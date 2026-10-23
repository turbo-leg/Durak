import { useEffect, useRef } from 'react';
import { TableRenderer } from './TableRenderer';
import { cardLabel, type TableSnapshot } from '../../game/tableSnapshot';

interface Props {
  snapshot: TableSnapshot;
  selectedKeys: string;
  backUrl: string | null;
  onSelect: (key: string) => void;
  onUnavailable: () => void;
  onLook?: (yaw: number, pitch: number) => void;
  recenterKey?: number;
}

export default function ThreeTable({
  snapshot,
  selectedKeys,
  backUrl,
  onSelect,
  onUnavailable,
  onLook,
  recenterKey = 0,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<TableRenderer | null>(null);
  const latest = useRef({ snapshot, selectedKeys, onSelect, onUnavailable, onLook });
  useEffect(() => {
    latest.current = { snapshot, selectedKeys, onSelect, onUnavailable, onLook };
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
      table.update(latest.current.snapshot, new Set(latest.current.selectedKeys.split('|')));
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
    renderer.current?.update(latest.current.snapshot, new Set(selectedKeys.split('|')));
  }, [snapshot.signature, selectedKeys]);
  useEffect(() => {
    renderer.current?.recenter();
  }, [recenterKey]);
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
