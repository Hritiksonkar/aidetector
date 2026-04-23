import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiDownload, FiFileText, FiXCircle } from 'react-icons/fi';
import { exportJson } from '../../utils/exporters.js';
import { downloadPdfReport } from '../../utils/pdf.js';
import { formatPct } from '../../utils/score.js';

function getVerdictStyle(result) {
    if (result === 'Real') {
        return {
            label: 'Real',
            icon: <FiCheckCircle className="text-emerald-300" />,
            badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20',
            bar: 'from-emerald-400 to-emerald-200'
        };
    }
    return {
        label: 'Fake',
        icon: <FiXCircle className="text-rose-300" />,
        badge: 'bg-rose-500/15 text-rose-200 border-rose-500/20',
        bar: 'from-rose-400 to-pink-200'
    };
}

function StatPill({ label, value, tone = 'indigo' }) {
    const toneMap = {
        indigo: 'bg-indigo-500/15 text-indigo-200 border-indigo-500/20',
        purple: 'bg-purple-500/15 text-purple-200 border-purple-500/20',
        sky: 'bg-sky-500/15 text-sky-200 border-sky-500/20',
        emerald: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20',
        rose: 'bg-rose-500/15 text-rose-200 border-rose-500/20'
    };

    return (
        <div className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold ${toneMap[tone] || toneMap.indigo}`}>
            <span className="text-slate-100/80">{label}</span>
            <span className="font-black text-slate-100">{value}</span>
        </div>
    );
}

export default function ResultDetailsCard({ record, secondaryBadges = [], metadataLines = [] }) {
    if (!record) {
        return (
            <div className="glass rounded-3xl p-5">
                <div className="text-sm font-semibold text-slate-200/70">Result</div>
                <div className="mt-3 text-sm text-slate-200/60">Run an analysis to see explainable results.</div>
            </div>
        );
    }

    const style = getVerdictStyle(record.result);
    const conf = Math.max(0, Math.min(100, Number(record.confidence || 0)));
    const trust = Math.max(0, Math.min(100, Number(record.trustScore || 0)));

    const why = Array.isArray(record.why) ? record.why : [];

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="glass w-full rounded-3xl p-5"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="text-sm font-semibold text-slate-200/70">Explainable Result</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold ${style.badge}`}>
                            {style.icon}
                            {style.label}
                        </div>

                        {secondaryBadges.map((b) => (
                            <div
                                key={b.label}
                                className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold ${b.className}`}
                            >
                                {b.label}
                            </div>
                        ))}
                    </div>
                    {record.label ? (
                        <div className="mt-3 text-xs text-slate-200/60 line-clamp-2">Input: {record.label}</div>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <StatPill label="Confidence" value={formatPct(conf)} tone={record.result === 'Fake' ? 'rose' : 'emerald'} />
                    <StatPill label="Trust Score" value={formatPct(trust)} tone="indigo" />
                </div>
            </div>

            <div className="mt-5">
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${conf}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${style.bar}`}
                    />
                </div>
            </div>

            {metadataLines.length ? (
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {metadataLines.map((line) => (
                        <div key={line} className="glass rounded-2xl px-4 py-3 text-xs text-slate-200/70">
                            {line}
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <div className="text-sm font-semibold text-slate-200/70">Why {record.result === 'Fake' ? 'Fake' : 'Real'}?</div>
                    <div className="mt-3 space-y-2">
                        {why.length ? (
                            why.map((x, idx) => (
                                <div key={idx} className="glass rounded-2xl px-4 py-3 text-sm text-slate-200/80">
                                    {x}
                                </div>
                            ))
                        ) : (
                            <div className="glass rounded-2xl px-4 py-3 text-sm text-slate-200/70">
                                Explanation unavailable.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="text-sm font-semibold text-slate-200/70">Report</div>
                    <button
                        type="button"
                        className="glass w-full rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-white/10 flex items-center justify-between"
                        onClick={() => {
                            try {
                                const filename = `truthlens-report-${record.kind}-${record.id}.pdf`;
                                downloadPdfReport(filename, record);
                                toast.success('PDF report downloaded');
                            } catch (e) {
                                toast.error(e?.message || 'Failed to generate PDF');
                            }
                        }}
                    >
                        <span className="inline-flex items-center gap-2">
                            <FiFileText />
                            PDF Report
                        </span>
                        <FiDownload className="opacity-80" />
                    </button>

                    <button
                        type="button"
                        className="glass w-full rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-white/10 flex items-center justify-between"
                        onClick={() => {
                            const filename = `truthlens-analysis-${record.kind}-${record.id}.json`;
                            exportJson(filename, record);
                            toast.success('Analysis exported');
                        }}
                    >
                        <span className="inline-flex items-center gap-2">
                            <FiDownload />
                            Export Analysis
                        </span>
                        <span className="text-xs text-slate-200/60">JSON</span>
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
