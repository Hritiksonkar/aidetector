import { useEffect, useMemo, useRef, useState } from 'react';
import Hero from '../components/Hero.jsx';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiFileText, FiImage, FiLayers, FiShield, FiUploadCloud, FiVideo, FiZap } from 'react-icons/fi';

import Tabs from '../components/Tabs.jsx';
import Loader from '../components/Loader.jsx';
import ResultCard from '../components/ResultCard.jsx';
import { detectImage, detectNews, detectText, detectVideo } from '../services/api.js';
import { addHistoryRecord, clearHistory, loadHistory } from '../services/history.js';

function Feature({ icon, title, desc }) {
    return (
        <div className="glass rounded-3xl p-5">
            <div className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3">
                {icon}
            </div>
            <div className="mt-4 text-lg font-bold">{title}</div>
            <div className="mt-2 text-sm text-slate-200/70">{desc}</div>
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
        const w = 300;
        const h = 90;
        const pts = trend.map((p, idx) => {
            const x = trend.length <= 1 ? w / 2 : (idx / (trend.length - 1)) * w;
            const y = h - (p.confidence / 100) * h;
            return { x, y, ...p, i: idx };
        });
        const d = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        return { w, h, pts, d };
    }, [trend]);

    return (
        <div className="space-y-8 pb-4">
            <Hero />

            <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="grid gap-4 sm:grid-cols-3"
            >
                <Feature
                    icon={<FiZap className="text-indigo-200" />}
                    title="Fast"
                    desc="Async API calls with smooth, responsive UI transitions."
                />
                <Feature
                    icon={<FiLayers className="text-pink-200" />}
                    title="Multi-modal"
                    desc="Analyze text, images, and video URLs in one dashboard."
                />
                <Feature
                    icon={<FiShield className="text-emerald-200" />}
                    title="Reliable"
                    desc="Production-ready patterns: validation, error handling, and feedback toasts."
                />
            </motion.section>

            <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="grid gap-4 lg:grid-cols-3"
            >
                <div className="glass rounded-3xl p-5 lg:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="text-lg font-black tracking-tight">Quick Analyze</div>
                            <div className="mt-1 text-sm text-slate-200/70">One simple form for Text, News, Image, and Video.</div>
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
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-slate-200/70">Insights</div>
                            <div className="mt-1 text-xs text-slate-200/60">Charts are based on your recent scans (local only).</div>
                        </div>
                        <button
                            type="button"
                            className="glass rounded-xl px-3 py-2 text-xs font-semibold hover:bg-white/10"
                            onClick={() => {
                                setHistory(clearHistory());
                                toast.success('History cleared');
                            }}
                            disabled={history.length === 0}
                        >
                            Clear
                        </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="glass rounded-2xl p-4">
                            <div className="text-xs text-slate-200/60">Total scans</div>
                            <div className="mt-1 text-2xl font-black">{stats.total}</div>
                        </div>
                        <div className="glass rounded-2xl p-4">
                            <div className="text-xs text-slate-200/60">Fake rate</div>
                            <div className="mt-1 text-2xl font-black">{stats.fakeRate}%</div>
                        </div>
                        <div className="glass rounded-2xl p-4">
                            <div className="text-xs text-slate-200/60">Avg confidence</div>
                            <div className="mt-1 text-2xl font-black">{stats.avgConfidence}%</div>
                        </div>
                        <div className="glass rounded-2xl p-4">
                            <div className="text-xs text-slate-200/60">Real vs Fake</div>
                            <div className="mt-1 flex items-center gap-3 text-sm font-semibold">
                                <span className="text-emerald-200">Real: {stats.real}</span>
                                <span className="text-rose-200">Fake: {stats.fake}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5">
                        <div className="text-xs font-semibold text-slate-200/70">Confidence trend</div>
                        <div className="mt-2 glass rounded-2xl p-3">
                            {spark.pts.length === 0 ? (
                                <div className="py-6 text-center text-sm text-slate-200/60">No scans yet</div>
                            ) : (
                                <div>
                                    <svg viewBox={`0 0 ${spark.w} ${spark.h}`} className="h-24 w-full text-indigo-200">
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
                                                r={4}
                                                fill="currentColor"
                                                opacity={hoverPoint?.i === p.i ? 1 : 0.55}
                                                onMouseEnter={() => setHoverPoint(p)}
                                                onMouseLeave={() => setHoverPoint(null)}
                                            />
                                        ))}
                                    </svg>
                                    <div className="mt-2 flex items-center justify-between text-xs text-slate-200/60">
                                        <span>Last {spark.pts.length} scans</span>
                                        <span className="text-slate-100 font-semibold">
                                            {hoverPoint ? `${hoverPoint.confidence}% (${hoverPoint.result})` : 'Hover a point'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-5">
                        <div className="text-xs font-semibold text-slate-200/70">By type</div>
                        <div className="mt-2 space-y-2">
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

                    <div className="mt-5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold text-slate-200/70">Recent scans</div>
                            <div className="text-xs text-slate-200/60">Latest 6</div>
                        </div>
                        <div className="mt-2 space-y-2">
                            {history.length === 0 && <div className="text-sm text-slate-200/60">Run analyses to populate history.</div>}
                            {history.slice(0, 6).map((x) => {
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
                </div>
            </motion.section>
        </div>
    );
}
