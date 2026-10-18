import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { AppTypes } from './env';

export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const COOKIE_NAME = 'master';

type AuthContext = Context<AppTypes>;

const cookieOptions = { prefix: 'host', path: '/', secure: true } as const;

const sha256 = async (text: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

export const passwordMatches = async (candidate: string, expected: string): Promise<boolean> => {
  const [candidateHash, expectedHash] = await Promise.all([sha256(candidate), sha256(expected)]);
  const difference = candidateHash.reduce(
    (accumulated, byte, index) => accumulated | (byte ^ (expectedHash[index] ?? 0)),
    0,
  );
  return difference === 0;
};

export const startMasterSession = (c: AuthContext, now: number): Promise<void> =>
  setSignedCookie(c, COOKIE_NAME, String(now), c.get('config').SESSION_SECRET, {
    ...cookieOptions,
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: SESSION_TTL_SECONDS,
  });

export const endMasterSession = (c: AuthContext): void => {
  deleteCookie(c, COOKIE_NAME, cookieOptions);
};

export const hasMasterSession = async (c: AuthContext, now: number): Promise<boolean> => {
  const issuedAt = await getSignedCookie(
    c,
    c.get('config').SESSION_SECRET,
    COOKIE_NAME,
    cookieOptions.prefix,
  );
  if (typeof issuedAt !== 'string') return false;
  const age = now - Number(issuedAt);
  return Number.isFinite(age) && age < SESSION_TTL_MS;
};
