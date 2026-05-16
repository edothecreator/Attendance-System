import { useState, useEffect } from "react";
import { getTrends } from "../services/api";

const COLORS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"
];

function TrendsChart() {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  useEffect(() => {
    loadTrends();
  }, []);

  const loadTrends = async () => {
    try {
      const data = await getTrends();
      setTrends(data.trends);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-6">
        <div className="h-5 w-32 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="h-48 bg-slate-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center">
        <p className="text-sm text-slate-400">No trend data yet. Complete some sessions first.</p>
      </div>
    );
  }

  // Find max weeks across all modules
  const maxWeek = Math.max(...trends.flatMap((t) => t.data_points.map((d) => d.week)));
  const chartWidth = 100;
  const chartHeight = 200;
  const padding = { top: 10, right: 10, bottom: 30, left: 35 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  return (
    <article className="bg-white border border-slate-100 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display font-bold text-slate-800 text-sm">Attendance Trends</h3>
        <div className="flex flex-wrap gap-3">
          {trends.map((t, i) => (
            <span key={t.module_code} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {t.module_code}
            </span>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-48" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = padding.top + innerHeight - (val / 100) * innerHeight;
            return (
              <g key={val}>
                <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#f1f5f9" strokeWidth="0.3" />
                <text x={padding.left - 2} y={y + 1} textAnchor="end" className="text-[3px] fill-slate-400">{val}%</text>
              </g>
            );
          })}

          {/* Week labels */}
          {Array.from({ length: maxWeek }, (_, i) => {
            const x = padding.left + ((i + 0.5) / maxWeek) * innerWidth;
            return (
              <text key={i} x={x} y={chartHeight - 5} textAnchor="middle" className="text-[3px] fill-slate-400">
                W{i + 1}
              </text>
            );
          })}

          {/* Lines */}
          {trends.map((module, moduleIdx) => {
            const color = COLORS[moduleIdx % COLORS.length];
            const points = module.data_points.map((d) => {
              const x = padding.left + ((d.week - 0.5) / maxWeek) * innerWidth;
              const y = padding.top + innerHeight - (d.rate / 100) * innerHeight;
              return { x, y, ...d };
            });

            if (points.length === 0) return null;

            const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

            return (
              <g key={module.module_code}>
                <path d={pathD} fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="1"
                    fill={color}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint({ ...p, module: module.module_code, color })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-2 right-2 bg-slate-900 text-white text-[11px] px-3 py-2 rounded-lg shadow-lg pointer-events-none animate-fade-in-up">
            <p className="font-semibold">{hoveredPoint.module} — Week {hoveredPoint.week}</p>
            <p className="text-slate-300 mt-0.5">{hoveredPoint.rate}% ({hoveredPoint.present}/{hoveredPoint.total})</p>
          </div>
        )}
      </div>
    </article>
  );
}

export default TrendsChart;
