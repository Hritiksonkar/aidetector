import Hero from '../components/Hero.jsx';
import { motion } from 'framer-motion';
import { FiShield, FiZap, FiLayers } from 'react-icons/fi';

function Feature({ icon, title, desc }) {
    return (
        <div className="glass rounded-3xl p-5">
            <div className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3">
                {icon}
            </div>
            <div className="mt-4 text-lg font-bold">{title}</div>
            <div className="mt-2 text-sm text-slate-200/70">{desc}</div>
        </div>
    );
}

export default function Home() {
    return (
        <div className="space-y-8 pb-4">
            <Hero />

            <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="grid gap-4 sm:grid-cols-3"
            >
                <Feature
                    icon={<FiZap className="text-indigo-200" />}
                    title="Fast"
                    desc="Async API calls with smooth, responsive UI transitions."
                />
                <Feature
                    icon={<FiLayers className="text-pink-200" />}
                    title="Multi-modal"
                    desc="Analyze text, images, and video URLs in one dashboard."
                />
                <Feature
                    icon={<FiShield className="text-emerald-200" />}
                    title="Reliable"
                    desc="Production-ready patterns: validation, error handling, and feedback toasts."
                />
            </motion.section>
        </div>
    );
}
