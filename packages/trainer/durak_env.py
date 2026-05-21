"""
2-player Durak RL environment.

Card index encoding (42 cards total):
  0-9:   Spades   ranks [7,8,9,10,11,12,13,14,15,16]
  10-19: Hearts
  20-29: Diamonds
  30-39: Clubs
  40:    Black Joker (rank 17)
  41:    Red Joker   (rank 18)

Action space (ACTION_DIM = 44):
  0-41  : play card at deck slot i
  42    : ACTION_PASS  (attacker commits staged / defender picks up)
  43    : ACTION_SWAP  (swap huzur)

Observation space (OBS_DIM = 176):
  [0:42]    my hand (one-hot)
  [42:84]   active attacks (one-hot)
  [84:126]  table / defended pairs (one-hot)
  [126:168] staged attack buffer (one-hot)
  [168:172] trump suit one-hot (Spades, Hearts, Diamonds, Clubs)
  [172]     is_attacker (1/0)
  [173]     deck_size / 42
  [174]     opp_hand_size / 42
  [175]     staging_progress (len(staged) / 7)
"""

import random
from typing import Optional

OBS_DIM = 176
ACTION_DIM = 44
ACTION_PASS = 42
ACTION_SWAP = 43

SUITS = ["Spades", "Hearts", "Diamonds", "Clubs"]
RANKS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]  # 7 through Ace

# Build lookup tables at module load
_IDX_TO_CARD: list[tuple[str, int, bool]] = []
for s in SUITS:
    for r in RANKS:
        _IDX_TO_CARD.append((s, r, False))
_IDX_TO_CARD.append(("None", 17, True))   # Black Joker (idx 40)
_IDX_TO_CARD.append(("None", 18, True))   # Red Joker   (idx 41)

_CARD_TO_IDX: dict[tuple, int] = {card: i for i, card in enumerate(_IDX_TO_CARD)}


def card_to_idx(suit: str, rank: int, is_joker: bool) -> int:
    return _CARD_TO_IDX[(suit, rank, is_joker)]


def idx_to_card(i: int) -> tuple[str, int, bool]:
    return _IDX_TO_CARD[i]


def can_defend(def_idx: int, atk_idx: int, trump_suit_idx: int) -> bool:
    def_suit, def_rank, def_joker = idx_to_card(def_idx)
    atk_suit, atk_rank, atk_joker = idx_to_card(atk_idx)
    trump_suit = SUITS[trump_suit_idx]

    if def_joker:
        # Red joker (rank 18) beats black joker (rank 17); both beat non-jokers
        if atk_joker:
            return def_rank > atk_rank
        return True
    if atk_joker:
        return False

    # Non-joker defense
    if def_suit == atk_suit:
        return def_rank > atk_rank
    if def_suit == trump_suit and atk_suit != trump_suit:
        return True
    return False


def is_valid_mass_attack(
    staged: list[int],
    hand_sizes: list[int],
    deck_size: int,
    target_hand_size: int = 5,
) -> bool:
    n = len(staged)
    if n not in (3, 5, 7):
        return False
    for hs in hand_sizes:
        if hs < n:
            return False
    ranks: dict[int, int] = {}
    for idx in staged:
        _, rank, is_joker = idx_to_card(idx)
        if not is_joker:
            ranks[rank] = ranks.get(rank, 0) + 1
    pairs = sum(v // 2 for v in ranks.values())
    if n == 3:
        return pairs >= 1
    if n == 5:
        if target_hand_size != 7 and deck_size > 0:
            return False
        return pairs >= 2
    if n == 7:
        if target_hand_size != 7 or deck_size > 0:
            return False
        return pairs >= 3
    return False


def _build_full_deck() -> list[int]:
    deck = list(range(42))
    random.shuffle(deck)
    return deck


class DurakEnv:
    TARGET_HAND_SIZE = 5

    def __init__(self):
        self.hands: list[list[int]] = [[], []]
        self.deck: list[int] = []
        self.active_attacks: list[int] = []
        self.defended_pairs: list[tuple[int, int]] = []
        self.staged_attack: list[int] = []
        self.trump_suit_idx: int = 0
        self.attacker_seat: int = 0
        self.defender_seat: int = 1
        self.current_seat: int = 0
        self._phase: str = "attacking"
        self._done: bool = False
        self._winner_seat: int = -1

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def reset(self) -> list[float]:
        self.deck = _build_full_deck()
        huzur_idx = self.deck[0]
        huzur_suit, _, huzur_joker = idx_to_card(huzur_idx)
        if huzur_joker:
            self.trump_suit_idx = 0  # Black Joker → Spades
        else:
            self.trump_suit_idx = SUITS.index(huzur_suit)

        self.hands = [[], []]
        for _ in range(self.TARGET_HAND_SIZE):
            for seat in range(2):
                if self.deck:
                    self.hands[seat].append(self.deck.pop())

        self.active_attacks = []
        self.defended_pairs = []
        self.staged_attack = []
        self.attacker_seat = 0
        self.defender_seat = 1
        self.current_seat = 0
        self._phase = "attacking"
        self._done = False
        self._winner_seat = -1
        return self._obs(0)

    def legal_actions(self, seat: int) -> list[int]:
        if self._done:
            return []
        if self._phase == "attacking" or self._phase == "staging":
            return self._legal_attack_actions(seat)
        else:
            return self._legal_defense_actions(seat)

    def step(self, action: int) -> tuple[list[float], float, bool, dict]:
        assert not self._done, "Episode already done"
        if self._phase in ("attacking", "staging"):
            return self._step_attack(action)
        else:
            return self._step_defense(action)

    # ------------------------------------------------------------------
    # Internal step helpers
    # ------------------------------------------------------------------

    def _step_attack(self, action: int) -> tuple[list[float], float, bool, dict]:
        seat = self.current_seat

        if action == ACTION_SWAP:
            self._do_swap(seat)
            obs = self._obs(seat)
            return obs, 0.0, False, {}

        if action == ACTION_PASS:
            # Commit staged attack
            if not self.staged_attack:
                # No cards staged — skip to defense? Shouldn't happen in normal flow.
                return self._obs(seat), 0.0, False, {}
            # Validate as mass attack if more than 1 card staged
            if len(self.staged_attack) > 1:
                hand_sizes = [len(h) for h in self.hands]
                if not is_valid_mass_attack(
                    self.staged_attack, hand_sizes, len(self.deck), self.TARGET_HAND_SIZE
                ):
                    # Revert to single card attack
                    single = self.staged_attack[0]
                    self.staged_attack = []
                    self.active_attacks = [single]
                else:
                    self.active_attacks = list(self.staged_attack)
                    self.staged_attack = []
            else:
                self.active_attacks = list(self.staged_attack)
                self.staged_attack = []
            self._phase = "defending"
            self.current_seat = self.defender_seat
            obs = self._obs(self.current_seat)
            return obs, 0.0, False, {}

        # Play a card
        card_idx = action
        assert card_idx in self.hands[seat], f"Card {card_idx} not in hand of seat {seat}"
        self.hands[seat].remove(card_idx)

        if self._phase == "attacking":
            # First card of the round — start staging
            self.staged_attack.append(card_idx)
            self._phase = "staging"
        elif self._phase == "staging":
            self.staged_attack.append(card_idx)

        # Check if attacker is now out of cards (edge case)
        obs, done, info = self._check_win_condition()
        return obs, 0.0, done, info

    def _step_defense(self, action: int) -> tuple[list[float], float, bool, dict]:
        seat = self.current_seat  # defender seat

        if action == ACTION_PASS:
            # Defender picks up all cards
            pickup_cards = list(self.active_attacks)
            for atk, dfn in self.defended_pairs:
                pickup_cards.append(atk)
                pickup_cards.append(dfn)
            self.hands[seat].extend(pickup_cards)
            self._end_round(pickup=True)
            obs, done, info = self._check_win_condition()
            return obs, 0.0, done, info

        # Defender plays a card — must beat one undefended active attack
        def_idx = action
        assert def_idx in self.hands[seat], f"Defense card {def_idx} not in hand"

        # Find first undefended attack it can beat
        already_defended = {atk for atk, _ in self.defended_pairs}
        undefended = [a for a in self.active_attacks if a not in already_defended]
        chosen_atk = None
        for atk in undefended:
            if can_defend(def_idx, atk, self.trump_suit_idx):
                chosen_atk = atk
                break
        assert chosen_atk is not None, f"Defense card {def_idx} cannot beat any active attack"

        self.hands[seat].remove(def_idx)
        self.defended_pairs.append((chosen_atk, def_idx))

        # Check if all attacks are now defended
        already_defended_after = {atk for atk, _ in self.defended_pairs}
        if all(a in already_defended_after for a in self.active_attacks):
            self._end_round(pickup=False)

        obs, done, info = self._check_win_condition()
        return obs, 0.0, done, info

    # ------------------------------------------------------------------
    # Round management
    # ------------------------------------------------------------------

    def _end_round(self, pickup: bool) -> None:
        if pickup:
            # Defender already received cards in _step_defense
            # Replenish attacker only
            self._replenish(self.attacker_seat)
            # Same attacker next round
        else:
            # Successful defense — discard everything (already removed from hands)
            self._replenish(self.attacker_seat)
            self._replenish(self.defender_seat)
            # Defender becomes new attacker
            self.attacker_seat, self.defender_seat = self.defender_seat, self.attacker_seat

        self.active_attacks = []
        self.defended_pairs = []
        self.staged_attack = []
        self._phase = "attacking"
        self.current_seat = self.attacker_seat

    def _replenish(self, seat: int) -> None:
        needed = self.TARGET_HAND_SIZE - len(self.hands[seat])
        while needed > 0 and self.deck:
            self.hands[seat].append(self.deck.pop())
            needed -= 1

    # ------------------------------------------------------------------
    # Win condition
    # ------------------------------------------------------------------

    def _check_win_condition(self) -> tuple[list[float], bool, dict]:
        if len(self.deck) > 0:
            return self._obs(self.current_seat), False, {}

        # Deck empty — check if either player is out of cards
        for seat in range(2):
            if len(self.hands[seat]) == 0 and self._phase in ("attacking", "staging"):
                self._done = True
                self._winner_seat = seat
                return self._obs(seat), True, {"winner_seat": seat}

        # During defending: defender ran out mid-round → they win if they defended all
        if self._phase == "defending":
            defender = self.defender_seat
            if len(self.hands[defender]) == 0:
                already_defended = {atk for atk, _ in self.defended_pairs}
                all_defended = all(a in already_defended for a in self.active_attacks)
                if all_defended:
                    self._end_round(pickup=False)
                    self._done = True
                    self._winner_seat = defender
                    return self._obs(self.current_seat), True, {"winner_seat": defender}

        return self._obs(self.current_seat), False, {}

    # ------------------------------------------------------------------
    # Legal action generators
    # ------------------------------------------------------------------

    def _legal_attack_actions(self, seat: int) -> list[int]:
        actions: list[int] = []
        hand = self.hands[seat]

        if self._phase == "attacking":
            # Any card from hand is a legal first card
            actions.extend(hand)
        elif self._phase == "staging":
            # Cards matching a rank already on active_attacks or in staged_attack
            played_ranks: set[int] = set()
            for idx in self.active_attacks + self.staged_attack:
                _, rank, is_joker = idx_to_card(idx)
                if not is_joker:
                    played_ranks.add(rank)
            for idx in hand:
                _, rank, is_joker = idx_to_card(idx)
                if is_joker or rank in played_ranks:
                    actions.append(idx)
            # Always allow committing
            actions.append(ACTION_PASS)

        # Huzur swap eligibility
        if self._can_swap(seat):
            actions.append(ACTION_SWAP)

        return actions

    def _legal_defense_actions(self, seat: int) -> list[int]:
        actions: list[int] = []
        hand = self.hands[seat]
        already_defended = {atk for atk, _ in self.defended_pairs}
        undefended = [a for a in self.active_attacks if a not in already_defended]

        for def_idx in hand:
            for atk_idx in undefended:
                if can_defend(def_idx, atk_idx, self.trump_suit_idx):
                    actions.append(def_idx)
                    break  # only add each defense card once

        actions.append(ACTION_PASS)  # always legal to pick up
        return actions

    # ------------------------------------------------------------------
    # Huzur swap
    # ------------------------------------------------------------------

    def _can_swap(self, seat: int) -> bool:
        if not self.deck:
            return False
        huzur_idx = self.deck[0]
        _, huzur_rank, huzur_joker = idx_to_card(huzur_idx)
        if huzur_joker:
            # Need Ace of Spades
            target = card_to_idx("Spades", 16, False)
        else:
            trump_suit = SUITS[self.trump_suit_idx]
            target = card_to_idx(trump_suit, 7, False)
        return target in self.hands[seat]

    def _do_swap(self, seat: int) -> None:
        if not self._can_swap(seat):
            return
        huzur_idx = self.deck[0]
        _, huzur_rank, huzur_joker = idx_to_card(huzur_idx)
        if huzur_joker:
            swap_card = card_to_idx("Spades", 16, False)
        else:
            trump_suit = SUITS[self.trump_suit_idx]
            swap_card = card_to_idx(trump_suit, 7, False)
        hand = self.hands[seat]
        hand.remove(swap_card)
        hand.append(huzur_idx)
        self.deck[0] = swap_card
        # Update trump suit in case huzur was joker
        new_huzur_suit, _, new_huzur_joker = idx_to_card(swap_card)
        if not new_huzur_joker:
            self.trump_suit_idx = SUITS.index(new_huzur_suit)

    # ------------------------------------------------------------------
    # Observation builder
    # ------------------------------------------------------------------

    def _obs(self, seat: int) -> list[float]:
        obs = [0.0] * OBS_DIM
        # [0:42] my hand
        for idx in self.hands[seat]:
            obs[idx] = 1.0
        # [42:84] active attacks
        for idx in self.active_attacks:
            obs[42 + idx] = 1.0
        # [84:126] table (defended pairs — both atk and def cards)
        for atk, dfn in self.defended_pairs:
            obs[84 + atk] = 1.0
            obs[84 + dfn] = 1.0
        # [126:168] staged attack buffer
        for idx in self.staged_attack:
            obs[126 + idx] = 1.0
        # [168:172] trump suit one-hot
        obs[168 + self.trump_suit_idx] = 1.0
        # [172] is_attacker
        obs[172] = 1.0 if seat == self.attacker_seat else 0.0
        # [173] deck_size / 42
        obs[173] = len(self.deck) / 42.0
        # [174] opp_hand_size / 42
        opp = 1 - seat
        obs[174] = len(self.hands[opp]) / 42.0
        # [175] staging_progress
        obs[175] = len(self.staged_attack) / 7.0
        return obs
