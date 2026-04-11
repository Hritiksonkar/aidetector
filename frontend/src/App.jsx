import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Dashboard from './pages/Dashboard.jsx';

function Page({ children }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="min-h-[calc(100vh-64px)]"
        >
            {children}
        </motion.div>
    );
}

function Footer() {
    return (
        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 pt-10">
            <div className="glass rounded-2xl px-5 py-4 text-sm text-slate-200/80">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span>© {new Date().getFullYear()} AI Fake Content Detector</span>
                    <span className="text-slate-200/60">Built for demo + production scaffolding</span>
                </div>
            </div>
        </footer>
    );
}

export default function App() {
    const location = useLocation();

    return (
        <div className="app-bg min-h-screen">
            <Navbar />
            <main className="mx-auto w-full max-w-6xl px-4 pt-8">
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
                            path="/dashboard"
                            element={
                                <Page>
                                    <Dashboard />
                                </Page>
                            }
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </AnimatePresence>
            </main>
            <Footer />
        </div>
    );
}
