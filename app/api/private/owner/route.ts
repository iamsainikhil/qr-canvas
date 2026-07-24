import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_MODE = process.env.NEXT_PUBLIC_PRIVATE_MODE === 'true';

const getOwnerEnv = () => {
  const privateOwner = (process.env.OWNER_EMAIL ?? '').trim();
  const legacyOwner = (process.env.NEXT_PUBLIC_OWNER_EMAIL ?? '').trim();
  const ownerEmail = (privateOwner || legacyOwner).toLowerCase();

  return {
    ownerEmail,
    ownerConfigured: Boolean(ownerEmail),
  };
};

export async function GET() {
  try {
    const owner = getOwnerEnv();

    return NextResponse.json(
      {
        privateMode: PRIVATE_MODE,
        ownerConfigured: owner.ownerConfigured,
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
    const { getAdminAuth } = await import('@/lib/firebaseAdmin');
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? '').trim().toLowerCase();

    if (email !== ownerEmail) {
      return NextResponse.json(
        {
          allowed: false,
          ownerConfigured: true,
          reason: 'owner-mismatch',
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
  } catch {
    return NextResponse.json(
      {
        allowed: false,
        ownerConfigured: true,
        reason: 'invalid-token-or-server-error',
      },
      { status: 401 },
    );
  }
}
