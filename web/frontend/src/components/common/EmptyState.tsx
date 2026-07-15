import { MaterialIcon } from './MaterialIcon';
import { Button } from './Button';

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
      <div className="w-20 h-20 rounded-full bg-ui-hover flex items-center justify-center mb-6">
        <MaterialIcon name={icon} className="text-4xl text-text-dim" />
      </div>
      <h3 className="text-xl font-bold text-text-base mb-2 text-center">
        {title}
      </h3>
      {description && (
        <p className="text-text-muted text-center max-w-md mb-6">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
