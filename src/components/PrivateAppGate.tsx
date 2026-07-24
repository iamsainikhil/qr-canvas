import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Icon } from '@iconify/react';

import {
  firebaseAuth,
  firestore,
  googleProvider,
  isFirebaseConfigured,
  missingFirebaseClientEnv,
} from '@/integrations/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';

const PRIVATE_MODE = process.env.NEXT_PUBLIC_PRIVATE_MODE === 'true';
const GITHUB_REPO = 'https://github.com/iamsainikhil/qr-canvas';

function GateHeader() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-border bg-card px-5 py-4">
      <a href="/" className="flex items-center gap-3">
        <img src="/logo.png" alt="QR Canvas" className="w-12 h-12 rounded-xl" />
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">QR Canvas</h1>
          <p className="text-sm text-muted-foreground">Generate dynamic QR codes with scan tracking</p>
        </div>
      </a>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <Icon icon="line-md:sunny-outline-to-moon-loop-transition" className="!size-6" />
          ) : (
            <Icon icon="line-md:moon-to-sunny-outline-loop-transition" className="!size-6" />
          )}
        </Button>
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon icon="line-md:github" height="2em" />
        </a>
      </div>
    </div>
  );
}

function GateFooter() {
  return (
    <div className="absolute bottom-0 left-0 right-0 border-t border-border/30 px-4 py-3">
      <p className="text-center text-xs text-muted-foreground">
        This is a private deployment.{' '}
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Fork on GitHub
        </a>{' '}
        to self-host with your own owner account.
      </p>
    </div>
  );
}

function formatPrivateReason(reason: string | null) {
  if (!reason) return null;

  const reasonMap: Record<string, string> = {
    'owner-not-configured': 'OWNER_EMAIL is not configured on the server environment.',
    'missing-admin-env': 'Firebase Admin credentials are missing in this deployment.',
    'firebase-project-mismatch': 'Firebase client and Admin project IDs do not match in this deployment.',
    'admin-credential-error': 'Firebase Admin private key or service account credentials are invalid.',
    'token-project-mismatch': 'The ID token belongs to a different Firebase project than the Admin SDK config.',
    'missing-token': 'No auth token was provided to the owner check endpoint.',
    'owner-mismatch': 'Signed-in Google email does not match OWNER_EMAIL.',
    'invalid-id-token': 'Firebase rejected the ID token as invalid for this deployment.',
    'token-expired': 'Firebase ID token expired. Sign out and sign in again.',
    'token-revoked': 'Firebase ID token was revoked. Sign out and sign in again.',
    'invalid-token-or-server-error': 'Token verification failed or the server returned an unexpected auth error.',
    'server-error': 'Server failed while checking private mode configuration.',
  };

  return reasonMap[reason] ?? `Private mode check failed: ${reason}`;
}

function PrivateAccessSetupError({
  reason,
  detail,
}: {
  reason: string | null;
  detail: string | null;
}) {
  const missing = missingFirebaseClientEnv.join(', ');
  const reasonText = formatPrivateReason(reason);

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <GateHeader />
      <main className="flex flex-1 items-center justify-center p-4 pt-20">
        <Card className="w-full max-w-xl border-destructive/40">
          <CardHeader className="text-center">
            <CardTitle className="font-heading text-2xl">Private mode needs setup</CardTitle>
            <CardDescription>
              Set OWNER_EMAIL and Firebase client env vars.
            </CardDescription>
          </CardHeader>
          {reasonText ? (
            <CardContent className="text-center text-sm text-destructive">
              {reasonText}
              {detail ? (
                <p className="mt-2 break-words text-xs text-muted-foreground">Detail: {detail}</p>
              ) : null}
            </CardContent>
          ) : null}
          {missing ? (
            <CardContent className="text-center text-sm text-muted-foreground">
              Missing: {missing}
            </CardContent>
          ) : null}
          <CardContent className="text-center">
            <p className="text-xs text-muted-foreground">
              See the{' '}
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                GitHub repo
              </a>{' '}
              for setup instructions.
            </p>
          </CardContent>
        </Card>
      </main>
      <GateFooter />
    </div>
  );
}

function AccessDenied({
  onSignOut,
  reason,
  detail,
}: {
  onSignOut: () => Promise<void>;
  reason: string | null;
  detail: string | null;
}) {
  const reasonText = formatPrivateReason(reason);

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <GateHeader />
      <main className="flex flex-1 items-center justify-center p-4 pt-20">
        <Card className="w-full max-w-xl border-destructive/40">
          <CardHeader className="text-center">
            <CardTitle className="font-heading text-2xl">Access denied</CardTitle>
            <CardDescription>
              This deployment is restricted to one owner account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            {reasonText ? (
              <p className="text-center text-xs text-destructive">
                {reasonText}
                {detail ? (
                  <span className="mt-1 block break-words text-muted-foreground">Detail: {detail}</span>
                ) : null}
              </p>
            ) : null}
            <Button variant="outline" className="rounded-full" onClick={onSignOut}>
              <Icon icon="line-md:logout" className="h-4 w-4" />
              Sign out
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Want your own instance?{' '}
              <a
                href={GITHUB_REPO}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Self-host on GitHub
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </main>
      <GateFooter />
    </div>
  );
}

function PrivateSignIn({
  signingIn,
  onSignIn,
}: {
  signingIn: boolean;
  onSignIn: () => Promise<void>;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <GateHeader />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(37,99,235,0.10), transparent 45%), radial-gradient(circle at 80% 80%, rgba(34,197,94,0.10), transparent 45%)',
        }}
      />
      <main className="relative z-10 flex flex-1 items-center justify-center p-4 pt-20">
        <Card className="w-full max-w-xl border-border/70 bg-card/95 backdrop-blur">
          <CardHeader className="items-center text-center">
            <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
              <Icon icon="solar:lock-outline" className="h-5 w-5 text-foreground" />
            </div>
            <CardTitle className="font-heading text-3xl">Dashboard</CardTitle>
            <CardDescription>
              Sign in with Google using your owner account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Button onClick={onSignIn} className="h-11 w-full max-w-xs rounded-full" disabled={signingIn}>
              {signingIn ? (
                <>
                  <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
                  Signing in
                </>
              ) : (
                <>
                  <Icon icon="solar:shield-check-outline" className="h-4 w-4" />
                  Continue with Google
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Access is restricted to the authorized owner account.
            </p>
          </CardContent>
        </Card>
      </main>
      <GateFooter />
    </div>
  );
}

export function PrivateAppGate({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(PRIVATE_MODE);
  const [signingIn, setSigningIn] = useState(false);
  const [ownerConfigured, setOwnerConfigured] = useState(true);
  const [ownerAllowed, setOwnerAllowed] = useState(false);
  const [ownerCheckReason, setOwnerCheckReason] = useState<string | null>(null);
  const [ownerCheckDetail, setOwnerCheckDetail] = useState<string | null>(null);
  const { toast } = useToast();

  const isOwner = useMemo(() => ownerAllowed, [ownerAllowed]);

  useEffect(() => {
    if (!PRIVATE_MODE) return;

    let cancelled = false;

    const loadOwnerConfig = async () => {
      try {
        const response = await fetch('/api/private/owner', {
          method: 'GET',
          cache: 'no-store',
        });
        const data = (await response.json()) as {
          ownerConfigured?: boolean;
          reason?: string;
          debug?: {
            errorCode?: string | null;
            errorMessage?: string | null;
            adminProjectId?: string | null;
            clientProjectId?: string | null;
          };
        };
        if (!cancelled) {
          setOwnerConfigured(Boolean(data.ownerConfigured));
          setOwnerCheckReason(data.reason ?? null);
          const configDebug =
            data.reason === 'firebase-project-mismatch'
              ? `adminProjectId=${data.debug?.adminProjectId ?? 'n/a'} clientProjectId=${data.debug?.clientProjectId ?? 'n/a'}`
              : null;
          setOwnerCheckDetail(configDebug);
        }
      } catch {
        if (!cancelled) {
          setOwnerConfigured(false);
          setOwnerCheckReason('server-error');
          setOwnerCheckDetail(null);
        }
      }
    };

    void loadOwnerConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user || !firestore) return;

    if (!isOwner) return;

    let cancelled = false;

    const ensureOwnerConfig = async () => {
      const ownerDocRef = doc(firestore, 'app_config', 'private');
      const ownerDoc = await getDoc(ownerDocRef);

      if (!ownerDoc.exists()) {
        await setDoc(ownerDocRef, {
          ownerUid: user.uid,
          ownerEmail: (user.email ?? '').toLowerCase(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      const ownerUid = ownerDoc.data()?.ownerUid as string | undefined;
      if (ownerUid && ownerUid !== user.uid && !cancelled) {
        await signOut(firebaseAuth);
        toast({
          title: 'Owner mismatch',
          description: 'This Firebase project is already locked to another owner uid.',
          variant: 'destructive',
        });
      }
    };

    void ensureOwnerConfig();

    return () => {
      cancelled = true;
    };
  }, [isOwner, user, toast]);

  const verifyOwnerAccess = async (nextUser: User) => {
    try {
      const token = await nextUser.getIdToken();
      const response = await fetch('/api/private/owner', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await response.json()) as {
        allowed?: boolean;
        ownerConfigured?: boolean;
        reason?: string;
        debug?: {
          errorCode?: string | null;
          errorMessage?: string | null;
          adminProjectId?: string | null;
          clientProjectId?: string | null;
        };
      };

      setOwnerConfigured(Boolean(data.ownerConfigured));
      setOwnerAllowed(Boolean(data.allowed));
      setOwnerCheckReason(data.reason ?? null);
      const verifyDebug = [data.debug?.errorCode, data.debug?.errorMessage]
        .filter(Boolean)
        .join(' | ');
      const configDebug =
        data.reason === 'firebase-project-mismatch'
          ? `adminProjectId=${data.debug?.adminProjectId ?? 'n/a'} clientProjectId=${data.debug?.clientProjectId ?? 'n/a'}`
          : null;
      setOwnerCheckDetail(configDebug ?? (verifyDebug || null));
    } catch {
      setOwnerAllowed(false);
      setOwnerCheckReason('server-error');
      setOwnerCheckDetail(null);
    }
  };

  useEffect(() => {
    if (!PRIVATE_MODE || !firebaseAuth) return;

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setOwnerAllowed(false);
        setChecking(false);
        return;
      }

      setChecking(true);
      await verifyOwnerAccess(nextUser);
      setChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    if (!firebaseAuth || !googleProvider) {
      toast({
        title: 'Firebase not configured',
        description: 'Set Firebase client environment variables and restart dev server.',
        variant: 'destructive',
      });
      return;
    }

    setSigningIn(true);
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Google sign-in failed';
      toast({
        title: 'Sign-in failed',
        description,
        variant: 'destructive',
      });
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (!firebaseAuth) return;

    await signOut(firebaseAuth);
    setUser(null);
  };

  if (!PRIVATE_MODE) {
    return <>{children}</>;
  }

  if (!ownerConfigured || !isFirebaseConfigured) {
    return <PrivateAccessSetupError reason={ownerCheckReason} detail={ownerCheckDetail} />;
  }

  if (checking) {
    return (
      <div className="relative flex min-h-screen flex-col bg-background">
        <GateHeader />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <Icon icon="bx:loader-circle" className="h-4 w-4 animate-spin" />
            Checking private access
          </div>
        </main>
        <GateFooter />
      </div>
    );
  }

  if (!user) {
    return <PrivateSignIn signingIn={signingIn} onSignIn={handleSignIn} />;
  }

  if (!isOwner) {
    return <AccessDenied onSignOut={handleSignOut} reason={ownerCheckReason} detail={ownerCheckDetail} />;
  }

  return <>{children}</>;
}
