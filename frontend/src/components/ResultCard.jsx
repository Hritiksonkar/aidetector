import React from 'react'
import ScoreMeter from './ScoreMeter.jsx'

function verdict(score) {
    const s = Number(score)
    if (!Number.isFinite(s)) return { label: 'Unknown', tone: 'yellow' }
    if (s > 6) return { label: 'Likely AI Generated', tone: 'red' }
    if (s > 3) return { label: 'Uncertain', tone: 'yellow' }
    return { label: 'Likely Real', tone: 'green' }
}

function badgeClass(tone) {
    if (tone === 'red') return 'bg-red-500/15 text-red-200 border-red-400/20'
    if (tone === 'yellow')
        return 'bg-amber-500/15 text-amber-200 border-amber-400/20'
    return 'bg-green-500/15 text-green-200 border-green-400/20'
}

export default function ResultCard({ file, result }) {
    const score =
        result?.score ??
        result?.aiScore ??
        result?.ai_probability ??
        result?.probability
    const backendVerdict = result?.verdict
    const v = backendVerdict
        ? {
            label: backendVerdict,
            tone:
                backendVerdict === 'Likely AI Generated'
                    ? 'red'
                    : backendVerdict === 'Uncertain'
                        ? 'yellow'
                        : 'green',
        }
        : verdict(score)

    const [previewUrl, setPreviewUrl] = React.useState(null)

    React.useEffect(() => {
        // If backend returned a persisted upload URL (e.g. URL-scan), prefer that.
        if (!file && result?.fileUrl) {
            setPreviewUrl(result.fileUrl)
            return
        }

        if (!file) {
            setPreviewUrl(null)
            return
        }

        // In React StrictMode (dev), effects mount/unmount twice.
        // Creating & revoking object URLs inside the effect avoids revoking
        // a URL that the UI is still trying to render.
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        return () => {
            URL.revokeObjectURL(url)
        }
    }, [file, result?.fileUrl])

    return (
        <div className="glass w-full rounded-3xl p-6">
            <div className="flex flex-col gap-6 md:flex-row">
                <div className="w-full md:w-64">
                    <div className="text-sm font-semibold">File Preview</div>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        {(file?.type?.startsWith('video/') || result?.fileType === 'video') ? (
                            <video
                                src={previewUrl || ''}
                                controls
                                className="h-44 w-full object-cover"
                            />
                        ) : (
                            <img
                                src={previewUrl || ''}
                                alt="Uploaded preview"
                                className="h-44 w-full object-cover"
                            />
                        )}
                    </div>
                    <div className="mt-3 text-xs text-text/70">
                        {file?.name ? (
                            <>
                                {file.name} • {file.type}
                            </>
                        ) : result?.fileUrl ? (
                            <>Saved file • {result?.fileType || 'media'}</>
                        ) : null}
                    </div>
                </div>

                <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="text-sm text-text/70">Detection Result</div>
                            <div className="mt-1 text-xl font-semibold">Truth Shield</div>
                        </div>
                        <div
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                                v.tone
                            )}`}
                        >
                            {v.label}
                        </div>
                    </div>

                    <div className="mt-6">
                        <ScoreMeter score={score} />
                    </div>

                    {result?.source ? (
                        <div className="mt-4 text-sm text-text/70">
                            Checked via{' '}
                            <span className="font-semibold text-text">
                                {result.source === 'gemini' ? 'Gemini' : 'Heuristic'}
                            </span>
                            {result.source === 'gemini' && result?.explanation
                                ? ` — ${result.explanation}`
                                : null}
                        </div>
                    ) : null}

                    {result?.message ? (
                        <div className="mt-4 text-sm text-text/70">{result.message}</div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
