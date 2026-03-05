import { AuditEvent, CancellationRequest, User } from './types';

const base = '/api';
const tokenKey = 'cancel_token';

const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(tokenKey) || ''}` });

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${base}${url}`, init);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || 'Erreur API');
  }
  return r.json();
}

export const api = {
  setToken: (t: string) => localStorage.setItem(tokenKey, t),
  logout: () => localStorage.removeItem(tokenKey),
  me: () => req<User>('/me', { headers: headers() }),
  login: (pin: string) => req<{ token: string; user: User }>('/auth/pin', { method: 'POST', headers: headers(), body: JSON.stringify({ pin }) }),
  list: (updatedSince?: string) => req<{ items: CancellationRequest[]; pollIntervalSeconds: number }>(`/requests${updatedSince ? `?updatedSince=${encodeURIComponent(updatedSince)}` : ''}`, { headers: headers() }),
  create: (payload: unknown) => req<CancellationRequest>('/requests', { method: 'POST', headers: headers(), body: JSON.stringify(payload) }),
  patchStatus: (id: string, status: string, note?: string, refusal_reason?: string) => req<CancellationRequest>(`/requests/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ action: 'status', status, note, refusal_reason }) }),
  audit: (id: string) => req<{ items: AuditEvent[] }>(`/requests/${id}/audit`, { headers: headers() }),
  comment: (id: string, message: string) => req(`/requests/${id}/comment`, { method: 'POST', headers: headers(), body: JSON.stringify({ message }) }),
  attach: (id: string, fileName: string, contentType: string, base64: string) => req(`/requests/${id}/attachments`, { method: 'POST', headers: headers(), body: JSON.stringify({ fileName, contentType, base64 }) })
};
