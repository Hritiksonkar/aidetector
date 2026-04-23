import {
    FiBarChart2,
    FiClock,
    FiFile,
    FiFileText,
    FiGrid,
    FiImage,
    FiMessageSquare,
    FiSettings,
    FiVideo
} from 'react-icons/fi';

export const DASHBOARD_VIEWS = {
    OVERVIEW: 'overview',
    TEXT: 'text',
    IMAGE: 'image',
    VIDEO: 'video',
    HISTORY: 'history',
    ASSISTANT: 'assistant',
    REPORTS: 'reports',
    SETTINGS: 'settings'
};

export const dashboardNav = [
    { key: DASHBOARD_VIEWS.OVERVIEW, label: 'Dashboard Overview', icon: FiGrid },
    { key: DASHBOARD_VIEWS.TEXT, label: 'Text Detection', icon: FiFileText },
    { key: DASHBOARD_VIEWS.IMAGE, label: 'Image Detection', icon: FiImage },
    { key: DASHBOARD_VIEWS.VIDEO, label: 'Video Detection', icon: FiVideo },
    { key: DASHBOARD_VIEWS.HISTORY, label: 'Analysis History', icon: FiClock },
    { key: DASHBOARD_VIEWS.ASSISTANT, label: 'AI Assistant', icon: FiMessageSquare },
    { key: DASHBOARD_VIEWS.REPORTS, label: 'Reports', icon: FiFile },
    { key: DASHBOARD_VIEWS.SETTINGS, label: 'Settings', icon: FiSettings }
];

function classNames(...items) {
    return items.filter(Boolean).join(' ');
}

export default function Sidebar({ active, onSelect }) {
    return (
        <aside className="hidden md:block md:w-[280px]">
            <div className="glass sticky top-20 rounded-3xl p-3">
                <div className="px-3 pb-3 pt-2">
                    <div className="text-xs font-semibold text-slate-200/60">TruthLens AI</div>
                    <div className="mt-1 text-lg font-black tracking-tight">Detection Panel</div>
                    <div className="mt-2 text-xs text-slate-200/60">
                        Verify text, images, videos with trust scores.
                    </div>
                </div>

                <nav className="space-y-1">
                    {dashboardNav.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.key === active;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => onSelect(item.key)}
                                className={classNames(
                                    'w-full rounded-2xl px-3 py-3 text-left text-sm font-semibold transition',
                                    'flex items-center gap-3',
                                    isActive ? 'bg-white/10 border border-white/10' : 'text-slate-200/80 hover:bg-white/5'
                                )}
                            >
                                <span className={classNames('grid h-9 w-9 place-items-center rounded-2xl', isActive ? 'bg-white/5' : 'bg-white/0')}>
                                    <Icon className="text-slate-100/90" />
                                </span>
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-3 glass rounded-2xl px-4 py-3 text-xs text-slate-200/70">
                    <div className="flex items-center justify-between">
                        <span>System</span>
                        <span className="text-emerald-300/90">Operational</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                        <span>Mode</span>
                        <span className="text-slate-100">Dark SaaS</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
