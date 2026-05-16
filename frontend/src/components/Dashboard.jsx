import { useWebSocket } from "../hooks/useWebSocket";

const statusLabels = {
  extracting_frames: "Extracting frames from video...",
  detecting_faces: "Scanning for faces...",
  identifying: "Identifying students...",
  complete: "Processing complete",
  error: "An error occurred",
};

function Dashboard({ sessionId }) {
  const { status, progress, matches, isConnected, isComplete, summary } =
    useWebSocket(sessionId);

  return (
    <div className="space-y-5">
      {/* Connection indicator */}
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
        <span className="text-xs text-slate-400">
          {isConnected ? "Live connection" : "Reconnecting..."}
        </span>
      </div>

      {/* Progress */}
      <article className="bg-white border border-slate-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-700">
            {statusLabels[status] || "Connecting..."}
          </p>
          <span className="text-xs font-semibold text-slate-400 tabular-nums">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isComplete ? "bg-emerald-500" : "bg-sky-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </article>

      {/* Matches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Detected Present
          </h3>
          {matches.length > 0 && (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {matches.length} identified
            </span>
          )}
        </div>

        {matches.length === 0 && !isComplete && (
          <div className="bg-white border border-slate-100 rounded-xl p-8 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-300 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-slate-400">Scanning video for faces...</p>
          </div>
        )}

        {matches.length === 0 && isComplete && (
          <div className="bg-white border border-slate-100 rounded-xl p-8 text-center">
            <p className="text-sm text-slate-400">No students recognized in this video.</p>
          </div>
        )}

        {matches.length > 0 && (
          <div className="space-y-2">
            {matches.map((match) => (
              <div
                key={match.student_id}
                className={`flex items-center justify-between px-4 py-3 bg-white border rounded-xl transition-all duration-300 ${
                  match.isNew
                    ? "border-sky-200 shadow-md shadow-sky-500/10 animate-fade-in-up"
                    : "border-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{match.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{match.student_id}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {(match.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {isComplete && summary && (
        <article className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <p className="text-sm font-semibold text-emerald-700">Attendance Recorded</p>
          </div>
          <p className="text-sm text-emerald-600 ml-6">
            {summary.total_identified} student(s) marked present · {summary.total_frames} frames processed
          </p>
        </article>
      )}
    </div>
  );
}

export default Dashboard;
