import { motion } from 'framer-motion';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';

function getResultStyle(result) {
    if (result === 'Real') {
        return {
            label: 'Real ✅',
            icon: <FiCheckCircle className="text-emerald-300" />,
            badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20',
            bar: 'from-emerald-400 to-emerald-200'
        };
    }
    return {
        label: 'Fake ❌',
        icon: <FiXCircle className="text-rose-300" />,
        badge: 'bg-rose-500/15 text-rose-200 border-rose-500/20',
        bar: 'from-rose-400 to-pink-200'
    };
}

export default function ResultCard({ title = 'Detection Result', result, confidence }) {
    const style = getResultStyle(result);
    const pct = Math.max(0, Math.min(100, Number(confidence ?? 0)));

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="glass w-full rounded-3xl p-5"
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-slate-200/70">{title}</div>
                    <div
                        className={`mt-2 inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold ${style.badge}`}
                    >
                        {style.icon}
                        {style.label}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-200/60">Confidence</div>
                    <div className="mt-1 text-2xl font-black">{pct}%</div>
                </div>
            </div>

            <div className="mt-5">
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${style.bar}`}
                    />
                </div>
            </div>
        </motion.div>
    );
}
