import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Lottie from 'lottie-react';
import { Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorReason = 'not_found' | 'disabled' | 'error' | 'invalid';

const errorContent: Record<ErrorReason, { title: string; description: string }> = {
  not_found: {
    title: 'QR code not found',
    description: 'This QR code doesn\'t exist or may have been deleted.',
  },
  disabled: {
    title: 'QR code disabled',
    description: 'This QR code has been deactivated and is no longer accepting scans.',
  },
  error: {
    title: 'Something went wrong',
    description: 'We couldn\'t process this QR redirect. Please try again or contact the QR owner.',
  },
  invalid: {
    title: 'Invalid QR link',
    description: 'This QR link appears to be malformed or incomplete.',
  },
};

export default function ScanError() {
  const [searchParams] = useSearchParams();
  const reason = (searchParams.get('reason') as ErrorReason) || 'error';
  const content = errorContent[reason] ?? errorContent.error;

  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    fetch('/404-error.json')
      .then((r) => r.json())
      .then(setAnimationData)
      .catch(() => {
        // Animation failed to load — page still works fine without it.
      });
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Full-page animation — sized to cover both axes */}
      {animationData && (
        <div className="absolute inset-0 overflow-hidden">
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'max(100vw, 100vh)',
              height: 'max(100vw, 100vh)',
            }}
          >
            <Lottie animationData={animationData} loop autoplay style={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      )}

      {/* Overlay content */}
      <div className="relative flex min-h-screen flex-col items-center justify-end gap-4 px-4 pb-16 text-center">
        <div className="rounded-2xl border border-border bg-background/80 px-8 py-6 shadow-xl backdrop-blur-md space-y-4 max-w-sm w-full">
          <div className="space-y-1">
            <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
              {content.title}
            </h1>
            <p className="text-muted-foreground text-sm">{content.description}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="rounded-full">
              <Link to="/">
                <Home className="h-4 w-4" />
                Go home
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => window.history.back()}
            >
              <RefreshCw className="h-4 w-4" />
              Go back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
