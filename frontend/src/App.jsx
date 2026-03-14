import React from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Upload from './pages/Upload.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import { setAuthToken } from './services/api.js'

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
                                <Page>
                                    <Home />
                                </Page>
                            }
                        />
                        <Route
                            path="/upload"
                            element={
                                <Page>
                                    <Upload />
                                </Page>
                            }
                        />
                        <Route
                            path="/dashboard"
                            element={
                                authed ? (
                                    <Page>
                                        <Dashboard />
                                    </Page>
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
                                    <Page>
                                        <Login onLogin={handleLogin} />
                                    </Page>
                                )
                            }
                        />
                        <Route
                            path="/register"
                            element={
                                authed ? (
                                    <Navigate to="/dashboard" replace />
                                ) : (
                                    <Page>
                                        <Register onRegister={handleLogin} />
                                    </Page>
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
