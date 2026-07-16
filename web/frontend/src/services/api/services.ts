import { request } from './base';

// --- Types ---

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LinkedRequest {
  id: number;
  method: string;
  path: string;
  statusCode: number;
  isError: boolean;
}

export interface LogEntry {
  id: number;
  serviceId: string;
  serviceName?: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  source?: 'internal' | 'otlp';
  fingerprint?: string;
  traceId?: string;
  spanId?: string;
  createdAt: string;
  linkedRequest?: LinkedRequest;
}

export interface ApiRequest {
  id: number;
  serviceId: string;
  requestId: string;
  method: string;
  path: string;
  pathTemplate: string;
  route?: string;
  serviceName?: string;
  traceId?: string;
  spanId?: string;
  statusCode: number;
  durationMs: number;
  clientIp?: string;
  error?: string;
  isError: boolean;
  createdAt: string;
}

export interface TraceSpanEvent {
  name: string;
  timeUnixNano?: number;
  attributes?: Record<string, unknown>;
}

export interface TraceSpan {
  id: number;
  serviceId?: string;
  serviceName?: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: string;
  startUnixNano: number;
  endUnixNano: number;
  durationMs: number;
  statusCode?: string;
  statusMessage?: string;
  attributes?: Record<string, unknown>;
  events?: TraceSpanEvent[];
  resource?: Record<string, unknown>;
  createdAt: string;
}

export interface TraceDetail {
  traceId: string;
  spans: TraceSpan[];
  logs: LogEntry[];
  apiRequests: ApiRequest[];
}

export interface AuditEvent {
  id: number;
  userId: number;
  username: string;
  action: string;
  traceId?: string;
  metadata?: string;
  createdAt: string;
}

// --- API ---

export const servicesApi = {
  getTrace: (traceId: string) =>
    request<TraceDetail>(`/traces/${traceId}`),

  getAuditEvents: (params?: { action?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<AuditEvent[]>(`/audit${qs ? `?${qs}` : ''}`);
  },
};
