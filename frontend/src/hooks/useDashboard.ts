import { api } from '../services/api';
import { useDataFetch } from './useDataFetch';
import { mockServices, mockIncidents } from '../mocks/dashboard';

export function useDashboardServices() {
  return useDataFetch(mockServices, async () => {
    const services = await api.getServices(['http', 'tcp', 'icmp']);
    const statusMap: Record<string, 'healthy' | 'degraded' | 'warning' | 'offline'> = {
      healthy: 'healthy',
      unhealthy: 'degraded',
      unknown: 'warning',
    };
    return services.map((service) => ({
      id: service.id,
      name: service.name,
      status: statusMap[service.status] || 'warning',
      latency: `${service.responseTime || 0}ms`,
      uptime: `${(service.uptime || 0).toFixed(1)}%`,
      icon: '',
      type: service.type as 'http' | 'tcp' | undefined,
      interval: service.interval,
      isActive: service.isActive,
    }));
  });
}

export function useDashboardIncidents() {
  return useDataFetch(mockIncidents, async () => {
    const timeline = await api.getDashboardTimeline();
    return timeline.map((item) => ({
      id: item.id,
      time: new Date(item.time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      type: item.type as 'warning' | 'error' | 'success' | 'info',
      serviceName: item.service || 'System',
      message: item.message,
      serviceId: item.serviceId,
    }));
  });
}
