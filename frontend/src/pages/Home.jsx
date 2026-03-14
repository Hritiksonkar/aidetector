import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

function Section({ title, children }) {
    return (
        <div className="glass rounded-3xl p-6">
            <div className="text-lg font-semibold">{title}</div>
            <div className="mt-2 text-sm text-text/70">{children}</div>
        </div>
    )
}

export default function Home() {
    return (
        <div className="space-y-10">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-10">
                <div className="relative">
                    <motion.h1
                        className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                    >
                        Truth Shield – Detect AI Generated Content
                    </motion.h1>
                    <p className="mt-4 max-w-2xl text-pretty text-base text-text/75 sm:text-lg">
                        Upload images or videos and instantly know if they are real or AI generated.
                    </p>

                    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                        <Link
                            to="/upload"
                            className="rounded-2xl bg-primary px-6 py-3 text-center text-sm font-semibold text-white hover:opacity-95"
                        >
                            Upload File
                        </Link>
                        <Link
                            to="/register"
                            className="rounded-2xl bg-white/10 px-6 py-3 text-center text-sm font-semibold hover:bg-white/15"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Section title="How It Works">
                    Upload a JPG, PNG, or MP4. Truth Shield analyzes the media and returns a
                    probability score from 0 to 10.
                </Section>
                <Section title="Features">
                    Drag & drop uploads, clear verdicts, and a dashboard to review past scans.
                </Section>
                <Section title="Technology">
                    React + Vite frontend, Tailwind UI, animations with Framer Motion, and
                    score visualization.
                </Section>
            </div>

            <div className="glass rounded-3xl p-6">
                <div className="text-lg font-semibold">Ready to verify content?</div>
                <div className="mt-2 text-sm text-text/70">
                    Start with a quick upload, then sign in to save results and view history.
                </div>
                <div className="mt-5">
                    <Link
                        to="/upload"
                        className="inline-flex rounded-2xl bg-secondary px-5 py-2 text-sm font-semibold text-white hover:opacity-95"
                    >
                        Start a Scan
                    </Link>
                </div>
            </div>
        </div>
    )
}
