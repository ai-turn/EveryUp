import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';

interface CopyButtonProps {
  onCopy: () => Promise<boolean> | boolean | void;
  title: string;
  className: string;
  children?: ReactNode;
  disabled?: boolean;
  copiedDurationMs?: number;
}

export function CopyButton({
  onCopy,
  title,
  className,
  children,
  disabled = false,
  copiedDurationMs = 3000,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = async () => {
    const didCopy = await onCopy();
    if (didCopy === false) return;

    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), copiedDurationMs);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={className}
      title={title}
      aria-label={title}
    >
      <MaterialIcon
        name={copied ? 'check' : 'content_copy'}
        className={copied ? 'text-emerald-500 dark:text-emerald-400' : ''}
      />
      {children}
    </button>
  );
}
