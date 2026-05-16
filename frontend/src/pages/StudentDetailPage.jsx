import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getStudent, getStudentAttendance, updateStudent, deleteStudent, getCurrentUser, downloadStudentReport } from "../services/api";

function StudentDetailPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);

  const user = getCurrentUser();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    loadData();
  }, [studentId]);

  const loadData = async () => {
    try {
      const [s, a] = await Promise.all([
        getStudent(studentId),
        getStudentAttendance(studentId),
      ]);
      setStudent(s);
      setAttendance(a);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${student.name}? This cannot be undone.`)) return;
    try {
      await deleteStudent(studentId);
      navigate("/");
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-500 text-sm">Student not found.</p>
        <Link to="/" className="mt-2 text-sky-500 text-sm font-medium hover:text-sky-600">← Back</Link>
      </div>
    );
  }

  const rateColor =
    student.attendance_rate >= 75
      ? "text-emerald-600"
      : student.attendance_rate >= 50
      ? "text-amber-600"
      : "text-rose-600";

  return (
    <section className="max-w-3xl mx-auto">
      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        All Students
      </Link>

      {/* Profile Card */}
      <article className="bg-white border border-slate-100 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-5">
          {student.profile_image ? (
            <img
              src={student.profile_image}
              alt={student.name}
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-slate-50"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <span className="text-slate-400 font-bold text-2xl">{student.name.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1">
            <h2 className="font-display font-bold text-slate-900 text-xl">{student.name}</h2>
            <p className="text-sm text-slate-400 font-mono mt-0.5">{student.student_id}</p>
            {student.email && <p className="text-sm text-slate-400 mt-0.5">{student.email}</p>}
          </div>
          <div className="text-right">
            <p className={`font-display font-bold text-3xl ${rateColor}`}>
              {student.attendance_rate}%
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Overall</p>
          </div>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex items-center gap-2 mt-5 pt-5 border-t border-slate-50">
            <button
              onClick={() => setEditModal(true)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200"
            >
              Edit Info
            </button>
            <button
              onClick={() => downloadStudentReport(studentId)}
              className="px-3.5 py-1.5 rounded-lg border border-sky-200 text-xs font-medium text-sky-600 hover:bg-sky-50 transition-all duration-200"
            >
              Download PDF
            </button>
            <button
              onClick={handleDelete}
              className="px-3.5 py-1.5 rounded-lg border border-rose-200 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-all duration-200"
            >
              Delete Student
            </button>
          </div>
        )}
      </article>

      {/* Module Breakdown */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h3 className="font-display font-bold text-slate-900 text-sm">Attendance by Module</h3>
        </div>
        {attendance.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 text-sm">No attendance data recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {attendance.map((mod) => (
              <div key={mod.module_code} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{mod.module_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {mod.module_code} · {mod.attended}/{mod.total_sessions} sessions
                  </p>
                </div>
                <div className="flex items-center gap-3 w-40">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        mod.rate >= 75 ? "bg-emerald-500" : mod.rate >= 50 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${mod.rate}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold w-10 text-right ${
                    mod.rate >= 75 ? "text-emerald-600" : mod.rate >= 50 ? "text-amber-600" : "text-rose-600"
                  }`}>
                    {mod.rate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <EditModal
          student={student}
          onClose={() => setEditModal(false)}
          onSaved={() => { setEditModal(false); loadData(); }}
        />
      )}
    </section>
  );
}

function EditModal({ student, onClose, onSaved }) {
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email || "");
  const [newId, setNewId] = useState(student.student_id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateStudent(student.student_id, {
        name: name !== student.name ? name : undefined,
        email: email !== (student.email || "") ? email : undefined,
        new_student_id: newId !== student.student_id ? newId : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.detail || "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
        <h3 className="font-display font-bold text-slate-900 text-lg mb-5">Edit Student</h3>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Student ID (CNE)</label>
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@uca.ac.ma"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-all duration-200"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <section className="max-w-3xl mx-auto">
      <div className="h-4 w-20 bg-slate-100 rounded animate-pulse mb-6" />
      <div className="bg-white border border-slate-100 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="flex-1">
            <div className="h-6 w-40 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-24 bg-slate-50 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <div className="flex-1"><div className="h-4 w-32 bg-slate-100 rounded animate-pulse" /></div>
            <div className="h-2 w-32 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default StudentDetailPage;
