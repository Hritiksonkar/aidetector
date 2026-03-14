import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../services/api.js'

export default function Register({ onRegister }) {
    const navigate = useNavigate()
    const [name, setName] = React.useState('')
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')

    const submit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const data = await register({ name, email, password })
            const token = data?.token || data?.jwt
            if (!token) throw new Error('Registration succeeded but no token was returned.')
            onRegister(token)
            navigate('/dashboard')
        } catch (err) {
            if (err?.response?.status === 409) {
                setError('Email already registered. Please login instead.')
                return
            }
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Registration failed.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mx-auto w-full max-w-md">
            <div className="glass rounded-3xl p-6">
                <div className="text-2xl font-semibold">Register</div>
                <div className="mt-1 text-sm text-text/70">Create an account to save scans.</div>

                <form onSubmit={submit} className="mt-6 space-y-4">
                    <div>
                        <label className="text-xs text-text/70">Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            type="text"
                            required
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                            placeholder="Your name"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-text/70">Email</label>
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            type="email"
                            required
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-text/70">Password</label>
                        <input
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            type="password"
                            required
                            minLength={6}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
                            placeholder="••••••••"
                        />
                    </div>

                    {error ? (
                        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {error}
                        </div>
                    ) : null}

                    <button
                        disabled={loading}
                        type="submit"
                        className="w-full rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating…' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-5 text-center text-sm text-text/70">
                    Already have an account?{' '}
                    <Link to="/login" className="font-semibold text-text hover:underline">
                        Login
                    </Link>
                </div>
            </div>
        </div>
    )
}
