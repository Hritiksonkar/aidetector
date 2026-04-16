import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiFileText, FiImage, FiUploadCloud, FiVideo } from 'react-icons/fi';

import Tabs from '../components/Tabs.jsx';
import Loader from '../components/Loader.jsx';
import ResultCard from '../components/ResultCard.jsx';
import { detectImage, detectNews, detectText, detectVideo } from '../services/api.js';
import { addHistoryRecord, clearHistory, loadHistory } from '../services/history.js';

function formatCompactNumber(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
    return String(Math.round(n));
}

function Ring({ value, label, hint, toneClassName }) {
    const clamped = Math.max(0, Math.min(100, Number(value || 0)));
    const r = 18;
    const c = 2 * Math.PI * r;
    const dash = (clamped / 100) * c;
    const rest = c - dash;

    return (
        <div className="glass flex items-center justify-between gap-4 rounded-2xl p-4">
            <div>
                <div className="text-xs text-slate-200/60">{label}</div>
                <div className="mt-1 text-xl font-black">{Math.round(clamped)}%</div>
                {hint ? <div className="mt-1 text-xs text-slate-200/60">{hint}</div> : null}
            </div>
            <svg viewBox="0 0 44 44" className={toneClassName || 'text-indigo-200'} aria-hidden="true">
                <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
                <circle
                    cx="22"
                    cy="22"
                    r={r}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${rest}`}
                    transform="rotate(-90 22 22)"
                    opacity="0.95"
                />
            </svg>
        </div>
    );
}

function StackedBar({ leftLabel, rightLabel, leftValue, rightValue }) {
    const total = Math.max(1, Number(leftValue || 0) + Number(rightValue || 0));
    const leftPct = Math.round((Number(leftValue || 0) / total) * 100);
    const rightPct = 100 - leftPct;
    return (
        <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 text-xs">
                <div className="font-semibold text-slate-200/70">{leftLabel}</div>
                <div className="font-semibold text-slate-100">{leftPct}%</div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-rose-300/80 to-rose-200" style={{ width: `${leftPct}%` }} />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <div className="font-semibold text-slate-200/70">{rightLabel}</div>
                <div className="font-semibold text-slate-100">{rightPct}%</div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-emerald-300/70 to-emerald-200" style={{ width: `${rightPct}%` }} />
            </div>
        </div>
    );
}

export default function Home() {
    const TAB_TEXT = 'text';
    const TAB_NEWS = 'news';
    const TAB_IMAGE = 'image';
    const TAB_VIDEO = 'video';

    const tabs = useMemo(
        () => [
            { key: TAB_TEXT, label: 'Text', icon: <FiFileText /> },
            { key: TAB_NEWS, label: 'News', icon: <FiFileText /> },
            { key: TAB_IMAGE, label: 'Image', icon: <FiImage /> },
            { key: TAB_VIDEO, label: 'Video', icon: <FiVideo /> }
        ],
        []
    );

    const [active, setActive] = useState(TAB_TEXT);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [confidence, setConfidence] = useState(0);

    const [text, setText] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const fileRef = useRef(null);

    const [history, setHistory] = useState(() => loadHistory());
    const [hoverPoint, setHoverPoint] = useState(null);

    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);

    function resetResult() {
        setResult(null);
        setConfidence(0);
    }

    function setApiResult(data, meta) {
        setResult(data.result);
        setConfidence(data.confidence);

        const next = addHistoryRecord({
            type: meta?.type || 'unknown',
            label: meta?.label || '',
            result: data.result,
            confidence: data.confidence
        });
        setHistory(next);
    }

    function handlePickFile(file) {
        if (!file) return;
        if (!file.type?.startsWith('image/')) {
            toast.error('Please upload an image file.');
            return;
        }
        setImageFile(file);
        resetResult();
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(URL.createObjectURL(file));
    }

    async function onAnalyze() {
        try {
            setLoading(true);
            resetResult();

            if (active === TAB_TEXT || active === TAB_NEWS) {
                const input = text.trim();
                if (!input) {
                    toast.error('Text is required.');
                    return;
                }
                const data = active === TAB_NEWS ? await detectNews(input) : await detectText(input);
                setApiResult(data, { type: active, label: input.slice(0, 120) });
                toast.success(active === TAB_NEWS ? 'News analyzed successfully' : 'Text analyzed successfully');
                return;
            }

            if (active === TAB_VIDEO) {
                const u = videoUrl.trim();
                if (!u) {
                    toast.error('Video URL is required.');
                    return;
                }
                const data = await detectVideo(u);
                setApiResult(data, { type: 'video', label: u.length > 120 ? `${u.slice(0, 117)}...` : u });
                toast.success('Video analyzed successfully');
                return;
            }

            if (active === TAB_IMAGE) {
                if (!imageFile) {
                    toast.error('Please select an image first.');
                    return;
                }
                const data = await detectImage(imageFile);
                setApiResult(data, { type: 'image', label: imageFile?.name || 'image' });
                toast.success('Image analyzed successfully');
            }
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Analysis failed';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    const stats = useMemo(() => {
        const items = Array.isArray(history) ? history : [];
        const total = items.length;
        const fake = items.filter((x) => x.result === 'Fake').length;
        const real = total - fake;
        const avgConfidence = total > 0 ? Math.round(items.reduce((acc, x) => acc + Number(x.confidence || 0), 0) / total) : 0;
        const fakeRate = total > 0 ? Math.round((fake / total) * 100) : 0;
        return { total, fake, real, avgConfidence, fakeRate };
    }, [history]);

    const byType = useMemo(() => {
        const order = ['text', 'news', 'image', 'video'];
        const map = new Map();
        for (const item of history) {
            const k = String(item.type || 'unknown');
            map.set(k, (map.get(k) || 0) + 1);
        }
        const out = [];
        for (const k of order) {
            if (map.has(k)) out.push({ type: k, count: map.get(k) });
        }
        for (const [k, v] of map.entries()) {
            if (!order.includes(k)) out.push({ type: k, count: v });
        }
        return out;
    }, [history]);

    const trend = useMemo(() => {
        const items = (Array.isArray(history) ? history : []).slice(0, 24).slice().reverse();
        return items.map((x) => ({
            ts: x.ts,
            confidence: Math.max(0, Math.min(100, Number(x.confidence || 0))),
            result: x.result
        }));
    }, [history]);

    const spark = useMemo(() => {
        const w = 620;
        const h = 220;
        const pts = trend.map((p, idx) => {
            const x = trend.length <= 1 ? w / 2 : (idx / (trend.length - 1)) * w;
            const y = h - (p.confidence / 100) * h;
            return { x, y, ...p, i: idx };
        });
        const d = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        return { w, h, pts, d };
    }, [trend]);

    const split = useMemo(() => {
        const items = Array.isArray(history) ? history : [];

        const textBucket = { real: 0, fake: 0 };
        const mediaBucket = { real: 0, fake: 0 };

        for (const x of items) {
            const isMedia = x.type === 'image' || x.type === 'video';
            const target = isMedia ? mediaBucket : textBucket;
            if (x.result === 'Real') target.real += 1;
            else target.fake += 1;
        }

        return { textBucket, mediaBucket };
    }, [history]);

    return (
        <div className="space-y-4 pb-6">
            <div className="glass rounded-3xl p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-lg font-black tracking-tight">AI Content Detection Dashboard</div>
                        <div className="mt-1 text-xs text-slate-200/60">Top • Summary</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="glass rounded-xl px-3 py-2 text-xs font-semibold hover:bg-white/10"
                            onClick={() => {
                                setHistory(clearHistory());
                                toast.success('History cleared');
                            }}
                            disabled={history.length === 0}
                        >
                            Clear history
                        </button>
                    </div>
                </div>
            </div>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="glass rounded-3xl p-4">
                    <div className="text-xs text-slate-200/60">Total analyses</div>
                    <div className="mt-1 text-2xl font-black">{formatCompactNumber(stats.total)}</div>
                </div>
                <div className="glass rounded-3xl p-4">
                    <div className="text-xs text-slate-200/60">Fake detections</div>
                    <div className="mt-1 text-2xl font-black text-rose-200">{formatCompactNumber(stats.fake)}</div>
                </div>
                <div className="glass rounded-3xl p-4">
                    <div className="text-xs text-slate-200/60">Real detections</div>
                    <div className="mt-1 text-2xl font-black text-emerald-200">{formatCompactNumber(stats.real)}</div>
                </div>
                <div className="glass rounded-3xl p-4">
                    <div className="text-xs text-slate-200/60">Average confidence</div>
                    <div className="mt-1 text-2xl font-black">{Math.round(stats.avgConfidence)}%</div>
                </div>
            </section>

            <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="grid gap-4 lg:grid-cols-12"
            >
                <aside className="space-y-4 lg:col-span-3">
                    <div className="glass rounded-3xl p-5">
                        <div className="text-sm font-semibold text-slate-200/70">Detection Breakdown</div>
                        <div className="mt-4 space-y-3">
                            <Ring value={stats.fakeRate} label="Fake" hint="Overall fake rate" toneClassName="text-rose-200" />
                            <Ring value={100 - stats.fakeRate} label="Real" hint="Overall real rate" toneClassName="text-emerald-200" />
                            <Ring value={stats.avgConfidence} label="Confidence" hint="Average confidence" toneClassName="text-indigo-200" />
                        </div>
                    </div>

                    <div className="glass rounded-3xl p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-200/70">Recent Activity</div>
                            <div className="text-xs text-slate-200/60">Latest 8</div>
                        </div>
                        <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
                            {history.length === 0 && <div className="text-sm text-slate-200/60">Run analyses to populate history.</div>}
                            {history.slice(0, 8).map((x) => {
                                const badge =
                                    x.result === 'Real'
                                        ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
                                        : 'bg-rose-500/15 text-rose-200 border-rose-500/20';
                                return (
                                    <div key={x.id} className="glass rounded-2xl p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-xs font-semibold text-slate-200/70">{String(x.type).toUpperCase()}</div>
                                            <div className={`inline-flex items-center rounded-xl border px-2 py-1 text-xs font-bold ${badge}`}>
                                                {x.result}
                                            </div>
                                        </div>
                                        <div className="mt-2 truncate text-xs text-slate-200/60">{x.label || '—'}</div>
                                        <div className="mt-2 flex items-center justify-between text-xs text-slate-200/60">
                                            <span>{new Date(x.ts).toLocaleString()}</span>
                                            <span className="font-semibold text-slate-100">{Math.round(Number(x.confidence || 0))}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </aside>

                <main className="space-y-4 lg:col-span-6">
                    <div className="glass rounded-3xl p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-slate-200/70">Detection Console</div>
                                <div className="mt-1 text-xs text-slate-200/60">Analyze text, news, image, and video</div>
                            </div>
                        </div>

                        <div className="mt-4">
                            <Tabs
                                tabs={tabs}
                                activeKey={active}
                                onChange={(k) => {
                                    setActive(k);
                                    resetResult();
                                }}
                            />
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="space-y-3">
                                {(active === TAB_TEXT || active === TAB_NEWS) && (
                                    <textarea
                                        className="input min-h-[170px] resize-none"
                                        placeholder={active === TAB_NEWS ? 'Paste news/article text to analyze...' : 'Paste text to analyze...'}
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                    />
                                )}

                                {active === TAB_VIDEO && (
                                    <div>
                                        <input
                                            className="input"
                                            placeholder="Paste a YouTube/Instagram/video URL"
                                            value={videoUrl}
                                            onChange={(e) => setVideoUrl(e.target.value)}
                                        />
                                        <div className="mt-2 text-xs text-slate-200/60">
                                            Social media links are supported (YouTube/Instagram). If the video is private or requires login,
                                            you’ll see a clear error message.
                                        </div>
                                    </div>
                                )}

                                {active === TAB_IMAGE && (
                                    <div className="space-y-3">
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handlePickFile(e.target.files?.[0])}
                                        />
                                        <div className="glass grid min-h-[170px] place-items-center rounded-3xl border border-dashed border-white/15 bg-white/5 p-5">
                                            <div className="flex flex-col items-center gap-3 text-center">
                                                <div className="glass rounded-2xl p-3">
                                                    <FiUploadCloud className="text-xl text-slate-100/80" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold">Upload an image</div>
                                                    <div className="mt-1 text-xs text-slate-200/60">PNG/JPG works best</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="glass rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10"
                                                    onClick={() => fileRef.current?.click()}
                                                >
                                                    Choose File
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <motion.button
                                    whileHover={{ scale: loading ? 1 : 1.02 }}
                                    whileTap={{ scale: loading ? 1 : 0.98 }}
                                    disabled={loading}
                                    onClick={onAnalyze}
                                    className="btn-grad w-full animate-shimmer"
                                    type="button"
                                >
                                    {loading ? <Loader /> : 'Analyze'}
                                </motion.button>
                            </div>

                            <div className="space-y-3">
                                {result ? (
                                    <ResultCard
                                        title={
                                            active === TAB_TEXT
                                                ? 'AI Text Detection Result'
                                                : active === TAB_NEWS
                                                    ? 'News Detection Result'
                                                    : active === TAB_IMAGE
                                                        ? 'Image Detection Result'
                                                        : 'Video Detection Result'
                                        }
                                        result={result}
                                        confidence={confidence}
                                    />
                                ) : (
                                    <div className="glass grid min-h-[220px] place-items-center rounded-3xl p-5 text-center">
                                        <div>
                                            <div className="text-lg font-bold">No result yet</div>
                                            <div className="mt-2 text-sm text-slate-200/70">Run an analysis to see Real/Fake + confidence.</div>
                                        </div>
                                    </div>
                                )}

                                {active === TAB_IMAGE && imagePreview && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="glass overflow-hidden rounded-3xl"
                                    >
                                        <img src={imagePreview} alt="Preview" className="h-44 w-full object-cover" />
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="glass rounded-3xl p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-slate-200/70">Detection Trends</div>
                                <div className="mt-1 text-xs text-slate-200/60">Confidence trend (last {spark.pts.length} scans)</div>
                            </div>
                            <div className="text-xs text-slate-200/60">{hoverPoint ? `${hoverPoint.confidence}% (${hoverPoint.result})` : 'Hover a point'}</div>
                        </div>

                        <div className="mt-4 glass rounded-2xl p-3">
                            {spark.pts.length === 0 ? (
                                <div className="py-12 text-center text-sm text-slate-200/60">No scans yet</div>
                            ) : (
                                <svg viewBox={`0 0 ${spark.w} ${spark.h}`} className="h-48 w-full text-indigo-200">
                                    <polyline
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        points={spark.d}
                                        opacity="0.9"
                                    />
                                    {spark.pts.map((p) => (
                                        <circle
                                            key={p.i}
                                            cx={p.x}
                                            cy={p.y}
                                            r={5}
                                            fill="currentColor"
                                            opacity={hoverPoint?.i === p.i ? 1 : 0.55}
                                            onMouseEnter={() => setHoverPoint(p)}
                                            onMouseLeave={() => setHoverPoint(null)}
                                        />
                                    ))}
                                </svg>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="glass rounded-3xl p-5">
                            <div className="text-sm font-semibold text-slate-200/70">Text Analysis Results</div>
                            <div className="mt-3">
                                <StackedBar
                                    leftLabel="AI Generated"
                                    rightLabel="Human Written"
                                    leftValue={split.textBucket.fake}
                                    rightValue={split.textBucket.real}
                                />
                            </div>
                        </div>

                        <div className="glass rounded-3xl p-5">
                            <div className="text-sm font-semibold text-slate-200/70">Image + Video Results</div>
                            <div className="mt-3">
                                <StackedBar
                                    leftLabel="Fake"
                                    rightLabel="Real"
                                    leftValue={split.mediaBucket.fake}
                                    rightValue={split.mediaBucket.real}
                                />
                            </div>
                        </div>
                    </div>
                </main>

                <aside className="space-y-4 lg:col-span-3">
                    <div className="glass rounded-3xl p-5">
                        <div className="text-sm font-semibold text-slate-200/70">Top Sources</div>
                        <div className="mt-3 space-y-2 text-sm">
                            <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
                                <span className="text-slate-200/80">Social Media</span>
                                <span className="text-xs text-slate-200/60">—</span>
                            </div>
                            <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
                                <span className="text-slate-200/80">News Sites</span>
                                <span className="text-xs text-slate-200/60">—</span>
                            </div>
                            <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
                                <span className="text-slate-200/80">User Uploads</span>
                                <span className="text-xs text-slate-200/60">—</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass rounded-3xl p-5">
                        <div className="text-sm font-semibold text-slate-200/70">Processing Time</div>
                        <div className="mt-3 space-y-2 text-sm">
                            <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
                                <span className="text-slate-200/80">Avg. Text Analysis</span>
                                <span className="text-slate-100 font-semibold">—</span>
                            </div>
                            <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
                                <span className="text-slate-200/80">Avg. Image Scan</span>
                                <span className="text-slate-100 font-semibold">—</span>
                            </div>
                            <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
                                <span className="text-slate-200/80">Avg. Video Scan</span>
                                <span className="text-slate-100 font-semibold">—</span>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-200/60">(Timing metrics can be added later if you want.)</div>
                    </div>

                    <div className="glass rounded-3xl p-5">
                        <div className="text-sm font-semibold text-slate-200/70">By type</div>
                        <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                            {byType.length === 0 && <div className="text-sm text-slate-200/60">No scans yet</div>}
                            {byType.map((row) => {
                                const max = Math.max(1, ...byType.map((r) => r.count));
                                const pct = Math.round((row.count / max) * 100);
                                return (
                                    <div key={row.type} className="glass rounded-2xl p-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-200/70">{String(row.type).toUpperCase()}</span>
                                            <span className="font-semibold text-slate-100">{row.count}</span>
                                        </div>
                                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-pink-200"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </aside>
            </motion.section>
        </div>
    );
}
