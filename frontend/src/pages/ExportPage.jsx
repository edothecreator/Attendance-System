import { useState, useEffect } from "react";
import { getModules, downloadExportCsv } from "../services/api";

function ExportPage() {
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      const data = await getModules();
      setModules(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setSuccess(false);
    try {
      await downloadExportCsv(selectedModule || undefined);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display font-bold text-slate-900 text-xl">Export Attendance</h2>
        <p className="text-sm text-slate-400 mt-1">
          Generate Apogée-compatible CSV files for official university records.
        </p>
      </div>

      <article className="bg-white border border-slate-100 rounded-2xl p-6 space-y-6">
        {/* Format info */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Apogée Format</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                CSV with semicolon delimiter. Columns: CNE, Nom Complet, Module, S1–S14, Total Absences, Taux Présence (%).
                Each session marked as P (Present), A (Absent), or — (No data).
              </p>
            </div>
          </div>
        </div>

        {/* Module filter */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
            Module (optional filter)
          </label>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200"
          >
            <option value="">All Modules (full export)</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.code} — {m.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1.5">
            Leave empty to export all modules in one file.
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download CSV
              </>
            )}
          </button>
        </div>

        {/* Success feedback */}
        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 animate-fade-in-up">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <p className="text-sm font-medium text-emerald-700">Export downloaded successfully.</p>
          </div>
        )}
      </article>
    </section>
  );
}

export default ExportPage;
