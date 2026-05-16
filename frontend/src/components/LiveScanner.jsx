import { useState, useRef, useEffect } from "react";
import { startLiveScan, sendLiveFrame, finishLiveScan } from "../services/api";

function LiveScanner({ moduleId, weekNumber, onComplete, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIdRef = useRef(null);
  const isProcessingRef = useRef(false);
  const isScanningRef = useRef(false);
  const timerRef = useRef(null);

  const [state, setState] = useState("starting");
  const [matches, setMatches] = useState([]);
  const [frameCount, setFrameCount] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const data = await startLiveScan(moduleId, weekNumber);
        if (!mounted) return;
        scanIdRef.current = data.scan_id;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        setState("scanning");
        isScanningRef.current = true;

        // Start frame loop — waits for each frame to finish before sending next
        scheduleNextFrame();
      } catch (err) {
        if (mounted) setError(err.response?.data?.detail || err.message || "Failed to start.");
      }
    };

    init();

    return () => {
      mounted = false;
      isScanningRef.current = false;
      cleanup();
    };
  }, []);

  const scheduleNextFrame = () => {
    // Send next frame after 800ms (gives backend time to process)
    timerRef.current = setTimeout(captureAndSend, 800);
  };

  const captureAndSend = async () => {
    if (!isScanningRef.current || !videoRef.current || !canvasRef.current || !scanIdRef.current) return;
    if (isProcessingRef.current) { scheduleNextFrame(); return; }

    isProcessingRef.current = true;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // Use smaller resolution for speed
      canvas.width = 480;
      canvas.height = 360;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, 480, 360);

      // Lower quality JPEG for faster transfer
      const frameData = canvas.toDataURL("image/jpeg", 0.6);

      const res = await sendLiveFrame(scanIdRef.current, frameData);

      if (res.expired) {
        // Session expired, stop
        isScanningRef.current = false;
        return;
      }

      setFrameCount(res.frame_count);

      if (res.new_matches && res.new_matches.length > 0) {
        setMatches((prev) => {
          const updated = [...prev];
          for (const m of res.new_matches) {
            if (!updated.find((x) => x.student_id === m.student_id)) {
              updated.push({ ...m, isNew: true });
              setTimeout(() => {
                setMatches((p) => p.map((x) => x.student_id === m.student_id ? { ...x, isNew: false } : x));
              }, 2000);
            }
          }
          return updated;
        });
      }
    } catch (err) {
      // Silently continue
    } finally {
      isProcessingRef.current = false;
    }

    // Schedule next frame only if still scanning
    if (isScanningRef.current) {
      scheduleNextFrame();
    }
  };

  const handleFinish = async () => {
    isScanningRef.current = false;
    cleanup();
    setState("finishing");

    try {
      const res = await finishLiveScan(scanIdRef.current);
      setResult(res);
      setState("done");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save.");
      setState("done");
    }
  };

  const handleCancel = () => {
    isScanningRef.current = false;
    cleanup();
    onCancel();
  };

  const cleanup = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

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

        {state === "scanning" && (
          <>
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-pulse" />
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-white text-xs font-medium">Scanning · {frameCount} frames</span>
            </div>
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <span className="text-emerald-400 text-xs font-bold">{matches.length} identified</span>
            </div>
          </>
        )}

        {state === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-2 border-sky-400 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-white text-xs">Starting camera...</p>
            </div>
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
        <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
          {matches.map((m) => (
            <div
              key={m.student_id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all duration-300 ${
                m.isNew ? "border-sky-200 bg-sky-50 shadow-sm animate-fade-in-up" : "border-slate-100 bg-white"
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
          onClick={handleCancel}
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
        Point camera at students. Names appear as they're identified.
      </p>
    </div>
  );
}

export default LiveScanner;
