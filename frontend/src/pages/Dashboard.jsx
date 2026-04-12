import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiFileText, FiImage, FiUploadCloud, FiVideo } from 'react-icons/fi';

import Tabs from '../components/Tabs.jsx';
import ResultCard from '../components/ResultCard.jsx';
import Loader from '../components/Loader.jsx';
import { detectImage, detectNews, detectText, detectVideo } from '../services/api.js';

const TAB_CONTENT = 'content';
const TAB_IMAGE = 'image';
const TAB_VIDEO = 'video';

const CONTENT_TEXT = 'text';
const CONTENT_NEWS = 'news';

export default function Dashboard() {
    const tabs = useMemo(
        () => [
            { key: TAB_CONTENT, label: 'Text + News', icon: <FiFileText /> },
            { key: TAB_IMAGE, label: 'Image Detection', icon: <FiImage /> },
            { key: TAB_VIDEO, label: 'Video Detection', icon: <FiVideo /> },
        ],
        []
    );

    const [active, setActive] = useState(TAB_CONTENT);

    // shared result
    const [result, setResult] = useState(null);
    const [confidence, setConfidence] = useState(0);
    const [loading, setLoading] = useState(false);

    // content (text + news)
    const [contentMode, setContentMode] = useState(CONTENT_TEXT);
    const [contentText, setContentText] = useState('');

    // image
    const [dragOver, setDragOver] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const fileInputRef = useRef(null);

    // video
    const [videoUrl, setVideoUrl] = useState('');

    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);

    function resetResult() {
        setResult(null);
        setConfidence(0);
    }

    function setApiResult(data) {
        setResult(data.result);
        setConfidence(data.confidence);
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
        const url = URL.createObjectURL(file);
        setImagePreview(url);
    }

    async function onAnalyzeContent(mode) {
        try {
            setLoading(true);
            resetResult();
            setContentMode(mode);

            if (!contentText.trim()) {
                toast.error('Text is required.');
                return;
            }

            const input = contentText.trim();
            const data = mode === CONTENT_NEWS ? await detectNews(input) : await detectText(input);
            setApiResult(data);
            toast.success(mode === CONTENT_NEWS ? 'News analyzed successfully' : 'Text analyzed successfully');
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                (mode === CONTENT_NEWS ? 'Failed to analyze news' : 'Failed to analyze text');
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    const resultTitle =
        active === TAB_CONTENT
            ? contentMode === CONTENT_NEWS
                ? 'News Detection Result'
                : 'AI Text Detection Result'
            : active === TAB_IMAGE
                ? 'Image Detection Result'
                : 'Video Detection Result';

    async function onAnalyzeImage() {
        try {
            setLoading(true);
            resetResult();

            if (!imageFile) {
                toast.error('Please select an image first.');
                return;
            }

            const data = await detectImage(imageFile);
            setApiResult(data);
            toast.success('Image analyzed successfully');
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to analyze image';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    async function onAnalyzeVideo() {
        try {
            setLoading(true);
            resetResult();

            if (!videoUrl.trim()) {
                toast.error('Video URL is required.');
                return;
            }

            const data = await detectVideo(videoUrl.trim());
            setApiResult(data);
            toast.success('Video analyzed successfully');
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Failed to analyze video';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="pb-6">
            <div className="mb-6">
                <div className="text-3xl font-black tracking-tight">Detection Dashboard</div>
                <div className="mt-2 text-sm text-slate-200/70">Choose a mode and analyze in seconds.</div>
            </div>

            <Tabs
                tabs={tabs}
                activeKey={active}
                onChange={(k) => {
                    setActive(k);
                    resetResult();
                }}
            />

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="glass rounded-3xl p-5">
                    {active === TAB_CONTENT && (
                        <div className="space-y-4">
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-slate-200/70">📝 Text + 📰 News Detection</div>

                                    <div className="glass flex items-center gap-1 rounded-2xl p-1">
                                        <button
                                            type="button"
                                            className={`tab ${contentMode === CONTENT_TEXT ? 'tab-active' : 'tab-inactive'}`}
                                            onClick={() => {
                                                setContentMode(CONTENT_TEXT);
                                                resetResult();
                                            }}
                                        >
                                            Text
                                        </button>
                                        <button
                                            type="button"
                                            className={`tab ${contentMode === CONTENT_NEWS ? 'tab-active' : 'tab-inactive'}`}
                                            onClick={() => {
                                                setContentMode(CONTENT_NEWS);
                                                resetResult();
                                            }}
                                        >
                                            News
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    className="input mt-3 min-h-[160px] resize-none"
                                    placeholder={
                                        contentMode === CONTENT_NEWS
                                            ? 'Paste a news claim/article text to analyze...'
                                            : 'Paste text to analyze...'
                                    }
                                    value={contentText}
                                    onChange={(e) => setContentText(e.target.value)}
                                />
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                                <motion.button
                                    whileHover={{ scale: loading ? 1 : 1.02 }}
                                    whileTap={{ scale: loading ? 1 : 0.98 }}
                                    disabled={loading}
                                    onClick={() => {
                                        setContentMode(CONTENT_TEXT);
                                        onAnalyzeContent(CONTENT_TEXT);
                                    }}
                                    className="btn-grad w-full animate-shimmer"
                                    type="button"
                                >
                                    {loading && contentMode === CONTENT_TEXT ? <Loader /> : 'Analyze as Text'}
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: loading ? 1 : 1.02 }}
                                    whileTap={{ scale: loading ? 1 : 0.98 }}
                                    disabled={loading}
                                    onClick={() => {
                                        setContentMode(CONTENT_NEWS);
                                        onAnalyzeContent(CONTENT_NEWS);
                                    }}
                                    className="btn-grad w-full animate-shimmer"
                                    type="button"
                                >
                                    {loading && contentMode === CONTENT_NEWS ? <Loader /> : 'Analyze as News'}
                                </motion.button>
                            </div>
                        </div>
                    )}

                    {active === TAB_IMAGE && (
                        <div className="space-y-4">
                            <div className="text-sm font-semibold text-slate-200/70">🖼 Image Detection</div>

                            <div
                                className={`relative grid min-h-[180px] place-items-center rounded-3xl border border-dashed p-5 transition ${dragOver ? 'border-indigo-300/60 bg-indigo-500/10' : 'border-white/15 bg-white/5'
                                    }`}
                                onDragEnter={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOver(true);
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOver(true);
                                }}
                                onDragLeave={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOver(false);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOver(false);
                                    const file = e.dataTransfer.files?.[0];
                                    handlePickFile(file);
                                }}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handlePickFile(e.target.files?.[0])}
                                />

                                <div className="flex flex-col items-center gap-3 text-center">
                                    <div className="glass rounded-2xl p-3">
                                        <FiUploadCloud className="text-xl text-slate-100/80" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold">Drag & drop an image</div>
                                        <div className="mt-1 text-xs text-slate-200/60">or click to browse</div>
                                    </div>
                                    <button
                                        type="button"
                                        className="glass rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        Choose File
                                    </button>
                                </div>
                            </div>

                            {imagePreview && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="glass overflow-hidden rounded-3xl"
                                >
                                    <img src={imagePreview} alt="Preview" className="h-56 w-full object-cover" />
                                </motion.div>
                            )}

                            <motion.button
                                whileHover={{ scale: loading ? 1 : 1.02 }}
                                whileTap={{ scale: loading ? 1 : 0.98 }}
                                disabled={loading}
                                onClick={onAnalyzeImage}
                                className="btn-grad w-full animate-shimmer"
                                type="button"
                            >
                                {loading ? <Loader /> : 'Analyze Image'}
                            </motion.button>
                        </div>
                    )}

                    {active === TAB_VIDEO && (
                        <div className="space-y-4">
                            <div className="text-sm font-semibold text-slate-200/70">🎥 Video Detection</div>

                            <div>
                                <input
                                    className="input mt-3"
                                    placeholder="https://example.com/video.mp4"
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                />
                                <div className="mt-2 text-xs text-slate-200/60">
                                    Use a direct public video file URL (e.g. .mp4). YouTube page links won’t work.
                                </div>
                            </div>

                            <motion.button
                                whileHover={{ scale: loading ? 1 : 1.02 }}
                                whileTap={{ scale: loading ? 1 : 0.98 }}
                                disabled={loading}
                                onClick={onAnalyzeVideo}
                                className="btn-grad w-full animate-shimmer"
                                type="button"
                            >
                                {loading ? <Loader /> : 'Analyze Video'}
                            </motion.button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4">
                    <div className="glass rounded-3xl p-5">
                        <div className="text-sm font-semibold text-slate-200/70">Live Status</div>
                        <div className="mt-2 text-sm text-slate-200/70">
                            Backend: <span className="text-slate-100">http://localhost:5000</span>
                        </div>
                        <div className="mt-1 text-sm text-slate-200/70">ML Service: http://localhost:8000</div>
                    </div>

                    {result && <ResultCard title={resultTitle} result={result} confidence={confidence} />}

                    {!result && (
                        <div className="glass grid min-h-[220px] place-items-center rounded-3xl p-5 text-center">
                            <div>
                                <div className="text-lg font-bold">No result yet</div>
                                <div className="mt-2 text-sm text-slate-200/70">Run an analysis to see Real/Fake + confidence.</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
