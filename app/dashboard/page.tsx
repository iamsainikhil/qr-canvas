'use client';

import { PrivateAppGate } from '@/components/PrivateAppGate';
import Dashboard from '@/views/Dashboard';

export default function DashboardPage() {
  return (
    <PrivateAppGate>
      <Dashboard />
    </PrivateAppGate>
  );
}
