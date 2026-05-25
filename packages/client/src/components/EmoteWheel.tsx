import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Room } from 'colyseus.js';
import type { GameState } from '@durak/shared';

const EMOTES = ['😂', '🤝', '🔥', '👏', '😤', '🎉'];

interface Props {
  room: Room<GameState> | null;
}

export const EmoteWheel: React.FC<Props> = ({ room }) => {
  const [open, setOpen] = useState(false);

  const sendEmote = (emoteId: string) => {
    room?.send('emote', { emoteId });
    setOpen(false);
  };

  return (
    <div className="relative flex items-end justify-end">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-12 right-0 grid grid-cols-3 gap-2 bg-indigo-900/90 border border-indigo-600 rounded-xl p-3 shadow-xl"
          >
            {EMOTES.map((emote) => (
              <button
                key={emote}
                onClick={() => sendEmote(emote)}
                className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg hover:bg-indigo-700 active:scale-90 transition"
              >
                {emote}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-11 h-11 rounded-full bg-indigo-700/80 hover:bg-indigo-600 border border-indigo-500 text-xl flex items-center justify-center shadow-lg transition active:scale-90"
        aria-label="Emote wheel"
      >
        😊
      </button>
    </div>
  );
};
