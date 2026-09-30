import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  HelpCircle,
  Languages,
  LogOut,
  Mail,
  MessageSquare,
  Pencil,
  Save,
  Settings,
  Sparkles,
  Star,
  UserRound,
  Watch,
} from "lucide-react";

import {
  getRequest,
  postForm,
  putJson,
} from "../../api/client.js";

import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import { PageLoading } from "../../components/common/States.jsx";
import { Avatar } from "../../components/Dashboard/Sidebar.jsx";


const activityItems = [
  {
    key: "liked",
    title: "Liked Videos",
    label: "My Activity",
    description: "Films you have liked",
    icon: Heart,
    path: "/liked",
  },
  {
    key: "reviews",
    title: "My Reviews",
    label: "My Activity",
    description: "Ratings and reviews you wrote",
    icon: MessageSquare,
    path: "/reviews",
  },
  {
    key: "watchlist",
    title: "Watchlist",
    label: "My Library",
    description: "Films saved for later",
    icon: Watch,
    path: "/watchlist",
  },
  {
    key: "history",
    title: "Watch History",
    label: "My Activity",
    description: "Everything you have watched",
    icon: Clock3,
    path: "/history",
  },
];


const accountItems = [
  {
    title: "Genre Preferences",
    description: "Manage the genres used for recommendations",
    icon: Sparkles,
    path: "/preferences/genres",
  },
  {
    title: "Language Preferences",
    description: "Choose the languages you enjoy watching",
    icon: Languages,
    path: "/preferences/languages",
  },
  {
    title: "Notifications",
    description: "Manage your viewing updates",
    icon: Mail,
    path: "/notifications",
  },
  {
    title: "Settings",
    description: "Playback and account preferences",
    icon: Settings,
    path: "/settings",
  },
  {
    title: "Help & Support",
    description: "Get help with your Proscenium account",
    icon: HelpCircle,
    path: "/help",
  },
];


function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


function getInitials(name) {
  const value = String(name || "Viewer").trim();

  if (!value) {
    return "V";
  }

  const parts = value.split(/\s+/);

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}


function StatCard({
  icon: Icon,
  label,
  value,
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group
        min-w-0
        rounded-2xl
        border border-white/[0.07]
        bg-white/[0.025]
        p-4
        text-left
        transition
        duration-200
        hover:-translate-y-0.5
        hover:border-[#d9a653]/25
        hover:bg-white/[0.04]
      "
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="
            grid
            h-9
            w-9
            shrink-0
            place-items-center
            rounded-xl
            border border-[#d9a653]/15
            bg-[#5c1220]/35
            text-[#d9a653]
          "
        >
          <Icon size={16} strokeWidth={1.7} />
        </span>

        <ChevronRight
          size={14}
          className="
            mt-1
            text-[#5f565b]
            transition
            group-hover:translate-x-0.5
            group-hover:text-[#d9a653]
          "
        />
      </div>

      <span className="mt-4 block text-[9px] font-semibold uppercase tracking-[0.15em] text-[#756a6f]">
        {label}
      </span>

      <strong className="mt-1 block truncate font-[var(--font-display)] text-xl text-[#efe7da]">
        {value}
      </strong>

      <span className="mt-1 block truncate text-[10px] leading-4 text-[#756a6f]">
        {description}
      </span>
    </button>
  );
}


function ActionRow({
  icon: Icon,
  title,
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group
        flex
        w-full
        items-center
        gap-3
        rounded-xl
        border border-transparent
        px-3
        py-3
        text-left
        transition
        hover:border-white/[0.06]
        hover:bg-white/[0.035]
      "
    >
      <span
        className="
          grid
          h-9
          w-9
          shrink-0
          place-items-center
          rounded-xl
          border border-white/[0.07]
          bg-white/[0.025]
          text-[#d9a653]
        "
      >
        <Icon size={15} strokeWidth={1.7} />
      </span>

      <span className="min-w-0 flex-1">
        <strong className="block text-xs font-semibold text-[#ddd4d4] group-hover:text-[#efe7da]">
          {title}
        </strong>

        <span className="mt-0.5 block truncate text-[10px] leading-4 text-[#756a6f]">
          {description}
        </span>
      </span>

      <ChevronRight
        size={14}
        className="
          shrink-0
          text-[#5f565b]
          transition
          group-hover:translate-x-0.5
          group-hover:text-[#d9a653]
        "
      />
    </button>
  );
}


export default function ViewerProfilePro() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [profile, setProfile] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");

  const [stats, setStats] = useState({
    liked: 0,
    reviews: 0,
    watchlist: 0,
    history: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");


  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const profileData = await getRequest("/viewer/profile");

      setProfile(profileData);
      setName(profileData.username || "");
      setEmail(profileData.email || "");
      setBio(profileData.bio || "");

      /*
       * These are independent requests.
       * If one activity endpoint fails, the profile itself
       * still remains usable.
       */
      const results = await Promise.allSettled([
        getRequest("/viewer/liked"),
        getRequest("/viewer/reviews"),
        getRequest("/viewer/watchlist"),
        getRequest("/viewer/history?limit=100"),
      ]);

      setStats({
        liked:
          results[0].status === "fulfilled"
            ? Number(results[0].value?.count || 0)
            : 0,

        reviews:
          results[1].status === "fulfilled"
            ? Number(results[1].value?.count || 0)
            : 0,

        watchlist:
          results[2].status === "fulfilled"
            ? Number(results[2].value?.count || 0)
            : 0,

        history:
          results[3].status === "fulfilled"
            ? Number(results[3].value?.count || 0)
            : 0,
      });
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load your profile."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadProfile();
  }, []);


  async function saveProfile() {
    if (!name.trim()) {
      setError("Username cannot be empty.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const updated = await putJson(
        "/viewer/profile",
        {
          username: name.trim(),
          email: email.trim(),
          bio: bio.trim(),
        }
      );

      setProfile(updated);

      setName(updated.username || "");
      setEmail(updated.email || "");
      setBio(updated.bio || "");

      setEditing(false);
      setMessage("Profile updated successfully.");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to update your profile."
      );
    } finally {
      setSaving(false);
    }
  }


  async function uploadAvatar(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingAvatar(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();

      formData.append(
        "avatar",
        file
      );

      const result = await postForm(
        "/viewer/profile/avatar",
        formData
      );

      setProfile((current) => ({
        ...current,
        avatarUrl: result.avatarUrl,
      }));

      setMessage("Profile photo updated.");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to update your profile photo."
      );
    } finally {
      setUploadingAvatar(false);

      /*
       * Allows selecting the same file again later.
       */
      event.target.value = "";
    }
  }


  async function signOut() {
    await Promise.resolve(
      logout?.()
    );

    navigate("/login", {
      replace: true,
    });
  }


  const username =
    profile?.username ||
    "Viewer";


  const viewerId =
    profile?.viewerId ||
    profile?.id ||
    "—";


  const memberSince =
    formatDate(profile?.createdAt);


  const tasteCount = useMemo(() => {
    return (
      (profile?.genrePreferences?.length || 0) +
      (profile?.languagePreferences?.length || 0)
    );
  }, [profile]);


  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading />
      </DashboardLayout>
    );
  }


  if (!profile) {
    return (
      <DashboardLayout>
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-300/10 bg-red-300/[0.04] p-5">
            <p className="text-sm text-[#e08a6b]">
              {error || "Unable to load your profile."}
            </p>

            <button
              type="button"
              onClick={loadProfile}
              className="
                mt-4
                rounded-lg
                border border-white/10
                px-3
                py-2
                text-xs
                text-[#d9d0d1]
                transition
                hover:bg-white/[0.05]
              "
            >
              Try again
            </button>
          </div>
        </main>
      </DashboardLayout>
    );
  }


  return (
    <DashboardLayout>
      <main
        className="
          mx-auto
          w-full
          max-w-6xl
          px-4
          py-7
          sm:px-6
          sm:py-9
          lg:px-8
        "
      >

        {/* =====================================================
            PROFILE HERO
            ===================================================== */}

        <section
          className="
            relative
            overflow-hidden
            rounded-3xl
            border border-white/[0.07]
            bg-[#141114]
          "
        >
          {/* subtle cinematic background */}
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              bg-[radial-gradient(circle_at_15%_20%,rgba(92,18,32,.48),transparent_38%),radial-gradient(circle_at_85%_15%,rgba(217,166,83,.08),transparent_32%)]
            "
          />

          <div className="relative p-5 sm:p-7 lg:p-8">

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex min-w-0 items-center gap-4 sm:gap-6">

                {/* Avatar */}

                <div className="relative shrink-0">

                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt=""
                      className="
                        h-24
                        w-24
                        rounded-full
                        border
                        border-white/10
                        object-cover
                        shadow-2xl
                        shadow-black/40
                        sm:h-28
                        sm:w-28
                      "
                    />
                  ) : (
                    <div
                      className="
                        grid
                        h-24
                        w-24
                        place-items-center
                        rounded-full
                        border border-[#d9a653]/20
                        bg-[#5c1220]
                        font-[var(--font-display)]
                        text-3xl
                        text-[#d9a653]
                        shadow-2xl
                        shadow-black/40
                        sm:h-28
                        sm:w-28
                        sm:text-4xl
                      "
                    >
                      {getInitials(username)}
                    </div>
                  )}

                  <label
                    className="
                      absolute
                      bottom-0
                      right-0
                      grid
                      h-8
                      w-8
                      cursor-pointer
                      place-items-center
                      rounded-full
                      border
                      border-[#141114]
                      bg-[#d9a653]
                      text-[#100d10]
                      shadow-lg
                      transition
                      hover:scale-105
                    "
                    title="Change profile photo"
                  >
                    {uploadingAvatar ? (
                      <span
                        className="
                          h-3.5
                          w-3.5
                          animate-spin
                          rounded-full
                          border-2
                          border-[#100d10]/30
                          border-t-[#100d10]
                        "
                      />
                    ) : (
                      <Camera size={14} />
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={uploadAvatar}
                      className="hidden"
                      disabled={uploadingAvatar}
                    />
                  </label>
                </div>


                {/* Identity */}

                <div className="min-w-0">

                  <div className="flex items-center gap-2">
                    <span
                      className="
                        text-[9px]
                        font-semibold
                        uppercase
                        tracking-[0.22em]
                        text-[#d9a653]
                      "
                    >
                      Your Proscenium
                    </span>

                    <span
                      className="
                        rounded-full
                        border
                        border-[#d9a653]/15
                        bg-[#d9a653]/[0.06]
                        px-2
                        py-0.5
                        text-[8px]
                        font-semibold
                        uppercase
                        tracking-[0.12em]
                        text-[#d9bd88]
                      "
                    >
                      Viewer
                    </span>
                  </div>

                  <h1
                    className="
                      mt-2
                      truncate
                      font-[var(--font-display)]
                      text-3xl
                      text-[#efe7da]
                      sm:text-4xl
                    "
                  >
                    {username}
                  </h1>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#8f8388]">
                    <span>
                      Viewer ID:{" "}
                      <span className="text-[#b7abad]">
                        {viewerId}
                      </span>
                    </span>

                    <span className="hidden sm:inline text-[#4e474b]">
                      •
                    </span>

                    <span>
                      Member since {memberSince}
                    </span>
                  </div>

                  {profile.bio && (
                    <p
                      className="
                        mt-3
                        max-w-2xl
                        text-xs
                        leading-5
                        text-[#91858a]
                      "
                    >
                      {profile.bio}
                    </p>
                  )}
                </div>
              </div>


              {/* Edit button */}

              <button
                type="button"
                onClick={() => {
                  setEditing((current) => !current);
                  setError("");
                  setMessage("");
                }}
                className="
                  inline-flex
                  h-9
                  shrink-0
                  items-center
                  justify-center
                  gap-2
                  rounded-lg
                  border border-white/10
                  bg-white/[0.025]
                  px-3.5
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.08em]
                  text-[#b7abad]
                  transition
                  hover:border-[#d9a653]/25
                  hover:text-[#efe7da]
                "
              >
                <Pencil size={13} />

                {editing
                  ? "Close editor"
                  : "Edit profile"}
              </button>
            </div>


            {/* Edit form */}

            {editing && (
              <div
                className="
                  mt-7
                  border-t
                  border-white/[0.07]
                  pt-6
                "
              >
                <div className="grid gap-4 sm:grid-cols-2">

                  <label className="text-[10px] text-[#91858a]">
                    Username

                    <input
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      maxLength={30}
                      className="
                        mt-2
                        w-full
                        rounded-xl
                        border border-white/10
                        bg-black/20
                        px-3
                        py-3
                        text-xs
                        text-[#efe7da]
                        outline-none
                        transition
                        focus:border-[#d9a653]/40
                      "
                    />
                  </label>


                  <label className="text-[10px] text-[#91858a]">
                    Email

                    <input
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      className="
                        mt-2
                        w-full
                        rounded-xl
                        border border-white/10
                        bg-black/20
                        px-3
                        py-3
                        text-xs
                        text-[#efe7da]
                        outline-none
                        transition
                        focus:border-[#d9a653]/40
                      "
                    />
                  </label>


                  <label className="text-[10px] text-[#91858a] sm:col-span-2">
                    Bio

                    <textarea
                      value={bio}
                      onChange={(event) =>
                        setBio(event.target.value)
                      }
                      maxLength={1000}
                      rows={4}
                      placeholder="Tell us a little about yourself..."
                      className="
                        mt-2
                        w-full
                        resize-none
                        rounded-xl
                        border border-white/10
                        bg-black/20
                        px-3
                        py-3
                        text-xs
                        leading-5
                        text-[#efe7da]
                        outline-none
                        transition
                        focus:border-[#d9a653]/40
                      "
                    />

                    <span className="mt-1 block text-right text-[8px] text-[#5f565b]">
                      {bio.length}/1000
                    </span>
                  </label>
                </div>


                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div className="min-h-5">
                    {error && (
                      <span className="text-xs text-[#e08a6b]">
                        {error}
                      </span>
                    )}

                    {!error && message && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#d9a653]">
                        <Check size={13} />
                        {message}
                      </span>
                    )}
                  </div>


                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveProfile}
                    className="
                      inline-flex
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-[#d9a653]
                      px-5
                      py-3
                      text-xs
                      font-bold
                      text-[#100d10]
                      transition
                      hover:bg-[#e2b56b]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    <Save size={14} />

                    {saving
                      ? "Saving…"
                      : "Save profile"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>


        {/* Error / success */}

        {!editing && (
          <div className="mt-4 min-h-5">
            {error && (
              <p className="text-xs text-[#e08a6b]">
                {error}
              </p>
            )}

            {!error && message && (
              <p className="inline-flex items-center gap-1.5 text-xs text-[#d9a653]">
                <Check size={13} />
                {message}
              </p>
            )}
          </div>
        )}


        {/* =====================================================
            ACTIVITY OVERVIEW
            ===================================================== */}

        <section className="mt-5">

          <div className="mb-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#d9a653]">
              Your library
            </p>

            <h2 className="mt-1 font-[var(--font-display)] text-2xl text-[#efe7da]">
              Your activity
            </h2>

            <p className="mt-1 text-xs text-[#756a6f]">
              Everything you save, like, review and watch.
            </p>
          </div>


          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <StatCard
              icon={Heart}
              label="Liked"
              value={stats.liked}
              description="Films you enjoyed"
              onClick={() =>
                navigate("/liked")
              }
            />

            <StatCard
              icon={MessageSquare}
              label="Reviews"
              value={stats.reviews}
              description="Your ratings and reviews"
              onClick={() =>
                navigate("/reviews")
              }
            />

            <StatCard
              icon={Watch}
              label="Watchlist"
              value={stats.watchlist}
              description="Saved for later"
              onClick={() =>
                navigate("/watchlist")
              }
            />

            <StatCard
              icon={Clock3}
              label="History"
              value={stats.history}
              description="Your viewing history"
              onClick={() =>
                navigate("/history")
              }
            />

          </div>
        </section>


        {/* =====================================================
            TWO-COLUMN LOWER AREA
            ===================================================== */}

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">


          {/* Preferences / Taste */}

          <section
            className="
              rounded-2xl
              border border-white/[0.07]
              bg-white/[0.025]
              p-5
            "
          >

            <div className="flex items-start justify-between gap-4">

              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#d9a653]">
                  Personalization
                </p>

                <h2 className="mt-1 font-[var(--font-display)] text-2xl text-[#efe7da]">
                  Your taste
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#756a6f]">
                  Your preferences help shape the films recommended to you.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate("/preferences/genres")
                }
                className="
                  shrink-0
                  rounded-lg
                  border border-white/10
                  px-2.5
                  py-2
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.08em]
                  text-[#91858a]
                  transition
                  hover:border-[#d9a653]/25
                  hover:text-[#d9a653]
                "
              >
                Edit
              </button>

            </div>


            <div className="mt-5">

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#756a6f]">
                    Genres
                  </span>

                  <span className="text-[9px] text-[#5f565b]">
                    {profile.genrePreferences?.length || 0}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {(profile.genrePreferences || []).map(
                    (genre) => (
                      <span
                        key={genre}
                        className="
                          rounded-full
                          border border-[#d9a653]/15
                          bg-[#5c1220]/35
                          px-3
                          py-1.5
                          text-[9px]
                          text-[#d9bd88]
                        "
                      >
                        {genre}
                      </span>
                    )
                  )}

                  {!profile.genrePreferences?.length && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/preferences/genres")
                      }
                      className="
                        text-xs
                        text-[#756a6f]
                        underline
                        decoration-white/10
                        underline-offset-4
                        hover:text-[#d9a653]
                      "
                    >
                      Add your favourite genres
                    </button>
                  )}
                </div>
              </div>


              <div className="mt-5 border-t border-white/[0.06] pt-5">

                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#756a6f]">
                    Languages
                  </span>

                  <span className="text-[9px] text-[#5f565b]">
                    {profile.languagePreferences?.length || 0}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {(profile.languagePreferences || []).map(
                    (language) => (
                      <span
                        key={language}
                        className="
                          rounded-full
                          border border-white/[0.08]
                          bg-white/[0.025]
                          px-3
                          py-1.5
                          text-[9px]
                          text-[#aaa0a4]
                        "
                      >
                        {language}
                      </span>
                    )
                  )}

                  {!profile.languagePreferences?.length && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/preferences/languages")
                      }
                      className="
                        text-xs
                        text-[#756a6f]
                        underline
                        decoration-white/10
                        underline-offset-4
                        hover:text-[#d9a653]
                      "
                    >
                      Add preferred languages
                    </button>
                  )}
                </div>
              </div>

            </div>


            <div className="mt-5 flex items-center gap-2 text-[9px] text-[#5f565b]">
              <Sparkles size={12} className="text-[#d9a653]" />

              {tasteCount > 0
                ? `${tasteCount} preference${
                    tasteCount === 1 ? "" : "s"
                  } saved`
                : "No preferences selected yet"}
            </div>

          </section>


          {/* Account information */}

          <section
            className="
              rounded-2xl
              border border-white/[0.07]
              bg-white/[0.025]
              p-5
            "
          >

            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#d9a653]">
                Account
              </p>

              <h2 className="mt-1 font-[var(--font-display)] text-2xl text-[#efe7da]">
                Account details
              </h2>
            </div>


            <div className="mt-5 space-y-1">

              <div className="flex items-center gap-3 rounded-xl px-3 py-3">
                <UserRound
                  size={15}
                  className="shrink-0 text-[#d9a653]"
                />

                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[#5f565b]">
                    Viewer ID
                  </p>

                  <p className="mt-0.5 truncate text-xs text-[#b7abad]">
                    {viewerId}
                  </p>
                </div>
              </div>


              <div className="flex items-center gap-3 rounded-xl px-3 py-3">
                <Mail
                  size={15}
                  className="shrink-0 text-[#d9a653]"
                />

                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[#5f565b]">
                    Email
                  </p>

                  <p className="mt-0.5 truncate text-xs text-[#b7abad]">
                    {profile.email || "—"}
                  </p>
                </div>
              </div>


              <div className="flex items-center gap-3 rounded-xl px-3 py-3">
                <Star
                  size={15}
                  className="shrink-0 text-[#d9a653]"
                />

                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[#5f565b]">
                    Account role
                  </p>

                  <p className="mt-0.5 text-xs capitalize text-[#b7abad]">
                    {profile.role || "viewer"}
                  </p>
                </div>
              </div>


              <div className="flex items-center gap-3 rounded-xl px-3 py-3">
                <Clock3
                  size={15}
                  className="shrink-0 text-[#d9a653]"
                />

                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-[#5f565b]">
                    Member since
                  </p>

                  <p className="mt-0.5 text-xs text-[#b7abad]">
                    {memberSince}
                  </p>
                </div>
              </div>

            </div>

          </section>

        </div>


        {/* =====================================================
            ACCOUNT SHORTCUTS
            ===================================================== */}

        <section className="mt-5">

          <div className="mb-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#d9a653]">
              Manage
            </p>

            <h2 className="mt-1 font-[var(--font-display)] text-2xl text-[#efe7da]">
              Account & preferences
            </h2>
          </div>


          <div
            className="
              rounded-2xl
              border border-white/[0.07]
              bg-white/[0.025]
              p-2
            "
          >
            <div className="grid gap-1 sm:grid-cols-2">

              {accountItems.map(
                ({
                  title,
                  description,
                  icon: Icon,
                  path,
                }) => (
                  <ActionRow
                    key={path}
                    icon={Icon}
                    title={title}
                    description={description}
                    onClick={() =>
                      navigate(path)
                    }
                  />
                )
              )}

            </div>
          </div>
        </section>


        {/* =====================================================
            LOGOUT
            ===================================================== */}

        <section
          className="
            mt-5
            flex
            flex-col
            gap-3
            rounded-2xl
            border border-[#e08a6b]/10
            bg-[#e08a6b]/[0.025]
            p-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <div className="flex items-center gap-3">

            <span
              className="
                grid
                h-9
                w-9
                shrink-0
                place-items-center
                rounded-xl
                border border-[#e08a6b]/10
                bg-[#e08a6b]/[0.04]
                text-[#e08a6b]
              "
            >
              <LogOut size={15} />
            </span>

            <div>
              <p className="text-xs font-semibold text-[#c8bfc0]">
                Sign out of Proscenium
              </p>

              <p className="mt-0.5 text-[10px] text-[#756a6f]">
                You can sign back in anytime.
              </p>
            </div>

          </div>


          <button
            type="button"
            onClick={signOut}
            className="
              inline-flex
              h-9
              items-center
              justify-center
              gap-2
              rounded-lg
              border border-[#e08a6b]/20
              px-4
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.08em]
              text-[#e08a6b]
              transition
              hover:bg-[#e08a6b]/10
            "
          >
            <LogOut size={13} />
            Logout
          </button>

        </section>


        {/* Bottom breathing room */}

        <div className="h-4" />

      </main>
    </DashboardLayout>
  );
}