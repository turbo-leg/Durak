import { cardFaceUrl } from '../game/cardArt';
import { cardLabel, type TableCard } from '../game/tableSnapshot';
import { RANKS, SUITS } from '../game/cardGlyphs';

/** An accessible 2D card face: local artwork over a readable generated fallback. */
export function Face({ card }: { card: TableCard }) {
  const artUrl = cardFaceUrl(card);
  return (
    <span
      role="img"
      aria-label={cardLabel(card)}
      className={`paper-card ${card.suit === 'Hearts' || card.suit === 'Diamonds' || card.rank === 18 ? 'red-ink' : ''}`}
    >
      <span className="card-corner">
        {RANKS[card.rank] || card.rank}
        <small>{SUITS[card.suit]}</small>
      </span>
      <span className="card-pip">{SUITS[card.suit]}</span>
      <span className="card-corner reverse">
        {RANKS[card.rank] || card.rank}
        <small>{SUITS[card.suit]}</small>
      </span>
      {artUrl && (
        <img
          className="card-art"
          key={artUrl}
          src={artUrl}
          alt=""
          draggable={false}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </span>
  );
}
