import { motion } from 'framer-motion';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { FiActivity, FiBarChart2, FiCheckCircle, FiCpu, FiPieChart, FiShield, FiVideo } from 'react-icons/fi';
import MetricCard from './MetricCard.jsx';
import { formatCompactNumber } from '../../utils/score.js';

const chartGridStroke = 'rgba(255,255,255,0.08)';

function ChartShell({ title, subtitle, icon, children }) {
    return (
        <div className="glass rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-slate-200/70">{title}</div>
                    {subtitle ? <div className="mt-1 text-xs text-slate-200/50">{subtitle}</div> : null}
                </div>
                <div className="glass grid h-10 w-10 place-items-center rounded-2xl text-slate-100/90">{icon}</div>
            </div>
            <div className="mt-4 h-64">{children}</div>
        </div>
    );
}

function FancyTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="glass rounded-2xl px-4 py-3 text-xs">
            <div className="font-semibold text-slate-100">{label}</div>
            <div className="mt-2 space-y-1">
                {payload.map((p) => (
                    <div key={p.dataKey} className="flex items-center justify-between gap-6 text-slate-200/80">
                        <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                            {p.name}
                        </span>
                        <span className="font-semibold text-slate-100">{p.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function AnalyticsSection() {
    // Realistic-looking dummy data
    const totals = {
        analyzed: 18240,
        fake: 3120,
        real: 15120,
        aiGenerated: 4980,
        deepfake: 860,
        avgTrust: 84
    };

    const byType = [
        { name: 'Text', value: 6800 },
        { name: 'Images', value: 5240 },
        { name: 'Videos', value: 2200 },
        { name: 'News', value: 4000 }
    ];

    const verdictSplit = [
        { name: 'Verified Real', value: totals.real, color: 'rgba(16,185,129,0.9)' },
        { name: 'Flagged Fake', value: totals.fake, color: 'rgba(244,63,94,0.9)' }
    ];

    const trend = [
        { day: 'Mon', analyzed: 2100, fakeRate: 14 },
        { day: 'Tue', analyzed: 2450, fakeRate: 16 },
        { day: 'Wed', analyzed: 2300, fakeRate: 15 },
        { day: 'Thu', analyzed: 2700, fakeRate: 18 },
        { day: 'Fri', analyzed: 2950, fakeRate: 17 },
        { day: 'Sat', analyzed: 2400, fakeRate: 13 },
        { day: 'Sun', analyzed: 2340, fakeRate: 12 }
    ];

    return (
        <section className="mt-10">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.35 }}
                className="flex items-end justify-between gap-4"
            >
                <div>
                    <div className="text-2xl font-black tracking-tight">Analytics</div>
                    <div className="mt-2 max-w-2xl text-sm text-slate-200/70">
                        Enterprise-style telemetry showing detection throughput, verdict distribution, and trend signals.
                    </div>
                </div>
                <div className="hidden sm:block glass rounded-2xl px-4 py-3 text-xs text-slate-200/70">
                    Demo data • Update with real usage metrics
                </div>
            </motion.div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                    tone="indigo"
                    icon={<FiActivity />}
                    label="Total Content Analyzed"
                    value={formatCompactNumber(totals.analyzed)}
                    delta="+8.4% this week"
                />
                <MetricCard
                    tone="rose"
                    icon={<FiShield />}
                    label="Fake Content Detected"
                    value={formatCompactNumber(totals.fake)}
                    delta="Avg fake rate: 16%"
                />
                <MetricCard
                    tone="emerald"
                    icon={<FiCheckCircle />}
                    label="Real Content Verified"
                    value={formatCompactNumber(totals.real)}
                    delta="Verified pipeline stable"
                />
                <MetricCard
                    tone="purple"
                    icon={<FiCpu />}
                    label="AI-Generated Content Count"
                    value={formatCompactNumber(totals.aiGenerated)}
                    delta="Text signatures dominating"
                />
                <MetricCard
                    tone="sky"
                    icon={<FiVideo />}
                    label="Deepfake Video Detections"
                    value={formatCompactNumber(totals.deepfake)}
                    delta="Frame sampling active"
                />
                <MetricCard
                    tone="indigo"
                    icon={<FiBarChart2 />}
                    label="Average Trust Score"
                    value={`${totals.avgTrust}%`}
                    delta="Across all modalities"
                />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-3">
                <ChartShell
                    title="Content Mix"
                    subtitle="Analyzed items by modality"
                    icon={<FiBarChart2 />}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={byType} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                            <CartesianGrid stroke={chartGridStroke} vertical={false} />
                            <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" tickLine={false} axisLine={false} />
                            <YAxis stroke="rgba(255,255,255,0.35)" tickLine={false} axisLine={false} />
                            <Tooltip content={<FancyTooltip />} />
                            <Bar dataKey="value" name="Analyzed" radius={[12, 12, 12, 12]}>
                                {byType.map((_, idx) => (
                                    <Cell
                                        key={idx}
                                        fill={
                                            idx % 3 === 0
                                                ? 'rgba(99,102,241,0.85)'
                                                : idx % 3 === 1
                                                    ? 'rgba(168,85,247,0.85)'
                                                    : 'rgba(56,189,248,0.85)'
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartShell>

                <ChartShell
                    title="Verification Split"
                    subtitle="Fake vs real verdict distribution"
                    icon={<FiPieChart />}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip content={<FancyTooltip />} />
                            <Pie
                                data={verdictSplit}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={70}
                                outerRadius={110}
                                paddingAngle={3}
                            >
                                {verdictSplit.map((s) => (
                                    <Cell key={s.name} fill={s.color} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </ChartShell>

                <ChartShell
                    title="Detection Trends"
                    subtitle="Volume and fake-rate signals"
                    icon={<FiActivity />}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                            <CartesianGrid stroke={chartGridStroke} vertical={false} />
                            <XAxis dataKey="day" stroke="rgba(255,255,255,0.55)" tickLine={false} axisLine={false} />
                            <YAxis yAxisId="left" stroke="rgba(255,255,255,0.35)" tickLine={false} axisLine={false} />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                stroke="rgba(255,255,255,0.35)"
                                tickLine={false}
                                axisLine={false}
                                domain={[0, 30]}
                            />
                            <Tooltip content={<FancyTooltip />} />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="analyzed"
                                name="Analyzed"
                                stroke="rgba(99,102,241,0.95)"
                                strokeWidth={3}
                                dot={false}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="fakeRate"
                                name="Fake Rate (%)"
                                stroke="rgba(244,63,94,0.95)"
                                strokeWidth={3}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartShell>
            </div>
        </section>
    );
}
