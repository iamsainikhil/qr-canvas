import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

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

const classifyAdminVerifyError = (error: unknown) => {
  const rawCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const code = rawCode.toLowerCase();
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (code.includes('id-token-expired')) return { reason: 'token-expired', code, message };
  if (code.includes('id-token-revoked')) return { reason: 'token-revoked', code, message };
  if (code.includes('invalid-id-token')) return { reason: 'invalid-id-token', code, message };
  if (message.includes('missing firebase admin environment variables')) {
    return { reason: 'missing-admin-env', code, message };
  }
  if (message.includes('private key') || message.includes('pem')) {
    return { reason: 'admin-credential-error', code, message };
  }
  if (
    message.includes('incorrect "aud"') ||
    message.includes('incorrect "iss"') ||
    message.includes('project')
  ) {
    return { reason: 'token-project-mismatch', code, message };
  }

  return { reason: 'invalid-token-or-server-error', code, message };
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

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? '').trim().toLowerCase();

    if (email !== ownerEmail) {
      return NextResponse.json(
        {
          allowed: false,
          ownerConfigured: true,
          reason: 'owner-mismatch',
          debug: {
            verifyMethod: 'firebase-admin',
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
        debug: {
          verifyMethod: 'firebase-admin',
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const verifyError = classifyAdminVerifyError(error);
    const status = verifyError.reason === 'invalid-token-or-server-error' ? 401 : 503;

    return NextResponse.json(
      {
        allowed: false,
        ownerConfigured: true,
        reason: verifyError.reason,
        debug: {
          verifyMethod: 'firebase-admin',
          errorCode: verifyError.code || null,
          errorMessage: verifyError.message ? verifyError.message.slice(0, 220) : null,
        },
      },
      { status },
    );
  }
}
