import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiDownload, FiFileText } from 'react-icons/fi';
import { loadHistory } from '../../../services/history.js';
import { exportJson } from '../../../utils/exporters.js';
import { downloadPdfReport } from '../../../utils/pdf.js';
import { formatPct } from '../../../utils/score.js';

export default function ReportsPanel() {
    const history = useMemo(() => loadHistory(), []);
    const [selectedId, setSelectedId] = useState(() => history?.[0]?.id || '');

    const record = useMemo(() => history.find((x) => x.id === selectedId), [history, selectedId]);

    return (
        <div className="glass rounded-3xl p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="text-sm font-semibold text-slate-200/70">Reports</div>
                    <div className="mt-1 text-xs text-slate-200/60">Generate shareable exports from historical results.</div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="glass rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-white/10 inline-flex items-center gap-2"
                        onClick={() => {
                            if (!record) {
                                toast.error('No record selected');
                                return;
                            }
                            downloadPdfReport(`truthlens-report-${record.kind}-${record.id}.pdf`, record);
                            toast.success('PDF report downloaded');
                        }}
                    >
                        <FiFileText /> PDF Report
                    </button>
                    <button
                        type="button"
                        className="glass rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-white/10 inline-flex items-center gap-2"
                        onClick={() => {
                            if (!record) {
                                toast.error('No record selected');
                                return;
                            }
                            exportJson(`truthlens-analysis-${record.kind}-${record.id}.json`, record);
                            toast.success('Exported analysis');
                        }}
                    >
                        <FiDownload /> Export
                    </button>
                </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="lg:col-span-1">
                    <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                        {history.length === 0 ? <option value="">No history</option> : null}
                        {history.map((x) => (
                            <option key={x.id} value={x.id}>
                                {new Date(x.ts).toLocaleDateString()} • {String(x.kind).toUpperCase()} • {x.result}
                            </option>
                        ))}
                    </select>
                    <div className="mt-2 text-xs text-slate-200/60">Select a record to export.</div>
                </div>

                <div className="lg:col-span-2">
                    {!record ? (
                        <div className="glass rounded-3xl p-5 text-sm text-slate-200/60">No record selected.</div>
                    ) : (
                        <div className="glass rounded-3xl p-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black tracking-tight">{String(record.kind).toUpperCase()}</span>
                                    <span
                                        className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold ${record.result === 'Fake'
                                                ? 'bg-rose-500/15 text-rose-200 border-rose-500/20'
                                                : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
                                            }`}
                                    >
                                        {record.result}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-200/60">{new Date(record.ts).toLocaleString()}</div>
                            </div>

                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <div className="glass rounded-2xl px-4 py-3 text-xs text-slate-200/70">
                                    Confidence: <span className="font-semibold text-slate-100">{formatPct(record.confidence)}</span>
                                </div>
                                <div className="glass rounded-2xl px-4 py-3 text-xs text-slate-200/70">
                                    Trust Score: <span className="font-semibold text-slate-100">{formatPct(record.trustScore)}</span>
                                </div>
                                <div className="glass rounded-2xl px-4 py-3 text-xs text-slate-200/70 line-clamp-1">
                                    {record.label || '—'}
                                </div>
                            </div>

                            <div className="mt-4">
                                <div className="text-sm font-semibold text-slate-200/70">Explainable Signals</div>
                                <div className="mt-3 space-y-2">
                                    {(record.why || []).slice(0, 5).map((x, idx) => (
                                        <div key={idx} className="glass rounded-2xl px-4 py-3 text-sm text-slate-200/80">
                                            {x}
                                        </div>
                                    ))}
                                    {(!record.why || record.why.length === 0) ? (
                                        <div className="glass rounded-2xl px-4 py-3 text-sm text-slate-200/60">No explanation stored.</div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
