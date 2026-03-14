import React from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Navbar from './components/Navbar.jsx'
import { setAuthToken } from './services/api.js'

const Home = React.lazy(() => import('./pages/Home.jsx'))
const Upload = React.lazy(() => import('./pages/Upload.jsx'))
const Dashboard = React.lazy(() => import('./pages/Dashboard.jsx'))
const Login = React.lazy(() => import('./pages/Login.jsx'))
const Register = React.lazy(() => import('./pages/Register.jsx'))

function Page({ children }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
        >
            {children}
        </motion.div>
    )
}

function Lazy({ children }) {
    return (
        <React.Suspense fallback={<div className="text-sm text-text/70">Loading...</div>}>
            {children}
        </React.Suspense>
    )
}

function isAuthed() {
    return Boolean(localStorage.getItem('token'))
}

export default function App() {
    const location = useLocation()
    const [authed, setAuthed] = React.useState(isAuthed())

    const handleLogout = () => {
        setAuthToken(null)
        setAuthed(false)
    }

    const handleLogin = (token) => {
        setAuthToken(token)
        setAuthed(true)
    }

    return (
        <div className="min-h-screen">
            <Navbar authed={authed} onLogout={handleLogout} />
            <main className="container-page py-8">
                <AnimatePresence mode="wait">
                    <Routes location={location} key={location.pathname}>
                        <Route
                            path="/"
                            element={
                                <Lazy>
                                    <Page>
                                        <Home />
                                    </Page>
                                </Lazy>
                            }
                        />
                        <Route
                            path="/upload"
                            element={
                                <Lazy>
                                    <Page>
                                        <Upload />
                                    </Page>
                                </Lazy>
                            }
                        />
                        <Route
                            path="/dashboard"
                            element={
                                authed ? (
                                    <Lazy>
                                        <Page>
                                            <Dashboard />
                                        </Page>
                                    </Lazy>
                                ) : (
                                    <Navigate to="/login" replace />
                                )
                            }
                        />
                        <Route
                            path="/login"
                            element={
                                authed ? (
                                    <Navigate to="/dashboard" replace />
                                ) : (
                                    <Lazy>
                                        <Page>
                                            <Login onLogin={handleLogin} />
                                        </Page>
                                    </Lazy>
                                )
                            }
                        />
                        <Route
                            path="/register"
                            element={
                                authed ? (
                                    <Navigate to="/dashboard" replace />
                                ) : (
                                    <Lazy>
                                        <Page>
                                            <Register onRegister={handleLogin} />
                                        </Page>
                                    </Lazy>
                                )
                            }
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AnimatePresence>
            </main>
        </div>
    )
}
