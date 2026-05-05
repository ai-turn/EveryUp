import { ReactNode } from 'react';

/**
 * Escape hatch that breaks out of MainLayout's `max-w-360 mx-auto` container.
 *
 * MainLayout constrains every page to 1440px (max-w-360) for readability.
 * Wrap a chart-heavy or canvas-style section with `<PageBleed>` when you need
 * the full viewport width — typically dashboards with multi-column charts that
 * benefit from extra horizontal real estate.
 *
 * The negative margins cancel MainLayout's `p-4 sm:p-6 md:p-8` padding so the
 * child renders edge-to-edge.
 */
export function PageBleed({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-screen left-1/2 -translate-x-1/2 px-4 sm:px-6 md:px-8">
      {children}
    </div>
  );
}
