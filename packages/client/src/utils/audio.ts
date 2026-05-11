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

  // Shared compressor keeps everything from clipping and adds warmth
  const getCompressor = useCallback((ctx: AudioContext): DynamicsCompressorNode => {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    comp.connect(ctx.destination);
    return comp;
  }, []);

  // Soft bandpass noise — more of a gentle thud/rustle than a harsh snap
  const playNoise = useCallback(
    (centerFreq: number, duration: number, gainPeak: number) => {
      const ctx = getCtx();
      if (!ctx) return;
      const comp = getCompressor(ctx);
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize;
        // Smooth bell-curve envelope: quick rise, gentle fall
        const env = Math.sin(t * Math.PI) * Math.exp(-t * 5);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(centerFreq, ctx.currentTime);
      filter.Q.value = 1.2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainPeak, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(comp);
      src.start();
    },
    [getCtx, getCompressor],
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
      const comp = getCompressor(ctx);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      osc.connect(gain);
      gain.connect(comp);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    },
    [getCtx, getCompressor],
  );

  // Card dealt — soft papery rustle
  const playDealSound = useCallback(() => {
    playNoise(800, 0.18, 0.35);
  }, [playNoise]);

  // Card played to the table — gentle tap
  const playCardSound = useCallback(() => {
    playNoise(600, 0.12, 0.3);
  }, [playNoise]);

  // Cards picked up — soft low whoosh
  const playPickupSound = useCallback(() => {
    playNoise(280, 0.22, 0.25);
  }, [playNoise]);

  // Timer warning — muted soft chime, not a harsh beep
  const playTimerWarning = useCallback(() => {
    playTone(660, 0, 0.2, 0.15, 'sine');
  }, [playTone]);

  // Victory — gentle ascending C-E-G-C, sine for warmth
  const playVictorySound = useCallback(() => {
    [
      [523, 0],
      [659, 0.16],
      [784, 0.32],
      [1047, 0.48],
    ].forEach(([freq, t]) => playTone(freq, t, 0.4, 0.18, 'sine'));
  }, [playTone]);

  // Defeat — soft descending C-A-F-C
  const playDefeatSound = useCallback(() => {
    [
      [523, 0],
      [440, 0.2],
      [349, 0.4],
      [262, 0.6],
    ].forEach(([freq, t]) => playTone(freq, t, 0.42, 0.14, 'sine'));
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
