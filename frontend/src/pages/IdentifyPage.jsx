import { useState, useEffect } from "react";
import { getModules, createSession, getNextWeek, getCurrentUser } from "../services/api";
import Dashboard from "../components/Dashboard";
import CameraRecorder from "../components/CameraRecorder";
import LiveScanner from "../components/LiveScanner";

function IdentifyPage() {
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);
  const [nextWeekInfo, setNextWeekInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showLiveScan, setShowLiveScan] = useState(false);

  const user = getCurrentUser();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const init = async () => {
      try {
        const data = await getModules();
        setModules(data);
        if (!isAdmin && user?.module_id) {
          setSelectedModule(user.module_id);
          const info = await getNextWeek(user.module_id);
          setNextWeekInfo(info);
          setWeekNumber(info.next_week);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setPageLoading(false);
      }
    };
    init();
  }, []);

  const handleModuleChange = async (moduleId) => {
    setSelectedModule(moduleId);
    setNextWeekInfo(null);
    if (moduleId) {
      try {
        const info = await getNextWeek(moduleId);
        setNextWeekInfo(info);
        setWeekNumber(info.next_week);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleOpenCamera = () => {
    if (!selectedModule) {
      setError("Please select a module first.");
      return;
    }
    setError(null);
    setShowCamera(true);
  };

  const handleVideoReady = async (videoFile) => {
    setShowCamera(false);
    setLoading(true);
    setError(null);
    try {
      const result = await createSession({
        module_id: selectedModule,
        week_number: weekNumber,
        video: videoFile,
      });
      setSession(result);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setSession(null);
    setError(null);
    setShowCamera(false);
    if (selectedModule) {
      try {
        const info = await getNextWeek(selectedModule);
        setNextWeekInfo(info);
        setWeekNumber(info.next_week);
      } catch (err) { /* ignore */ }
    }
  };

  if (pageLoading) {
    return (
      <section className="max-w-lg mx-auto">
        <div className="h-6 w-40 bg-slate-100 rounded animate-pulse mb-6" />
        <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  // Processing state
  if (session) {
    const moduleName = modules.find((m) => m.id === selectedModule)?.name || "";
    return (
      <section className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display font-bold text-slate-900 text-xl">Processing Attendance</h2>
            <p className="text-sm text-slate-400 mt-0.5">{moduleName} · Week {session.week_number}</p>
          </div>
          <button onClick={handleReset} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            ← New session
          </button>
        </div>
        <Dashboard sessionId={session.session_id} />
      </section>
    );
  }

  // Camera recording state
  if (showCamera) {
    const moduleName = modules.find((m) => m.id === selectedModule)?.name || "";
    return (
      <section className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="font-display font-bold text-slate-900 text-xl">Record Attendance</h2>
          <p className="text-sm text-slate-400 mt-0.5">{moduleName} · Week {weekNumber}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-6">
          <CameraRecorder
            onVideoReady={handleVideoReady}
            onCancel={() => setShowCamera(false)}
          />
        </div>
      </section>
    );
  }

  // Live scan state
  if (showLiveScan) {
    const moduleName = modules.find((m) => m.id === selectedModule)?.name || "";
    return (
      <section className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="font-display font-bold text-slate-900 text-xl">Live Scan</h2>
          <p className="text-sm text-slate-400 mt-0.5">{moduleName} · Week {weekNumber}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-6">
          <LiveScanner
            moduleId={selectedModule}
            weekNumber={weekNumber}
            onComplete={() => { setShowLiveScan(false); handleReset(); }}
            onCancel={() => setShowLiveScan(false)}
          />
        </div>
      </section>
    );
  }

  // Setup form
  const weekOptions = [];
  if (nextWeekInfo) {
    for (let i = 1; i <= nextWeekInfo.last_completed_week; i++) {
      weekOptions.push({ value: i, label: `Week ${i} (retake)` });
    }
    weekOptions.push({ value: nextWeekInfo.next_week, label: `Week ${nextWeekInfo.next_week} (new)` });
  } else if (selectedModule) {
    weekOptions.push({ value: 1, label: "Week 1" });
  }

  return (
    <section className="max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="font-display font-bold text-slate-900 text-xl">Take Attendance</h2>
        <p className="text-sm text-slate-400 mt-1">
          {isAdmin ? "Select a module and week, then record the class." : "Record your class. AI will identify present students."}
        </p>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-6">
        <div className="space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium animate-fade-in-up">
              {error}
            </div>
          )}

          {loading && (
            <div className="px-4 py-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 text-sm font-medium flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Uploading video for analysis...
            </div>
          )}

          {/* Module */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Module</label>
            {isAdmin ? (
              <select
                value={selectedModule}
                onChange={(e) => handleModuleChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
              >
                <option value="">Select module...</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
                ))}
              </select>
            ) : (
              <div className="px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                {modules.find((m) => m.id === selectedModule)?.name || "Your module"}
              </div>
            )}
          </div>

          {/* Week */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Séance / Week</label>
            <select
              value={weekNumber}
              onChange={(e) => setWeekNumber(parseInt(e.target.value))}
              disabled={!selectedModule}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400 transition-all duration-200"
            >
              {weekOptions.length === 0 && <option value="">Select module first</option>}
              {weekOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {nextWeekInfo && (
              <p className="text-xs text-slate-400 mt-1.5">
                {nextWeekInfo.last_completed_week > 0
                  ? `Last completed: Week ${nextWeekInfo.last_completed_week}`
                  : "No sessions yet — starting from Week 1"}
              </p>
            )}
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <button
              onClick={() => { if (!selectedModule) { setError("Please select a module first."); return; } setError(null); setShowLiveScan(true); }}
              disabled={!selectedModule || loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5M20.25 16.5V18A2.25 2.25 0 0 1 18 20.25h-1.5M3.75 16.5V18A2.25 2.25 0 0 0 6 20.25h1.5" />
              </svg>
              Live Scan (Recommended)
            </button>
            <button
              onClick={handleOpenCamera}
              disabled={!selectedModule || loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Record Video
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center">
            <strong>Live Scan:</strong> Real-time identification as you point the camera.<br/>
            <strong>Record:</strong> Record a video, then AI processes it after.
          </p>
        </div>
      </div>
    </section>
  );
}

export default IdentifyPage;
