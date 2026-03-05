import { v4 as uuid } from 'uuid';
import { notificationsConfigured } from './config.js';
import { db } from './store.js';
import { AuditEvent, CancellationRequest, RequestStatus, User } from './types.js';

const allowedReasons = ['Client cancel', 'Erreur de qty', 'Zéro pick', 'Client n’est jamais venu chercher', 'Service clientèle'];

const addAudit = (event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
  db.audits.push({ id: uuid(), timestamp: new Date().toISOString(), ...event });
};

const notify = (message: string) => {
  if (!notificationsConfigured) {
    return { notified: false, message: 'Notifications désactivées (config manquante)' };
  }
  console.log('NOTIFY', message);
  return { notified: true };
};

export const createRequest = (payload: Partial<CancellationRequest>, user: User) => {
  if (!payload.so_number || !payload.client_name || !payload.requested_by || !payload.cancellation_location || !payload.reason) {
    throw new Error('Champs obligatoires manquants.');
  }
  if (!allowedReasons.includes(payload.reason)) throw new Error('Raison invalide.');
  if (!payload.line_items?.length) throw new Error('Au moins une ligne article est obligatoire.');
  if (payload.bill_transport && !payload.carrier) throw new Error('Le transporteur est obligatoire si facturer transport = oui.');

  const now = new Date().toISOString();
  const req: CancellationRequest = {
    id: uuid(),
    so_number: payload.so_number,
    client_name: payload.client_name,
    requested_by: payload.requested_by,
    cancellation_location: payload.cancellation_location,
    reason: payload.reason as CancellationRequest['reason'],
    reason_details: payload.reason_details,
    request_date_time: payload.request_date_time || now,
    urgent: Boolean(payload.urgent),
    bill_transport: Boolean(payload.bill_transport),
    carrier: payload.carrier,
    line_items: payload.line_items,
    attachments: [],
    status: 'Nouveau',
    comments: [],
    createdAt: now,
    updatedAt: now,
    lastAction: 'Création'
  };
  db.requests.unshift(req);
  addAudit({ requestId: req.id, userId: user.id, userName: user.name, action: 'CREATE', toStatus: 'Nouveau', note: 'Nouvelle demande' });
  notify(`Nouvelle demande ${req.so_number}`);
  if (req.urgent) notify(`URGENT ${req.so_number}`);
  return req;
};

export const changeStatus = (request: CancellationRequest, toStatus: RequestStatus, user: User, note?: string, refusalReason?: string) => {
  const fromStatus = request.status;
  if (toStatus === 'Refusé' && !refusalReason) throw new Error('Motif de refus obligatoire.');
  request.status = toStatus;
  request.updatedAt = new Date().toISOString();
  request.lastAction = `Statut: ${toStatus}`;
  if (refusalReason) request.refusal_reason = refusalReason;
  if (note && toStatus === 'Exécuté') request.execution_note = note;
  addAudit({ requestId: request.id, userId: user.id, userName: user.name, action: 'STATUS_CHANGE', fromStatus, toStatus, note: note || refusalReason });
  notify(`Demande ${request.so_number} => ${toStatus}`);

  if (toStatus === 'Exécuté') {
    request.status = 'Archivé';
    request.lastAction = 'Archivage automatique';
    request.updatedAt = new Date().toISOString();
    addAudit({ requestId: request.id, userId: user.id, userName: user.name, action: 'AUTO_ARCHIVE', fromStatus: 'Exécuté', toStatus: 'Archivé', note: 'Archivage automatique' });
  }
  return request;
};

export const addComment = (request: CancellationRequest, message: string, user: User) => {
  request.comments.push({ id: uuid(), message, userId: user.id, userName: user.name, timestamp: new Date().toISOString() });
  request.updatedAt = new Date().toISOString();
  request.lastAction = 'Commentaire ajouté';
  addAudit({ requestId: request.id, userId: user.id, userName: user.name, action: 'COMMENT', note: message });
};

export const addAttachmentRecord = (request: CancellationRequest, fileName: string, contentType: string, url: string, user: User) => {
  request.attachments.push({ id: uuid(), fileName, contentType, url, uploadedAt: new Date().toISOString(), uploadedBy: user.name });
  request.updatedAt = new Date().toISOString();
  request.lastAction = 'Pièce jointe ajoutée';
  addAudit({ requestId: request.id, userId: user.id, userName: user.name, action: 'ATTACHMENT', note: fileName });
};
