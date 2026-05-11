import { useEffect, useRef, useCallback } from 'react';

export const useAudio = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const initAudio = () => {
      if (!audioCtxRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };

    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });

    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
  }, []);

  const getCtx = useCallback((): AudioContext | null => {
    if (!audioCtxRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const playNoise = useCallback(
    (
      filterFreq: number,
      duration: number,
      gainPeak: number,
      filterType: BiquadFilterType = 'highpass',
    ) => {
      const ctx = getCtx();
      if (!ctx) return;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize;
        const env = Math.max(0, 1 - t * t * 6);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainPeak, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    },
    [getCtx],
  );

  const playTone = useCallback(
    (
      freq: number,
      startTime: number,
      duration: number,
      gainPeak: number,
      type: OscillatorType = 'sine',
    ) => {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    },
    [getCtx],
  );

  // Card dealt / drawn from deck — crisp paper snap
  const playDealSound = useCallback(() => {
    playNoise(1200, 0.15, 1.5, 'highpass');
  }, [playNoise]);

  // Card played to the table (attack or defend) — sharper, higher-pitched snap
  const playCardSound = useCallback(() => {
    playNoise(2200, 0.08, 1.8, 'highpass');
  }, [playNoise]);

  // Cards picked up — low shuffle rumble
  const playPickupSound = useCallback(() => {
    playNoise(350, 0.28, 1.2, 'lowpass');
  }, [playNoise]);

  // Timer warning beep when < 5 s remaining — single sharp tone
  const playTimerWarning = useCallback(() => {
    playTone(880, 0, 0.12, 0.4);
  }, [playTone]);

  // Victory jingle — ascending C-E-G-C arpeggio
  const playVictorySound = useCallback(() => {
    [
      [523, 0],
      [659, 0.15],
      [784, 0.3],
      [1047, 0.45],
    ].forEach(([freq, t]) => playTone(freq, t, 0.35, 0.35, 'triangle'));
  }, [playTone]);

  // Defeat jingle — descending C-A-F-C
  const playDefeatSound = useCallback(() => {
    [
      [523, 0],
      [440, 0.18],
      [349, 0.36],
      [262, 0.54],
    ].forEach(([freq, t]) => playTone(freq, t, 0.38, 0.3, 'sine'));
  }, [playTone]);

  return {
    playDealSound,
    playCardSound,
    playPickupSound,
    playTimerWarning,
    playVictorySound,
    playDefeatSound,
  };
};
