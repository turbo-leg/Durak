import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

// A scroll container that replaces the native rubber-band with a custom, spring-damped
// overscroll: the content pulls with diminishing resistance and a gold diamond emblem
// glints in the gap, then springs back on release. Touch-only; desktop uses native scroll.

const MAX = 90; // px — cap of the rubber-band travel
const rubber = (d: number) => {
  const sign = Math.sign(d);
  return sign * MAX * (1 - Math.exp(-Math.abs(d) / MAX));
};

export const SpringScroll: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}> = ({ children, style, className }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);

  // Emblem reveal driven directly off the overscroll offset (no React re-renders mid-gesture).
  const topOpacity = useTransform(y, [4, 60], [0, 1]);
  const topScale = useTransform(y, [0, 80], [0.5, 1]);
  const topRotate = useTransform(y, [0, 110], [-40, 0]);
  const botOpacity = useTransform(y, [-4, -60], [0, 1]);
  const botScale = useTransform(y, [0, -80], [0.5, 1]);
  const botRotate = useTransform(y, [0, -110], [40, 0]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let startY = 0;
    let active = false;

    const onStart = (e: TouchEvent) => {
      startY = e.touches[0]!.clientY;
      active = false;
    };

    const onMove = (e: TouchEvent) => {
      const delta = e.touches[0]!.clientY - startY;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      if ((atTop && delta > 0) || (atBottom && delta < 0)) {
        active = true;
        y.set(rubber(delta));
        e.preventDefault(); // suppress the native bounce; we own the overscroll
      } else if (active) {
        active = false;
        y.set(0);
      }
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      animate(y, 0, { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 });
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [y]);

  const emblem = (
    pos: 'top' | 'bottom',
    opacity: typeof topOpacity,
    scale: typeof topScale,
    rotate: typeof topRotate,
  ) => (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        [pos]: 18,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 0,
        opacity,
      }}
    >
      <motion.span
        style={{
          scale,
          rotate,
          fontSize: 26,
          color: '#f4d774',
          textShadow: '0 0 16px rgba(212,175,55,0.8), 0 0 4px rgba(212,175,55,0.6)',
        }}
      >
        ♦
      </motion.span>
    </motion.div>
  );

  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {emblem('top', topOpacity, topScale, topRotate)}
      {emblem('bottom', botOpacity, botScale, botRotate)}
      <div
        ref={scrollRef}
        className={className}
        style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'contain' }}
      >
        <motion.div style={{ y, minHeight: '100%' }}>{children}</motion.div>
      </div>
    </div>
  );
};
