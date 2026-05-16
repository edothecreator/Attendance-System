import { useState, useEffect } from "react";
import { getPendingReclamations, resolveReclamation } from "../services/api";

function ReclamationsPage() {
  const [reclamations, setReclamations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [responseText, setResponseText] = useState("");

  useEffect(() => {
    loadReclamations();
  }, []);

  const loadReclamations = async () => {
    try {
      const data = await getPendingReclamations();
      setReclamations(data.reclamations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id, decision) => {
    try {
      await resolveReclamation(id, decision, responseText);
      setResolving(null);
      setResponseText("");
      loadReclamations();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <section>
        <div className="h-6 w-36 bg-slate-100 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-6">
        <h2 className="font-display font-bold text-slate-900 text-xl">Reclamations</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          {reclamations.length} pending justification request{reclamations.length !== 1 ? "s" : ""}
        </p>
      </div>

      {reclamations.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-xl p-12 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 font-medium">All clear</p>
          <p className="text-xs text-slate-400 mt-0.5">No pending reclamations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reclamations.map((r) => (
            <article key={r.id} className="bg-white border border-slate-100 rounded-xl p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                {r.profile_image ? (
                  <img src={r.profile_image} alt={r.student_name} className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="text-slate-500 text-xs font-bold">{r.student_name.charAt(0)}</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{r.student_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{r.student_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-600">{r.module_code} — Week {r.week_number}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="mt-3 px-3 py-2.5 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-700">{r.message}</p>
                  </div>

                  {/* Attachment */}
                  {r.has_attachment && r.attachment && (
                    <div className="mt-2">
                      {r.attachment.startsWith("data:image") ? (
                        <img src={r.attachment} alt="Certificate" className="max-h-40 rounded-lg border border-slate-200" />
                      ) : (
                        <a href={r.attachment} download className="text-xs text-sky-500 font-medium hover:text-sky-600">
                          📎 View attachment
                        </a>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {resolving === r.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
                        placeholder="Optional response to student..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolve(r.id, "approved")}
                          className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all duration-200"
                        >
                          ✓ Approve (Justify)
                        </button>
                        <button
                          onClick={() => handleResolve(r.id, "declined")}
                          className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-all duration-200"
                        >
                          ✗ Decline
                        </button>
                        <button
                          onClick={() => { setResolving(null); setResponseText(""); }}
                          className="py-2 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-all duration-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <button
                        onClick={() => setResolving(r.id)}
                        className="px-3 py-1.5 rounded-lg border border-sky-200 text-xs font-medium text-sky-600 hover:bg-sky-50 transition-all duration-200"
                      >
                        Review & Respond
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ReclamationsPage;
