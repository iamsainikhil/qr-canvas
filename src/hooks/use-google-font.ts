import { useEffect, useState } from 'react';
import { ensureGoogleFontLoaded } from '@/lib/fontRegistry';

export function useGoogleFont(fontFamily: string) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    ensureGoogleFontLoaded(fontFamily, [400, 500, 600, 700, 800])
      .then(() => {
        if (!cancelled) setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fontFamily]);

  return isLoading;
}
