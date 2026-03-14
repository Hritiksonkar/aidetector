import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../services/api.js'

export default function Login({ onLogin }) {
    const navigate = useNavigate()
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')

    const submit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const data = await login({ email, password })
            const token = data?.token || data?.jwt
            if (!token) throw new Error('Login succeeded but no token was returned.')
            onLogin(token)
            navigate('/dashboard')
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                'Login failed.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mx-auto w-full max-w-md">
            <div className="glass rounded-3xl p-6">
                <div className="text-2xl font-semibold">Login</div>
                <div className="mt-1 text-sm text-text/70">Access your dashboard and history.</div>

                <form onSubmit={submit} className="mt-6 space-y-4">
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
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-5 text-center text-sm text-text/70">
                    No account?{' '}
                    <Link to="/register" className="font-semibold text-text hover:underline">
                        Register
                    </Link>
                </div>
            </div>
        </div>
    )
}
