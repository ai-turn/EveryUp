/**
 * Mock data for available protocols in settings
 * Used by: ProtocolSelector component
 */

export interface Protocol {
  value: string;
  icon: string;
  label: string;
}

export const mockProtocols: Protocol[] = [
  { value: 'http', icon: 'language', label: 'HTTP/S' },
  { value: 'tcp', icon: 'router', label: 'TCP' },
  { value: 'grpc', icon: 'alt_route', label: 'gRPC' },
  { value: 'icmp', icon: 'settings_ethernet', label: 'ICMP' },
];
