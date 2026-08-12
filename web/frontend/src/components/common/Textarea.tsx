import type { ComponentPropsWithRef } from 'react';
import { FIELD_SHELL } from './Input';

interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  invalid?: boolean;
  mono?: boolean;
}

export function Textarea({ invalid = false, mono = false, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={`${FIELD_SHELL} py-2.5 placeholder:text-text-dim ${invalid ? 'border-red-500' : 'border-ui-border'} ${mono ? 'font-mono' : ''} ${className}`}
      {...props}
    />
  );
}
