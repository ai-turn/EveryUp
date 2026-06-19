import { MaterialIcon } from './MaterialIcon';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center mb-6">
        <MaterialIcon name={icon} className="text-4xl text-slate-400 dark:text-text-dim-dark" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">
        {title}
      </h3>
      {description && (
        <p className="text-slate-500 dark:text-text-muted-dark text-center max-w-md mb-6">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 rounded-lg text-white font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
