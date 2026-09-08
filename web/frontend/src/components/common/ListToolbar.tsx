import type { ReactNode } from 'react';

interface ListToolbarProps {
  search: ReactNode;
  children?: ReactNode;
}

export function ListToolbar({ search, children }: ListToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
      <div className="w-full min-w-0 sm:w-80 sm:shrink-0">{search}</div>
      {children && <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
