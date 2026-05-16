import { useState } from "react";
import { enrollStudent } from "../services/api";

function EnrollPage() {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [profileIndex, setProfileIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length < 3 || files.length > 10) {
      setError("Please select between 3 and 10 images.");
      return;
    }
    setError(null);
    setImages(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
    setProfileIndex(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (images.length < 3) {
      setError("Please upload at least 3 images.");
      return;
    }

    setLoading(true);
    try {
      const result = await enrollStudent({
        name,
        student_id: studentId,
        email: email || undefined,
        profile_index: profileIndex,
        images,
      });
      setSuccess(`${result.name} enrolled successfully.`);
      setName("");
      setStudentId("");
      setEmail("");
      setImages([]);
      setPreviews([]);
    } catch (err) {
      setError(err.response?.data?.detail || "Enrollment failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="font-display font-bold text-slate-900 text-xl">Enroll Student</h2>
        <p className="text-sm text-slate-400 mt-1">
          Upload 3–10 clear facial photos. Click one to set as profile picture.
        </p>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium animate-fade-in-up">
              {error}
            </div>
          )}
          {success && (
            <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-medium animate-fade-in-up">
              {success}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200" placeholder="Mohamed Amine" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Student ID (CNE)</label>
            <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} required className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200 font-mono" placeholder="R130456789" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Email (optional)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all duration-200" placeholder="student@uca.ac.ma" />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Face Photos (3–10)</label>
            <label htmlFor="imageUpload" className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-sky-300 hover:bg-sky-50/30 transition-all duration-200">
              <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
              <p className="text-sm text-slate-500">Click to select photos</p>
              <p className="text-xs text-slate-300 mt-0.5">JPEG or PNG</p>
            </label>
            <input type="file" id="imageUpload" multiple accept="image/jpeg,image/png" onChange={handleImageChange} className="hidden" />

            {previews.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-400 mb-2">Click to set profile picture:</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {previews.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setProfileIndex(idx)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                        idx === profileIndex
                          ? "border-sky-500 ring-2 ring-sky-200"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === profileIndex && (
                        <span className="absolute inset-0 bg-sky-500/10 flex items-center justify-center">
                          <span className="bg-sky-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PFP</span>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || images.length < 3}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing faces...
              </span>
            ) : (
              "Enroll Student"
            )}
          </button>
        </form>
      </div>
    </section>
  );
}

export default EnrollPage;
