import { motion } from 'framer-motion';

export default function Loader({ label = 'Analyzing...' }) {
    return (
        <div className="flex items-center gap-3">
            <motion.div
                className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white/70"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
            />
            <span className="text-sm font-semibold text-slate-200/80">{label}</span>
        </div>
    );
}
