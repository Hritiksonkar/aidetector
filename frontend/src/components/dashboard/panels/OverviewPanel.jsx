import { useMemo } from 'react';
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiCpu, FiTrendingUp } from 'react-icons/fi';
import { loadHistory } from '../../../services/history.js';
import { formatCompactNumber, formatPct } from '../../../utils/score.js';

function Pill({ icon, label, value, tone = 'indigo' }) {
    const toneMap = {
        indigo: 'from-indigo-500/20 to-transparent',
        rose: 'from-rose-500/20 to-transparent',
        emerald: 'from-emerald-500/20 to-transparent',
        purple: 'from-purple-500/20 to-transparent',
        sky: 'from-sky-500/20 to-transparent'
    };

    return (
        <div className="glass relative overflow-hidden rounded-3xl p-5">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${toneMap[tone] || toneMap.indigo} opacity-70`} />
            <div className="relative flex items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-semibold text-slate-200/60">{label}</div>
                    <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
                </div>
                <div className="glass grid h-12 w-12 place-items-center rounded-2xl text-slate-100/90">{icon}</div>
            </div>
        </div>
    );
}

export default function OverviewPanel({ onQuickNavigate }) {
    const history = useMemo(() => loadHistory(), []);

    const stats = useMemo(() => {
        const items = Array.isArray(history) ? history : [];
        const total = items.length;
        const fake = items.filter((x) => x.result === 'Fake').length;
        const real = total - fake;
        const avgTrust = total
            ? Math.round(items.reduce((acc, x) => acc + Number(x.trustScore || 0), 0) / total)
            : 0;
        const aiCount = items.filter((x) => x.kind === 'text' && x.result === 'Fake').length;
        const deepfakeCount = items.filter((x) => x.kind === 'video' && x.result === 'Fake').length;
        const fakeRate = total ? Math.round((fake / total) * 100) : 0;
        return { total, fake, real, avgTrust, aiCount, deepfakeCount, fakeRate };
    }, [history]);

    const recent = useMemo(() => (Array.isArray(history) ? history.slice(0, 6) : []), [history]);

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Pill icon={<FiActivity />} label="Total Content Analyzed" value={formatCompactNumber(stats.total)} tone="indigo" />
                <Pill icon={<FiAlertTriangle />} label="Fake Content Detected" value={formatCompactNumber(stats.fake)} tone="rose" />
                <Pill icon={<FiCheckCircle />} label="Real Content Verified" value={formatCompactNumber(stats.real)} tone="emerald" />
                <Pill icon={<FiCpu />} label="AI Generated (Text)" value={formatCompactNumber(stats.aiCount)} tone="purple" />
                <Pill icon={<FiTrendingUp />} label="Deepfake Video Flags" value={formatCompactNumber(stats.deepfakeCount)} tone="sky" />
                <Pill icon={<FiCheckCircle />} label="Average Trust Score" value={formatPct(stats.avgTrust)} tone="emerald" />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <div className="glass rounded-3xl p-5 xl:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-slate-200/70">Recent Activity</div>
                            <div className="mt-1 text-xs text-slate-200/60">Latest verification events</div>
                        </div>
                        <div className="glass rounded-2xl px-3 py-2 text-xs text-slate-200/70">
                            Fake rate: <span className="font-semibold text-slate-100">{formatPct(stats.fakeRate)}</span>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                        {recent.length === 0 ? (
                            <div className="text-sm text-slate-200/60">No activity yet. Run your first detection.</div>
                        ) : null}
                        {recent.map((x) => (
                            <div key={x.id} className="glass rounded-3xl px-4 py-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black tracking-tight">{String(x.kind).toUpperCase()}</span>
                                        <span
                                            className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${x.result === 'Fake'
                                                    ? 'bg-rose-500/15 text-rose-200 border-rose-500/20'
                                                    : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
                                                }`}
                                        >
                                            {x.result}
                                        </span>
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
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass rounded-3xl p-5">
                    <div className="text-sm font-semibold text-slate-200/70">Quick Actions</div>
                    <div className="mt-1 text-xs text-slate-200/60">Jump directly into detection modules</div>

                    <div className="mt-4 space-y-2">
                        <button type="button" className="btn-grad w-full" onClick={() => onQuickNavigate?.('text')}>
                            Start Text Detection
                        </button>
                        <button type="button" className="btn-grad w-full" onClick={() => onQuickNavigate?.('image')}>
                            Start Image Detection
                        </button>
                        <button type="button" className="btn-grad w-full" onClick={() => onQuickNavigate?.('video')}>
                            Start Video Detection
                        </button>
                    </div>

                    <div className="mt-4 glass rounded-2xl px-4 py-3 text-xs text-slate-200/70">
                        Tip: Use History for exports, reports, and filtering.
                    </div>
                </div>
            </div>
        </div>
    );
}
