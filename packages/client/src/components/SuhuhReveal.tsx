import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card as UICard } from './Card';
import { Card as SharedCard } from '@durak/shared';
import type { Player } from '@durak/shared';
import type { SuhuhDraw } from '../contexts/GameContext';

interface SuhuhRevealProps {
  draws: SuhuhDraw[];
  winnerId: string;
  players: Map<string, Player>;
  seatOrder: string[];
  onDone: () => void;
}

type Phase = 'drawing' | 'drawn' | 'revealing' | 'highlighting' | 'exiting';

const CardBack: React.FC = () => (
  <div className="w-full h-full rounded-lg border-2 border-blue-400 bg-blue-800 flex items-center justify-center shadow-lg select-none">
    <div className="w-[calc(100%-10px)] h-[calc(100%-10px)] rounded border border-blue-300/40 bg-blue-900 flex items-center justify-center">
      <span className="text-blue-300 text-3xl">♦</span>
    </div>
  </div>
);

interface FlipCardProps {
  draw: SuhuhDraw;
  revealed: boolean;
  highlighted: boolean;
  entryDelay: number;
}

const FlipCard: React.FC<FlipCardProps> = ({ draw, revealed, highlighted, entryDelay }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), entryDelay);
    return () => clearTimeout(t);
  }, [entryDelay]);

  const card = new SharedCard(draw.suit, draw.rank, draw.isJoker);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -70 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
          style={{ perspective: '700px', width: 80, height: 112 }}
        >
          <motion.div
            animate={{ rotateY: revealed ? 180 : 0 }}
            transition={{ duration: 0.55, ease: 'easeInOut' }}
            style={{
              transformStyle: 'preserve-3d',
              position: 'relative',
              width: '100%',
              height: '100%',
            }}
            className={highlighted ? 'drop-shadow-[0_0_20px_rgba(250,204,21,0.95)]' : ''}
          >
            {/* Back face */}
            <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}>
              <CardBack />
            </div>
            {/* Front face */}
            <div
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                position: 'absolute',
                inset: 0,
              }}
            >
              <UICard card={card} className="!w-full !h-full" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const SuhuhReveal: React.FC<SuhuhRevealProps> = ({
  draws,
  winnerId,
  players,
  seatOrder,
  onDone,
}) => {
  const [phase, setPhase] = useState<Phase>('drawing');

  // Sort draws into seat order; players who didn't draw (teams mode) are omitted
  const orderedDraws = seatOrder
    .map((id) => draws.find((d) => d.playerId === id))
    .filter((d): d is SuhuhDraw => d !== undefined);

  useEffect(() => {
    const lastCardAt = orderedDraws.length * 350 + 300;

    const t1 = setTimeout(() => setPhase('drawn'), lastCardAt + 300);
    const t2 = setTimeout(() => setPhase('revealing'), lastCardAt + 1100);
    const t3 = setTimeout(() => setPhase('highlighting'), lastCardAt + 1800);
    const t4 = setTimeout(() => setPhase('exiting'), lastCardAt + 3900);
    const t5 = setTimeout(onDone, lastCardAt + 4400);

    return () => [t1, t2, t3, t4, t5].forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const revealed = phase === 'revealing' || phase === 'highlighting';
  const winnerPlayer = players.get(winnerId);

  return (
    <AnimatePresence>
      {phase !== 'exiting' && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Title */}
          <motion.h2
            className="text-xl font-bold tracking-widest uppercase mb-8"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {phase === 'highlighting' ? (
              <span className="text-yellow-300">
                {winnerPlayer?.username || winnerId} goes first!
              </span>
            ) : (
              <span className="text-white/70">Drawing for first attacker…</span>
            )}
          </motion.h2>

          {/* Player slots */}
          <div className="flex flex-wrap gap-8 justify-center max-w-3xl px-4">
            {orderedDraws.map((draw, i) => {
              const player = players.get(draw.playerId);
              const isWinner = draw.playerId === winnerId;
              const highlighted = phase === 'highlighting' && isWinner;

              return (
                <motion.div
                  key={draw.playerId}
                  className="flex flex-col items-center gap-3"
                  animate={highlighted ? { scale: 1.12 } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Avatar + name */}
                  <div className="flex flex-col items-center gap-1">
                    {player?.avatarUrl ? (
                      <img
                        src={player.avatarUrl}
                        alt={player.username}
                        className={`w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                          highlighted
                            ? 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.7)]'
                            : 'border-white/30'
                        }`}
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full bg-green-700 flex items-center justify-center text-white font-bold text-sm border-2 transition-all duration-300 ${
                          highlighted ? 'border-yellow-400' : 'border-white/20'
                        }`}
                      >
                        {(player?.username || draw.playerId).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span
                      className={`text-sm font-medium transition-colors duration-300 ${
                        highlighted ? 'text-yellow-300 font-bold' : 'text-white/70'
                      }`}
                    >
                      {player?.username || draw.playerId.slice(0, 8)}
                    </span>
                  </div>

                  {/* Card flip */}
                  <FlipCard
                    draw={draw}
                    revealed={revealed}
                    highlighted={highlighted}
                    entryDelay={300 + i * 350}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* "Highest card wins" subtitle during highlight */}
          <AnimatePresence>
            {phase === 'highlighting' && (
              <motion.p
                className="mt-8 text-green-400 text-sm tracking-wide"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                ♦ Highest card wins ♦
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
