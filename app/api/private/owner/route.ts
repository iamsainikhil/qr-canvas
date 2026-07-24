import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_MODE = process.env.NEXT_PUBLIC_PRIVATE_MODE === 'true';

const normalizeEnvValue = (value?: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  return trimmed.replace(/^['\"]|['\"]$/g, '');
};

const getOwnerEnv = () => {
  const privateOwner = normalizeEnvValue(process.env.OWNER_EMAIL);
  const ownerEmail = privateOwner.toLowerCase();

  return {
    ownerEmail,
    ownerConfigured: Boolean(ownerEmail),
  };
};

const getServerAuthConfig = () => {
  const adminProjectId = normalizeEnvValue(process.env.FIREBASE_PROJECT_ID);
  const adminClientEmail = normalizeEnvValue(process.env.FIREBASE_CLIENT_EMAIL);
  const adminPrivateKey = normalizeEnvValue(process.env.FIREBASE_PRIVATE_KEY);
  const clientProjectId = normalizeEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

  const adminConfigured =
    Boolean(adminProjectId) && Boolean(adminClientEmail) && Boolean(adminPrivateKey);
  const projectAligned =
    !adminProjectId || !clientProjectId || adminProjectId === clientProjectId;

  return {
    adminConfigured,
    projectAligned,
    adminProjectId,
    clientProjectId,
  };
};

const getFirebaseWebApiKey = () =>
  normalizeEnvValue(process.env.FIREBASE_WEB_API_KEY) ||
  normalizeEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

const maskEmail = (email: string) => {
  const [local = '', domain = ''] = email.split('@');
  if (!local || !domain) return null;

  const localMasked = local.length <= 2
    ? `${local[0] ?? '*'}*`
    : `${local.slice(0, 2)}***`;

  const domainParts = domain.split('.');
  const domainName = domainParts[0] ?? '';
  const tld = domainParts.slice(1).join('.');
  const domainMasked = domainName
    ? `${domainName.slice(0, 2)}***${tld ? `.${tld}` : ''}`
    : domain;

  return `${localMasked}@${domainMasked}`;
};

const classifyTokenLookupError = (errorCode: string) => {
  const code = errorCode.toUpperCase();

  if (code.includes('TOKEN_EXPIRED')) return 'token-expired';
  if (code.includes('USER_DISABLED')) return 'token-revoked';
  if (code.includes('INVALID_ID_TOKEN')) return 'invalid-id-token';

  return 'invalid-token-or-server-error';
};

export async function GET() {
  try {
    const owner = getOwnerEnv();
    const serverAuth = getServerAuthConfig();
    const ownerConfigured =
      owner.ownerConfigured &&
      (!PRIVATE_MODE || (serverAuth.adminConfigured && serverAuth.projectAligned));

    const reason = !owner.ownerConfigured
      ? 'owner-not-configured'
      : !serverAuth.adminConfigured
        ? 'missing-admin-env'
        : !serverAuth.projectAligned
          ? 'firebase-project-mismatch'
          : null;

    return NextResponse.json(
      {
        privateMode: PRIVATE_MODE,
        ownerConfigured,
        reason,
        debug: {
          adminConfigured: serverAuth.adminConfigured,
          projectAligned: serverAuth.projectAligned,
          adminProjectId: serverAuth.adminProjectId || null,
          clientProjectId: serverAuth.clientProjectId || null,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        privateMode: PRIVATE_MODE,
        ownerConfigured: false,
        reason: 'server-error',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  const owner = getOwnerEnv();
  const serverAuth = getServerAuthConfig();
  const ownerEmail = owner.ownerEmail;

  if (!PRIVATE_MODE) {
    return NextResponse.json(
      {
        allowed: true,
        ownerConfigured: true,
      },
      { status: 200 },
    );
  }

  if (!ownerEmail) {
    return NextResponse.json(
      {
        allowed: false,
        ownerConfigured: owner.ownerConfigured,
        reason: 'owner-not-configured',
      },
      { status: 503 },
    );
  }

  if (!serverAuth.adminConfigured) {
    return NextResponse.json(
      {
        allowed: false,
        ownerConfigured: false,
        reason: 'missing-admin-env',
      },
      { status: 503 },
    );
  }

  if (!serverAuth.projectAligned) {
    return NextResponse.json(
      {
        allowed: false,
        ownerConfigured: false,
        reason: 'firebase-project-mismatch',
        debug: {
          adminProjectId: serverAuth.adminProjectId || null,
          clientProjectId: serverAuth.clientProjectId || null,
        },
      },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return NextResponse.json(
      {
        allowed: false,
        ownerConfigured: true,
        reason: 'missing-token',
      },
      { status: 401 },
    );
  }

  const webApiKey = getFirebaseWebApiKey();
  if (!webApiKey) {
    return NextResponse.json(
      {
        allowed: false,
        ownerConfigured: true,
        reason: 'missing-firebase-api-key',
      },
      { status: 503 },
    );
  }

  try {
    const lookupResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(webApiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken: token }),
        cache: 'no-store',
      },
    );

    if (!lookupResponse.ok) {
      const payload = (await lookupResponse.json().catch(() => null)) as
        | {
            error?: {
              message?: string;
            };
          }
        | null;
      const errorCode = payload?.error?.message ?? 'UNKNOWN_TOKEN_LOOKUP_ERROR';
      const reason = classifyTokenLookupError(errorCode);

      return NextResponse.json(
        {
          allowed: false,
          ownerConfigured: true,
          reason,
          debug: {
            errorCode,
            errorMessage: `Identity Toolkit lookup failed with HTTP ${lookupResponse.status}`,
          },
        },
        { status: reason === 'invalid-token-or-server-error' ? 401 : 503 },
      );
    }

    const payload = (await lookupResponse.json()) as {
      users?: Array<{
        email?: string;
      }>;
    };
    const email = (payload.users?.[0]?.email ?? '').trim().toLowerCase();

    if (email !== ownerEmail) {
      return NextResponse.json(
        {
          allowed: false,
          ownerConfigured: true,
          reason: 'owner-mismatch',
          debug: {
            signedInEmail: maskEmail(email),
            expectedOwnerEmail: maskEmail(ownerEmail),
          },
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        allowed: true,
        ownerConfigured: true,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        allowed: false,
        ownerConfigured: true,
        reason: 'invalid-token-or-server-error',
        debug: {
          errorCode: 'TOKEN_LOOKUP_EXCEPTION',
          errorMessage: message.slice(0, 220),
        },
      },
      { status: 401 },
    );
  }
}
