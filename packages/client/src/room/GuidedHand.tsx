import { useState } from 'react';
import { describePairs, previewPlay } from '../game/playPreview';
import { cardLabel } from '../game/tableSnapshot';
import { GUIDED_HUZUR as HUZUR, GUIDED_STEPS } from '../game/guidedSteps';
import { Face } from './CardFace';
import { RoomDialog } from './RoomDialog';

/** An optional practice hand: four scripted moves checked with the shared rules. */
export function GuidedHand({
  close,
  finishLabel = 'Done',
}: {
  close: () => void;
  finishLabel?: string;
}) {
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
    ? step.done
    : nudge
      ? nudge
      : !preview
        ? step.goal === 'pickup'
          ? 'Try selecting a card, then pick up.'
          : 'Select a card.'
        : !preview.legal
          ? preview.reason
          : step.goal === 'pickup'
            ? 'That would not work here. Pick up instead.'
            : preview.kind === 'defense'
              ? describePairs(preview)
              : `Ready: ${picked.map(cardLabel).join(', ')}.`;
  return (
    <RoomDialog title={`Guided hand · ${index + 1} of ${GUIDED_STEPS.length}`} close={close}>
      <div className="guided-hand">
        <h3>{step.title}</h3>
        <p>{step.lesson}</p>
        {step.attacks.length > 0 && (
          <div className="guided-row" aria-label="Attacking cards">
            <small>To beat</small>
            {step.attacks.map((c) => (
              <Face key={c.key} card={c} />
            ))}
          </div>
        )}
        <div className="guided-row keyboard-hand" aria-label="Practice hand">
          {step.hand.map((c) => (
            <button
              key={c.key}
              className={selected.includes(c.key) ? 'hand-card selected' : 'hand-card'}
              aria-pressed={selected.includes(c.key)}
              aria-label={`Select ${cardLabel(c)}`}
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
              {last ? finishLabel : 'Next'}
            </button>
          ) : (
            <>
              {step.attacks.length > 0 && (
                <button
                  className="secondary-button"
                  onClick={() =>
                    step.goal === 'pickup'
                      ? setComplete(true)
                      : setNudge('You can beat this one. Try defending first.')
                  }
                >
                  Pick up
                </button>
              )}
              <button
                className="primary-button"
                disabled={!preview?.legal || step.goal === 'pickup'}
                onClick={() => setComplete(true)}
              >
                {step.attacks.length ? 'Defend' : 'Play cards'}
              </button>
            </>
          )}
        </div>
      </div>
    </RoomDialog>
  );
}
