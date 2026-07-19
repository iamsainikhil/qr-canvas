import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';

import { getAdminDb } from '../_lib/firebaseAdmin.js';

const parseCookies = (cookieHeader?: string) => {
  if (!cookieHeader) return {} as Record<string, string>;
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
};

const getOrCreateVisitorId = (req: IncomingMessage, res: ServerResponse) => {
  const cookies = parseCookies(req.headers.cookie);
  const current = cookies.visitor_id;
  if (current) return current;

  const visitorId = crypto.randomUUID();
  res.setHeader(
    'Set-Cookie',
    `visitor_id=${visitorId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
  );
  return visitorId;
};

const normalizeIp = (rawIp: string) => {
  if (!rawIp) return 'unknown';
  if (rawIp.includes(':')) {
    return rawIp.split(':').slice(0, 4).join(':');
  }
  const parts = rawIp.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return rawIp;
};

const hashIp = (ip: string) => {
  const salt = process.env.SCAN_IP_HASH_SALT || 'fallback-salt';
  return crypto.createHmac('sha256', salt).update(ip).digest('hex');
};

const readShortCode = (req: IncomingMessage) => {
  const url = req.url || '';
  const parts = url.split('?')[0].split('/').filter(Boolean);
  return parts.at(-1) || '';
};

const buildErrorRedirect = (req: IncomingMessage, reason: string) => {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) || 'https';
  const host = req.headers.host || 'localhost';
  return `${proto}://${host}/scan-error?reason=${reason}`;
};

const BOT_UA_RE = /bot|crawler|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram\/|curl\/|wget\/|python-requests|go-http-client|java\/|headlesschrome|prerender|lighthouse|pagespeed|googleimageproxy|adsbot/i;

const isBot = (ua: string) => BOT_UA_RE.test(ua);

const extractUtmParams = (req: IncomingMessage) => {
  const raw = req.url || '';
  const qIndex = raw.indexOf('?');
  const qs = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
  const params = new URLSearchParams(qs);
  return {
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
    utmTerm: params.get('utm_term') || '',
    utmContent: params.get('utm_content') || '',
  };
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const shortCode = readShortCode(req);
  if (!shortCode) {
    res.statusCode = 302;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', buildErrorRedirect(req, 'invalid'));
    res.end();
    return;
  }

  try {
    const db = getAdminDb();
    const routeRef = db.collection('qr_routes').doc(shortCode);
    const routeDoc = await routeRef.get();

    if (!routeDoc.exists) {
      res.statusCode = 302;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Location', buildErrorRedirect(req, 'not_found'));
      res.end();
      return;
    }

    const routeData = routeDoc.data() as {
      ownerUid: string;
      qrId: string;
      targetValue: string;
      active?: boolean;
    };

    if (!routeData.active) {
      res.statusCode = 302;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Location', buildErrorRedirect(req, 'disabled'));
      res.end();
      return;
    }

    const now = new Date().toISOString();
    const userAgent = (req.headers['user-agent'] as string | undefined) || '';

    if (isBot(userAgent)) {
      res.statusCode = 302;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Location', routeData.targetValue);
      res.end();
      return;
    }

    const visitorId = getOrCreateVisitorId(req, res);
    const forwardedFor = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || '';
    const ipHash = hashIp(normalizeIp(forwardedFor));

    const referrer = (req.headers.referer as string | undefined) || '';
    const country = (req.headers['x-vercel-ip-country'] as string | undefined) || 'unknown';
    const region = (req.headers['x-vercel-ip-country-region'] as string | undefined) || 'unknown';
    const city = (req.headers['x-vercel-ip-city'] as string | undefined) || 'unknown';
    const utmParams = extractUtmParams(req);

    const scanRef = db
      .collection('users')
      .doc(routeData.ownerUid)
      .collection('qrs')
      .doc(routeData.qrId)
      .collection('scans')
      .doc();

    await scanRef.set({
      id: scanRef.id,
      qrId: routeData.qrId,
      shortCode,
      timestamp: now,
      visitorId,
      ipHash,
      userAgent,
      referrer,
      country,
      region,
      city,
      ...utmParams,
    });

    await db
      .collection('users')
      .doc(routeData.ownerUid)
      .collection('qrs')
      .doc(routeData.qrId)
      .set(
        {
          updatedAt: now,
          stats: {
            scanCount: FieldValue.increment(1),
            lastScannedAt: now,
          },
        },
        { merge: true },
      );

    res.statusCode = 302;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', routeData.targetValue);
    res.end();
  } catch {
    res.statusCode = 302;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Location', buildErrorRedirect(req, 'error'));
    res.end();
  }
}
