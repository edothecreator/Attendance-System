import { useState, useRef, useEffect, useCallback } from "react";
import { startLiveScan, sendLiveFrame, finishLiveScan } from "../services/api";

function LiveScanner({ moduleId, weekNumber, onComplete, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const scanIdRef = useRef(null);

  const [state, setState] = useState("starting"); // starting, scanning, finishing, done
  const [matches, setMatches] = useState([]);
  const [frameCount, setFrameCount] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Start camera and live scan session
  useEffect(() => {
    const init = async () => {
      try {
        // Start backend scan session
        const data = await startLiveScan(moduleId, weekNumber);
        scanIdRef.current = data.scan_id;

        // Start camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setState("scanning");

        // Start sending frames every 500ms (2 frames/sec to backend)
        intervalRef.current = setInterval(captureAndSend, 500);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || "Failed to start.");
        setState("starting");
      }
    };
    init();

    return () => {
      cleanup();
    };
  }, []);

  const captureAndSend = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !scanIdRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    // Convert to JPEG base64
    const frameData = canvas.toDataURL("image/jpeg", 0.7);

    try {
      const res = await sendLiveFrame(scanIdRef.current, frameData);
      setFrameCount(res.frame_count);

      // Add new matches
      if (res.new_matches && res.new_matches.length > 0) {
        setMatches((prev) => {
          const updated = [...prev];
          for (const m of res.new_matches) {
            if (!updated.find((x) => x.student_id === m.student_id)) {
              updated.push({ ...m, isNew: true });
              // Remove isNew after 2s
              setTimeout(() => {
                setMatches((p) => p.map((x) => x.student_id === m.student_id ? { ...x, isNew: false } : x));
              }, 2000);
            }
          }
          return updated;
        });
      }
    } catch (err) {
      // Silently continue — one failed frame is fine
    }
  }, []);

  const handleFinish = async () => {
    setState("finishing");
    cleanup();

    try {
      const res = await finishLiveScan(scanIdRef.current);
      setResult(res);
      setState("done");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save attendance.");
      setState("done");
    }
  };

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Done state
  if (state === "done") {
    return (
      <div className="space-y-4">
        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center animate-fade-in-up">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-lg font-display font-bold text-emerald-800">Attendance Saved</p>
            <p className="text-sm text-emerald-600 mt-1">
              {result.present_count} present · {result.absent_count} absent
            </p>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        )}
        <button onClick={onComplete} className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all duration-200">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-600">{error}</div>
      )}

      {/* Camera feed */}
      <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning overlay */}
        {state === "scanning" && (
          <>
            {/* Scan line animation */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-pulse" />

            {/* Status badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-white text-xs font-medium">Scanning · {frameCount} frames</span>
            </div>

            {/* Match counter */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <span className="text-emerald-400 text-xs font-bold">{matches.length} identified</span>
            </div>
          </>
        )}

        {state === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="animate-spin h-8 w-8 border-2 border-sky-400 border-t-transparent rounded-full" />
          </div>
        )}

        {state === "finishing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="text-center">
              <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-white text-sm">Saving attendance...</p>
            </div>
          </div>
        )}
      </div>

      {/* Live matches */}
      {matches.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {matches.map((m) => (
            <div
              key={m.student_id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-300 ${
                m.isNew ? "border-sky-200 bg-sky-50 shadow-sm" : "border-slate-100 bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-700">{m.name}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">{m.student_id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={state !== "scanning"}
          className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all duration-200"
        >
          Cancel
        </button>
        <button
          onClick={handleFinish}
          disabled={state !== "scanning"}
          className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-all duration-200"
        >
          Finish & Save ({matches.length} found)
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Point camera at students. They appear above as they're identified.
      </p>
    </div>
  );
}

export default LiveScanner;
