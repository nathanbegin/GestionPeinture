import { createHmac, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const COOKIE = 'session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

const secret = () => {
  const s = process.env.APP_PASSWORD;
  if (!s) throw new Error('APP_PASSWORD manquant');
  return s;
};

// Jeton dérivé du mot de passe : changer APP_PASSWORD déconnecte tous les appareils.
const token = () => createHmac('sha256', secret()).update('registre-peinture:session:v1').digest('hex');

const safeEqual = (a, b) => {
  const ha = createHmac('sha256', 'cmp').update(String(a)).digest();
  const hb = createHmac('sha256', 'cmp').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
};

export const checkPassword = (pw) => safeEqual(pw ?? '', secret());

export const sessionCookie = (on = true) =>
  `${COOKIE}=${on ? token() : ''}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${on ? MAX_AGE : 0}`;

export function isAuthed(req) {
  const m = /(?:^|;\s*)session=([0-9a-f]+)/.exec(req.headers.cookie || '');
  return !!m && safeEqual(m[1], token());
}

export const db = () => neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

export async function ensureTable(sql) {
  await sql`CREATE TABLE IF NOT EXISTS registre (
    id text PRIMARY KEY,
    data jsonb NOT NULL,
    version integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
