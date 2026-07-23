import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

export default function TrackingRedirect() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!shortCode) {
      navigate('/scan-error?reason=invalid', { replace: true });
      return;
    }

    const encodedShortCode = encodeURIComponent(shortCode);
    const search = location.search || '';
    window.location.replace(`/api/r/${encodedShortCode}${search}`);
  }, [location.search, navigate, shortCode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Redirecting to destination...
      </div>
    </div>
  );
}
