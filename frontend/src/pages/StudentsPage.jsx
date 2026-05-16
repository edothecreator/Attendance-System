import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getStudents } from "../services/api";

function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const data = await getStudents();
      setStudents(data);
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <StudentsSkeleton />;

  return (
    <section>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-slate-900 text-xl">Students</h2>
          <p className="text-sm text-slate-400 mt-0.5">{students.length} enrolled</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students..."
              className="pl-9 pr-4 py-2 w-64 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {students.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm font-medium">No students enrolled yet</p>
          <Link to="/enroll" className="mt-3 text-sky-500 text-sm font-medium hover:text-sky-600 transition-colors">
            Enroll your first student →
          </Link>
        </div>
      )}

      {/* No search results */}
      {students.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-100 rounded-xl">
          <p className="text-slate-400 text-sm">No students match "{search}"</p>
          <button onClick={() => setSearch("")} className="mt-2 text-sky-500 text-sm font-medium hover:text-sky-600 transition-colors">
            Clear search
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((student) => (
            <Link
              key={student.id}
              to={`/student/${student.student_id}`}
              className="group bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md hover:border-slate-200 transition-all duration-200"
            >
              <div className="flex items-center gap-3.5">
                {student.profile_image ? (
                  <img
                    src={student.profile_image}
                    alt={student.name}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100 group-hover:ring-sky-100 transition-all duration-200"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <span className="text-slate-500 font-semibold text-sm">
                      {student.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-slate-900">
                    {student.name}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">{student.student_id}</p>
                </div>
                <AttendanceBadge rate={student.attendance_rate} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function AttendanceBadge({ rate }) {
  const color =
    rate >= 75
      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
      : rate >= 50
      ? "bg-amber-50 text-amber-600 border-amber-200"
      : rate > 0
      ? "bg-rose-50 text-rose-600 border-rose-200"
      : "bg-slate-50 text-slate-400 border-slate-200";

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${color}`}>
      {rate > 0 ? `${rate}%` : "—"}
    </span>
  );
}

function StudentsSkeleton() {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-slate-100 rounded animate-pulse mt-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-slate-100 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-20 bg-slate-50 rounded animate-pulse mt-1.5" />
              </div>
              <div className="h-5 w-10 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StudentsPage;
