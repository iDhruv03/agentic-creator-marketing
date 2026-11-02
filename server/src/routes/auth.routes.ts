import { Router } from 'express';
import { z } from 'zod';
import { h, parse } from './helpers';
import { login, listDemoUsers, requireAuth } from '../auth/auth';
import { queryOne } from '../db/database';
import { unreadCount } from '../core/notifications';

export const authRouter = Router();

authRouter.post('/login', h((req, res) => {
  const body = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body);
  res.json(login(body.email, body.password));
}));

/** Demo personas for the login screen (passwords are all "demo1234"). */
authRouter.get('/personas', h((_req, res) => {
  res.json(listDemoUsers().map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, title: u.title, avatar_url: u.avatar_url, org: u.brand_name ?? u.agency_name ?? (u.creator_handle ? `@${u.creator_handle}` : null) })));
}));

authRouter.get('/me', requireAuth, h((req, res) => {
  const u = req.user!;
  const org = u.role === 'BRAND' ? queryOne(`SELECT id, name, industry, logo_url FROM brands WHERE id = ?`, [u.brand_id ?? ''])
    : u.role === 'AGENCY' ? queryOne(`SELECT id, name, logo_url FROM agencies WHERE id = ?`, [u.agency_id ?? ''])
    : u.role === 'CREATOR' ? queryOne(`SELECT id, name, handle, avatar_url FROM creators WHERE id = ?`, [u.creator_id ?? ''])
    : null;
  const audience = u.role === 'BRAND' ? ['BRAND', u.brand_id] : u.role === 'AGENCY' ? ['AGENCY', u.agency_id] : u.role === 'CREATOR' ? ['CREATOR', u.creator_id] : null;
  res.json({ user: u, org, unread_notifications: audience && audience[1] ? unreadCount(audience[0] as any, audience[1]) : 0 });
}));
