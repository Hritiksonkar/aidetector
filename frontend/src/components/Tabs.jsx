export default function Tabs({ tabs, activeKey, onChange }) {
    return (
        <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-2">
            {tabs.map((t) => {
                const active = t.key === activeKey;
                return (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => onChange(t.key)}
                        className={`tab ${active ? 'tab-active' : 'tab-inactive'}`}
                    >
                        <span className="inline-flex items-center gap-2">
                            {t.icon}
                            {t.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
