import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import UploadBox from '../components/UploadBox.jsx'
import ResultCard from '../components/ResultCard.jsx'
import { detectVideoFromUrl, uploadForDetection } from '../services/api.js'

export default function Upload() {
    const authed = Boolean(localStorage.getItem('token'))
    const [file, setFile] = React.useState(null)
    const [videoUrl, setVideoUrl] = React.useState('')
    const [result, setResult] = React.useState(null)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')

    const startUpload = async (selectedFile) => {
        if (!authed) {
            setError('Please login to upload and scan files.')
            return
        }
        setFile(selectedFile)
        setVideoUrl('')
        setResult(null)
        setError('')
        setLoading(true)

        try {
            const data = await uploadForDetection(selectedFile)
            setResult(data)
        } catch (e) {
            if (e?.response?.status === 401) {
                setError('Session expired. Please login again to upload.')
                return
            }
            const msg =
                e?.response?.data?.message ||
                e?.response?.data?.error ||
                e?.message ||
                'Upload failed.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    const startUrlDetect = async () => {
        if (!authed) {
            setError('Please login to scan video links.')
            return
        }

        const url = (videoUrl || '').trim()
        if (!url) {
            setError('Please paste a video URL to scan.')
            return
        }

        setFile(null)
        setResult(null)
        setError('')
        setLoading(true)

        try {
            const data = await detectVideoFromUrl(url)
            setResult(data)
        } catch (e) {
            if (e?.response?.status === 401) {
                setError('Session expired. Please login again to upload.')
                return
            }
            if (e?.response?.status === 404) {
                setError('Video not found at the provided link.')
                return
            }
            const msg =
                e?.response?.data?.message ||
                e?.response?.data?.error ||
                e?.message ||
                'Link scan failed.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <div className="text-2xl font-semibold">Upload Media</div>
                    <div className="mt-1 text-sm text-text/70">
                        Upload an image or video to detect AI-generated content.
                    </div>
                </div>
            </div>

            {!authed ? (
                <div className="glass rounded-3xl p-6">
                    <div className="text-sm text-text/70">
                        Upload scanning requires an account (JWT). Please login or register.
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <Link
                            to="/login"
                            className="rounded-2xl bg-primary px-5 py-2 text-center text-sm font-semibold text-white hover:opacity-95"
                        >
                            Login
                        </Link>
                        <Link
                            to="/register"
                            className="rounded-2xl bg-white/10 px-5 py-2 text-center text-sm font-semibold hover:bg-white/15"
                        >
                            Register
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <UploadBox onFileSelected={startUpload} disabled={loading} />

                    <div className="glass rounded-3xl p-6">
                        <div className="text-sm font-semibold">Scan Video Link</div>
                        <div className="mt-1 text-sm text-text/70">
                            Paste a video link (YouTube/Instagram/Facebook or direct file URL). Public links work best.
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <input
                                value={videoUrl}
                                onChange={(e) => setVideoUrl(e.target.value)}
                                type="url"
                                disabled={loading}
                                placeholder="https://youtube.com/watch?v=..."
                                className="w-full flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 disabled:cursor-not-allowed"
                            />
                            <button
                                type="button"
                                disabled={loading}
                                onClick={startUrlDetect}
                                className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Checking…' : 'Check Link'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="glass rounded-3xl p-6">
                    <div className="flex items-center gap-3">
                        <motion.div
                            className="h-3 w-3 rounded-full bg-secondary"
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{ repeat: Infinity, duration: 0.9 }}
                        />
                        <div className="text-sm">
                            <div className="font-semibold">Processing...</div>
                            <div className="text-text/70">Analyzing your media file</div>
                        </div>
                    </div>
                </div>
            ) : null}

            {error ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </div>
            ) : null}

            {result && (file || result?.fileUrl) ? <ResultCard file={file} result={result} /> : null}

            {result ? (
                <div className="text-sm text-text/70">
                    Tip: sign in to view saved scans in your dashboard.
                </div>
            ) : null}
        </div>
    )
}
