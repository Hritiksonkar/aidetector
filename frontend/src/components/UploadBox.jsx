import React from 'react'
import { motion } from 'framer-motion'

const ACCEPTED = {
    'image/jpeg': true,
    'image/png': true,
    'video/mp4': true,
}

export default function UploadBox({ onFileSelected, disabled }) {
    const inputRef = React.useRef(null)
    const [dragOver, setDragOver] = React.useState(false)
    const [error, setError] = React.useState('')

    const validate = (file) => {
        if (!file) return null
        if (!ACCEPTED[file.type]) {
            return 'Invalid file type. Please upload a JPG, PNG, or MP4.'
        }
        return null
    }

    const handleFile = (file) => {
        const err = validate(file)
        setError(err || '')
        if (!err && file) onFileSelected(file)
    }

    return (
        <div className="w-full">
            <motion.div
                className={`glass relative w-full rounded-3xl p-8 transition ${dragOver ? 'border-white/30 bg-white/10' : ''
                    } ${disabled ? 'opacity-60' : ''}`}
                onDragEnter={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!disabled) setDragOver(true)
                }}
                onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!disabled) setDragOver(true)
                }}
                onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOver(false)
                }}
                onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOver(false)
                    if (disabled) return
                    const file = e.dataTransfer.files?.[0]
                    handleFile(file)
                }}
            >
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div className="text-lg font-semibold">Drag & Drop</div>
                    <div className="text-sm text-text/70">
                        Accepted: <span className="font-medium">jpg</span>,{' '}
                        <span className="font-medium">png</span>,{' '}
                        <span className="font-medium">mp4</span>
                    </div>

                    <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => inputRef.current?.click()}
                            className="rounded-2xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed"
                        >
                            Upload File
                        </button>
                        <div className="text-xs text-text/60">or drop it here</div>
                    </div>

                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,video/mp4"
                        disabled={disabled}
                        onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                </div>
            </motion.div>

            {error ? (
                <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </div>
            ) : null}
        </div>
    )
}
