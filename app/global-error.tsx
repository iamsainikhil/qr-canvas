"use client";

import { useEffect } from 'react';
import ErrorPage from '@/views/Error';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <ErrorPage reason="page_error" />
      </body>
    </html>
  );
}
