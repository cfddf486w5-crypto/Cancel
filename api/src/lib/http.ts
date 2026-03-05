import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { createHmac } from 'crypto';
import { config } from './config.js';
import { db } from './store.js';
import { User } from './types.js';

export const json = (status: number, body: unknown): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'
  }
});

export const optionsResponse = (): HttpResponseInit => ({
  status: 204,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'
  }
});

export const signToken = (user: User) => {
  const payload = `${user.id}|${user.role}|${Date.now()}`;
  const sig = createHmac('sha256', config.jwtSecret).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
};

export const getUserFromRequest = (req: HttpRequest): User | null => {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.substring(7);
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [userId, role, issuedAt, sig] = raw.split('|');
    const check = createHmac('sha256', config.jwtSecret).update(`${userId}|${role}|${issuedAt}`).digest('hex');
    if (check !== sig) return null;
    return db.users.find((u) => u.id === userId && u.role === role) || null;
  } catch {
    return null;
  }
};

export const requireRole = (user: User | null, allowed: Array<User['role']>): string | null => {
  if (!user) return 'Authentification requise';
  if (!allowed.includes(user.role)) return 'Accès refusé pour ce rôle';
  return null;
};
