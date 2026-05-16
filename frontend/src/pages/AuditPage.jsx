import { useState, useEffect } from "react";
import { getAuditLog } from "../services/api";

const actionLabels = {
  enrolled_student: { label: "Enrolled Student", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  override_attendance: { label: "Override", color: "bg-amber-50 text-amber-600 border-amber-200" },
  generated_qr: { label: "Generated QR", color: "bg-sky-50 text-sky-600 border-sky-200" },
  qr_checkin: { label: "QR Check-in", color: "bg-cyan-50 text-cyan-600 border-cyan-200" },
  deleted_student: { label: "Deleted Student", color: "bg-rose-50 text-rose-600 border-rose-200" },
};

function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const data = await getAuditLog();
      setLogs(data.logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section>
        <div className="h-6 w-28 bg-slate-100 rounded animate-pulse mb-6" />
        <div className="bg-white border border-slate-100 rounded-xl p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-40 bg-slate-50 rounded animate-pulse" />
              <div className="flex-1" />
              <div className="h-4 w-24 bg-slate-50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6">
        <h2 className="font-display font-bold text-slate-900 text-xl">Audit Log</h2>
        <p className="text-sm text-slate-400 mt-0.5">Complete history of system actions</p>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-xl p-12 text-center">
          <p className="text-sm text-slate-400">No actions recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((log) => {
                  const actionInfo = actionLabels[log.action] || { label: log.action, color: "bg-slate-50 text-slate-600 border-slate-200" };
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap font-mono">
                        {new Date(log.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-slate-700">{log.actor}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 max-w-xs truncate">{log.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export default AuditPage;
