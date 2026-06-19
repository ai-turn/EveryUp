import { Link } from 'react-router-dom';
import { MaterialIcon } from '../common';
import type { BreadcrumbItem } from '../../types/common';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <div className="flex items-center gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <span className="text-slate-600 dark:text-text-dim-dark">/</span>}
          {item.href ? (
            <Link
              to={item.href}
              className="flex items-center gap-1 text-slate-500 dark:text-text-muted-dark hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {index === 0 && <MaterialIcon name="arrow_back" className="text-lg" />}
              <span className="text-base font-medium">{item.label}</span>
            </Link>
          ) : (
            <span className="text-slate-900 dark:text-white text-base font-semibold tracking-wide">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
