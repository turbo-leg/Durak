import { useEffect, useRef, useCallback } from 'react';

export const useAudio = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Initialize AudioContext on first user interaction if possible, or just hold the ref.
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

  const playDealSound = useCallback(() => {
    if (!audioCtxRef.current) {
       // Best effort fallback instantiation
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Some browsers block if not resumed via user gesture
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    const ctx = audioCtxRef.current;
    
    // Create an empty, short buffer (0.15 seconds of noise)
    const duration = 0.15;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Fill buffer with white noise, fading out very quickly
    for (let i = 0; i < bufferSize; i++) {
        // Simple envelope multiplier for crisp snap vs swoosh
        const t = i / bufferSize;
        const envelope = Math.max(0, 1 - (t * t * t * 5)); // sharp decay
        data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // Filter to simulate paper/card stock (Bandpass/Lowpass hybrid feel)
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);

    // Gain node for global volume of this snap
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(1.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    // Connect graph: Noise -> Filter -> Gain -> Destination
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Start
    noiseSource.start();
  }, []);

  return { playDealSound };
};
