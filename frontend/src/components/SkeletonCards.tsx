"use client";

// Placeholder cards while a list loads, so the screen never goes blank.
type Props = {
  count?: number;
  label: string;
};

export default function SkeletonCards({ count = 6, label }: Props) {
  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 min-[1680px]:grid-cols-4"
      role="status"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          className="bg-surface border border-solid border-line rounded-lg p-3 flex gap-3"
          key={index}
        >
          <div className="[background:linear-gradient(90deg,var(--skeleton)_25%,var(--skeleton-hi)_37%,var(--skeleton)_63%)] bg-size-[400%_100%] animate-shimmer size-18 rounded-md!" />
          <div className="flex-1 flex flex-col gap-2 pt-1">
            <div className="[background:linear-gradient(90deg,var(--skeleton)_25%,var(--skeleton-hi)_37%,var(--skeleton)_63%)] bg-size-[400%_100%] animate-shimmer rounded-sm h-3 w-[40%]" />
            <div className="[background:linear-gradient(90deg,var(--skeleton)_25%,var(--skeleton-hi)_37%,var(--skeleton)_63%)] bg-size-[400%_100%] animate-shimmer rounded-sm h-3 w-[70%]" />
            <div className="[background:linear-gradient(90deg,var(--skeleton)_25%,var(--skeleton-hi)_37%,var(--skeleton)_63%)] bg-size-[400%_100%] animate-shimmer rounded-sm h-3 w-[55%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
