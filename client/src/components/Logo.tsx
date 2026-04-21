type Props = { className?: string; showWordmark?: boolean; size?: number };

export function Logo({ className = "", showWordmark = true, size = 32 }: Props) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} data-testid="logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        aria-label="ReviewHive logo"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer hexagon — amber */}
        <polygon
          points="24,3 42,13.5 42,34.5 24,45 6,34.5 6,13.5"
          fill="hsl(38, 92%, 50%)"
          stroke="hsl(30, 40%, 15%)"
          strokeWidth="1.5"
        />
        {/* Inner hex — light core */}
        <polygon
          points="24,12 34,17.75 34,29.25 24,35 14,29.25 14,17.75"
          fill="hsl(48, 100%, 92%)"
        />
        {/* Center dot */}
        <circle cx="24" cy="23.5" r="3.5" fill="hsl(30, 40%, 15%)" />
        {/* Small side accent */}
        <polygon
          points="24,15 30,18 30,24.5 24,27.5 18,24.5 18,18"
          fill="none"
          stroke="hsl(30, 40%, 15%)"
          strokeWidth="1.25"
        />
      </svg>
      {showWordmark && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Review<span className="text-primary">Hive</span>
        </span>
      )}
    </div>
  );
}
