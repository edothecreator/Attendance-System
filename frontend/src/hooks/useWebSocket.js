import { useState, useEffect, useRef, useCallback } from "react";

export function useWebSocket(sessionId) {
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [matches, setMatches] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/session/${sessionId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case "status":
            setStatus(message.data.status);
            setProgress(message.data.progress || 0);
            break;
          case "match":
            setMatches((prev) => {
              const existing = prev.findIndex((m) => m.student_id === message.data.student_id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { ...message.data, isNew: true };
                return updated;
              }
              return [...prev, { ...message.data, isNew: true }];
            });
            // Remove "isNew" flag after animation
            setTimeout(() => {
              setMatches((prev) =>
                prev.map((m) =>
                  m.student_id === message.data.student_id ? { ...m, isNew: false } : m
                )
              );
            }, 2000);
            break;
          case "complete":
            setIsComplete(true);
            setSummary(message.data);
            setProgress(100);
            setStatus("complete");
            break;
          default:
            break;
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Auto-reconnect if not complete
        if (!isComplete && reconnectAttempts.current < 5) {
          reconnectAttempts.current += 1;
          reconnectTimer.current = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      setIsConnected(false);
    }
  }, [sessionId, isComplete]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const reset = useCallback(() => {
    setStatus(null);
    setProgress(0);
    setMatches([]);
    setIsComplete(false);
    setSummary(null);
  }, []);

  return { status, progress, matches, isConnected, isComplete, summary, reset };
}
