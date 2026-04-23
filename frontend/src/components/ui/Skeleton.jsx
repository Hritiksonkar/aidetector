export function Skeleton({ className = '' }) {
    return <div className={`skeleton ${className}`} />;
}

export function SkeletonText({ lines = 3 }) {
    const n = Math.max(1, Math.min(8, Number(lines) || 3));
    return (
        <div className="space-y-2">
            {Array.from({ length: n }).map((_, i) => (
                <div
                    key={i}
                    className={`skeleton h-3 ${i === 0 ? 'w-4/5' : i === n - 1 ? 'w-2/3' : 'w-full'}`}
                />
            ))}
        </div>
    );
}
