export default function SectionHeader({ title, subtitle, right }) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <div className="text-2xl font-black tracking-tight">{title}</div>
                {subtitle ? <div className="mt-2 text-sm text-slate-200/70">{subtitle}</div> : null}
            </div>
            {right ? <div className="flex items-center gap-2">{right}</div> : null}
        </div>
    );
}
