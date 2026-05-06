/**
 * Runtime Tailwind class mappings for status-driven UI.
 *
 * CSS design tokens (color values) live exclusively in `src/index.css` (@theme block).
 * This file contains *Tailwind class name maps* used for dynamic status rendering —
 * they are not CSS variable duplicates and cannot be replaced by CSS variables alone.
 *
 * Usage: `statusColorClasses[service.status].bg` → Tailwind bg class string
 */

/**
 * Service status color mapping (healthy/degraded/warning/offline)
 */
export const statusColorClasses = {
  healthy: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    pulse: 'bg-emerald-500',
    border: 'border-emerald-500/20',
  },
  degraded: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    pulse: 'bg-red-500',
    border: 'border-red-500/20',
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    pulse: 'bg-amber-500',
    border: 'border-amber-500/20',
  },
  offline: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
    pulse: 'bg-slate-500',
    border: 'border-slate-500/20',
  },
} as const;

/**
 * Infrastructure status color mapping (healthy/warning/critical/error)
 * Uses lime for healthy to visually distinguish from service status
 */
export const infraStatusColorClasses = {
  healthy: {
    bg: 'bg-lime-400/10',
    text: 'text-lime-500 dark:text-lime-400',
    dot: 'bg-lime-500 dark:bg-lime-400',
    badge: 'bg-lime-400/10 text-lime-500',
    border: 'border-lime-500/20',
  },
  warning: {
    bg: 'bg-amber-400/10',
    text: 'text-amber-500 dark:text-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
    badge: 'bg-amber-400/10 text-amber-500',
    border: 'border-amber-500/20',
  },
  critical: {
    bg: 'bg-red-400/10',
    text: 'text-red-500 dark:text-red-400',
    dot: 'bg-red-500 dark:bg-red-400',
    badge: 'bg-red-400/10 text-red-500',
    border: 'border-red-500/20',
  },
  error: {
    bg: 'bg-red-400/10',
    text: 'text-red-500 dark:text-red-400',
    dot: 'bg-red-500 dark:bg-red-400',
    badge: 'bg-red-400/10 text-red-500',
    border: 'border-red-500/20',
  },
  paused: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-500 dark:text-text-muted-dark',
    dot: 'bg-slate-500 dark:bg-slate-400',
    badge: 'bg-slate-500/10 text-slate-500',
    border: 'border-slate-500/20',
  },
  unknown: {
    bg: 'bg-amber-400/10',
    text: 'text-amber-500 dark:text-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
    badge: 'bg-amber-400/10 text-amber-500',
    border: 'border-amber-500/20',
  },
} as const;

/**
 * Incident/Error level color classes
 */
export const incidentColorClasses = {
  error: {
    icon: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  warning: {
    icon: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  success: {
    icon: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  info: {
    icon: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
} as const;

/**
 * Returns a CSS variable reference for use in inline styles (e.g. recharts color props).
 * Prefer Tailwind classes for static styles — use this only when a CSS string is required.
 */
export function getCSSVariable(token: string): string {
  return `var(--color-${token})`;
}
