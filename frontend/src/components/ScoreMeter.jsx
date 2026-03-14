import React from 'react'
import { RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts'

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n))
}

function scoreToPercent(score) {
    const s = Number(score)
    if (!Number.isFinite(s)) return 0
    return clamp((s / 10) * 100, 0, 100)
}

function palette(score) {
    const s = Number(score)
    if (!Number.isFinite(s)) return { fg: '#94A3B8', bg: 'rgba(148,163,184,0.15)' }
    if (s > 6) return { fg: '#EF4444', bg: 'rgba(239,68,68,0.15)' }
    if (s > 3) return { fg: '#F59E0B', bg: 'rgba(245,158,11,0.15)' }
    return { fg: '#22C55E', bg: 'rgba(34,197,94,0.15)' }
}

export default function ScoreMeter({ score }) {
    const percent = scoreToPercent(score)
    const colors = palette(score)
    const data = [{ name: 'score', value: percent }]
    const scoreText = Number.isFinite(Number(score))
        ? `${Number(score).toFixed(1)} / 10`
        : '— / 10'

    return (
        <div className="flex items-center gap-6">
            <div className="h-28 w-28">
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                        data={data}
                        innerRadius="72%"
                        outerRadius="100%"
                        startAngle={90}
                        endAngle={-270}
                    >
                        <RadialBar
                            dataKey="value"
                            cornerRadius={12}
                            fill={colors.fg}
                            background={{ fill: colors.bg }}
                        />
                    </RadialBarChart>
                </ResponsiveContainer>
            </div>

            <div className="flex-1">
                <div className="text-sm text-text/70">AI Probability Score</div>
                <div className="mt-1 text-2xl font-semibold">
                    {scoreText}
                </div>

                <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                    <div
                        className="h-2 rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: colors.fg }}
                    />
                </div>
            </div>
        </div>
    )
}
