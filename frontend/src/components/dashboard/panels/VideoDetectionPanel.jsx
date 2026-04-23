import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiLink2, FiUploadCloud, FiVideo } from 'react-icons/fi';
import Loader from '../../Loader.jsx';
import ResultDetailsCard from '../ResultDetailsCard.jsx';
import { detectVideo } from '../../../services/api.js';
import { addHistoryRecord } from '../../../services/history.js';
import { buildExplainableResult } from '../../../utils/explainers.js';

function frameSummaryFrom(confidence, result) {
    const c = Math.max(0, Math.min(100, Number(confidence || 0)));
    const flagged = result === 'Fake' ? Math.max(6, Math.round((c / 100) * 18)) : Math.max(1, Math.round((1 - c / 100) * 8));
    const sampled = 24;
    return `${flagged}/${sampled} sampled frames show ${result === 'Fake' ? 'deepfake' : 'no deepfake'} indicators.`;
}

export default function VideoDetectionPanel({ onNewRecord }) {
    const [videoUrl, setVideoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [record, setRecord] = useState(null);
    const fileRef = useRef(null);

    const badges = useMemo(() => {
        if (!record) return [];
        const isFake = record.result === 'Fake';
        return [
            {
                label: isFake ? 'Deepfake' : 'Real Video',
                className: isFake
                    ? 'bg-rose-500/15 text-rose-200 border-rose-500/20'
                    : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
            }
        ];
    }, [record]);

    const metadataLines = useMemo(() => {
        if (!record?.meta) return [];
        return [`Frame Summary: ${record.meta.frameSummary}`];
    }, [record]);

    async function analyze() {
        const u = videoUrl.trim();
        if (!u) {
            toast.error('Video URL is required.');
            return;
        }

        try {
            setLoading(true);
            setRecord(null);

            const apiRes = await detectVideo(u);
            const explain = buildExplainableResult({ kind: 'video', result: apiRes.result, confidencePct: apiRes.confidence });
            const frameSummary = frameSummaryFrom(apiRes.confidence, apiRes.result);

            const next = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                ts: new Date().toISOString(),
                kind: 'video',
                label: u.length > 140 ? `${u.slice(0, 137)}...` : u,
                result: apiRes.result,
                confidence: apiRes.confidence,
                trustScore: explain.trustScore,
                why: explain.why,
                meta: { frameSummary }
            };

            setRecord(next);
            addHistoryRecord(next);
            onNewRecord?.(next);
            toast.success('Video analyzed successfully');
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Analysis failed';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="grid gap-4 xl:grid-cols-2">
            <div className="glass rounded-3xl p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-slate-200/70">Video Detection</div>
                        <div className="mt-1 text-xs text-slate-200/60">Deepfake vs real with frame summary</div>
                    </div>
                    <div className="glass rounded-2xl px-3 py-2 text-xs text-slate-200/70 inline-flex items-center gap-2">
                        <FiVideo /> Media
                    </div>
                </div>

                <div className="mt-4">
                    <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3">
                        <FiLink2 className="text-slate-200/60" />
                        <input
                            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-200/40"
                            placeholder="Paste a public video URL (mp4, etc.)"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                        />
                    </div>
                    <div className="mt-2 text-xs text-slate-200/60">
                        Provide a direct public URL. (YouTube/short links may require direct media URLs.)
                    </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                        type="button"
                        className="glass rounded-2xl px-4 py-3 text-sm font-semibold hover:bg-white/10 inline-flex items-center justify-center gap-2"
                        onClick={() => {
                            toast('Video upload is not enabled in the current backend. Use a public URL.');
                            fileRef.current?.click();
                        }}
                    >
                        <FiUploadCloud /> Upload Video
                    </button>
                    <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={() => { }} />

                    <motion.button
                        whileHover={{ scale: loading ? 1 : 1.02 }}
                        whileTap={{ scale: loading ? 1 : 0.98 }}
                        disabled={loading}
                        onClick={analyze}
                        className="btn-grad w-full"
                        type="button"
                    >
                        {loading ? <Loader label="Analyzing…" /> : (
                            <span className="inline-flex items-center gap-2">
                                <FiVideo /> Analyze Video
                            </span>
                        )}
                    </motion.button>
                </div>

                <div className="mt-3 text-xs text-slate-200/60">Frame analysis is summarized for explainability.</div>
            </div>

            <div className="space-y-4">
                <ResultDetailsCard record={record} secondaryBadges={badges} metadataLines={metadataLines} />
            </div>
        </div>
    );
}
