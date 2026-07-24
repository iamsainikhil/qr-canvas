import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

const PRIVATE_MODE = process.env.NEXT_PUBLIC_PRIVATE_MODE === 'true';

const getOwnerEmail = () => (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();

export async function GET() {
  return NextResponse.json(
    {
      privateMode: PRIVATE_MODE,
      ownerConfigured: Boolean(getOwnerEmail()),
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const ownerEmail = getOwnerEmail();

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
        ownerConfigured: false,
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
        reason: 'invalid-token',
      },
      { status: 401 },
    );
  }
}
