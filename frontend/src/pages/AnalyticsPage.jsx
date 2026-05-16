import { useState, useEffect } from "react";
import { getHeatmap, getAtRiskStudents } from "../services/api";
import { Link } from "react-router-dom";
import TrendsChart from "../components/TrendsChart";

function AnalyticsPage() {
  const [heatmap, setHeatmap] = useState(null);
  const [atRisk, setAtRisk] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [heatData, riskData] = await Promise.all([
        getHeatmap(),
        getAtRiskStudents(),
      ]);
      setHeatmap(heatData);
      setAtRisk(riskData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <AnalyticsSkeleton />;

  return (
    <section className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-slate-900 text-xl">Analytics</h2>
        <p className="text-sm text-slate-400 mt-0.5">Attendance heatmap & risk monitoring</p>
      </div>

      {/* Heatmap */}
      <article className="bg-white border border-slate-100 rounded-2xl p-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-slate-800 text-sm">Attendance Heatmap</h3>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> &gt;80%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400" /> 50–80%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-500" /> &lt;50%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-100" /> No data</span>
          </div>
        </div>

        {heatmap && (
          <div className="min-w-[700px]">
            {/* Week headers */}
            <div className="flex items-center mb-1">
              <div className="w-24 shrink-0" />
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className="flex-1 text-center text-[10px] font-medium text-slate-400">
                  W{i + 1}
                </div>
              ))}
            </div>

            {/* Module rows */}
            <div className="space-y-1">
              {heatmap.heatmap.map((module) => (
                <div key={module.module_code} className="flex items-center">
                  <div className="w-24 shrink-0 text-xs font-semibold text-slate-600 truncate pr-2">
                    {module.module_code}
                  </div>
                  <div className="flex-1 flex gap-0.5">
                    {module.weeks.map((week) => (
                      <div
                        key={week.week}
                        className="flex-1 aspect-square rounded-md transition-all duration-200 hover:scale-110 cursor-default relative group"
                        style={{ backgroundColor: getHeatColor(week) }}
                        title={week.completed ? `${module.module_code} W${week.week}: ${week.rate}% (${week.present}P / ${week.absent}A)` : "No data"}
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                          <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                            {week.completed ? `${week.rate}%` : "—"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Trends Chart */}
      <TrendsChart />

      {/* Critical Risk Radar */}
      <article className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-slate-800 text-sm">Critical Risk Radar</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Students approaching exclusion threshold (≥2 absences in a module)
            </p>
          </div>
          {atRisk && (
            <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              {atRisk.total_flagged} flagged
            </span>
          )}
        </div>

        {atRisk && atRisk.at_risk.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">All clear</p>
            <p className="text-xs text-slate-400 mt-0.5">No students at risk of exclusion</p>
          </div>
        )}

        {atRisk && atRisk.at_risk.length > 0 && (
          <div className="divide-y divide-slate-50">
            {atRisk.at_risk.map((student) => (
              <div key={student.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                {/* Avatar */}
                {student.profile_image ? (
                  <img src={student.profile_image} alt={student.name} className="w-9 h-9 rounded-lg object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <span className="text-slate-500 text-xs font-semibold">{student.name.charAt(0)}</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link to={`/student/${student.student_id}`} className="text-sm font-semibold text-slate-800 hover:text-sky-600 transition-colors">
                    {student.name}
                  </Link>
                  <p className="text-xs text-slate-400 font-mono">{student.student_id}</p>
                </div>

                {/* Risk modules */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {student.modules_at_risk.map((mod) => (
                    <span
                      key={mod.module_code}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-rose-50 text-rose-600 border-rose-200"
                    >
                      {mod.module_code}: {mod.absences}A
                    </span>
                  ))}
                </div>

                {/* Risk badge */}
                <RiskBadge level={student.risk_level} />
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

function RiskBadge({ level }) {
  const styles = {
    critical: "bg-rose-50 text-rose-600 border-rose-200",
    warning: "bg-amber-50 text-amber-600 border-amber-200",
    caution: "bg-amber-50 text-amber-600 border-amber-200",
    safe: "bg-emerald-50 text-emerald-600 border-emerald-200",
  };

  const labels = {
    critical: "Critical",
    warning: "Warning",
    caution: "Caution",
    safe: "Safe",
  };

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${styles[level] || styles.safe}`}>
      {labels[level] || level}
    </span>
  );
}

function getHeatColor(week) {
  if (!week.completed) return "#F1F5F9"; // slate-100
  if (week.rate >= 80) return "#10B981"; // emerald-500
  if (week.rate >= 60) return "#34D399"; // emerald-400
  if (week.rate >= 50) return "#FBBF24"; // amber-400
  if (week.rate >= 30) return "#FB923C"; // orange-400
  return "#E11D48"; // rose-600
}

function AnalyticsSkeleton() {
  return (
    <section className="space-y-8">
      <div>
        <div className="h-6 w-28 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-48 bg-slate-100 rounded animate-pulse mt-1.5" />
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl p-6">
        <div className="h-5 w-40 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-16 h-4 bg-slate-100 rounded animate-pulse" />
              <div className="flex-1 h-6 bg-slate-50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl p-6">
        <div className="h-5 w-36 bg-slate-100 rounded animate-pulse mb-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 animate-pulse" />
            <div className="flex-1"><div className="h-4 w-32 bg-slate-100 rounded animate-pulse" /></div>
            <div className="h-5 w-16 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default AnalyticsPage;
