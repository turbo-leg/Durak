import { useState } from 'react';
import { describePairs, previewPlay } from '../game/playPreview';
import { cardLabel } from '../game/tableSnapshot';
import { GUIDED_HUZUR as HUZUR, GUIDED_STEPS } from '../game/guidedSteps';
import { Face } from './CardFace';
import { RoomDialog } from './RoomDialog';
import { t } from '../i18n';

/** An optional practice hand: four scripted moves checked with the shared rules. */
export function GuidedHand({ close, finishLabel }: { close: () => void; finishLabel?: string }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);
  const [nudge, setNudge] = useState('');
  const step = GUIDED_STEPS[index]!;
  const last = index === GUIDED_STEPS.length - 1;
  const picked = step.hand.filter((c) => selected.includes(c.key));
  const preview = previewPlay(picked, {
    attacks: step.attacks,
    table: [],
    huzurSuit: HUZUR,
    handCounts: [step.hand.length, 5],
    deckCount: 20,
    targetHandSize: 5,
  });
  const next = () => {
    setComplete(false);
    setSelected([]);
    setNudge('');
    if (last) close();
    else setIndex(index + 1);
  };
  const toggle = (key: string) => {
    setNudge('');
    setSelected((old) => (old.includes(key) ? old.filter((k) => k !== key) : [...old, key]));
  };
  const hint = complete
    ? t(step.done)
    : nudge
      ? nudge
      : !preview
        ? step.goal === 'pickup'
          ? t('Try selecting a card, then pick up.')
          : t('Select a card.')
        : !preview.legal
          ? preview.reason
          : step.goal === 'pickup'
            ? t('That would not work here. Pick up instead.')
            : preview.kind === 'defense'
              ? describePairs(preview)
              : t('Ready: {cards}.', { cards: picked.map(cardLabel).join(', ') });
  return (
    <RoomDialog
      title={t('Guided hand, {n} of {total}', { n: index + 1, total: GUIDED_STEPS.length })}
      close={close}
    >
      <div className="guided-hand">
        <h3>{t(step.title)}</h3>
        <p>{t(step.lesson)}</p>
        {step.attacks.length > 0 && (
          <div className="guided-row" aria-label={t('Attacking cards')}>
            <small>{t('To beat')}</small>
            {step.attacks.map((c) => (
              <Face key={c.key} card={c} />
            ))}
          </div>
        )}
        <div className="guided-row keyboard-hand" aria-label={t('Practice hand')}>
          {step.hand.map((c) => (
            <button
              key={c.key}
              className={selected.includes(c.key) ? 'hand-card selected' : 'hand-card'}
              aria-pressed={selected.includes(c.key)}
              aria-label={t('Select {card}', { card: cardLabel(c) })}
              disabled={complete}
              onClick={() => toggle(c.key)}
            >
              <Face card={c} />
            </button>
          ))}
        </div>
        <p className="guided-hint" role="status">
          {hint}
        </p>
        <div className="dialog-actions">
          {complete ? (
            <button className="primary-button" onClick={next}>
              {last ? (finishLabel ?? t('Done')) : t('Next')}
            </button>
          ) : (
            <>
              {step.attacks.length > 0 && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    step.goal === 'pickup'
                      ? setComplete(true)
                      : setNudge(t('You can beat this one. Try defending first.'))
                  }
                >
                  {t('Pick up')}
                </button>
              )}
              <button
                className="primary-button"
                disabled={!preview?.legal || step.goal === 'pickup'}
                onClick={() => setComplete(true)}
              >
                {step.attacks.length ? t('Defend') : t('Play cards')}
              </button>
            </>
          )}
        </div>
      </div>
    </RoomDialog>
  );
}
