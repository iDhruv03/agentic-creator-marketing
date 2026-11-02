import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { queryOne, queryAll, execute } from '../db/database';
import { CoreError, newId } from '../core/ids';

export type Role = 'BRAND' | 'AGENCY' | 'CREATOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  brand_id: string | null;
  agency_id: string | null;
  creator_id: string | null;
  avatar_url: string | null;
  title: string | null;
  created_at: string;
}

export interface AuthedRequest extends Request {
  user?: User;
}

const SECRET = process.env.CMI_AUTH_SECRET || 'cmi-dev-secret-change-me';
const TOKEN_TTL_SEC = 60 * 60 * 24 * 7;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signToken(userId: string): string {
  const payload = b64url(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC }));
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || data.exp < Date.now() / 1000) return null;
    return String(data.sub);
  } catch {
    return null;
  }
}

export function publicUser(row: any): User {
  const { password_hash, ...rest } = row;
  return rest as User;
}

export function getUser(id: string): User | null {
  const row = queryOne(`SELECT * FROM users WHERE id = ?`, [id]);
  return row ? publicUser(row) : null;
}

export function login(email: string, password: string): { token: string; user: User } {
  const row = queryOne<any>(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email?.trim() ?? '']);
  if (!row || !verifyPassword(password ?? '', row.password_hash)) throw new CoreError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  return { token: signToken(row.id), user: publicUser(row) };
}

export function listDemoUsers(): (User & { brand_name?: string; agency_name?: string; creator_handle?: string })[] {
  return queryAll<any>(
    `SELECT u.*, b.name as brand_name, a.name as agency_name, c.handle as creator_handle
     FROM users u LEFT JOIN brands b ON b.id = u.brand_id LEFT JOIN agencies a ON a.id = u.agency_id LEFT JOIN creators c ON c.id = u.creator_id
     ORDER BY CASE u.role WHEN 'BRAND' THEN 0 WHEN 'AGENCY' THEN 1 WHEN 'CREATOR' THEN 2 ELSE 3 END, u.name`,
  ).map(publicUser) as any;
}

export function createUser(input: { email: string; password: string; name: string; role: Role; brand_id?: string | null; agency_id?: string | null; creator_id?: string | null; avatar_url?: string | null; title?: string | null }): User {
  const id = newId('usr');
  execute(
    `INSERT INTO users (id, email, password_hash, name, role, brand_id, agency_id, creator_id, avatar_url, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.email.toLowerCase(), hashPassword(input.password), input.name, input.role, input.brand_id ?? null, input.agency_id ?? null, input.creator_id ?? null, input.avatar_url ?? null, input.title ?? null],
  );
  return getUser(id)!;
}

/** Attach req.user when a valid bearer token is present. */
export function authenticate(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string | undefined);
  if (token) {
    const uid = verifyToken(token);
    if (uid) req.user = getUser(uid) ?? undefined;
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) { res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHENTICATED' }); return; }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHENTICATED' }); return; }
    if (!roles.includes(req.user.role) && req.user.role !== 'ADMIN') { res.status(403).json({ error: `This action requires one of: ${roles.join(', ')}.`, code: 'FORBIDDEN' }); return; }
    next();
  };
}

/** Which brand ids can this user operate on? Agencies see every managed client. */
export function brandScope(user: User): string[] | null {
  if (user.role === 'ADMIN') return null;
  if (user.role === 'BRAND') return user.brand_id ? [user.brand_id] : [];
  if (user.role === 'AGENCY') return queryAll<{ brand_id: string }>(`SELECT brand_id FROM agency_brands WHERE agency_id = ?`, [user.agency_id ?? '']).map((r) => r.brand_id);
  return [];
}

export function canAccessCampaign(user: User, campaignBrandId: string): boolean {
  const scope = brandScope(user);
  return scope === null || scope.includes(campaignBrandId);
}

export function actorOf(user: User): { type: 'HUMAN'; id: string; name: string } {
  return { type: 'HUMAN', id: user.id, name: user.name };
}
