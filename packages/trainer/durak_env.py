"""
2-player Durak environment for RL training.

Card encoding (index 0-41):
  0-9   Spades   rank [7,8,9,10,J,Q,K,3,2,A]   (J=11,Q=12,K=13,A=16,3=14,2=15)
 10-19  Hearts
 20-29  Diamonds
 30-39  Clubs
 40     Black Joker
 41     Red Joker

Actions:
  0-41  play card at that index
  42    ACTION_PASS  (attacker commits staged / defender picks up)
  43    ACTION_SWAP  (huzur swap)

Observation vector (OBS_DIM = 176):
  [0:42]    my hand one-hot
  [42:84]   active (undefended) attacks one-hot
  [84:126]  table/defended pairs one-hot (both atk + def cards)
  [126:168] staged attack buffer one-hot
  [168:172] trump suit 4-bit one-hot (Spades,Hearts,Diamonds,Clubs)
  [172]     is_attacker float
  [173]     deck_size / 42
  [174]     opp_hand_size / 42
  [175]     staging_progress (len(staged) / 7)
"""

import random
from collections import Counter
from typing import List, Tuple, Optional

# ── Constants ────────────────────────────────────────────────────────────────

SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
# Ranks as stored in the TS engine (Ace=16, Three=14, Two=15)
RANKS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]

_SUIT_IDX = {s: i for i, s in enumerate(SUITS)}
_RANK_IDX = {r: i for i, r in enumerate(RANKS)}
_RANK_STRENGTH = {r: i for i, r in enumerate(RANKS)}  # 7=0 (weakest) ... Ace=9 (strongest)

ACTION_PASS = 42
ACTION_SWAP = 43
OBS_DIM = 176
ACTION_DIM = 44


# ── Card helpers ─────────────────────────────────────────────────────────────

def card_index(suit: str, rank: int, is_joker: bool = False) -> int:
    if is_joker:
        return 40 if rank == 17 else 41
    return _SUIT_IDX[suit] * 10 + _RANK_IDX[rank]


def idx_to_card(idx: int) -> Tuple[str, int, bool]:
    """Returns (suit, rank, is_joker)."""
    if idx == 40:
        return ('Spades', 17, True)
    if idx == 41:
        return ('Spades', 18, True)
    suit = SUITS[idx // 10]
    rank = RANKS[idx % 10]
    return (suit, rank, False)


def _rank_of(idx: int) -> int:
    return idx_to_card(idx)[1]


def _suit_of(idx: int) -> str:
    return idx_to_card(idx)[0]


def _is_joker(idx: int) -> bool:
    return idx >= 40


def can_defend(def_idx: int, atk_idx: int, trump_suit: int) -> bool:
    """True if def_idx can beat atk_idx given trump_suit index."""
    if _is_joker(def_idx):
        return True
    if _is_joker(atk_idx):
        return False
    def_suit = _suit_of(def_idx)
    atk_suit = _suit_of(atk_idx)
    trump_name = SUITS[trump_suit]
    if def_suit == atk_suit:
        return _RANK_STRENGTH[_rank_of(def_idx)] > _RANK_STRENGTH[_rank_of(atk_idx)]
    if def_suit == trump_name and atk_suit != trump_name:
        return True
    return False


def is_valid_mass_attack(cards: List[int], hand_sizes: List[int], deck_empty: bool) -> bool:
    """Port of DurakEngine.isValidMassAttack for 2-player."""
    n = len(cards)
    if n == 1:
        return True
    rank_counts = Counter(_rank_of(c) for c in cards)
    pairs = sum(1 for cnt in rank_counts.values() if cnt >= 2)
    min_hand = min(hand_sizes)
    if n == 3:
        return pairs >= 1 and min_hand >= 3
    if n == 5:
        return pairs >= 2 and deck_empty and min_hand >= 5
    if n == 7:
        return pairs >= 3 and deck_empty and min_hand >= 7
    return False


def _make_deck() -> List[int]:
    deck = list(range(42))
    random.shuffle(deck)
    return deck


# ── Environment ───────────────────────────────────────────────────────────────

class DurakEnv:
    TARGET_HAND = 5

    def reset(self) -> List[float]:
        deck = _make_deck()
        self.hands: List[List[int]] = [
            deck[:self.TARGET_HAND],
            deck[self.TARGET_HAND: self.TARGET_HAND * 2],
        ]
        self.deck: List[int] = deck[self.TARGET_HAND * 2:]
        huzur = self.deck[0] if self.deck else -1
        self.trump_suit: int = _SUIT_IDX[_suit_of(huzur)] if huzur >= 0 and not _is_joker(huzur) else 0

        self.attacker_seat: int = 0
        self.defender_seat: int = 1
        self.current_seat: int = 0

        self.active_attacks: List[int] = []
        self.defended_pairs: List[Tuple[int, int]] = []
        self.staged_attack: List[int] = []
        self._phase: str = 'attacking'

        self._done: bool = False
        self._winner: int = -1
        self._step_count: int = 0
        return self._observe()

    # ── Observation ──────────────────────────────────────────────────────────

    def _observe(self) -> List[float]:
        obs = [0.0] * OBS_DIM
        seat = self.current_seat
        opp = 1 - seat

        for c in self.hands[seat]:
            obs[c] = 1.0
        for c in self.active_attacks:
            obs[42 + c] = 1.0
        for atk, df in self.defended_pairs:
            obs[84 + atk] = 1.0
            obs[84 + df] = 1.0
        for c in self.staged_attack:
            obs[126 + c] = 1.0

        obs[168 + self.trump_suit] = 1.0
        obs[172] = 1.0 if seat == self.attacker_seat else 0.0
        obs[173] = len(self.deck) / 42.0
        obs[174] = len(self.hands[opp]) / 42.0
        obs[175] = len(self.staged_attack) / 7.0
        return obs

    # ── Legal actions ─────────────────────────────────────────────────────────

    def legal_actions(self, seat: Optional[int] = None) -> List[int]:
        if self._done:
            return [ACTION_PASS]
        seat = seat if seat is not None else self.current_seat
        hand = self.hands[seat]

        if self._phase == 'defending':
            legal = [c for c in hand if any(can_defend(c, a, self.trump_suit) for a in self.active_attacks)]
            legal.append(ACTION_PASS)
            return legal

        if self._phase == 'attacking':
            legal = list(hand)
            if self._can_swap(seat):
                legal.append(ACTION_SWAP)
            return legal if legal else [ACTION_PASS]

        # staging
        table_ranks: set = set()
        for c in self.active_attacks:
            table_ranks.add(_rank_of(c))
        for atk, df in self.defended_pairs:
            table_ranks.add(_rank_of(atk))
            table_ranks.add(_rank_of(df))
        for c in self.staged_attack:
            table_ranks.add(_rank_of(c))

        legal = [c for c in hand if _rank_of(c) in table_ranks]
        legal.append(ACTION_PASS)
        return legal

    def _can_swap(self, seat: int) -> bool:
        if not self.deck:
            return False
        trump_7 = card_index(SUITS[self.trump_suit], 7)
        return trump_7 in self.hands[seat]

    # ── Step ─────────────────────────────────────────────────────────────────

    def step(self, action: int) -> Tuple[List[float], float, bool, dict]:
        self._step_count += 1
        if self._done:
            return self._observe(), 0.0, True, {'winner_seat': self._winner, 'current_seat': self.current_seat}

        seat = self.current_seat
        hand = self.hands[seat]
        legal = self.legal_actions(seat)
        if action not in legal:
            action = legal[0]

        # ── Defending ────────────────────────────────────────────────────────
        if self._phase == 'defending':
            if action == ACTION_PASS:
                self.hands[seat] += self.active_attacks
                self.hands[seat] += [c for pair in self.defended_pairs for c in pair]
                self._end_round(pickup=True)
            else:
                atk = self._best_target(action)
                self.defended_pairs.append((atk, action))
                self.active_attacks.remove(atk)
                hand.remove(action)
                if not self.active_attacks:
                    self._end_round(pickup=False)
            return self._finish_step()

        # ── Attacking / Staging ───────────────────────────────────────────────
        if action == ACTION_SWAP:
            if self._can_swap(seat):
                trump_7 = card_index(SUITS[self.trump_suit], 7)
                hand.remove(trump_7)
                hand.append(self.deck[0])
                self.deck[0] = trump_7
            return self._finish_step()

        if action == ACTION_PASS:
            if self._phase == 'staging' and self.staged_attack:
                self._commit_attack()
            elif self._phase == 'attacking':
                pass  # no-op on empty attack phase
            return self._finish_step()

        # Play a card
        self.staged_attack.append(action)
        hand.remove(action)
        if self._phase == 'attacking':
            self._phase = 'staging'
        return self._finish_step()

    def _best_target(self, def_idx: int) -> int:
        candidates = [a for a in self.active_attacks if can_defend(def_idx, a, self.trump_suit)]
        trump_name = SUITS[self.trump_suit]
        def weight(a):
            s, r, j = idx_to_card(a)
            return (0 if j else (1 if s == trump_name else 2), _RANK_STRENGTH.get(r, 0))
        return min(candidates, key=weight)

    def _commit_attack(self):
        deck_empty = len(self.deck) == 0
        # hand sizes BEFORE staging (staged cards already removed from hand)
        hand_sizes = [len(h) + (len(self.staged_attack) if i == self.attacker_seat else 0)
                      for i, h in enumerate(self.hands)]

        if is_valid_mass_attack(self.staged_attack, hand_sizes, deck_empty):
            self.active_attacks = list(self.staged_attack)
        else:
            # Fallback: single-card attack
            fallback = self.staged_attack[0]
            for c in self.staged_attack[1:]:
                self.hands[self.attacker_seat].append(c)
            self.active_attacks = [fallback]

        self.staged_attack = []
        self._phase = 'defending'
        self.current_seat = self.defender_seat

    def _end_round(self, pickup: bool):
        self.active_attacks = []
        self.defended_pairs = []
        self.staged_attack = []

        # Replenish: attacker first
        for s in [self.attacker_seat, self.defender_seat]:
            while len(self.hands[s]) < self.TARGET_HAND and self.deck:
                self.hands[s].append(self.deck.pop())

        if not pickup:
            self.attacker_seat, self.defender_seat = self.defender_seat, self.attacker_seat

        self._phase = 'attacking'
        self.current_seat = self.attacker_seat
        self._check_terminal()

    def _check_terminal(self):
        if self.deck:
            return
        for seat in range(2):
            if len(self.hands[seat]) == 0:
                self._done = True
                self._winner = seat
                return

    def _finish_step(self) -> Tuple[List[float], float, bool, dict]:
        # Auto-commit if staging and no more cards can be added
        if self._phase == 'staging' and self.staged_attack:
            card_legal = [a for a in self.legal_actions(self.current_seat) if a < 42]
            if not card_legal:
                self._commit_attack()

        # Safety: prevent infinite loops — if stuck in attacking with no cards
        if self._phase == 'attacking' and not self.hands[self.current_seat]:
            self._check_terminal()
            if not self._done:
                # Force end round
                self._end_round(pickup=False)

        return self._observe(), 0.0, self._done, {
            'winner_seat': self._winner,
            'current_seat': self.current_seat,
        }
