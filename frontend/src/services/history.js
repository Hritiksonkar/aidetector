const STORAGE_KEY = 'aidetector.history.v1';
const MAX_ITEMS = 100;

function clamp(n, min = 0, max = 100) {
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
}

function trustScoreFromResult(result, confidencePct) {
    const c = clamp(confidencePct, 0, 100);
    return result === 'Real' ? c : 100 - c;
}

function safeParseJson(raw) {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function loadHistory() {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = safeParseJson(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
        .filter((x) => x && typeof x === 'object')
        .map((x) => {
            const kind = String(x.kind ?? x.type ?? 'unknown');
            const result = x.result === 'Real' || x.result === 'Fake' ? x.result : 'Fake';
            const confidence = Number.isFinite(Number(x.confidence)) ? Number(x.confidence) : 0;
            const trustScore = Number.isFinite(Number(x.trustScore))
                ? Number(x.trustScore)
                : trustScoreFromResult(result, confidence);

            return {
                id: String(x.id ?? ''),
                ts: String(x.ts ?? ''),
                kind,
                result,
                confidence: clamp(confidence, 0, 100),
                trustScore: clamp(trustScore, 0, 100),
                label: typeof x.label === 'string' ? x.label : '',
                why: Array.isArray(x.why) ? x.why.map(String).slice(0, 8) : [],
                meta: x.meta && typeof x.meta === 'object' ? x.meta : undefined
            };
        })
        .filter((x) => x.id && x.ts && x.kind);
}

export function saveHistory(items) {
    if (typeof window === 'undefined') return;
    const list = Array.isArray(items) ? items.slice(0, MAX_ITEMS) : [];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearHistory() {
    if (typeof window === 'undefined') return [];
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
}

export function addHistoryRecord(record) {
    const now = new Date();
    const item = {
        id: record?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ts: record?.ts || now.toISOString(),
        kind: record?.kind || record?.type || 'unknown',
        result: record?.result === 'Real' || record?.result === 'Fake' ? record.result : 'Fake',
        confidence: clamp(Number.isFinite(Number(record?.confidence)) ? Number(record.confidence) : 0, 0, 100),
        trustScore: clamp(
            Number.isFinite(Number(record?.trustScore))
                ? Number(record.trustScore)
                : trustScoreFromResult(record?.result, record?.confidence),
            0,
            100
        ),
        label: typeof record?.label === 'string' ? record.label : '',
        why: Array.isArray(record?.why) ? record.why.map(String).slice(0, 8) : [],
        meta: record?.meta && typeof record.meta === 'object' ? record.meta : undefined
    };

    const prev = loadHistory();
    const next = [item, ...prev].slice(0, MAX_ITEMS);
    saveHistory(next);
    return next;
}
