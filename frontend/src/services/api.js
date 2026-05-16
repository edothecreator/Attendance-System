import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith("/portal")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export async function login(username, password) {
  const response = await api.post("/auth/login", { username, password });
  const { access_token, user } = response.data;
  localStorage.setItem("token", access_token);
  localStorage.setItem("user", JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getCurrentUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

export function isAuthenticated() {
  return !!localStorage.getItem("token");
}

// --- Students ---
export async function enrollStudent({ name, student_id, email, profile_index, images }) {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("student_id", student_id);
  if (email) formData.append("email", email);
  formData.append("profile_index", profile_index || 0);
  images.forEach((img) => formData.append("images", img));
  const response = await api.post("/students/enroll", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getStudents() {
  const response = await api.get("/students/");
  return response.data;
}

export async function getStudent(studentId) {
  const response = await api.get(`/students/${studentId}`);
  return response.data;
}

export async function getStudentAttendance(studentId) {
  const response = await api.get(`/students/${studentId}/attendance`);
  return response.data;
}

export async function updateStudent(studentId, { name, email, new_student_id }) {
  const formData = new FormData();
  if (name) formData.append("name", name);
  if (email !== undefined) formData.append("email", email || "");
  if (new_student_id) formData.append("new_student_id", new_student_id);
  const response = await api.patch(`/students/${studentId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function deleteStudent(studentId) {
  await api.delete(`/students/${studentId}`);
}

// --- Modules ---
export async function getModules() {
  const response = await api.get("/modules/");
  return response.data;
}

export async function createModule(data) {
  const response = await api.post("/modules/", data);
  return response.data;
}

// --- Sessions ---
export async function createSession({ module_id, week_number, video }) {
  const formData = new FormData();
  formData.append("module_id", module_id);
  formData.append("week_number", week_number);
  formData.append("video", video);
  const response = await api.post("/sessions/identify", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getSessions(moduleId) {
  const params = moduleId ? { module_id: moduleId } : {};
  const response = await api.get("/sessions/", { params });
  return response.data;
}

export async function getSessionAttendance(sessionId) {
  const response = await api.get(`/sessions/${sessionId}/attendance`);
  return response.data;
}

export async function getNextWeek(moduleId) {
  const response = await api.get(`/sessions/next-week/${moduleId}`);
  return response.data;
}

// --- Analytics ---
export async function getHeatmap() {
  const response = await api.get("/analytics/heatmap");
  return response.data;
}

export async function getAtRiskStudents() {
  const response = await api.get("/analytics/at-risk");
  return response.data;
}

// --- Overrides ---
export async function overrideAttendance(recordId, status, justification) {
  const formData = new FormData();
  formData.append("status", status);
  if (justification) formData.append("justification", justification);
  const response = await api.patch(`/attendance/${recordId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getDetailedAttendance(sessionId) {
  const response = await api.get(`/attendance/session/${sessionId}`);
  return response.data;
}

// --- Export ---
export function getExportCsvUrl(moduleId) {
  const token = localStorage.getItem("token");
  const base = "/api/analytics/export/csv";
  const params = new URLSearchParams();
  if (moduleId) params.append("module_id", moduleId);
  return `${base}?${params.toString()}`;
}

export async function downloadExportCsv(moduleId) {
  const params = moduleId ? { module_id: moduleId } : {};
  const response = await api.get("/analytics/export/csv", {
    params,
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "attendai_export_apogee.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// --- Trends ---
export async function getTrends() {
  const response = await api.get("/analytics/trends");
  return response.data;
}

// --- Notifications ---
export async function getNotifications() {
  const response = await api.get("/notifications/");
  return response.data;
}

export async function markNotificationsRead() {
  const response = await api.post("/notifications/read-all");
  return response.data;
}

// --- QR Attendance ---
export async function generateQR(sessionId, latitude, longitude) {
  const formData = new FormData();
  formData.append("latitude", latitude);
  formData.append("longitude", longitude);
  const response = await api.post(`/qr/generate/${sessionId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function qrCheckin(token, studentId, latitude, longitude) {
  const formData = new FormData();
  formData.append("token", token);
  formData.append("student_id", studentId);
  formData.append("latitude", latitude);
  formData.append("longitude", longitude);
  const response = await api.post("/qr/checkin", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getActiveQR(sessionId) {
  const response = await api.get(`/qr/active/${sessionId}`);
  return response.data;
}

// --- Reports (PDF) ---
export async function downloadStudentReport(studentId) {
  const response = await api.get(`/reports/student/${studentId}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `releve_${studentId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadModuleReport(moduleId) {
  const response = await api.get(`/reports/module/${moduleId}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `emargement_module.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadCertificate(studentId) {
  const response = await api.get(`/reports/certificate/${studentId}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `attestation_${studentId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// --- Dashboard ---
export async function getDashboardStats() {
  const response = await api.get("/dashboard/stats");
  return response.data;
}

// --- Audit ---
export async function getAuditLog() {
  const response = await api.get("/audit/");
  return response.data;
}

// --- Live Scan ---
export async function startLiveScan(moduleId, weekNumber) {
  const formData = new FormData();
  formData.append("module_id", moduleId);
  formData.append("week_number", weekNumber);
  const response = await api.post("/live/start", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function sendLiveFrame(scanId, frameDataUrl) {
  const formData = new FormData();
  formData.append("scan_id", scanId);
  formData.append("frame_data", frameDataUrl);
  const response = await api.post("/live/frame", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function finishLiveScan(scanId) {
  const formData = new FormData();
  formData.append("scan_id", scanId);
  const response = await api.post("/live/finish", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

// --- Reclamations ---
export async function submitReclamation({ student_id, session_id, message, attachment }) {
  const formData = new FormData();
  formData.append("student_id", student_id);
  formData.append("session_id", session_id);
  formData.append("message", message);
  if (attachment) formData.append("attachment", attachment);
  const response = await api.post("/reclamations/submit", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getStudentReclamations(studentId) {
  const response = await api.get(`/reclamations/student/${studentId}`);
  return response.data;
}

export async function getPendingReclamations() {
  const response = await api.get("/reclamations/pending");
  return response.data;
}

export async function resolveReclamation(reclamationId, decision, response_text) {
  const formData = new FormData();
  formData.append("decision", decision);
  if (response_text) formData.append("response", response_text);
  const response = await api.post(`/reclamations/${reclamationId}/resolve`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

// --- Student Portal ---
export async function studentLogin(email, password) {
  const formData = new FormData();
  formData.append("email", email);
  formData.append("password", password);
  const response = await api.post("/portal/login", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getMyAttendance(studentId) {
  const response = await api.get(`/portal/my-attendance/${studentId}`);
  return response.data;
}

export default api;
