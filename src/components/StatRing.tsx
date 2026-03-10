interface StatRingProps {
  value: number;
  max: number;
  label: string;
  color: string;
  size?: number;
  strokeWidth?: number;
}

export function StatRing({
  value,
  max,
  label,
  color,
  size = 80,
  strokeWidth = 7,
}: StatRingProps) {
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - progress);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-label={`${value} / ${max} ${label}`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            transform: `rotate(90deg)`,
            transformOrigin: `${center}px ${center}px`,
            fill: color,
            fontSize: value >= 100 ? '20px' : '24px',
            fontWeight: 700,
          }}
        >
          {value}
        </text>
      </svg>
      <span className="text-[0.6rem] uppercase tracking-widest text-gray-500">
        {label}
      </span>
    </div>
  );
}
