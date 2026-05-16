import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getNotifications, markNotificationsRead } from "../services/api";

function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (err) {
      // Silently fail
    }
  };

  const handleOpen = async () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      await markNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const typeStyles = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    error: "bg-rose-50 border-rose-200 text-rose-700",
    info: "bg-sky-50 border-sky-200 text-sky-700",
  };

  const typeIcons = {
    success: "✓",
    warning: "⚠",
    error: "✗",
    info: "ℹ",
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all duration-200"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-up">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">Notifications</h4>
            {notifications.length > 0 && (
              <span className="text-[10px] text-slate-400">{notifications.length} total</span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-400">No notifications yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.read ? "bg-sky-50/30" : ""}`}
                    onClick={() => {
                      if (n.link) {
                        navigate(n.link);
                        setOpen(false);
                      }
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold border ${typeStyles[n.type]}`}>
                        {typeIcons[n.type]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{n.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-slate-300 mt-1">
                          {new Date(n.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
