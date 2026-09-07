import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Eye,
  Film,
  Mail,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react";

import { getRequest, putJson, putForm } from "../../api/client";
import { useAuth } from "../../context/AuthContext.jsx";
import DirectorNav from "../../components/DirectorNav.jsx";

// ============================================================
// FORMATTERS & HELPERS
// ============================================================

function formatDuration(sec) {
  const s = Math.round(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const rem = String(ss).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${rem}` : `${mm}:${rem}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "Archive Record";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? "Archive Record"
      : d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  } catch {
    return "Archive Record";
  }
}

function StatusBadge({ status }) {
  const styles = {
    approved: "border-[#d9a653]/60 text-[#f3ce8a] bg-[#d9a653]/10",
    pending: "border-white/20 text-[#c7bec2] bg-white/[0.04]",
    rejected: "border-[#e08a6b]/50 text-[#e08a6b] bg-[#e08a6b]/10",
  };

  const labels = {
    approved: "Theatrical",
    pending: "In Review",
    rejected: "Revisions",
  };

  const key = String(status || "pending").toLowerCase();

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-[var(--font-mono)] text-[8.5px] uppercase tracking-[0.14em] ${
        styles[key] || styles.pending
      }`}
    >
      <span
        className={`h-1 w-1 rounded-full ${
          key === "approved"
            ? "bg-[#d9a653]"
            : key === "rejected"
            ? "bg-[#e08a6b]"
            : "bg-[#8a7d85]"
        }`}
      />
      {labels[key] || key}
    </span>
  );
}

// ============================================================
// MAIN COMPONENT: Director Profile
// ============================================================

export default function Profile() {
  const auth = useAuth() || {};
  const user = auth.user || {};

  // Avatar file input reference & states
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState({ type: "", message: "" });

  // Film catalog state
  const [videos, setVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Bio editing state
  const [bio, setBio] = useState("");
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [bioFeedback, setBioFeedback] = useState({ type: "", message: "" });

  // ID copy feedback
  const [copiedId, setCopiedId] = useState(false);

  // Sync initial user details
  useEffect(() => {
    const initialBio = user?.bio || "";
    setBio(initialBio);
    setBioInput(initialBio);
    if (user?.avatarUrl) {
      setAvatarUrl(user.avatarUrl);
    }
  }, [user]);

  // Fetch director's catalog
  const loadVideos = async () => {
    setLoadingVideos(true);
    try {
      const res = await getRequest("/directors/videos");
      if (Array.isArray(res)) {
        setVideos(res);
      } else if (Array.isArray(res?.videos)) {
        setVideos(res.videos);
      } else {
        setVideos([]);
      }
    } catch (err) {
      console.error("Failed to load director videos:", err);
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  // Avatar Image Upload using putForm (with proscenium_auth token)
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant optimistic preview
    const objectUrl = URL.createObjectURL(file);
    setAvatarUrl(objectUrl);
    setUploadingAvatar(true);
    setAvatarFeedback({ type: "", message: "" });

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      // Uses existing client putForm which automatically sends Authorization: Bearer <token>
      const data = await putForm("/directors/profile/avatar", formData);

      const newAvatarUrl = data?.avatarUrl || data?.url || objectUrl;
      setAvatarUrl(newAvatarUrl);

      if (typeof auth.updateUser === "function") {
        auth.updateUser({ avatarUrl: newAvatarUrl });
      }

      setAvatarFeedback({
        type: "success",
        message: "Director portrait updated.",
      });
      setTimeout(() => setAvatarFeedback({ type: "", message: "" }), 3500);
    } catch (err) {
      console.error("Avatar upload error:", err);
      setAvatarFeedback({
        type: "error",
        message: err.message || "Failed to upload portrait.",
      });
      setAvatarUrl(user?.avatarUrl || "");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save Bio via PUT /directors/profile/bio
  const handleSaveBio = async () => {
    if (savingBio) return;
    setSavingBio(true);
    setBioFeedback({ type: "", message: "" });

    try {
      await putJson("/directors/profile/bio", { bio: bioInput.trim() });
      setBio(bioInput.trim());
      setIsEditingBio(false);
      setBioFeedback({
        type: "success",
        message: "Director's statement filed to ledger.",
      });

      if (typeof auth.updateUser === "function") {
        auth.updateUser({ bio: bioInput.trim() });
      }

      setTimeout(() => setBioFeedback({ type: "", message: "" }), 4000);
    } catch (err) {
      console.error("Error updating bio:", err);
      setBioFeedback({
        type: "error",
        message: err.message || "Failed to update statement.",
      });
    } finally {
      setSavingBio(false);
    }
  };

  const handleCancelBio = () => {
    setBioInput(bio);
    setIsEditingBio(false);
    setBioFeedback({ type: "", message: "" });
  };

  const handleCopyId = () => {
    const directorId = user?.id || user?._id || "CREATOR-ARCHIVE";
    navigator.clipboard.writeText(directorId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalVideos = videos.length;
    const totalViews = videos.reduce((sum, v) => sum + (Number(v?.views) || 0), 0);
    const approvedCount = videos.filter((v) => v?.moderationStatus === "approved").length;
    const pendingCount = videos.filter((v) => v?.moderationStatus === "pending").length;
    const totalSeconds = videos.reduce((sum, v) => sum + (Number(v?.duration) || 0), 0);
    const totalRuntimeHours = (totalSeconds / 3600).toFixed(1);

    return {
      totalVideos,
      totalViews,
      approvedCount,
      pendingCount,
      totalRuntimeHours,
    };
  }, [videos]);

  // Filtered & Searched Videos
  const filteredVideos = useMemo(() => {
    return videos.filter((vid) => {
      const matchesFilter =
        filter === "all" || String(vid?.moderationStatus).toLowerCase() === filter;
      const matchesSearch =
        !searchQuery ||
        vid?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vid?.genre?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [videos, filter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#09060b] text-[#efe7da] selection:bg-[#d9a653]/30 selection:text-[#fff8ea]">
      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Ambient illumination */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[18vw] left-1/2 -translate-x-1/2 w-[70vw] h-[45vw] rounded-full bg-gradient-to-b from-[#d9a653]/08 via-[#2a1728]/12 to-transparent blur-3xl" />
        <div className="absolute top-[40vh] -left-[10vw] w-[35vw] h-[35vw] rounded-full bg-[#180f1d]/30 blur-3xl" />
      </div>

      {/* Top Director Navigation */}
      <DirectorNav />

      {/* Main Body */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* HERO: DIRECTOR PROFILE HEADER */}
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#120e17]/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="pointer-events-none absolute -right-6 -top-10 select-none opacity-[0.03] font-[var(--font-display)] text-[14rem] font-bold text-[#d9a653]">
            PROSCENIUM
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Avatar & Identity */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Profile Monogram / Avatar (Clickable) */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#d9a653]/40 bg-gradient-to-br from-[#241a29] via-[#16111b] to-[#0c0910] text-[#d9a653] shadow-[0_0_30px_rgba(217,166,83,0.18)] transition-transform hover:scale-[1.02] active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#d9a653]"
                  title="Click to change Director portrait"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user?.username || "Director"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-[var(--font-display)] text-4xl sm:text-5xl font-medium tracking-tight">
                      {String(user?.username || "D").charAt(0).toUpperCase()}
                    </span>
                  )}

                  {/* Dark hover overlay with camera icon */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                    <Camera size={20} className="text-[#d9a653]" />
                    <span className="mt-1 font-[var(--font-mono)] text-[8px] uppercase tracking-wider text-[#efe7da]">
                      {uploadingAvatar ? "Uploading..." : "Change Pic"}
                    </span>
                  </div>

                  {uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                      <RefreshCw size={20} className="animate-spin text-[#d9a653]" />
                    </div>
                  )}
                </button>

                {/* Clickable Camera Badge Button on the Avatar Corner */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-xl border border-[#d9a653]/80 bg-[#17111d] text-[#d9a653] shadow-lg hover:bg-[#d9a653] hover:text-[#0f0c11] hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title="Upload profile picture"
                >
                  {uploadingAvatar ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Camera size={14} />
                  )}
                </button>
              </div>

              {/* Identity Details */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.24em] text-[#d9a653]">
                    PROSCENIUM DIRECTORS GUILD
                  </span>
                  <span className="h-1 w-1 rounded-full bg-white/30" />
                  <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.16em] text-[#8a7d85]">
                    STUDIO ATELIER
                  </span>
                </div>

                {/* Master Director Title with Clickable Profile Picture Icon */}
                <div className="flex items-center gap-3">
                  <h1 className="font-[var(--font-display)] text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#efe7da]">
                    {user?.username || "Master Director"}
                  </h1>

                  {/* Icon beside Master Director */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="group/btn inline-flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] p-2 text-[#8a7d85] hover:border-[#d9a653]/60 hover:bg-[#d9a653]/10 hover:text-[#d9a653] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm"
                    title="Upload profile picture for director"
                  >
                    <Camera size={16} className="transition-transform group-hover/btn:scale-110" />
                  </button>
                </div>

                {/* Avatar Feedback Alert */}
                {avatarFeedback.message && (
                  <p
                    className={`font-[var(--font-mono)] text-[11px] ${
                      avatarFeedback.type === "success"
                        ? "text-[#7fc59b]"
                        : "text-[#e08a6b]"
                    }`}
                  >
                    {avatarFeedback.message}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#8a7d85]">
                  <div className="flex items-center gap-1.5">
                    <Mail size={13} className="text-[#d9a653]/70" />
                    <span className="font-[var(--font-mono)] text-[11px] text-[#c7bec2]">
                      {user?.email || "director@proscenium.cinema"}
                    </span>
                  </div>

                  <span className="text-white/20">•</span>

                  <button
                    onClick={handleCopyId}
                    className="group inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-[var(--font-mono)] text-[#8a7d85] hover:border-[#d9a653]/40 hover:text-[#efe7da] transition-colors"
                    title="Click to copy Director Archival Key"
                  >
                    <span>ID: {String(user?.id || user?._id || "CREATOR").slice(0, 10)}...</span>
                    {copiedId ? (
                      <Check size={11} className="text-[#7fc59b]" />
                    ) : (
                      <Copy size={11} className="group-hover:text-[#d9a653]" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
              <Link
                to="/director/upload"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d9a653] to-[#c7923e] px-5 py-2.5 font-[var(--font-mono)] text-xs uppercase tracking-[0.16em] text-[#0f0c11] font-semibold shadow-[0_0_20px_rgba(217,166,83,0.25)] hover:brightness-110 active:scale-[0.98] transition-all"
              >
                <Upload size={14} />
                <span>New Production</span>
              </Link>

              <button
                onClick={() => {
                  setIsEditingBio(true);
                  setTimeout(() => {
                    const el = document.getElementById("director-bio-textarea");
                    el?.focus();
                  }, 50);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 font-[var(--font-mono)] text-xs uppercase tracking-[0.16em] text-[#efe7da] hover:border-[#d9a653]/50 hover:bg-[#d9a653]/10 transition-all"
              >
                <Edit3 size={13} className="text-[#d9a653]" />
                <span>Edit Statement</span>
              </button>
            </div>
          </div>
        </section>

        {/* METRICS OVERVIEW */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#120e17]/60 p-5 backdrop-blur-md transition-all hover:border-[#d9a653]/30">
            <div className="flex items-center justify-between text-[#8a7d85]">
              <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.2em]">
                Total Productions
              </span>
              <Film size={16} className="text-[#d9a653]" />
            </div>
            <p className="mt-3 font-[var(--font-display)] text-3xl sm:text-4xl font-medium text-[#efe7da]">
              {loadingVideos ? "—" : stats.totalVideos}
            </p>
            <span className="mt-1 block font-[var(--font-mono)] text-[10px] text-[#8a7d85]">
              Archived in portfolio
            </span>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#120e17]/60 p-5 backdrop-blur-md transition-all hover:border-[#d9a653]/30">
            <div className="flex items-center justify-between text-[#8a7d85]">
              <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.2em]">
                Theatrical Releases
              </span>
              <Sparkles size={16} className="text-[#7fc59b]" />
            </div>
            <p className="mt-3 font-[var(--font-display)] text-3xl sm:text-4xl font-medium text-[#efe7da]">
              {loadingVideos ? "—" : stats.approvedCount}
            </p>
            <span className="mt-1 block font-[var(--font-mono)] text-[10px] text-[#7fc59b]/80">
              Live for public viewing
            </span>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#120e17]/60 p-5 backdrop-blur-md transition-all hover:border-[#d9a653]/30">
            <div className="flex items-center justify-between text-[#8a7d85]">
              <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.2em]">
                Total Archival Views
              </span>
              <Eye size={16} className="text-[#d9a653]" />
            </div>
            <p className="mt-3 font-[var(--font-display)] text-3xl sm:text-4xl font-medium text-[#efe7da]">
              {loadingVideos ? "—" : stats.totalViews.toLocaleString()}
            </p>
            <span className="mt-1 block font-[var(--font-mono)] text-[10px] text-[#8a7d85]">
              Cumulative screenings
            </span>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#120e17]/60 p-5 backdrop-blur-md transition-all hover:border-[#d9a653]/30">
            <div className="flex items-center justify-between text-[#8a7d85]">
              <span className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.2em]">
                Screening Runtime
              </span>
              <Clock size={16} className="text-[#c7923e]" />
            </div>
            <p className="mt-3 font-[var(--font-display)] text-3xl sm:text-4xl font-medium text-[#efe7da]">
              {loadingVideos ? "—" : `${stats.totalRuntimeHours}h`}
            </p>
            <span className="mt-1 block font-[var(--font-mono)] text-[10px] text-[#8a7d85]">
              Footage master cut
            </span>
          </div>
        </section>

        {/* MAIN CONTENT: STUDIO ATELIER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: STATEMENT & ARCHIVAL SPECS */}
          <div className="lg:col-span-4 space-y-6">
            {/* Director Statement / Bio Card */}
            <div className="rounded-3xl border border-white/[0.08] bg-[#120e17]/70 p-6 backdrop-blur-md shadow-xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-[#d9a653]" />
                  <h2 className="font-[var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#d9a653]">
                    Director's Statement
                  </h2>
                </div>

                {!isEditingBio && (
                  <button
                    onClick={() => setIsEditingBio(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-[var(--font-mono)] text-[#8a7d85] hover:text-[#d9a653] transition-colors"
                  >
                    <Edit3 size={12} />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {/* Feedback Alert */}
              {bioFeedback.message && (
                <div
                  className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs ${
                    bioFeedback.type === "success"
                      ? "border border-[#7fc59b]/30 bg-[#7fc59b]/10 text-[#7fc59b]"
                      : "border border-[#e08a6b]/30 bg-[#e08a6b]/10 text-[#e08a6b]"
                  }`}
                >
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{bioFeedback.message}</span>
                </div>
              )}

              {/* Bio Content or Form */}
              <div className="mt-5">
                {isEditingBio ? (
                  <div className="space-y-4">
                    <label className="block text-[10px] font-[var(--font-mono)] uppercase tracking-[0.16em] text-[#8a7d85]">
                      Artistic Manifesto & Philosophy
                    </label>

                    <textarea
                      id="director-bio-textarea"
                      value={bioInput}
                      onChange={(e) => setBioInput(e.target.value)}
                      placeholder="Compose your creative vision, cinematic philosophy, influences, or background in independent cinema..."
                      rows={6}
                      maxLength={1200}
                      className="w-full rounded-2xl border border-[#d9a653]/40 bg-[#09060c] p-4 text-sm leading-relaxed text-[#efe7da] placeholder-[#5a5056] focus:border-[#d9a653] focus:outline-none focus:ring-1 focus:ring-[#d9a653]/40 transition-all font-sans"
                    />

                    <div className="flex items-center justify-between text-[10px] font-[var(--font-mono)] text-[#8a7d85]">
                      <span>{bioInput.length} / 1200 characters</span>
                      <span>Markdown supported</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleCancelBio}
                        disabled={savingBio}
                        className="rounded-xl border border-white/[0.1] px-4 py-2 font-[var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[#8a7d85] hover:border-white/20 hover:text-[#efe7da] transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveBio}
                        disabled={savingBio}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#d9a653] px-4 py-2 font-[var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[#0f0c11] font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {savingBio && <RefreshCw size={12} className="animate-spin" />}
                        <span>{savingBio ? "Archiving..." : "Save Statement"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bio ? (
                      <p className="font-[var(--font-display)] text-lg leading-relaxed text-[#d7cfc5]">
                        "{bio}"
                      </p>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/[0.1] p-6 text-center">
                        <p className="font-[var(--font-display)] text-base italic text-[#8a7d85]">
                          No director's manifesto recorded.
                        </p>
                        <button
                          onClick={() => setIsEditingBio(true)}
                          className="mt-3 inline-flex items-center gap-1.5 font-[var(--font-mono)] text-xs text-[#d9a653] hover:underline"
                        >
                          <Edit3 size={12} />
                          <span>Compose your statement</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Archival Specification Card */}
            <div className="rounded-3xl border border-white/[0.08] bg-[#120e17]/70 p-6 backdrop-blur-md shadow-xl space-y-4">
              <h3 className="font-[var(--font-mono)] text-xs uppercase tracking-[0.2em] text-[#d9a653] border-b border-white/[0.06] pb-3">
                Archival Specifications
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="font-[var(--font-mono)] text-[#8a7d85]">Accreditation</span>
                  <span className="font-medium text-[#efe7da]">Proscenium Fellow</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="font-[var(--font-mono)] text-[#8a7d85]">Primary Engine</span>
                  <span className="font-mono text-[#d9a653]">ESPCN AI 4X Upscaler</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="font-[var(--font-mono)] text-[#8a7d85]">Master Format</span>
                  <span className="font-medium text-[#efe7da]">HLS Adaptive Ladder</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="font-[var(--font-mono)] text-[#8a7d85]">Account Status</span>
                  <span className="inline-flex items-center gap-1.5 text-[#7fc59b]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7fc59b]" />
                    Good Standing
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: COMPACT SCROLLABLE FILMOGRAPHY */}
          <div className="lg:col-span-8">
            <div className="rounded-3xl border border-white/[0.08] bg-[#120e17]/70 p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col">
              {/* STICKY HEADER & FILTERS */}
              <div className="space-y-4 border-b border-white/[0.06] pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-[var(--font-display)] text-xl sm:text-2xl font-medium tracking-tight text-[#efe7da]">
                      Filmography & Works
                    </h2>
                    <p className="font-[var(--font-mono)] text-[10px] text-[#8a7d85] mt-0.5">
                      Showing {filteredVideos.length} of {videos.length} productions
                    </p>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-black/40 p-1 shrink-0">
                    {[
                      { id: "all", label: "All" },
                      { id: "approved", label: "Approved" },
                      { id: "pending", label: "In Review" },
                      { id: "rejected", label: "Revisions" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFilter(tab.id)}
                        className={`rounded-lg px-2.5 py-1 font-[var(--font-mono)] text-[9.5px] uppercase tracking-[0.12em] transition-all ${
                          filter === tab.id
                            ? "bg-[#d9a653] text-[#0f0c11] font-bold shadow"
                            : "text-[#8a7d85] hover:text-[#efe7da]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7d85]"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search catalog by title, genre, or keyword..."
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0c080f] py-2 pl-9 pr-4 text-xs text-[#efe7da] placeholder-[#5a5056] focus:border-[#d9a653]/50 focus:outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7d85] hover:text-[#efe7da]"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* DEDICATED COMPACT SCROLLABLE CONTAINER */}
              <div className="mt-4 max-h-[500px] overflow-y-auto pr-1.5 space-y-2.5 [scrollbar-width:thin] [scrollbar-color:#d9a65330_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-black/20 [&::-webkit-scrollbar-thumb]:bg-[#d9a653]/30 hover:[&::-webkit-scrollbar-thumb]:bg-[#d9a653]/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                {loadingVideos ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="h-16 rounded-xl border border-white/[0.04] bg-white/[0.02] animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredVideos.length > 0 ? (
                  filteredVideos.map((video) => {
                    const videoId = video?._id || video?.id;
                    return (
                      <div
                        key={videoId}
                        className="group relative flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0c0810]/70 p-2.5 sm:p-3 transition-all hover:border-[#d9a653]/40 hover:bg-[#150f1b]/90"
                      >
                        {/* Film Thumbnail & Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-[#1a1420]">
                            {video?.thumbnailUrl ? (
                              <img
                                src={video.thumbnailUrl}
                                alt={video?.title}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#5a5056]">
                                <Film size={18} />
                              </div>
                            )}

                            <span className="absolute bottom-1 right-1 rounded bg-black/85 px-1 py-0.2 font-[var(--font-mono)] text-[8px] text-[#efe7da]">
                              {formatDuration(video?.duration)}
                            </span>
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={video?.moderationStatus} />
                              {video?.genre && (
                                <span className="font-[var(--font-mono)] text-[8.5px] uppercase tracking-[0.12em] text-[#8a7d85] truncate">
                                  {video.genre}
                                </span>
                              )}
                            </div>

                            <h3 className="font-[var(--font-display)] text-sm sm:text-base font-medium text-[#efe7da] group-hover:text-[#d9a653] transition-colors truncate">
                              {video?.title || "Untitled Cinematic Work"}
                            </h3>

                            <div className="flex items-center gap-2 text-[10px] font-[var(--font-mono)] text-[#8a7d85]">
                              <span className="flex items-center gap-1">
                                <Eye size={11} className="text-[#d9a653]" />
                                {(video?.views || 0).toLocaleString()}
                              </span>
                              <span>•</span>
                              <span>{formatDate(video?.uploadedAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Compact Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {video?.moderationStatus === "approved" && (
                            <Link
                              to={`/director/videos/${videoId}/watch`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#d9a653]/30 bg-[#d9a653]/10 px-2.5 py-1.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#f3ce8a] hover:bg-[#d9a653] hover:text-[#0f0c11] transition-all"
                              title="Watch screening"
                            >
                              <Play size={10} />
                              <span className="hidden sm:inline">Screen</span>
                            </Link>
                          )}

                          <Link
                            to={`/director/videos/${videoId}/edit`}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.12em] text-[#efe7da] hover:border-white/25 hover:bg-white/[0.08] transition-all"
                            title="Edit film metadata & cast"
                          >
                            <Edit3 size={10} />
                            <span>Edit</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-white/[0.1] py-10 px-4 text-center">
                    <Film size={28} className="mx-auto text-[#5a5056] mb-2" />
                    <p className="font-[var(--font-display)] text-base text-[#efe7da]">
                      {searchQuery
                        ? "No productions match your query."
                        : "No cinematic productions found in this filter."}
                    </p>
                    <Link
                      to="/director/upload"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#d9a653] px-3.5 py-1.5 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[#0f0c11] font-semibold hover:brightness-110 transition-all"
                    >
                      <Upload size={12} />
                      <span>Upload Production</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}