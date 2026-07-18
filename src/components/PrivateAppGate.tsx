import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader2, Lock, LogOut, ShieldCheck } from 'lucide-react';

import {
  firebaseAuth,
  firestore,
  googleProvider,
  isFirebaseConfigured,
  missingFirebaseClientEnv,
} from '@/integrations/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const PRIVATE_MODE = import.meta.env.VITE_PRIVATE_MODE === 'true';
const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL ?? '').trim().toLowerCase();

const isOwnerUser = (user: User | null) => {
  if (!OWNER_EMAIL) return false;
  return (user?.email ?? '').trim().toLowerCase() === OWNER_EMAIL;
};

function PrivateAccessSetupError() {
  const missing = missingFirebaseClientEnv.join(', ');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl border-destructive/40">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Private mode needs setup</CardTitle>
          <CardDescription>
            Set VITE_OWNER_EMAIL and Firebase client env vars to lock this deployment.
          </CardDescription>
        </CardHeader>
        {missing ? (
          <CardContent className="text-sm text-muted-foreground">
            Missing: {missing}
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}

function AccessDenied({ onSignOut }: { onSignOut: () => Promise<void> }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl border-destructive/40">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Access denied</CardTitle>
          <CardDescription>
            This deployment is restricted to one owner account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="rounded-full" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(37,99,235,0.10), transparent 45%), radial-gradient(circle at 80% 80%, rgba(34,197,94,0.10), transparent 45%)',
        }}
      />
      <Card className="relative w-full max-w-xl border-border/70 bg-card/95 backdrop-blur">
        <CardHeader>
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
            <Lock className="h-5 w-5 text-foreground" />
          </div>
          <CardTitle className="font-heading text-3xl">Private QR Console</CardTitle>
          <CardDescription>
            Sign in with Google using your owner account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={onSignIn} className="h-11 w-full rounded-full" disabled={signingIn}>
            {signingIn ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Continue with Google
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Access is restricted to the authorized owner account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function PrivateAppGate({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(PRIVATE_MODE);
  const [signingIn, setSigningIn] = useState(false);
  const { toast } = useToast();

  const isOwner = useMemo(() => isOwnerUser(user), [user]);

  useEffect(() => {
    if (!user || !firestore) return;

    if (!isOwnerUser(user)) return;

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
  }, [user, toast]);

  useEffect(() => {
    if (!PRIVATE_MODE || !firebaseAuth) return;

    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
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
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const email = (result.user.email ?? '').trim().toLowerCase();
      if (email !== OWNER_EMAIL) {
        await signOut(firebaseAuth);
        toast({
          title: 'Unauthorized account',
          description: 'Use the configured owner Google account.',
          variant: 'destructive',
        });
      }
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

  if (!OWNER_EMAIL || !isFirebaseConfigured) {
    return <PrivateAccessSetupError />;
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking private access
        </div>
      </div>
    );
  }

  if (!user) {
    return <PrivateSignIn signingIn={signingIn} onSignIn={handleSignIn} />;
  }

  if (!isOwner) {
    return <AccessDenied onSignOut={handleSignOut} />;
  }

  return <>{children}</>;
}
