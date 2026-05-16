import { useState, useEffect } from "react";
import { getSessions, getDetailedAttendance, getModules, overrideAttendance, generateQR } from "../services/api";

function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [modules, setModules] = useState([]);
  const [filterModule, setFilterModule] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [attLoading, setAttLoading] = useState(false);
  const [overrideModal, setOverrideModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadSessions();
  }, [filterModule]);

  const loadData = async () => {
    try {
      const mods = await getModules();
      setModules(mods);
    } catch (err) { /* ignore */ }
    await loadSessions();
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await getSessions(filterModule || undefined);
      setSessions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const viewAttendance = async (sessionId) => {
    setSelectedSession(sessionId);
    setAttLoading(true);
    try {
      const data = await getDetailedAttendance(sessionId);
      setAttendance(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAttLoading(false);
    }
  };

  const handleOverride = async (recordId, newStatus, justification) => {
    try {
      await overrideAttendance(recordId, newStatus, justification);
      // Refresh attendance
      if (selectedSession) {
        const data = await getDetailedAttendance(selectedSession);
        setAttendance(data);
      }
      setOverrideModal(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateQR = () => {
    if (!selectedSession) return;
    setQrLoading(true);
    setQrData(null);

    // Try to get location, but generate QR even without it
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const data = await generateQR(selectedSession, position.coords.latitude, position.coords.longitude);
            setQrData(data);
          } catch (err) {
            alert(err.response?.data?.detail || "Failed to generate QR.");
          } finally {
            setQrLoading(false);
          }
        },
        async () => {
          // Location denied — generate without location (0,0 means no geo-check)
          try {
            const data = await generateQR(selectedSession, 0, 0);
            setQrData(data);
          } catch (err) {
            alert(err.response?.data?.detail || "Failed to generate QR.");
          } finally {
            setQrLoading(false);
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      // No geolocation API — generate without location
      generateQR(selectedSession, 0, 0)
        .then((data) => setQrData(data))
        .catch((err) => alert(err.response?.data?.detail || "Failed to generate QR."))
        .finally(() => setQrLoading(false));
    }
  };

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-slate-900 text-xl">Sessions</h2>
          <p className="text-sm text-slate-400 mt-0.5">Attendance history & overrides</p>
        </div>
        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
        >
          <option value="">All Modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sessions list */}
        <div className="lg:col-span-2 space-y-2">
          {loading ? (
            <SessionsSkeleton />
          ) : sessions.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-400">No sessions recorded yet.</p>
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => viewAttendance(s.id)}
                className={`w-full text-left bg-white border rounded-xl p-4 transition-all duration-200 hover:shadow-sm ${
                  selectedSession === s.id
                    ? "border-sky-200 ring-1 ring-sky-100"
                    : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {s.module_code} — Week {s.week_number}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(s.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {s.present_count}P
                    </span>
                    <span className="text-xs font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                      {s.absent_count}A
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Attendance detail with overrides */}
        <div className="lg:col-span-3">
          {!attendance && !attLoading && (
            <div className="bg-white border border-slate-100 rounded-xl p-12 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                </svg>
              </div>
              <p className="text-sm text-slate-400">Select a session to view attendance</p>
            </div>
          )}

          {attLoading && <AttendanceDetailSkeleton />}

          {attendance && !attLoading && (
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Attendance Detail</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateQR}
                    disabled={qrLoading}
                    className="px-2.5 py-1 rounded-lg border border-sky-200 text-[11px] font-medium text-sky-600 hover:bg-sky-50 disabled:opacity-50 transition-all duration-200"
                  >
                    {qrLoading ? "..." : "Generate QR"}
                  </button>
                  <p className="text-xs text-slate-400">Click badge to override</p>
                </div>
              </div>
              <div className="divide-y divide-slate-50 max-h-[550px] overflow-y-auto scrollbar-thin">
                {attendance.attendance.map((entry) => (
                  <div key={entry.record_id} className="px-5 py-3 flex items-center gap-3">
                    {/* Avatar */}
                    {entry.profile_image ? (
                      <img src={entry.profile_image} alt={entry.name} className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <span className="text-slate-400 text-xs font-medium">{entry.name.charAt(0)}</span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{entry.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-400 font-mono">{entry.student_id}</p>
                        {entry.detected_at_sec && (
                          <span className="text-[10px] text-sky-500 font-medium">
                            Detected at {formatTimestamp(entry.detected_at_sec)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status badge (clickable for override) */}
                    <button
                      onClick={() => setOverrideModal(entry)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-sm ${
                        entry.status === "present"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                          : entry.status === "justified"
                          ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                          : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      {entry.status === "present" && `Present${entry.confidence === 0.99 ? " (QR Code)" : entry.confidence ? ` (${(entry.confidence * 100).toFixed(0)}%)` : ""}`}
                      {entry.status === "absent" && "Absent"}
                      {entry.status === "justified" && "Justified"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Override Modal */}
      {overrideModal && (
        <OverrideModal
          entry={overrideModal}
          onClose={() => setOverrideModal(null)}
          onOverride={handleOverride}
        />
      )}

      {/* QR Code Modal */}
      {qrData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setQrData(null)} />
          <div className="relative bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-sm p-6 animate-fade-in-up text-center">
            <h3 className="font-display font-bold text-slate-900 text-lg mb-1">QR Check-in</h3>
            <p className="text-sm text-slate-400 mb-4">Show this to students who weren't detected. Expires in 10 minutes.</p>
            <img src={qrData.qr_image} alt="QR Code" className="w-48 h-48 mx-auto mb-4 rounded-xl border border-slate-100" />
            <p className="text-xs text-slate-500 font-mono bg-slate-50 px-3 py-2 rounded-lg break-all mb-4">
              Code: {qrData.token.slice(0, 8)}...
            </p>
            <p className="text-[11px] text-slate-400 mb-4">
              Students must be within 50m of your location to check in.
            </p>
            <button
              onClick={() => setQrData(null)}
              className="w-full py-2.5 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function OverrideModal({ entry, onClose, onOverride }) {
  const [status, setStatus] = useState(entry.status);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onOverride(entry.record_id, status, justification || undefined);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
        <h3 className="font-display font-bold text-slate-900 text-lg mb-1">Override Attendance</h3>
        <p className="text-sm text-slate-400 mb-5">
          {entry.name} — <span className="font-mono">{entry.student_id}</span>
        </p>

        {/* Status selector */}
        <div className="space-y-2 mb-5">
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">New Status</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStatus("present")}
              className={`py-2.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                status === "present"
                  ? "bg-emerald-50 text-emerald-600 border-emerald-300 ring-2 ring-emerald-200"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              Present
            </button>
            <button
              type="button"
              onClick={() => setStatus("absent")}
              className={`py-2.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                status === "absent"
                  ? "bg-rose-50 text-rose-600 border-rose-300 ring-2 ring-rose-200"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              Absent
            </button>
            <button
              type="button"
              onClick={() => setStatus("justified")}
              className={`py-2.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                status === "justified"
                  ? "bg-amber-50 text-amber-600 border-amber-300 ring-2 ring-amber-200"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              Justified
            </button>
          </div>
        </div>

        {/* Justification note (shown for justified) */}
        {status === "justified" && (
          <div className="mb-5 animate-fade-in-up">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Justification Note
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200 resize-none"
              placeholder="e.g., Medical certificate provided — Dr. appointment 15/05"
            />
          </div>
        )}

        {/* Detection receipt */}
        {entry.detected_at_sec && (
          <div className="mb-5 px-3 py-2.5 rounded-lg bg-sky-50 border border-sky-200">
            <p className="text-xs font-medium text-sky-700">
              AI Detection Receipt
            </p>
            <p className="text-xs text-sky-600 mt-0.5">
              Face detected at <span className="font-mono font-semibold">{formatTimestamp(entry.detected_at_sec)}</span> in video
              {entry.confidence && ` · Confidence: ${(entry.confidence * 100).toFixed(1)}%`}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || status === entry.status}
            className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {submitting ? "Saving..." : "Confirm Override"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(seconds) {
  if (!seconds && seconds !== 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function SessionsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-100 rounded-xl p-4">
          <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-20 bg-slate-50 rounded animate-pulse mt-2" />
        </div>
      ))}
    </div>
  );
}

function AttendanceDetailSkeleton() {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse" />
          <div className="flex-1"><div className="h-4 w-28 bg-slate-100 rounded animate-pulse" /></div>
          <div className="h-6 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default SessionsPage;
