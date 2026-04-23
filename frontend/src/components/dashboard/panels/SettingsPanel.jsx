export default function SettingsPanel() {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '(default)';
    const isDev = import.meta.env.DEV;

    return (
        <div className="grid gap-4 xl:grid-cols-2">
            <div className="glass rounded-3xl p-5">
                <div className="text-sm font-semibold text-slate-200/70">Environment</div>
                <div className="mt-1 text-xs text-slate-200/60">Runtime configuration</div>

                <div className="mt-4 space-y-2">
                    <div className="glass rounded-2xl px-4 py-3 text-sm">
                        <div className="text-xs text-slate-200/60">Mode</div>
                        <div className="mt-1 font-semibold text-slate-100">{isDev ? 'Development' : 'Production'}</div>
                    </div>
                    <div className="glass rounded-2xl px-4 py-3 text-sm">
                        <div className="text-xs text-slate-200/60">API Base URL</div>
                        <div className="mt-1 font-semibold text-slate-100 break-all">{apiBase}</div>
                    </div>
                </div>

                <div className="mt-4 text-xs text-slate-200/60">
                    Set <span className="font-semibold text-slate-100">VITE_API_BASE_URL</span> in <span className="font-semibold text-slate-100">frontend/.env</span> when deploying frontend and backend on different origins.
                </div>
            </div>

            <div className="glass rounded-3xl p-5">
                <div className="text-sm font-semibold text-slate-200/70">Preferences</div>
                <div className="mt-1 text-xs text-slate-200/60">UI and workflow</div>

                <div className="mt-4 grid gap-2">
                    <div className="glass rounded-2xl px-4 py-3 text-sm text-slate-200/80">
                        Dark Theme: <span className="font-semibold text-slate-100">Enabled</span>
                    </div>
                    <div className="glass rounded-2xl px-4 py-3 text-sm text-slate-200/80">
                        History Storage: <span className="font-semibold text-slate-100">Local (browser)</span>
                    </div>
                    <div className="glass rounded-2xl px-4 py-3 text-sm text-slate-200/80">
                        Exports: <span className="font-semibold text-slate-100">JSON / CSV / PDF</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
