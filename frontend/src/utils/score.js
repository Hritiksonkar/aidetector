export function clamp(n, min = 0, max = 100) {
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
}

export function trustScoreFromResult(result, confidencePct) {
    const c = clamp(confidencePct, 0, 100);
    // Trust means "how likely is it genuine".
    return result === 'Real' ? c : 100 - c;
}

export function formatPct(n) {
    return `${Math.round(clamp(n, 0, 100))}%`;
}

export function formatCompactNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
    return String(Math.round(n));
}
