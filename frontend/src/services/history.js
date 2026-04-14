const STORAGE_KEY = 'aidetector.history.v1';
const MAX_ITEMS = 100;

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
        .map((x) => ({
            id: String(x.id ?? ''),
            ts: String(x.ts ?? ''),
            type: String(x.type ?? ''),
            result: x.result === 'Real' || x.result === 'Fake' ? x.result : 'Fake',
            confidence: Number.isFinite(Number(x.confidence)) ? Number(x.confidence) : 0,
            label: typeof x.label === 'string' ? x.label : ''
        }))
        .filter((x) => x.id && x.ts && x.type);
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
        type: record?.type || 'unknown',
        result: record?.result === 'Real' || record?.result === 'Fake' ? record.result : 'Fake',
        confidence: Number.isFinite(Number(record?.confidence)) ? Number(record.confidence) : 0,
        label: typeof record?.label === 'string' ? record.label : ''
    };

    const prev = loadHistory();
    const next = [item, ...prev].slice(0, MAX_ITEMS);
    saveHistory(next);
    return next;
}
