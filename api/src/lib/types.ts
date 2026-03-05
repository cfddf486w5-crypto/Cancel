export type Role = 'requester' | 'approver' | 'viewer';

export type RequestStatus = 'Nouveau' | 'En validation' | 'Approuvé' | 'Refusé' | 'Exécuté' | 'Archivé';

export interface User {
  id: string;
  name: string;
  pin: string;
  role: Role;
}

export interface LineItem {
  product_sku_or_name: string;
  qty: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface CancellationRequest {
  id: string;
  so_number: string;
  client_name: string;
  requested_by: string;
  cancellation_location: string;
  reason: 'Client cancel' | 'Erreur de qty' | 'Zéro pick' | 'Client n’est jamais venu chercher' | 'Service clientèle';
  reason_details?: string;
  request_date_time: string;
  urgent: boolean;
  bill_transport: boolean;
  carrier?: string;
  line_items: LineItem[];
  attachments: Attachment[];
  status: RequestStatus;
  refusal_reason?: string;
  execution_note?: string;
  comments: Array<{ id: string; message: string; userId: string; userName: string; timestamp: string }>;
  createdAt: string;
  updatedAt: string;
  lastAction: string;
}

export interface AuditEvent {
  id: string;
  requestId: string;
  userId: string;
  userName: string;
  action: string;
  fromStatus?: RequestStatus;
  toStatus?: RequestStatus;
  note?: string;
  timestamp: string;
}
