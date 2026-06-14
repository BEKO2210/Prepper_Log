interface SkeletonProps {
  className?: string;
}

/** Base shimmer block. Uses Tailwind's animate-pulse (disabled under reduced-motion via index.css). */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-primary-700/50 ${className}`} aria-hidden />;
}

function Card({ className = '' }: SkeletonProps) {
  return <Skeleton className={`rounded-2xl ${className}`} />;
}

/** Skeleton placeholder for the Dashboard while the local DB loads. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5 pb-4" role="status" aria-busy="true">
      <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-5">
        <div className="flex items-center justify-around">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-2 w-10" />
            </div>
          ))}
        </div>
      </div>
      <Card className="h-[88px]" />
      <div className="grid grid-cols-2 gap-3">
        <Card className="h-[72px] rounded-xl" />
        <Card className="h-[72px] rounded-xl" />
      </div>
      <Card className="h-24" />
      <Card className="h-36" />
    </div>
  );
}

/** Skeleton placeholder for the product list. */
export function ListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <Skeleton className="h-10 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Generic page skeleton — used for lazy-loaded pages and stat/score views. */
export function PageSkeleton() {
  return (
    <div className="space-y-4 pb-4" role="status" aria-busy="true">
      <Skeleton className="h-7 w-1/2" />
      <Card className="h-32" />
      <Card className="h-40" />
      <Card className="h-28" />
    </div>
  );
}
