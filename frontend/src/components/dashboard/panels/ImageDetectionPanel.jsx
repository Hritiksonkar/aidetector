import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiImage, FiUploadCloud } from 'react-icons/fi';
import Loader from '../../Loader.jsx';
import ResultDetailsCard from '../ResultDetailsCard.jsx';
import { detectImage } from '../../../services/api.js';
import { addHistoryRecord } from '../../../services/history.js';
import { buildExplainableResult } from '../../../utils/explainers.js';

function formatBytes(n) {
    const v = Number(n || 0);
    if (!Number.isFinite(v) || v <= 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const idx = Math.min(units.length - 1, Math.floor(Math.log(v) / Math.log(1024)));
    const val = v / Math.pow(1024, idx);
    return `${val.toFixed(idx === 0 ? 0 : 2)}${units[idx]}`;
}

async function getImageDimensions(file) {
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to read image'));
            img.src = url;
        });
        return { width: img.naturalWidth || 0, height: img.naturalHeight || 0 };
    } finally {
        URL.revokeObjectURL(url);
    }
}

export default function ImageDetectionPanel({ onNewRecord }) {
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState('');
    const [loading, setLoading] = useState(false);
    const [record, setRecord] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview);
        };
    }, [preview]);

    const badges = useMemo(() => {
        if (!record) return [];
        const isFake = record.result === 'Fake';
        return [
            {
                label: isFake ? 'Manipulated / AI' : 'No Strong Manipulation',
                className: isFake
                    ? 'bg-purple-500/15 text-purple-200 border-purple-500/20'
                    : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
            }
        ];
    }, [record]);

    function pickFile(f) {
        if (!f) return;
        if (!f.type?.startsWith('image/')) {
            toast.error('Please upload an image file.');
            return;
        }
        setFile(f);
        setRecord(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(URL.createObjectURL(f));
    }

    async function analyze() {
        if (!file) {
            toast.error('Please select an image first.');
            return;
        }

        try {
            setLoading(true);
            setRecord(null);

            const [apiRes, dims] = await Promise.all([detectImage(file), getImageDimensions(file)]);
            const explain = buildExplainableResult({ kind: 'image', result: apiRes.result, confidencePct: apiRes.confidence });

            const meta = {
                name: file.name,
                type: file.type,
                sizeBytes: file.size,
                width: dims.width,
                height: dims.height
            };

            const next = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                ts: new Date().toISOString(),
                kind: 'image',
                label: file.name,
                result: apiRes.result,
                confidence: apiRes.confidence,
                trustScore: explain.trustScore,
                why: explain.why,
                meta
            };

            setRecord(next);
            addHistoryRecord(next);
            onNewRecord?.(next);
            toast.success('Image analyzed successfully');
        } catch (err) {
            const msg = err?.response?.data?.message || err?.message || 'Analysis failed';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    const metadataLines = useMemo(() => {
        if (!record?.meta) return [];
        const m = record.meta;
        return [
            `File: ${m.name || '—'}`,
            `Type: ${m.type || '—'}`,
            `Size: ${formatBytes(m.sizeBytes)}`,
            `Dimensions: ${m.width || 0}×${m.height || 0}`
        ];
    }, [record]);

    return (
        <div className="grid gap-4 xl:grid-cols-2">
            <div className="glass rounded-3xl p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold text-slate-200/70">Image Detection</div>
                        <div className="mt-1 text-xs text-slate-200/60">Drag & drop upload with preview and explainable signals</div>
                    </div>
                    <div className="glass rounded-2xl px-3 py-2 text-xs text-slate-200/70 inline-flex items-center gap-2">
                        <FiImage /> Vision
                    </div>
                </div>

                <div
                    className={`mt-4 relative grid min-h-[200px] place-items-center rounded-3xl border border-dashed p-5 transition ${dragOver ? 'border-indigo-300/60 bg-indigo-500/10' : 'border-white/15 bg-white/5'
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
                        const f = e.dataTransfer.files?.[0];
                        pickFile(f);
                    }}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => pickFile(e.target.files?.[0])}
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
                            onClick={() => inputRef.current?.click()}
                        >
                            Choose File
                        </button>
                    </div>
                </div>

                {preview ? (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 glass overflow-hidden rounded-3xl"
                    >
                        <img src={preview} alt="Preview" className="h-60 w-full object-cover" />
                    </motion.div>
                ) : null}

                <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    disabled={loading}
                    onClick={analyze}
                    className="btn-grad mt-4 w-full"
                    type="button"
                >
                    {loading ? <Loader label="Analyzing…" /> : 'Analyze Image'}
                </motion.button>

                <div className="mt-3 text-xs text-slate-200/60">Tip: Upload higher resolution for better signals.</div>
            </div>

            <div className="space-y-4">
                <ResultDetailsCard record={record} secondaryBadges={badges} metadataLines={metadataLines} />
            </div>
        </div>
    );
}
