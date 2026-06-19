import { CSSProperties } from 'react';

interface MaterialIconProps {
  name: string;
  className?: string;
  style?: CSSProperties;
}

export function MaterialIcon({ name, className = '', style }: MaterialIconProps) {
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}
