import { useId } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  showEndpoint?: boolean;
  showMidline?: boolean;
  // When true the SVG stretches to fill its container width (width is kept as
  // the viewBox coordinate space). Stroke stays crisp via non-scaling-stroke.
  fluid?: boolean;
}

export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = '#3b82f6',
  className,
  showEndpoint = true,
  showMidline = true,
  fluid = false,
}: SparklineProps) {
  const rawId = useId();

  if (!data || data.length < 2) return null;

  const safeId = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `sparkline-fill-${safeId}`;
  const glowId = `sparkline-glow-${safeId}`;
  const padX = 2;
  const padY = Math.max(3, Math.min(5, height * 0.14));
  const smoothed = data.map((value, index) => {
    const previous = data[Math.max(0, index - 1)];
    const next = data[Math.min(data.length - 1, index + 1)];
    return previous * 0.2 + value * 0.6 + next * 0.2;
  });

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const visibleRange = range < 8 ? 8 : range;
  const center = (min + max) / 2;
  const chartMin = center - visibleRange / 2;
  const chartHeight = height - padY * 2;
  const stepX = (width - padX * 2) / (smoothed.length - 1);
  const clampY = (y: number) => Math.max(padY, Math.min(height - padY, y));
  const points = smoothed.map((value, index) => ({
    x: padX + index * stepX,
    y: clampY(padY + chartHeight - ((value - chartMin) / visibleRange) * chartHeight),
  }));
  const linePath = pointsToPath(points);
  const lastPoint = points[points.length - 1];
  const baselineY = height - padY;
  const areaPath = `${linePath} L${width - padX},${baselineY} L${padX},${baselineY} Z`;

  return (
    <svg
      width={fluid ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio={fluid ? 'none' : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="62%" stopColor={color} stopOpacity="0.07" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.24 0"
          />
        </filter>
      </defs>

      {showMidline && (
        <line
          x1={padX}
          y1={height / 2}
          x2={width - padX}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth="1"
          className="text-slate-100 dark:text-ui-border-dark/60"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
        opacity="0.26"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showEndpoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="2.3"
          fill="white"
          stroke={color}
          strokeWidth="1.6"
          className="dark:fill-bg-surface-dark"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

function pointsToPath(points: Array<{ x: number; y: number }>) {
  return points.reduce((path, point, index, all) => {
    if (index === 0) return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;

    const previous = all[index - 1];
    const beforePrevious = all[Math.max(0, index - 2)];
    const next = all[Math.min(all.length - 1, index + 1)];
    const smoothing = 0.18;
    const cp1x = previous.x + (point.x - beforePrevious.x) * smoothing;
    const cp1y = previous.y + (point.y - beforePrevious.y) * smoothing;
    const cp2x = point.x - (next.x - previous.x) * smoothing;
    const cp2y = point.y - (next.y - previous.y) * smoothing;

    return `${path} C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }, '');
}
