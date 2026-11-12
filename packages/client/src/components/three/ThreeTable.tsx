import { useEffect, useRef } from 'react';
import { TableRenderer } from './TableRenderer';
import { cardLabel, type TableCard, type TableSnapshot } from '../../game/tableSnapshot';

interface Props {
  snapshot: TableSnapshot;
  selectedKeys: string;
  defensePairs?: readonly { attack: TableCard; defense: TableCard }[];
  backUrl: string | null;
  onSelect: (key: string) => void;
  onUnavailable: () => void;
  onLook?: (yaw: number, pitch: number) => void;
  recenterKey?: number;
  /** Phones: a 2D row is the hand, so cards resting in the 3D hand are not drawn. */
  restingHandHidden?: boolean;
  /** Which cards of your hand have landed in it; a card still flying in is not listed. */
  onHandLanded?: (keys: string[]) => void;
}

export default function ThreeTable({
  snapshot,
  selectedKeys,
  defensePairs,
  backUrl,
  onSelect,
  onUnavailable,
  onLook,
  recenterKey = 0,
  restingHandHidden = false,
  onHandLanded,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<TableRenderer | null>(null);
  const latest = useRef({
    snapshot,
    selectedKeys,
    defensePairs,
    onSelect,
    onUnavailable,
    onLook,
    restingHandHidden,
    onHandLanded,
  });
  useEffect(() => {
    latest.current = {
      snapshot,
      selectedKeys,
      defensePairs,
      onSelect,
      onUnavailable,
      onLook,
      restingHandHidden,
      onHandLanded,
    };
  });
  useEffect(() => {
    if (!host.current) return;
    try {
      const table = new TableRenderer(
        host.current,
        (key) => latest.current.onSelect(key),
        () => latest.current.onUnavailable(),
        backUrl,
        (yaw, pitch) => latest.current.onLook?.(yaw, pitch),
      );
      renderer.current = table;
      table.onHandLanded = (keys) => latest.current.onHandLanded?.(keys);
      table.setRestingHandHidden(latest.current.restingHandHidden);
      table.update(
        latest.current.snapshot,
        new Set(latest.current.selectedKeys.split('|')),
        latest.current.defensePairs,
      );
      return () => {
        renderer.current = null;
        table.dispose();
      };
    } catch {
      latest.current.onUnavailable();
    }
  }, [backUrl]);
  // The signature changes only on meaningful schema changes, not HUD timer frames.
  useEffect(() => {
    renderer.current?.update(
      latest.current.snapshot,
      new Set(selectedKeys.split('|')),
      latest.current.defensePairs,
    );
  }, [snapshot.signature, selectedKeys]);
  useEffect(() => {
    renderer.current?.recenter();
  }, [recenterKey]);
  useEffect(() => {
    renderer.current?.setRestingHandHidden(restingHandHidden);
  }, [restingHandHidden]);
  return (
    <>
      <div ref={host} className="absolute inset-0" data-testid="three-table" />
      <section className="sr-only" aria-label="Table state" aria-live="polite">
        <p>
          {snapshot.deckCount} cards in the deck. {snapshot.discardCount} discarded.
        </p>
        <ul aria-label="Incoming attack">
          {snapshot.attacks.map((card) => (
            <li key={card.key}>{cardLabel(card)}</li>
          ))}
        </ul>
        <ul aria-label="Players at the table">
          {snapshot.seats.map((seat) => (
            <li key={seat.id}>
              {seat.name}: {seat.escaped ? 'escaped' : `${seat.count} cards`}
              {seat.active ? ', their turn' : ''}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
