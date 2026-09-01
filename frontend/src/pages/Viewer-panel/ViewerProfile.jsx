import React, { useEffect, useState } from "react";

import ViewerNav from "../../components/ViewerNav.jsx";
import { getRequest, postForm, putJson } from "../../api/client.js";

const GENRES = [
  "Drama",
  "Comedy",
  "Thriller",
  "Romance",
  "Horror",
  "Documentary",
  "Action",
  "Animation",
  "Sci-Fi",
  "Fantasy",
  "Adventure",
  "Crime",
];

export default function ViewerProfile() {
  const [form, setForm] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadProfile() {
    try {
      const data = await getRequest("/viewer/profile");

      setForm(data);
      setPreview(data.avatarUrl || null);
    } catch (err) {
      setError(err.message || "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleGenre(genre) {
    setForm((current) => {
      const genres = current.genrePreferences || [];

      return {
        ...current,
        genrePreferences: genres.includes(genre)
          ? genres.filter((item) => item !== genre)
          : [...genres, genre],
      };
    });
  }

  function handleAvatarChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    setFile(selectedFile);

    if (selectedFile) {
      setPreview(URL.createObjectURL(selectedFile));
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const data = await putJson("/viewer/profile", {
        username: form.username,
        email: form.email,
        bio: form.bio,
        genrePreferences: form.genrePreferences || [],
        maturitySetting: form.maturitySetting,
      });

      setForm(data);
      setSuccess("Profile saved.");

      if (file) {
        const formData = new FormData();
        formData.append("avatar", file);

        const avatar = await postForm(
          "/viewer/profile/avatar",
          formData
        );

        setForm((current) => ({
          ...current,
          avatarUrl: avatar.avatarUrl,
        }));

        setPreview(avatar.avatarUrl);
        setFile(null);
      }
    } catch (err) {
      setError(err.message || "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-(--stage) p-10 text-(--mauve)">
        Loading profile…
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-(--stage) p-10 text-(--error)">
        {error || "Profile unavailable"}
      </div>
    );
  }

  const genres = form.genrePreferences || [];

  return (
    <div className="min-h-screen bg-(--stage) text-(--parchment)">
      <ViewerNav />

      <main className="mx-auto max-w-3xl px-5 py-10 lg:px-8">
        <p className="font-(--font-mono) text-[0.62rem] uppercase tracking-[0.14em] text-(--gold)">
          Your account
        </p>

        <h1 className="mb-8 font-(--font-display) text-4xl">
          Profile
        </h1>

        {error && (
          <div className="mb-4 border border-(--error)/40 px-4 py-3 text-sm text-(--error)">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 border border-(--gold)/35 px-4 py-3 text-sm text-(--gold-soft)">
            {success}
          </div>
        )}

        <form
          onSubmit={saveProfile}
          className="space-y-6 rounded-[3px] border border-white/10 bg-[#17131a] p-6"
        >
          {/* Avatar */}

          <div className="flex flex-wrap items-center gap-5">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-(--velvet)">
              {preview && (
                <img
                  src={preview}
                  alt="Profile avatar"
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div>
              <p className="font-(--font-mono) text-[0.6rem] uppercase text-(--mauve)">
                Viewer ID
              </p>

              <p className="mt-1 font-(--font-mono) text-sm text-(--gold-soft)">
                {form.viewerId}
              </p>

              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="mt-3 block max-w-full text-xs text-(--mauve)"
              />
            </div>
          </div>

          {/* Username and Email */}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm">
              Username

              <input
                type="text"
                value={form.username || ""}
                onChange={(event) =>
                  updateField("username", event.target.value)
                }
                className="
                  mt-2
                  w-full
                  border
                  border-white/10
                  bg-transparent
                  px-3
                  py-3
                  text-(--parchment)
                  outline-none
                  transition-colors
                  focus:border-(--gold)
                "
              />
            </label>

            <label className="text-sm">
              Email

              <input
                type="email"
                value={form.email || ""}
                onChange={(event) =>
                  updateField("email", event.target.value)
                }
                className="
                  mt-2
                  w-full
                  border
                  border-white/10
                  bg-transparent
                  px-3
                  py-3
                  text-(--parchment)
                  outline-none
                  transition-colors
                  focus:border-(--gold)
                "
              />
            </label>
          </div>

          {/* Bio */}

          <label className="block text-sm">
            Bio

            <textarea
              maxLength={1000}
              rows={4}
              value={form.bio || ""}
              onChange={(event) =>
                updateField("bio", event.target.value)
              }
              className="
                mt-2
                w-full
                resize-y
                border
                border-white/10
                bg-transparent
                px-3
                py-3
                text-(--parchment)
                outline-none
                transition-colors
                focus:border-(--gold)
              "
            />
          </label>

          {/* Genre Preferences */}

          <div>
            <p className="mb-3 text-sm">
              Genre preferences
            </p>

            <div className="flex flex-wrap gap-2">
              {GENRES.map((genre) => {
                const selected = genres.includes(genre);

                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`
                      rounded-full
                      border
                      px-3
                      py-1.5
                      text-xs
                      transition-colors
                      duration-200
                      ${
                        selected
                          ? "border-(--gold) bg-(--velvet) text-(--gold-soft)"
                          : "border-white/10 text-(--mauve) hover:border-(--gold) hover:text-(--parchment)"
                      }
                    `}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Maturity Setting */}

          <label className="block text-sm">
            Maturity setting

            <select
              value={form.maturitySetting || "all"}
              onChange={(event) =>
                updateField("maturitySetting", event.target.value)
              }
              className="
                mt-2
                w-full
                border
                border-white/10
                bg-[#17131a]
                px-3
                py-3
                text-(--parchment)
                outline-none
                transition-colors
                focus:border-(--gold)
              "
            >
              <option value="all">All audiences</option>
              <option value="mature">
                Include mature content
              </option>
            </select>
          </label>

          {/* Save */}

          <button
            type="submit"
            disabled={saving}
            className="
              w-full
              rounded-[3px]
              bg-(--gold)
              px-4
              py-3
              font-(--font-mono)
              text-[0.65rem]
              uppercase
              tracking-[0.08em]
              text-(--stage)
              transition-opacity
              hover:opacity-90
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </main>
    </div>
  );
}