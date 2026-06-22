import { useState, useEffect } from 'react';

// Matches landscape iPhones and other short viewports (height < 500px)
const SHORT_QUERY = '(max-height: 500px)';

export function useIsShortViewport(): boolean {
  const [isShort, setIsShort] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(SHORT_QUERY).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(SHORT_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsShort(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isShort;
}
