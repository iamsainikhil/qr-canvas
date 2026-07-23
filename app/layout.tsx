import './globals.css';
import type { Metadata } from 'next';
import { RuntimeRecovery } from '@/components/RuntimeRecovery';

export const metadata: Metadata = {
  title: 'QR Canvas',
  description: 'Free, open-source, self-hosted dynamic QR code generator with scan analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RuntimeRecovery />
        {children}
      </body>
    </html>
  );
}
