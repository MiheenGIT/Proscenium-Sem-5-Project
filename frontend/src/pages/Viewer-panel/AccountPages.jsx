import React, {useEffect,useState,} from "react";
import { useNavigate } from "react-router-dom";
import {Check,Languages,Save,Star,} from "lucide-react";

import {getRequest,patchJson,putJson,postJson,} from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import {EmptyState,ErrorState,PageLoading,} from "../../components/common/States.jsx";

const genres = [
  "Action",
  "Drama",
  "Comedy",
  "Horror",
  "Thriller",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Documentary",
  "Animation",
  "Crime",
  "Fantasy",
];

export function Preferences({
  type = "genres",
}) {
  const [profile, setProfile] =
    useState(null);

  const [selected, setSelected] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const options =
    type === "genres"
      ? genres
      : [
          "English",
          "Hindi",
          "Spanish",
          "French",
          "German",
          "Japanese",
          "Korean",
          "Tamil",
          "Telugu",
          "Bengali",
          "Marathi",
        ];

  useEffect(() => {
    getRequest("/viewer/profile")
      .then((profileData) => {
        setProfile(profileData);

        setSelected(
          type === "genres"
            ? profileData.genrePreferences ||
                []
            : profileData.languagePreferences ||
                []
        );
      })
      .catch((err) =>
        setError(err.message)
      )
      .finally(() =>
        setLoading(false)
      );
  }, [type]);

  async function save() {
    try {
      const body =
        type === "genres"
          ? {
              genrePreferences:
                selected,
            }
          : {
              languagePreferences:
                selected,
            };

      const updated =
        await putJson(
          "/viewer/profile",
          body
        );

      setProfile(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-4xl px-5 py-10 lg:px-8">
        <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">
          Personalize
        </p>

        <h1 className="mt-2 font-[var(--font-display)] text-4xl text-[#efe7da]">
          {type === "genres"
            ? "Genre Preferences"
            : "Language Preferences"}
        </h1>

        <p className="mt-2 max-w-xl text-sm text-[#8f8388]">
          Choose what you love. These
          preferences are saved to your
          viewer account and used by the
          recommendation shelf.
        </p>

        {error && (
          <div className="mt-5">
            <ErrorState
              message={error}
            />
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="col-span-full mb-2 flex items-center gap-2 text-xs text-[#a89ca0]">
            {type === "genres" ? (
              <Star
                size={15}
                className="text-[#d9a653]"
              />
            ) : (
              <Languages
                size={15}
                className="text-[#d9a653]"
              />
            )}

            {selected.length} selected
          </div>

          {options.map((option) => {
            const active =
              selected.some(
                (value) =>
                  value.toLowerCase() ===
                  option.toLowerCase()
              );

            return (
              <button
                key={option}
                onClick={() =>
                  setSelected(
                    (current) =>
                      active
                        ? current.filter(
                            (value) =>
                              value.toLowerCase() !==
                              option.toLowerCase()
                          )
                        : [
                            ...current,
                            option,
                          ]
                  )
                }
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-xs transition ${
                  active
                    ? "border-[#d9a653]/50 bg-[#5c1220] text-[#e6c184]"
                    : "border-white/[0.07] bg-white/[0.025] text-[#a79b9f] hover:border-white/15 hover:text-[#efe7da]"
                }`}
              >
                {option}

                {active && (
                  <Check size={14} />
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={save}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#d9a653] px-5 py-3 text-xs font-bold text-[#100d10]"
        >
          <Save size={14} />
          Save preferences
        </button>
      </main>
    </DashboardLayout>
  );
}

export function SettingsPage() {
  const [settings, setSettings] =
    useState(null);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    getRequest("/viewer/settings")
      .then(setSettings)
      .catch((err) =>
        setMessage(err.message)
      );
  }, []);

  async function save() {
    setSaving(true);

    try {
      const updated =
        await putJson(
          "/viewer/settings",
          settings
        );

      setSettings(updated);
      setMessage("Settings saved");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <DashboardLayout>
        <PageLoading />
      </DashboardLayout>
    );
  }

  function Toggle({
    name,
    label,
    help,
  }) {
    return (
      <button
        onClick={() =>
          setSettings((current) => ({
            ...current,
            [name]: !current[name],
          }))
        }
        className="flex w-full items-center justify-between gap-5 border-b border-white/[0.06] py-4 text-left last:border-0"
      >
        <span>
          <b className="block text-xs text-[#ddd3d5]">
            {label}
          </b>

          <small className="mt-1 block text-[9px] text-[#756a6f]">
            {help}
          </small>
        </span>

        <span
          className={`h-5 w-9 rounded-full p-0.5 transition ${
            settings[name]
              ? "bg-[#d9a653]"
              : "bg-white/10"
          }`}
        >
          <i
            className={`block h-4 w-4 rounded-full bg-[#100d10] transition ${
              settings[name]
                ? "translate-x-4"
                : "translate-x-0"
            }`}
          />
        </span>
      </button>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-3xl px-5 py-10 lg:px-8">
        <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">
          Account
        </p>

        <h1 className="mt-2 font-[var(--font-display)] text-4xl text-[#efe7da]">
          Settings
        </h1>

        <section className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <h2 className="font-[var(--font-display)] text-xl text-[#efe7da]">
            Playback
          </h2>

          <Toggle
            name="autoplay"
            label="Autoplay"
            help="Start the next available story automatically."
          />

          <Toggle
            name="subtitles"
            label="Subtitles"
            help="Prefer available captions when playback starts."
          />

          <div className="border-b border-white/[0.06] py-4">
            <label className="text-xs text-[#ddd3d5]">
              Default quality

              <select
                value={
                  settings.defaultQuality
                }
                onChange={(event) =>
                  setSettings(
                    (current) => ({
                      ...current,
                      defaultQuality:
                        event.target.value,
                    })
                  )
                }
                className="mt-2 block w-full rounded-xl border border-white/10 bg-[#171216] px-3 py-3 text-xs text-[#cfc4c7] outline-none"
              >
                <option value="auto">
                  Auto
                </option>

                <option value="1080">
                  1080p
                </option>

                <option value="720">
                  720p
                </option>

                <option value="480">
                  480p
                </option>

                <option value="360">
                  360p
                </option>
              </select>
            </label>
          </div>

          <Toggle
            name="saveHistory"
            label="Save viewing history"
            help="Keep playback progress and history synchronized to your account."
          />
        </section>

        <section className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <h2 className="font-[var(--font-display)] text-xl text-[#efe7da]">
            Notifications
          </h2>

          <Toggle
            name="emailNotifications"
            label="Email notifications"
            help="Allow account emails where supported."
          />

          <Toggle
            name="newReleaseNotifications"
            label="New releases"
            help="Notify you when a director's film is approved and published."
          />

          <Toggle
            name="recommendationNotifications"
            label="Recommendations"
            help="Allow recommendation updates where supported."
          />
        </section>

        {message && (
          <p className="mt-4 text-xs text-[#d9a653]">
            {message}
          </p>
        )}

        <button
          disabled={saving}
          onClick={save}
          className="mt-5 rounded-xl bg-[#d9a653] px-5 py-3 text-xs font-bold text-[#100d10]"
        >
          {saving
            ? "Saving…"
            : "Save settings"}
        </button>
      </main>
    </DashboardLayout>
  );
}

export function Help() {
  return (
    <DashboardLayout>
      <main className="mx-auto max-w-3xl px-5 py-12 lg:px-8">
        <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">
          Support
        </p>

        <h1 className="mt-2 font-[var(--font-display)] text-4xl text-[#efe7da]">
          Help & Support
        </h1>

        <div className="mt-8 space-y-3">
          {[
            [
              "Playback",
              "If a stream fails, refresh the film and try again. Playback position is persisted server-side.",
            ],
            [
              "Watchlist",
              "Use the bookmark control on any film to save or remove it from your cinema.",
            ],
            [
              "Account",
              "Your profile and preferences belong to your authenticated viewer account.",
            ],
          ].map(([heading, text]) => (
            <details
              key={heading}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"
            >
              <summary className="cursor-pointer text-sm font-semibold text-[#efe7da]">
                {heading}
              </summary>

              <p className="mt-3 text-xs leading-6 text-[#93878c]">
                {text}
              </p>
            </details>
          ))}
        </div>
      </main>
    </DashboardLayout>
  );
}

export function Notifications() {
  const navigate = useNavigate();

  const [rows, setRows] =
    useState([]);

  const [unread, setUnread] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function load() {
    try {
      const data =
        await getRequest(
          "/viewer/notifications"
        );

      setRows(
        data.notifications || []
      );

      setUnread(
        data.unread || 0
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(
    id,
    videoId
  ) {
    try {
      await patchJson(
        `/viewer/notifications/${id}/read`,
        {}
      );
    } catch {
      // Keep UI responsive even if the
      // notification request fails.
    }

    setRows((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              read: true,
            }
          : item
      )
    );

    setUnread((value) =>
      Math.max(0, value - 1)
    );

    if (videoId) {
      navigate(
        `/viewer/videos/${videoId}`
      );
    }
  }

  async function markAllRead() {
    try {
      await postJson(
        "/viewer/notifications/read-all",
        {}
      );

      setRows((current) =>
        current.map((item) => ({
          ...item,
          read: true,
        }))
      );

      setUnread(0);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoading />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-3xl px-5 py-10 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">
              Updates
            </p>

            <h1 className="mt-2 font-[var(--font-display)] text-4xl text-[#efe7da]">
              Notifications
            </h1>
          </div>

          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-[9px] uppercase tracking-[.15em] text-[#d9a653]"
            >
              Mark all read
            </button>
          )}
        </div>

        {error && (
          <p className="mt-4 text-xs text-[#e08a6b]">
            {error}
          </p>
        )}

        {!rows.length ? (
          <div className="mt-8">
            <EmptyState
              title="You're all caught up"
              message="New Proscenium releases will appear here when they are published."
            />
          </div>
        ) : (
          <div className="mt-7 space-y-2">
            {rows.map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  markRead(
                    item.id,
                    item.videoId
                  )
                }
                className={`flex w-full gap-3 rounded-2xl border p-4 text-left ${
                  item.read
                    ? "border-white/[0.06] bg-white/[0.02]"
                    : "border-[#d9a653]/20 bg-[#5c1220]/25"
                }`}
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    item.read
                      ? "bg-white/15"
                      : "bg-[#d9a653]"
                  }`}
                />

                <span>
                  <b className="block text-xs text-[#efe7da]">
                    {item.title}
                  </b>

                  <p className="mt-1 text-[10px] leading-5 text-[#93878c]">
                    {item.message}
                  </p>

                  <small className="mt-2 block text-[8px] text-[#6f6468]">
                    {item.createdAt &&
                      new Date(
                        item.createdAt
                      ).toLocaleString()}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}

export default function AccountPages({
  section = "settings",
}) {
  if (section === "genres") {
    return (
      <Preferences type="genres" />
    );
  }

  if (section === "languages") {
    return (
      <Preferences type="languages" />
    );
  }

  if (section === "notifications") {
    return <Notifications />;
  }

  if (section === "help") {
    return <Help />;
  }

  return <SettingsPage />;
}