import { useState, useEffect } from "react";
import { getDashboardStats, getCurrentUser } from "../services/api";
import { Link } from "react-router-dom";

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = getCurrentUser();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <section className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="font-display font-bold text-slate-900 text-xl">
          Welcome back, {user?.name?.split(" ")[0] || "Admin"}
        </h2>
        <p className="text-sm text-slate-400 mt-0.5">Here's your attendance overview.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Students" value={stats?.total_students || 0} icon="👥" />
        <StatCard label="Modules" value={stats?.total_modules || 0} icon="📚" />
        <StatCard label="Sessions" value={stats?.total_sessions || 0} icon="🎬" />
        <StatCard
          label="Attendance"
          value={`${stats?.overall_rate || 0}%`}
          icon="📊"
          color={stats?.overall_rate >= 75 ? "text-emerald-600" : stats?.overall_rate >= 50 ? "text-amber-600" : "text-rose-600"}
        />
        <StatCard
          label="At Risk"
          value={stats?.at_risk_count || 0}
          icon="⚠️"
          color={stats?.at_risk_count > 0 ? "text-rose-600" : "text-emerald-600"}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/attendance" className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md hover:border-sky-200 transition-all duration-200 group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center group-hover:bg-sky-100 transition-colors">
              <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Take Attendance</p>
              <p className="text-xs text-slate-400">Record a new session</p>
            </div>
          </div>
        </Link>
        <Link to="/students" className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md hover:border-sky-200 transition-all duration-200 group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">View Students</p>
              <p className="text-xs text-slate-400">Manage enrolled students</p>
            </div>
          </div>
        </Link>
        <Link to="/analytics" className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md hover:border-sky-200 transition-all duration-200 group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Analytics</p>
              <p className="text-xs text-slate-400">Heatmap & risk radar</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Sessions */}
      {stats?.recent_sessions?.length > 0 && (
        <article className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Recent Sessions</h3>
            <Link to="/sessions" className="text-xs text-sky-500 hover:text-sky-600 font-medium transition-colors">View all →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.recent_sessions.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">{s.module_code} — Week {s.week_number}</p>
                  <p className="text-xs text-slate-400">{s.module_name}</p>
                </div>
                <span className="text-xs text-slate-400">
                  {s.date ? new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                </span>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`font-display font-bold text-2xl ${color || "text-slate-900"}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <section className="space-y-6">
      <div><div className="h-6 w-48 bg-slate-100 rounded animate-pulse" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="h-4 w-6 bg-slate-100 rounded animate-pulse mb-2" />
            <div className="h-7 w-12 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-16 bg-slate-50 rounded animate-pulse mt-1.5" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default DashboardPage;
