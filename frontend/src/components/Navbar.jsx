import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

function classNames(...items) {
    return items.filter(Boolean).join(' ');
}

export default function Navbar() {
    const navLinkClass = useMemo(
        () =>
            ({ isActive }) =>
                classNames(
                    'rounded-xl px-3 py-2 text-sm font-semibold transition',
                    isActive ? 'bg-white/10 border border-white/10' : 'text-slate-200/80 hover:bg-white/5'
                ),
        []
    );

    return (
        <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
                <NavLink to="/" className="flex items-center gap-3">
                    <div className="glass grid h-10 w-10 place-items-center rounded-2xl">
                        <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-sky-300 bg-clip-text text-lg font-black text-transparent">TL</span>
                    </div>
                    <div className="leading-tight">
                        <div className="text-sm font-bold">TruthLens AI</div>
                        <div className="text-xs text-slate-200/60">Trust verification for content</div>
                    </div>
                </NavLink>

                <nav className="flex items-center gap-2">
                    <NavLink to="/" className={navLinkClass}>
                        Home
                    </NavLink>
                    <NavLink to="/dashboard" className={navLinkClass}>
                        Dashboard
                    </NavLink>
                </nav>
            </div>
        </header>
    );
}
