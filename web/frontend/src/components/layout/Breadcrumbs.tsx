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
          {index > 0 && <span className="text-text-muted">/</span>}
          {item.href ? (
            <Link
              to={item.href}
              className="flex items-center gap-1 text-text-muted hover:text-text-base transition-colors"
            >
              {index === 0 && <MaterialIcon name="arrow_back" className="text-lg" />}
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ) : (
            <span className="text-text-base text-sm font-semibold">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
