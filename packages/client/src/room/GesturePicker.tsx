import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import {
  GESTURES,
  GESTURE_COOLDOWN_MS,
  gestureLabel,
  gestureWeight,
  type GestureId,
  type PublicGesture,
} from '@durak/shared';
import { t } from '../i18n';
import type { TableSeat } from '../game/tableSnapshot';

const GesturePreview = lazy(() => import('../components/three/GesturePreview'));

export function GesturePicker({
  self,
  seats,
  now,
  offset,
  enabled,
  send,
  preview = false,
}: {
  self: PublicGesture & { preset: string };
  seats: readonly TableSeat[];
  now: number;
  offset: number;
  enabled: boolean;
  send: (id: GestureId) => void;
  preview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const remaining = Math.max(
    0,
    Math.ceil(((self.gestureStartedAt || 0) + GESTURE_COOLDOWN_MS - now - offset) / 1000),
  );
  const active = [
    ...(gestureWeight(self, now + offset)
      ? [`${t('You')}: ${t(gestureLabel(self.gestureId || ''))}`]
      : []),
    ...seats
      .filter((seat) => gestureWeight(seat, now + offset))
      .map((seat) => `${seat.name}: ${t(gestureLabel(seat.gestureId || ''))}`),
  ].join('. ');
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !host.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    host.current
      ?.querySelector<HTMLButtonElement>('.gesture-options button:not(:disabled)')
      ?.focus();
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div
      className="gesture-picker"
      ref={host}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <span className="gesture-announcement" role="status" aria-live="polite">
        {active}
      </span>
      <button
        ref={trigger}
        className="quiet-button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {t('Gestures')}
      </button>
      {open && (
        <section id={id} className="gesture-popover" aria-label={t('Public gestures')}>
          <div className="gesture-heading">
            <strong>{t('A little expression.')}</strong>
            <button
              className="quiet-button"
              aria-label={t('Close gestures')}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              ×
            </button>
          </div>
          <p>
            {preview
              ? t('Try a gesture before taking a seat.')
              : t('Visible to everyone at the table.')}
          </p>
          <div className="gesture-body">
            <Suspense fallback={<span className="gesture-preview">{t('Loading character…')}</span>}>
              <GesturePreview gesture={self} offset={offset} preset={self.preset} />
            </Suspense>
            <div className="gesture-options">
              {GESTURES.map((gesture) => (
                <button
                  type="button"
                  key={gesture.id}
                  aria-pressed={Boolean(
                    gestureWeight(self, now + offset) && self.gestureId === gesture.id,
                  )}
                  disabled={!enabled || remaining > 0}
                  onClick={() => send(gesture.id)}
                >
                  {t(gesture.label)}
                </button>
              ))}
            </div>
          </div>
          <p className="gesture-note">
            {!enabled
              ? t('Available when seated, between deals or during play.')
              : remaining
                ? t('Another gesture in {n}s.', { n: remaining })
                : t('Your other hand keeps the cards.')}
          </p>
        </section>
      )}
    </div>
  );
}
