import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import Sidebar, { DASHBOARD_VIEWS, dashboardNav } from '../components/dashboard/Sidebar.jsx';
import SectionHeader from '../components/dashboard/SectionHeader.jsx';

import OverviewPanel from '../components/dashboard/panels/OverviewPanel.jsx';
import TextDetectionPanel from '../components/dashboard/panels/TextDetectionPanel.jsx';
import ImageDetectionPanel from '../components/dashboard/panels/ImageDetectionPanel.jsx';
import VideoDetectionPanel from '../components/dashboard/panels/VideoDetectionPanel.jsx';
import ReportsPanel from '../components/dashboard/panels/ReportsPanel.jsx';
import SettingsPanel from '../components/dashboard/panels/SettingsPanel.jsx';

import HistoryPanel from '../components/dashboard/HistoryPanel.jsx';
import AssistantPanel from '../components/dashboard/AssistantPanel.jsx';

const viewTitles = {
    [DASHBOARD_VIEWS.OVERVIEW]: { title: 'Dashboard Overview', subtitle: 'At-a-glance analytics, recents, and quick actions.' },
    [DASHBOARD_VIEWS.TEXT]: { title: 'Text Detection', subtitle: 'Detect AI-generated text and fake-news patterns.' },
    [DASHBOARD_VIEWS.IMAGE]: { title: 'Image Detection', subtitle: 'Detect manipulation and AI-generated imagery.' },
    [DASHBOARD_VIEWS.VIDEO]: { title: 'Video Detection', subtitle: 'Deepfake detection with explainable signals.' },
    [DASHBOARD_VIEWS.HISTORY]: { title: 'History', subtitle: 'Search, filter, export, and review previous results.' },
    [DASHBOARD_VIEWS.ASSISTANT]: { title: 'AI Assistant', subtitle: 'Ask questions and get guidance using your latest result.' },
    [DASHBOARD_VIEWS.REPORTS]: { title: 'Reports', subtitle: 'Generate shareable exports and PDFs.' },
    [DASHBOARD_VIEWS.SETTINGS]: { title: 'Settings', subtitle: 'Environment and preferences.' }
};

export default function Dashboard() {
    const [activeView, setActiveView] = useState(DASHBOARD_VIEWS.OVERVIEW);
    const [lastRecord, setLastRecord] = useState(null);
    const [refreshSignal, setRefreshSignal] = useState(0);

    const header = viewTitles[activeView] || viewTitles[DASHBOARD_VIEWS.OVERVIEW];

    const mobileNav = useMemo(() => {
        return dashboardNav.map((x) => {
            const isActive = x.key === activeView;
            return (
                <button
                    key={x.key}
                    type="button"
                    onClick={() => setActiveView(x.key)}
                    className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-semibold transition ${isActive ? 'bg-white/10 text-white' : 'text-slate-200/70 hover:bg-white/5'
                        }`}
                >
                    {x.label}
                </button>
            );
        });
    }, [activeView]);

    function onNewRecord(next) {
        setLastRecord(next);
        setRefreshSignal((x) => x + 1);
    }

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-6">
            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
                <div className="hidden md:block">
                    <Sidebar active={activeView} onSelect={(view) => setActiveView(view)} />
                </div>

                <div className="space-y-4">
                    <SectionHeader title={header.title} subtitle={header.subtitle} />

                    <div className="md:hidden">
                        <div className="glass overflow-x-auto rounded-3xl p-2">
                            <div className="flex items-center gap-1">{mobileNav}</div>
                        </div>
                    </div>

                    <motion.div
                        key={activeView}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                    >
                        {activeView === DASHBOARD_VIEWS.OVERVIEW ? (
                            <OverviewPanel onQuickNavigate={(view) => setActiveView(view)} />
                        ) : null}

                        {activeView === DASHBOARD_VIEWS.TEXT ? <TextDetectionPanel onNewRecord={onNewRecord} /> : null}

                        {activeView === DASHBOARD_VIEWS.IMAGE ? <ImageDetectionPanel onNewRecord={onNewRecord} /> : null}

                        {activeView === DASHBOARD_VIEWS.VIDEO ? <VideoDetectionPanel onNewRecord={onNewRecord} /> : null}

                        {activeView === DASHBOARD_VIEWS.HISTORY ? (
                            <HistoryPanel
                                refreshSignal={refreshSignal}
                                onSelectRecord={(rec) => {
                                    setLastRecord(rec);
                                    setActiveView(DASHBOARD_VIEWS.ASSISTANT);
                                }}
                            />
                        ) : null}

                        {activeView === DASHBOARD_VIEWS.ASSISTANT ? <AssistantPanel lastRecord={lastRecord} /> : null}

                        {activeView === DASHBOARD_VIEWS.REPORTS ? <ReportsPanel /> : null}

                        {activeView === DASHBOARD_VIEWS.SETTINGS ? <SettingsPanel /> : null}
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
