import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiCpu, FiFileText } from 'react-icons/fi';
import Loader from '../../Loader.jsx';
import ResultDetailsCard from '../ResultDetailsCard.jsx';
import { detectNews, detectText } from '../../../services/api.js';
import { addHistoryRecord } from '../../../services/history.js';
import { buildExplainableResult } from '../../../utils/explainers.js';

const MODE_AI_TEXT = 'text';
const MODE_NEWS = 'news';

export default function TextDetectionPanel({ onNewRecord }) {
    const [mode, setMode] = useState(MODE_AI_TEXT);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [record, setRecord] = useState(null);

    const badges = useMemo(() => {
        if (!record) return [];
        const isFake = record.result === 'Fake';

        if (record.kind === 'news') {
            return [
                {
                    label: isFake ? 'Fake News' : 'Real News',
                    className: isFake
                        ? 'bg-rose-500/15 text-rose-200 border-rose-500/20'
                        : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
                }
            ];
        }

        return [
            {
                label: isFake ? 'AI Generated' : 'Human',
                className: isFake
                    ? 'bg-purple-500/15 text-purple-200 border-purple-500/20'
                    : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20'
            }
        ];
    }, [record]);

    async function analyze() {
        const input = text.trim();
        if (!input) {
            toast.error('Text is required.');
            return;
        }

        try {
            setLoading(true);
            setRecord(null);

            const apiRes = mode === MODE_NEWS ? await detectNews(input) : await detectText(input);
            const kind = mode === MODE_NEWS ? 'news' : 'text';

            const explain = buildExplainableResult({ kind, result: apiRes.result, confidencePct: apiRes.confidence });

            const next = {
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                ts: new Date().toISOString(),
                kind,
                label: input.length > 140 ? `${input.slice(0, 137)}...` : input,
                result: apiRes.result,
                confidence: apiRes.confidence,
                trustScore: explain.trustScore,
                why: explain.why
            };

            setRecord(next);
            addHistoryRecord(next);
            onNewRecord?.(next);
            toast.success(kind === 'news' ? 'News analyzed successfully' : 'Text analyzed successfully');
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
                        <div className="text-sm font-semibold text-slate-200/70">Text Detection</div>
                        <div className="mt-1 text-xs text-slate-200/60">AI-generated vs human + fake-news analysis</div>
                    </div>
                    <div className="glass rounded-2xl px-3 py-2 text-xs text-slate-200/70 inline-flex items-center gap-2">
                        <FiCpu /> {mode === MODE_NEWS ? 'Fake News' : 'AI Text'}
                    </div>
                </div>

                <div className="mt-4 glass flex items-center gap-1 rounded-2xl p-1">
                    <button
                        type="button"
                        className={`tab ${mode === MODE_AI_TEXT ? 'tab-active' : 'tab-inactive'}`}
                        onClick={() => {
                            setMode(MODE_AI_TEXT);
                            setRecord(null);
                        }}
                    >
                        AI Text
                    </button>
                    <button
                        type="button"
                        className={`tab ${mode === MODE_NEWS ? 'tab-active' : 'tab-inactive'}`}
                        onClick={() => {
                            setMode(MODE_NEWS);
                            setRecord(null);
                        }}
                    >
                        Fake News
                    </button>
                </div>

                <textarea
                    className="input mt-4 min-h-[220px] resize-none"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                        mode === MODE_NEWS
                            ? 'Paste a news claim or article text for verification…'
                            : 'Paste text to detect AI-generation patterns…'
                    }
                />

                <motion.button
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    disabled={loading}
                    onClick={analyze}
                    className="btn-grad mt-4 w-full"
                    type="button"
                >
                    {loading ? <Loader label="Analyzing…" /> : (
                        <span className="inline-flex items-center gap-2">
                            <FiFileText /> Analyze
                        </span>
                    )}
                </motion.button>

                <div className="mt-3 text-xs text-slate-200/60">
                    Tip: Use longer samples for stronger signals.
                </div>
            </div>

            <div className="space-y-4">
                <ResultDetailsCard record={record} secondaryBadges={badges} />
            </div>
        </div>
    );
}
