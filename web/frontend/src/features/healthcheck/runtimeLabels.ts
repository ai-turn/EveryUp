// Display names for agent-detected language runtimes.
const LABELS: Record<string, string> = {
  java: 'Java',
  node: 'Node.js',
  python: 'Python',
  go: 'Go',
  dotnet: '.NET',
};

export function runtimeLabel(runtime?: string): string {
  if (!runtime) return '';
  return LABELS[runtime] ?? runtime;
}
