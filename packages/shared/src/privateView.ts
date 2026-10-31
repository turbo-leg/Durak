import type { Player } from './state/Player';

export interface PrivateCard {
  suit: string;
  rank: number;
  isJoker: boolean;
}

/** What only a seat's owner may see, sent as a 'private' message instead of filtered state. */
export interface PrivateView {
  hand: PrivateCard[];
  pickedUpCardKeys: string[];
}

export const EMPTY_PRIVATE_VIEW: PrivateView = { hand: [], pickedUpCardKeys: [] };

export function privateView(player: Player): PrivateView {
  return {
    hand: Array.from(player.hand)
      .filter((card): card is NonNullable<typeof card> => !!card)
      .map(({ suit, rank, isJoker }) => ({ suit, rank, isJoker })),
    pickedUpCardKeys: Array.from(player.pickedUpCardKeys).filter((key): key is string => !!key),
  };
}
