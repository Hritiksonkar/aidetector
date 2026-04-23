import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiDownload, FiSearch, FiTrash2 } from 'react-icons/fi';
import { clearHistory, loadHistory } from '../../services/history.js';
import { exportCsv, exportJson } from '../../utils/exporters.js';
import { formatPct } from '../../utils/score.js';

function Badge({ result }) {
    const isFake = result === 'Fake';
    return (
        <span
            className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${isFake ? 'bg-rose-500/15 text-rose-200 border-rose-500/20' : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
                }`}
        >
            {result}
        </span>
    );
}

export default function HistoryPanel({ onSelectRecord, refreshSignal = 0 }) {
    const [items, setItems] = useState(() => loadHistory());
    const [q, setQ] = useState('');
    const [type, setType] = useState('all');
    const [verdict, setVerdict] = useState('all');

    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        return items.filter((x) => {
            if (type !== 'all' && x.kind !== type) return false;
            if (verdict !== 'all' && x.result !== verdict) return false;
            if (!query) return true;
            const hay = `${x.kind} ${x.result} ${x.label}`.toLowerCase();
            return hay.includes(query);
        });
    }, [items, q, type, verdict]);

    useEffect(() => {
        setItems(loadHistory());
    }, [refreshSignal]);

    function doClear() {
        setItems(clearHistory());
        toast.success('History cleared');
    }

    function exportFilteredJson() {
        exportJson(`truthlens-history-${Date.now()}.json`, filtered);
        toast.success('Exported JSON');
    }

    function exportFilteredCsv() {
        const rows = filtered.map((x) => ({
            ts: x.ts,
            type: x.kind,
            result: x.result,
            confidence: Math.round(x.confidence),
            trustScore: Math.round(x.trustScore),
            label: x.label
        }));
        exportCsv(`truthlens-history-${Date.now()}.csv`, rows);
        toast.success('Exported CSV');
    }

    return (
        <div className="glass rounded-3xl p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="text-sm font-semibold text-slate-200/70">Analysis History</div>
                    <div className="mt-1 text-xs text-slate-200/60">Search, filter, export, and reuse past results.</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="glass rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-white/10 inline-flex items-center gap-2"
                        onClick={exportFilteredJson}
                    >
                        <FiDownload /> Export JSON
                    </button>
                    <button
                        type="button"
                        className="glass rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-white/10 inline-flex items-center gap-2"
                        onClick={exportFilteredCsv}
                    >
                        <FiDownload /> Export CSV
                    </button>
                    <button
                        type="button"
                        className="glass rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-white/10 inline-flex items-center gap-2"
                        onClick={doClear}
                    >
                        <FiTrash2 /> Clear
                    </button>
                </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3">
                        <FiSearch className="text-slate-200/60" />
                        <input
                            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-200/40"
                            placeholder="Search by type, label, or verdict…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <select
                        className="input py-3"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                    >
                        <option value="all">All Types</option>
                        <option value="text">Text</option>
                        <option value="news">News</option>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                    </select>
                    <select
                        className="input py-3"
                        value={verdict}
                        onChange={(e) => setVerdict(e.target.value)}
                    >
                        <option value="all">All Verdicts</option>
                        <option value="Real">Real</option>
                        <option value="Fake">Fake</option>
                    </select>
                </div>
            </div>

            <div className="mt-4 grid gap-3">
                {filtered.length === 0 ? (
                    <div className="text-sm text-slate-200/60">No history matches your filters.</div>
                ) : null}

                {filtered.slice(0, 24).map((x) => (
                    <button
                        key={x.id}
                        type="button"
                        className="glass w-full rounded-3xl px-4 py-4 text-left hover:bg-white/10"
                        onClick={() => {
                            onSelectRecord?.(x);
                            toast.success('Loaded record');
                        }}
                    >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black tracking-tight">{String(x.kind).toUpperCase()}</span>
                                <Badge result={x.result} />
                            </div>
                            <div className="text-xs text-slate-200/60">{new Date(x.ts).toLocaleString()}</div>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <div className="glass rounded-2xl px-3 py-2 text-xs text-slate-200/70">
                                Confidence: <span className="font-semibold text-slate-100">{formatPct(x.confidence)}</span>
                            </div>
                            <div className="glass rounded-2xl px-3 py-2 text-xs text-slate-200/70">
                                Trust: <span className="font-semibold text-slate-100">{formatPct(x.trustScore)}</span>
                            </div>
                            <div className="glass rounded-2xl px-3 py-2 text-xs text-slate-200/70 line-clamp-1">
                                {x.label || '—'}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
