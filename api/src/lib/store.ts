import { v4 as uuid } from 'uuid';
import { AuditEvent, CancellationRequest, User } from './types.js';

const now = () => new Date().toISOString();

const users: User[] = [
  { id: 'u1', name: 'Service clientèle', pin: '1111', role: 'requester' },
  { id: 'u2', name: 'Superviseur', pin: '2222', role: 'approver' },
  { id: 'u3', name: 'Lecture', pin: '3333', role: 'viewer' }
];

const requests: CancellationRequest[] = [
  {
    id: uuid(),
    so_number: 'SO/02xx1234567',
    client_name: 'Client Urgent',
    requested_by: 'Agent 1',
    cancellation_location: 'Laval',
    reason: 'Client cancel',
    request_date_time: now(),
    urgent: true,
    bill_transport: true,
    carrier: 'Loomis',
    line_items: [{ product_sku_or_name: 'SKU-1', qty: 3 }],
    attachments: [],
    status: 'Nouveau',
    comments: [],
    createdAt: now(),
    updatedAt: now(),
    lastAction: 'Création'
  },
  {
    id: uuid(),
    so_number: 'SO/02xx7654321',
    client_name: 'Client Validation',
    requested_by: 'Agent 2',
    cancellation_location: 'Langelier',
    reason: 'Zéro pick',
    request_date_time: now(),
    urgent: false,
    bill_transport: false,
    line_items: [{ product_sku_or_name: 'SKU-2', qty: 1 }],
    attachments: [],
    status: 'En validation',
    comments: [],
    createdAt: now(),
    updatedAt: now(),
    lastAction: 'Prise en charge'
  },
  {
    id: uuid(),
    so_number: 'SO/02xx9999999',
    client_name: 'Client Archive',
    requested_by: 'Agent 3',
    cancellation_location: 'Laval2',
    reason: 'Erreur de qty',
    request_date_time: now(),
    urgent: false,
    bill_transport: false,
    line_items: [{ product_sku_or_name: 'SKU-3', qty: 6 }],
    attachments: [],
    status: 'Archivé',
    comments: [],
    createdAt: now(),
    updatedAt: now(),
    lastAction: 'Archivage automatique'
  }
];

const audits: AuditEvent[] = [];

export const db = { users, requests, audits };
