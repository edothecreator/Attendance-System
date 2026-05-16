import { useState, useEffect } from "react";
import { studentLogin, getMyAttendance, qrCheckin, downloadCertificate, submitReclamation, getStudentReclamations } from "../services/api";

function StudentPortalPage({ user: propUser, onLogout }) {
  // Parse token from URL or sessionStorage (persists through login redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get("token") || "";
  
  // Save token to sessionStorage if it came from URL (before login clears it)
  if (urlToken) {
    sessionStorage.setItem("qr_token", urlToken);
  }
  const initialToken = urlToken || sessionStorage.getItem("qr_token") || "";

  const [student, setStudent] = useState(propUser || null);
  const [attendance, setAttendance] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [qrToken, setQrToken] = useState(initialToken);
  const [qrMessage, setQrMessage] = useState(null);
  const [reclamationTarget, setReclamationTarget] = useState(null);

  // If user was passed as prop, load attendance immediately
  useState(() => {
    if (propUser && propUser.student_id) {
      getMyAttendance(propUser.student_id).then(setAttendance).catch(console.error);
    }
  }, [propUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await studentLogin(email, password);
      // Store token so API calls work
      localStorage.setItem("token", res.access_token);
      setStudent(res.student);
      try {
        const att = await getMyAttendance(res.student.student_id);
        setAttendance(att);
      } catch (attErr) {
        // Attendance load failed but login succeeded — show student anyway
        console.error("Failed to load attendance:", attErr);
        setAttendance({ overall_rate: 0, total_sessions: 0, total_present: 0, total_absent: 0, modules: [] });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleQrCheckin = async (e) => {
    e.preventDefault();
    setQrMessage(null);

    // Try to get location, but allow check-in without it if geo fails
    const doCheckin = async (lat, lng) => {
      try {
        const res = await qrCheckin(qrToken, student.student_id, lat, lng);
        setQrMessage({ type: "success", text: res.message });
        const att = await getMyAttendance(student.student_id);
        setAttendance(att);
        setQrToken("");
        sessionStorage.removeItem("qr_token");
      } catch (err) {
        setQrMessage({ type: "error", text: err.response?.data?.detail || "Check-in failed." });
      }
    };

    if (navigator.geolocation) {
      setQrMessage({ type: "info", text: "Getting your location..." });
      navigator.geolocation.getCurrentPosition(
        (position) => doCheckin(position.coords.latitude, position.coords.longitude),
        () => doCheckin(0, 0), // Location denied — try without
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      await doCheckin(0, 0);
    }
  };

  // Login screen
  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src="/logo.svg" alt="AttendAI" className="w-11 h-11 rounded-2xl shadow-lg shadow-sky-500/20" />
              <img src="/fst-logo.png" alt="FST Marrakech" className="h-11 object-contain" />
            </div>
            <h1 className="font-display font-extrabold text-slate-900 text-xl">Student Portal</h1>
            <p className="text-slate-400 text-sm mt-1">View your attendance records</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-8">
            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium animate-fade-in-up">
                {error}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
                  placeholder="student@uca.ac.ma"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-all duration-200"
              >
                {loading ? "Loading..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard
  if (!attendance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const rateColor = attendance.overall_rate >= 75 ? "text-emerald-600" : attendance.overall_rate >= 50 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {student.profile_image ? (
              <img src={student.profile_image} alt={student.name} className="w-14 h-14 rounded-2xl object-cover ring-4 ring-white shadow-sm" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                <span className="text-slate-500 font-bold text-xl">{student.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <h1 className="font-display font-bold text-slate-900 text-lg">{student.name}</h1>
              <p className="text-sm text-slate-400 font-mono">{student.student_id}</p>
            </div>
          </div>
          <button onClick={() => { if (onLogout) onLogout(); else { setStudent(null); setAttendance(null); } }} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Logout
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-slate-100 rounded-xl p-4 text-center">
            <p className={`font-display font-bold text-2xl ${rateColor}`}>{attendance.overall_rate}%</p>
            <p className="text-xs text-slate-400 mt-0.5">Overall</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-xl p-4 text-center">
            <p className="font-display font-bold text-2xl text-emerald-600">{attendance.total_present}</p>
            <p className="text-xs text-slate-400 mt-0.5">Present</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-xl p-4 text-center">
            <p className="font-display font-bold text-2xl text-rose-600">{attendance.total_absent}</p>
            <p className="text-xs text-slate-400 mt-0.5">Absent</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => downloadCertificate(student.student_id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white border border-slate-100 text-sm font-medium text-slate-700 hover:border-sky-200 hover:shadow-sm transition-all duration-200"
          >
            <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Download Certificate
          </button>
        </div>

        {/* QR Check-in */}
        <div className="bg-white border border-slate-100 rounded-xl p-5 mb-6">
          <h3 className="font-display font-bold text-slate-800 text-sm mb-3">QR Check-in</h3>
          <form onSubmit={handleQrCheckin} className="flex gap-2">
            <input
              type="text"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Enter QR code..."
              className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 font-mono placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
            />
            <button type="submit" disabled={!qrToken} className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-50 transition-all duration-200">
              Check In
            </button>
          </form>
          {qrMessage && (
            <p className={`mt-2 text-sm font-medium ${qrMessage.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
              {qrMessage.text}
            </p>
          )}
        </div>

        {/* Module breakdown */}
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-50">
            <h3 className="font-display font-bold text-slate-800 text-sm">Attendance by Module</h3>
            <p className="text-xs text-slate-400 mt-0.5">Tap a red week to submit a justification</p>
          </div>
          <div className="divide-y divide-slate-50">
            {attendance.modules.map((mod) => (
              <div key={mod.module_code} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{mod.module_name}</p>
                    <p className="text-xs text-slate-400">{mod.module_code} · {mod.present}/{mod.total_sessions} sessions</p>
                  </div>
                  <span className={`text-sm font-bold ${mod.rate >= 75 ? "text-emerald-600" : mod.rate >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                    {mod.rate}%
                  </span>
                </div>
                {/* Week dots — absent ones are clickable */}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {mod.weeks.map((w) => (
                    <button
                      key={w.week}
                      type="button"
                      onClick={() => {
                        if (w.present === false && w.session_id) {
                          setReclamationTarget({ module_code: mod.module_code, module_name: mod.module_name, week: w.week, session_id: w.session_id });
                        }
                      }}
                      disabled={w.present !== false}
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold transition-all duration-200 ${
                        w.present === true
                          ? "bg-emerald-100 text-emerald-600"
                          : w.present === false
                          ? "bg-rose-100 text-rose-600 hover:bg-rose-200 hover:ring-2 hover:ring-rose-300 cursor-pointer"
                          : "bg-slate-50 text-slate-300"
                      }`}
                      title={w.present === false ? `Week ${w.week}: Absent — Click to submit justification` : `Week ${w.week}`}
                    >
                      {w.week}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* My Reclamations */}
        <ReclamationsList studentId={student.student_id} />
      </div>

      {/* Reclamation Modal */}
      {reclamationTarget && (
        <ReclamationModal
          target={reclamationTarget}
          studentId={student.student_id}
          onClose={() => setReclamationTarget(null)}
          onSubmitted={() => {
            setReclamationTarget(null);
            // Refresh
            getMyAttendance(student.student_id).then(setAttendance).catch(console.error);
          }}
        />
      )}
    </div>
  );
}

function ReclamationModal({ target, studentId, onClose, onSubmitted }) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) { setError("Please describe your justification."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await submitReclamation({
        student_id: studentId,
        session_id: target.session_id,
        message: message.trim(),
        attachment: file || undefined,
      });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.detail || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
        <h3 className="font-display font-bold text-slate-900 text-lg mb-1">Submit Justification</h3>
        <p className="text-sm text-slate-400 mb-5">
          {target.module_code} — {target.module_name} · Week {target.week}
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Reason</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200 resize-none"
              placeholder="e.g., I was sick and have a medical certificate..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Attachment (optional — medical certificate, etc.)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-slate-200 file:text-xs file:font-medium file:text-slate-600 file:bg-slate-50 hover:file:bg-slate-100 file:cursor-pointer file:transition-all"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-all duration-200">
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReclamationsList({ studentId }) {
  const [reclamations, setReclamations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentReclamations(studentId).then((data) => setReclamations(data.reclamations)).catch(console.error).finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return null;
  if (reclamations.length === 0) return null;

  const statusStyles = {
    pending: "bg-amber-50 text-amber-600 border-amber-200",
    approved: "bg-emerald-50 text-emerald-600 border-emerald-200",
    declined: "bg-rose-50 text-rose-600 border-rose-200",
  };

  return (
    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50">
        <h3 className="font-display font-bold text-slate-800 text-sm">My Reclamations</h3>
      </div>
      <div className="divide-y divide-slate-50">
        {reclamations.map((r) => (
          <div key={r.id} className="px-5 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">{r.module_code} — Week {r.week_number}</p>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{r.message}</p>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${statusStyles[r.status]}`}>
                {r.status}
              </span>
            </div>
            {r.professor_response && (
              <p className="text-xs text-slate-500 mt-1 italic">Prof: "{r.professor_response}"</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default StudentPortalPage;
