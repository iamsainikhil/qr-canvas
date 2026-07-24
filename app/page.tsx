'use client';

import { PrivateAppGate } from '@/components/PrivateAppGate';
import Index from '@/views/Index';

export default function HomePage() {
  return (
    <PrivateAppGate>
      <Index />
    </PrivateAppGate>
  );
}
