import { motion } from 'framer-motion';
import { FiCpu, FiFileText, FiShield, FiUploadCloud } from 'react-icons/fi';

const steps = [
    {
        title: 'Upload Content',
        desc: 'Paste text, upload an image, or provide a video URL for verification.',
        icon: FiUploadCloud,
        tone: 'from-indigo-400/25 to-transparent'
    },
    {
        title: 'AI Analysis',
        desc: 'Multi-modal models analyze authenticity, manipulation cues, and generation signals.',
        icon: FiCpu,
        tone: 'from-purple-400/25 to-transparent'
    },
    {
        title: 'Trust Score',
        desc: 'A calibrated trust score quantifies how likely the content is genuine.',
        icon: FiShield,
        tone: 'from-sky-400/25 to-transparent'
    },
    {
        title: 'Explanation & Report',
        desc: 'Get an explainable summary with exportable reports for audit and sharing.',
        icon: FiFileText,
        tone: 'from-emerald-400/25 to-transparent'
    }
];

export default function HowItWorks() {
    return (
        <section className="mt-10 pb-10">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.35 }}
            >
                <div className="text-2xl font-black tracking-tight">How It Works</div>
                <div className="mt-2 max-w-2xl text-sm text-slate-200/70">
                    A clean verification workflow designed for teams, compliance, and high-stakes decisions.
                </div>
            </motion.div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {steps.map((s, idx) => {
                    const Icon = s.icon;
                    return (
                        <motion.div
                            key={s.title}
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-80px' }}
                            transition={{ duration: 0.35, delay: idx * 0.05 }}
                            whileHover={{ y: -3 }}
                            className="glass group relative overflow-hidden rounded-3xl p-5"
                        >
                            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.tone} opacity-0 transition group-hover:opacity-100`} />
                            <div className="relative">
                                <div className="glass inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-200/80">
                                    <span className="grid h-7 w-7 place-items-center rounded-xl bg-white/5">
                                        <Icon className="text-slate-100/90" />
                                    </span>
                                    Step {idx + 1}
                                </div>
                                <div className="mt-4 text-lg font-bold">{s.title}</div>
                                <div className="mt-2 text-sm text-slate-200/70">{s.desc}</div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </section>
    );
}
