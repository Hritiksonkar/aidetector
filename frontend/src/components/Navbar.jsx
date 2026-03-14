import React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

function NavItem({ to, children }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm transition ${isActive ? 'bg-white/10' : 'hover:bg-white/5'
                }`
            }
        >
            {children}
        </NavLink>
    )
}

export default function Navbar({ authed, onLogout }) {
    const navigate = useNavigate()

    return (
        <header className="sticky top-0 z-50 border-b border-white/10 bg-background/70 backdrop-blur">
            <div className="container-page flex h-16 items-center justify-between">
                <Link to="/" className="flex items-center gap-2">
                    <motion.div
                        className="h-9 w-9 rounded-2xl bg-gradient-to-br from-primary to-secondary"
                        initial={{ rotate: -6 }}
                        animate={{ rotate: 0 }}
                        transition={{ duration: 0.3 }}
                    />
                    <div className="leading-tight">
                        <div className="text-sm font-semibold">Truth Shield</div>
                        <div className="text-xs text-text/70">AI media detector</div>
                    </div>
                </Link>

                <nav className="hidden items-center gap-1 md:flex">
                    <NavItem to="/">Home</NavItem>
                    <NavItem to="/upload">Upload</NavItem>
                    {authed && <NavItem to="/dashboard">Dashboard</NavItem>}
                </nav>

                <div className="flex items-center gap-2">
                    {!authed ? (
                        <>
                            <Link
                                to="/login"
                                className="rounded-xl px-3 py-2 text-sm hover:bg-white/5"
                            >
                                Login
                            </Link>
                            <Link
                                to="/register"
                                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                            >
                                Get Started
                            </Link>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => navigate('/upload')}
                                className="hidden rounded-xl px-3 py-2 text-sm hover:bg-white/5 md:block"
                            >
                                New Scan
                            </button>
                            <button
                                onClick={() => {
                                    onLogout()
                                    navigate('/')
                                }}
                                className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                            >
                                Logout
                            </button>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
