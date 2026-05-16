import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { getCurrentUser } from "./services/api";
import Shell from "./components/Shell";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import StudentDetailPage from "./pages/StudentDetailPage";
import EnrollPage from "./pages/EnrollPage";
import IdentifyPage from "./pages/IdentifyPage";
import SessionsPage from "./pages/SessionsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ExportPage from "./pages/ExportPage";
import AuditPage from "./pages/AuditPage";
import ReclamationsPage from "./pages/ReclamationsPage";
import StudentPortalPage from "./pages/StudentPortalPage";

function App() {
  const [user, setUser] = useState(getCurrentUser());

  // Not logged in
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Student role → show student portal
  if (user.role === "student") {
    return <StudentPortalPage user={user} onLogout={() => { setUser(null); localStorage.removeItem("token"); localStorage.removeItem("user"); }} />;
  }

  // Admin/Professor → full dashboard
  return (
    <Shell user={user} onLogout={() => setUser(null)}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/student/:studentId" element={<StudentDetailPage />} />
        {user.role === "admin" && <Route path="/enroll" element={<EnrollPage />} />}
        <Route path="/attendance" element={<IdentifyPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/reclamations" element={<ReclamationsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        {user.role === "admin" && <Route path="/export" element={<ExportPage />} />}
        {user.role === "admin" && <Route path="/audit" element={<AuditPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default App;
