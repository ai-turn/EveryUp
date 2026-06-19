import type { RequestFn } from './base';

// --- Types ---

export interface TimelineItem {
  id: string;
  type: string;
  message: string;
  time: string;
  service?: string;
  serviceId?: string;
}

// --- API ---

export function createDashboardApi(request: RequestFn) {
  return {
    getDashboardTimeline: async () => {
      const data = await request<TimelineItem[]>('/dashboard/timeline');
      return data || [];
    },
  };
}
