"use client";

import { useEffect } from 'react';
import ErrorPage from '@/views/Error';

export default function RouteErrorBoundary({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled route error:', error);
  }, [error]);

  return <ErrorPage reason="page_error" />;
}
