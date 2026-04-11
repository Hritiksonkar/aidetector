import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

export default function Hero() {
    return (
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-6 py-12 backdrop-blur-xl sm:px-10 sm:py-16">
            <div className="pointer-events-none absolute inset-0 opacity-60">
                <div className="absolute -left-24 -top-24 h-72 w-72 animate-floaty rounded-full bg-indigo-500/25 blur-3xl" />
                <div className="absolute -right-24 -top-24 h-72 w-72 animate-floaty rounded-full bg-pink-500/20 blur-3xl [animation-delay:0.8s]" />
                <div className="absolute bottom-[-7rem] left-1/2 h-80 w-80 -translate-x-1/2 animate-floaty rounded-full bg-emerald-500/15 blur-3xl [animation-delay:1.6s]" />
            </div>

            <div className="relative">
                <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100/90"
                >
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Real-time detection API ready
                </motion.p>

                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.05 }}
                    className="mt-6 text-4xl font-black tracking-tight sm:text-5xl"
                >
                    <span className="bg-gradient-to-r from-indigo-300 via-pink-300 to-emerald-200 bg-clip-text text-transparent">
                        AI Fake Content Detector
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.12 }}
                    className="mt-4 max-w-2xl text-base text-slate-200/80 sm:text-lg"
                >
                    Detect Fake Images, Videos & Text in Seconds
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.18 }}
                    className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
                >
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                        <Link to="/dashboard" className="btn-grad animate-shimmer">
                            Start Detection <FiArrowRight />
                        </Link>
                    </motion.div>

                    <div className="glass rounded-2xl px-4 py-3 text-sm text-slate-200/75">
                        Works with: Text • Images • Video URLs
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
