import { NavLink } from "react-router-dom";
import { logout } from "../services/api";
import NotificationBell from "./NotificationBell";

function Shell({ user, onLogout, children }) {
  const isAdmin = user.role === "admin";

  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-[260px] bg-white border-r border-slate-100 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-50">
          <img src="/logo.svg" alt="AttendAI" className="w-9 h-9 rounded-xl shadow-lg shadow-sky-500/20" />
          <div>
            <h1 className="font-display font-extrabold text-slate-900 text-[15px] leading-none tracking-tight">AttendAI</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">FST Marrakech</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-5 overflow-y-auto scrollbar-thin">
          {/* Main */}
          <div className="space-y-0.5">
            <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Main</p>
            <SidebarLink to="/" end icon={HomeIcon}>Dashboard</SidebarLink>
            <SidebarLink to="/students" icon={UsersIcon}>Students</SidebarLink>
            {isAdmin && <SidebarLink to="/enroll" icon={PlusIcon}>Enroll</SidebarLink>}
            <SidebarLink to="/attendance" icon={ScanIcon}>Take Attendance</SidebarLink>
            <SidebarLink to="/sessions" icon={ListIcon}>Sessions</SidebarLink>
            <SidebarLink to="/reclamations" icon={InboxIcon}>Reclamations</SidebarLink>
          </div>

          {/* Intelligence */}
          <div className="space-y-0.5">
            <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Intelligence</p>
            <SidebarLink to="/analytics" icon={ChartIcon}>Analytics</SidebarLink>
            {isAdmin && <SidebarLink to="/export" icon={DownloadIcon}>Export</SidebarLink>}
            {isAdmin && <SidebarLink to="/audit" icon={ShieldIcon}>Audit Log</SidebarLink>}
          </div>
        </nav>

        {/* User card */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/80">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
              <span className="text-slate-600 text-xs font-bold">{user.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-700 truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 capitalize">{user.role}</p>
            </div>
            <NotificationBell />
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white hover:shadow-sm transition-all duration-200"
              title="Sign out"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      {/* Right content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="AttendAI" className="w-7 h-7 rounded-lg" />
            <span className="font-display font-bold text-slate-900 text-sm">AttendAI</span>
          </div>
          <div className="flex items-center gap-1">
            <MobileLink to="/" end><HomeIcon /></MobileLink>
            <MobileLink to="/students"><UsersIcon /></MobileLink>
            {isAdmin && <MobileLink to="/enroll"><PlusIcon /></MobileLink>}
            <MobileLink to="/attendance"><ScanIcon /></MobileLink>
            <MobileLink to="/sessions"><ListIcon /></MobileLink>
            <MobileLink to="/analytics"><ChartIcon /></MobileLink>
            {isAdmin && <MobileLink to="/audit"><ShieldIcon /></MobileLink>}
            <button onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 transition-colors">
              <LogoutIcon />
            </button>
          </div>
        </header>

        {/* Scrollable main */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ to, end, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
          isActive
            ? "bg-sky-50 text-sky-600 shadow-sm shadow-sky-500/5"
            : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
        }`
      }
    >
      <span className="w-5 h-5 flex items-center justify-center"><Icon /></span>
      {children}
    </NavLink>
  );
}

function MobileLink({ to, end, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `p-2 rounded-lg transition-all duration-200 ${
          isActive ? "text-sky-600 bg-sky-50" : "text-slate-400 hover:text-slate-600"
        }`
      }
    >
      <span className="w-4 h-4 block">{children}</span>
    </NavLink>
  );
}

/* --- Icons --- */
function HomeIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5M20.25 16.5V18A2.25 2.25 0 0 1 18 20.25h-1.5M3.75 16.5V18A2.25 2.25 0 0 0 6 20.25h1.5M12 9v3m0 0v3m0-3h3m-3 0H9" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h2.21a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3M2.25 18.75h19.5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
    </svg>
  );
}

export default Shell;
