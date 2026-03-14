import React from 'react'
import { fetchHistory } from '../services/api.js'

function verdict(score) {
    const s = Number(score)
    if (!Number.isFinite(s)) return { label: 'Unknown', tone: 'yellow' }
    if (s > 6) return { label: 'Likely AI', tone: 'red' }
    if (s > 3) return { label: 'Uncertain', tone: 'yellow' }
    return { label: 'Likely Real', tone: 'green' }
}

function badgeClass(tone) {
    if (tone === 'red') return 'bg-red-500/15 text-red-200 border-red-400/20'
    if (tone === 'yellow')
        return 'bg-amber-500/15 text-amber-200 border-amber-400/20'
    return 'bg-green-500/15 text-green-200 border-green-400/20'
}

export default function Dashboard() {
    const [rows, setRows] = React.useState([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState('')

    React.useEffect(() => {
        let active = true

            ; (async () => {
                setLoading(true)
                setError('')
                try {
                    const data = await fetchHistory()
                    const list = Array.isArray(data) ? data : data?.items || []
                    if (active) setRows(list)
                } catch (e) {
                    const msg =
                        e?.response?.data?.message ||
                        e?.response?.data?.error ||
                        e?.message ||
                        'Failed to load history.'
                    if (active) setError(msg)
                } finally {
                    if (active) setLoading(false)
                }
            })()

        return () => {
            active = false
        }
    }, [])

    const apiBase = import.meta.env.VITE_API_BASE_URL || ''
    const withBase = (url) => {
        if (!url) return url
        if (url.startsWith('http://') || url.startsWith('https://')) return url
        if (!apiBase) return url
        return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`
    }

    return (
        <div className="space-y-6">
            <div>
                <div className="text-2xl font-semibold">Dashboard</div>
                <div className="mt-1 text-sm text-text/70">
                    Your upload history (requires login).
                </div>
            </div>

            {loading ? (
                <div className="glass rounded-3xl p-6 text-sm text-text/70">
                    Loading history...
                </div>
            ) : null}

            {error ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </div>
            ) : null}

            {!loading && !error ? (
                <div className="glass overflow-hidden rounded-3xl">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase text-text/70">
                                <tr>
                                    <th className="px-4 py-3">File Preview</th>
                                    <th className="px-4 py-3">File Type</th>
                                    <th className="px-4 py-3">Score</th>
                                    <th className="px-4 py-3">Verdict</th>
                                    <th className="px-4 py-3">Upload Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td className="px-4 py-6 text-text/70" colSpan={5}>
                                            No uploads yet.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((r) => {
                                        const score = r?.score ?? r?.aiScore ?? r?.probability
                                        const v = r?.verdict
                                            ? {
                                                label: r.verdict,
                                                tone:
                                                    r.verdict === 'Likely AI Generated'
                                                        ? 'red'
                                                        : r.verdict === 'Uncertain'
                                                            ? 'yellow'
                                                            : 'green',
                                            }
                                            : verdict(score)
                                        const date = r?.createdAt || r?.uploadDate || r?.date
                                        const preview = withBase(r?.fileUrl || r?.url || r?.path)
                                        const type = r?.fileType || r?.mimeType || r?.type

                                        return (
                                            <tr key={r?._id || r?.id || `${preview}-${date}`} className="border-b border-white/5">
                                                <td className="px-4 py-3">
                                                    <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                                                        {type === 'video' || type?.startsWith('video') ? (
                                                            <video src={preview} className="h-12 w-12 object-cover" />
                                                        ) : (
                                                            <img src={preview} alt="preview" className="h-12 w-12 object-cover" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-text/70">{type || '—'}</td>
                                                <td className="px-4 py-3 font-semibold">
                                                    {Number.isFinite(Number(score)) ? Number(score).toFixed(1) : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(v.tone)}`}>
                                                        {v.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-text/70">
                                                    {date ? new Date(date).toLocaleString() : '—'}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
