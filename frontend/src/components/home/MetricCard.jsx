import { motion } from 'framer-motion';

export default function MetricCard({ icon, label, value, delta, tone = 'indigo' }) {
    const toneMap = {
        indigo: 'from-indigo-400/30 to-indigo-200/10 text-indigo-100',
        purple: 'from-purple-400/30 to-purple-200/10 text-purple-100',
        sky: 'from-sky-400/30 to-sky-200/10 text-sky-100',
        emerald: 'from-emerald-400/30 to-emerald-200/10 text-emerald-100',
        rose: 'from-rose-400/30 to-rose-200/10 text-rose-100'
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="glass group relative overflow-hidden rounded-3xl p-5"
        >
            <div className={`pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-gradient-to-br ${toneMap[tone] || toneMap.indigo}`} />
            <div className="relative flex items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-semibold text-slate-200/60">{label}</div>
                    <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
                    {delta ? <div className="mt-2 text-xs text-slate-200/70">{delta}</div> : null}
                </div>
                <div className="glass grid h-12 w-12 place-items-center rounded-2xl text-slate-100/90">
                    {icon}
                </div>
            </div>
        </motion.div>
    );
}
