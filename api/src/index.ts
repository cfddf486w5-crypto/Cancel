import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { stringify } from 'csv-stringify/sync';
import { addAttachmentRecord, addComment, changeStatus, createRequest } from './lib/service.js';
import { optionsResponse, getUserFromRequest, json, requireRole, signToken } from './lib/http.js';
import { db } from './lib/store.js';
import { saveAttachment } from './lib/attachment.js';

const handleOptions = (req: HttpRequest): HttpResponseInit | null => (req.method === 'OPTIONS' ? optionsResponse() : null);

app.http('auth-pin', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'auth/pin',
  handler: async (req) => {
    const opt = handleOptions(req); if (opt) return opt;
    const { pin } = (await req.json()) as { pin: string };
    const user = db.users.find((u) => u.pin === pin);
    if (!user) return json(401, { error: 'PIN invalide' });
    return json(200, { token: signToken(user), user: { id: user.id, name: user.name, role: user.role } });
  }
});

app.http('me', {
  methods: ['GET', 'OPTIONS'], authLevel: 'anonymous', route: 'me',
  handler: async (req) => {
    const opt = handleOptions(req); if (opt) return opt;
    const user = getUserFromRequest(req);
    if (!user) return json(401, { error: 'Non connecté' });
    return json(200, user);
  }
});

app.http('requests-create-list', {
  methods: ['GET', 'POST', 'OPTIONS'], authLevel: 'anonymous', route: 'requests',
  handler: async (req) => {
    const opt = handleOptions(req); if (opt) return opt;
    const user = getUserFromRequest(req);
    const deny = requireRole(user, ['requester', 'approver', 'viewer']);
    if (deny) return json(403, { error: deny });
    if (req.method === 'POST') {
      const denyCreate = requireRole(user, ['requester', 'approver']);
      if (denyCreate) return json(403, { error: denyCreate });
      try {
        const payload = await req.json();
        return json(201, createRequest(payload as any, user!));
      } catch (error) {
        return json(400, { error: (error as Error).message });
      }
    }

    const updatedSince = req.query.get('updatedSince');
    let result = [...db.requests];
    if (updatedSince) result = result.filter((r) => r.updatedAt > updatedSince);
    const status = req.query.get('status');
    if (status) result = result.filter((r) => r.status === status);
    const urgent = req.query.get('urgent');
    if (urgent !== null) result = result.filter((r) => r.urgent === (urgent === 'true'));
    const site = req.query.get('site');
    if (site) result = result.filter((r) => r.cancellation_location === site);
    const q = req.query.get('q');
    if (q) result = result.filter((r) => [r.so_number, r.client_name].join(' ').toLowerCase().includes(q.toLowerCase()));
    return json(200, { items: result, pollIntervalSeconds: 20 });
  }
});

app.http('request-detail-patch', {
  methods: ['GET', 'PATCH', 'OPTIONS'], authLevel: 'anonymous', route: 'requests/{id}',
  handler: async (req) => {
    const opt = handleOptions(req); if (opt) return opt;
    const user = getUserFromRequest(req);
    const deny = requireRole(user, ['requester', 'approver', 'viewer']);
    if (deny) return json(403, { error: deny });
    const id = req.params.id;
    const request = db.requests.find((r) => r.id === id);
    if (!request) return json(404, { error: 'Demande introuvable' });
    if (req.method === 'GET') return json(200, request);

    const body = await req.json() as any;
    if (body.action === 'status') {
      const denyApprove = requireRole(user, ['approver']);
      if (denyApprove) return json(403, { error: denyApprove });
      try {
        return json(200, changeStatus(request, body.status, user!, body.note, body.refusal_reason));
      } catch (error) {
        return json(400, { error: (error as Error).message });
      }
    }

    return json(400, { error: 'Action PATCH inconnue' });
  }
});

app.http('request-attachment', {
  methods: ['POST', 'OPTIONS'], authLevel: 'anonymous', route: 'requests/{id}/attachments',
  handler: async (req) => {
    const opt = handleOptions(req); if (opt) return opt;
    const user = getUserFromRequest(req);
    const deny = requireRole(user, ['requester', 'approver']);
    if (deny) return json(403, { error: deny });
    const request = db.requests.find((r) => r.id === req.params.id);
    if (!request) return json(404, { error: 'Demande introuvable' });
    if (request.status === 'Archivé') return json(400, { error: 'Impossible de joindre un fichier à une demande archivée.' });

    const body = await req.json() as { fileName: string; contentType: string; base64: string };
    const bytes = Buffer.from(body.base64, 'base64');
    const url = await saveAttachment(request.id, body.fileName, body.contentType, bytes);
    addAttachmentRecord(request, body.fileName, body.contentType, url, user!);
    return json(201, { url });
  }
});

app.http('request-comment', {
  methods: ['POST', 'OPTIONS'], authLevel: 'anonymous', route: 'requests/{id}/comment',
  handler: async (req) => {
    const opt = handleOptions(req); if (opt) return opt;
    const user = getUserFromRequest(req);
    const deny = requireRole(user, ['requester', 'approver']);
    if (deny) return json(403, { error: deny });
    const request = db.requests.find((r) => r.id === req.params.id);
    if (!request) return json(404, { error: 'Demande introuvable' });
    const { message } = await req.json() as { message: string };
    if (!message?.trim()) return json(400, { error: 'Commentaire vide' });
    addComment(request, message.trim(), user!);
    return json(201, { ok: true });
  }
});

app.http('request-audit', {
  methods: ['GET', 'OPTIONS'], authLevel: 'anonymous', route: 'requests/{id}/audit',
  handler: async (req) => {
    const opt = handleOptions(req); if (opt) return opt;
    const user = getUserFromRequest(req);
    const deny = requireRole(user, ['requester', 'approver', 'viewer']);
    if (deny) return json(403, { error: deny });
    const items = db.audits.filter((a) => a.requestId === req.params.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return json(200, { items });
  }
});

app.http('export-csv', {
  methods: ['GET', 'OPTIONS'], authLevel: 'anonymous', route: 'exports/requests.csv',
  handler: async (req) => {
    const opt = handleOptions(req); if (opt) return opt;
    const user = getUserFromRequest(req);
    const deny = requireRole(user, ['requester', 'approver', 'viewer']);
    if (deny) return json(403, { error: deny });
    const csv = stringify(db.requests.map((r) => ({ Date: r.request_date_time, SO: r.so_number, Client: r.client_name, Statut: r.status, Urgent: r.urgent, Site: r.cancellation_location, Demandeur: r.requested_by })), { header: true });
    return { status: 200, body: csv, headers: { 'Content-Type': 'text/csv', 'Access-Control-Allow-Origin': '*' } };
  }
});
