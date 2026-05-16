import { useState, useRef, useEffect, useCallback } from "react";

function CameraRecorder({ onVideoReady, onCancel }) {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const [state, setState] = useState("idle"); // idle, previewing, recording, recorded
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  // Start camera preview
  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setState("previewing");
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setError("Camera access denied. Please allow camera permissions.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Could not access camera: " + err.message);
      }
    }
  }, []);

  // Start recording
  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
      setState("recorded");
      stopCamera();
    };

    recorder.start(1000); // collect data every second
    setState("recording");
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Confirm and send video
  const confirmVideo = () => {
    if (recordedBlob) {
      // Convert to File object for upload
      const extension = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
      const file = new File([recordedBlob], `attendance_recording.${extension}`, {
        type: recordedBlob.type,
      });
      onVideoReady(file);
    }
  };

  // Retake
  const retake = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    startCamera();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, []);

  // Auto-start camera on mount
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium animate-fade-in-up">
          {error}
        </div>
      )}

      {/* Video display */}
      <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video">
        {(state === "previewing" || state === "recording") && (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
        )}

        {state === "recorded" && recordedUrl && (
          <video
            src={recordedUrl}
            className="w-full h-full object-cover"
            controls
            playsInline
          />
        )}

        {state === "idle" && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
          </div>
        )}

        {/* Recording indicator */}
        {state === "recording" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-white text-xs font-mono font-medium">{formatTime(duration)}</span>
          </div>
        )}

        {/* Duration badge for recorded */}
        {state === "recorded" && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <span className="text-white text-xs font-mono font-medium">{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {state === "previewing" && (
          <>
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-all duration-200 shadow-sm shadow-rose-500/20"
            >
              <span className="w-3 h-3 rounded-full bg-white" />
              Start Recording
            </button>
          </>
        )}

        {state === "recording" && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all duration-200"
          >
            <span className="w-3 h-3 rounded-sm bg-white" />
            Stop Recording
          </button>
        )}

        {state === "recorded" && (
          <>
            <button
              onClick={retake}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200"
            >
              Retake
            </button>
            <button
              onClick={confirmVideo}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Confirm & Analyze
            </button>
          </>
        )}
      </div>

      {/* Tip */}
      {(state === "previewing" || state === "recording") && (
        <p className="text-xs text-slate-400 text-center">
          Point the camera at the class. Record for 10–30 seconds, ensuring faces are visible.
        </p>
      )}
    </div>
  );
}

export default CameraRecorder;
