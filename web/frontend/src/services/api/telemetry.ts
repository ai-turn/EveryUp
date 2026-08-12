// Shared OpenTelemetry read models used by Agent-discovered and direct
// Observed Services.
export interface OtelMetricName {
  metricName: string;
  metricType: 'gauge' | 'sum' | 'histogram';
  unit?: string;
  lastAt: string;
}

export interface OtelMetricPoint {
  id: number;
  metricName: string;
  metricType: string;
  unit?: string;
  attributes?: Record<string, unknown>;
  value: number;
  count?: number;
  total?: number;
  createdAt: string;
}

export interface OtelServiceMetric {
  serviceId?: string;
  serviceName: string;
  metricName: string;
  metricType: string;
  unit?: string;
  value: number;
}

// Shared API trace projections used by Agent-discovered and direct Observed
// Services.
export interface ApiRequestStatBucket {
  time: string;
  count: number;
  errorCount: number;
  p50: number;
  p95: number;
  timed: number;
}

export interface ApiRequestStatusSummary {
  count2xx: number;
  count3xx: number;
  count4xx: number;
  count5xx: number;
  countOther: number;
  top5xxMethod?: string;
  top5xxPath?: string;
  top5xxCount?: number;
}
