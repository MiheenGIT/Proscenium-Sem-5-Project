import React, { useEffect, useState } from "react";
import {Camera,Heart,Mail,Save,Star,UserRound,} from "lucide-react";
import { getRequest, postForm, putJson,} from "../../api/client.js";
import DashboardLayout from "../../components/Dashboard/DashboardLayout.jsx";
import { Avatar } from "../../components/Dashboard/Sidebar.jsx";
import { PageLoading } from "../../components/common/States.jsx";

export default function ViewerProfilePro() {
  const [p, setP] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const x = await getRequest("/viewer/profile");

    setP(x);
    setName(x.username || "");
    setEmail(x.email || "");
    setBio(x.bio || "");
  }

  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);

  async function save() {
    setSaving(true);

    try {
      const x = await putJson("/viewer/profile", {
        username: name,
        email,
        bio,
      });

      setP(x);
      setMessage("Profile updated");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function avatar(e) {
    const f = e.target.files?.[0];

    if (!f) return;

    const fd = new FormData();
    fd.append("avatar", f);

    try {
      const x = await postForm("/viewer/profile/avatar", fd);

      setP((v) => ({
        ...v,
        avatarUrl: x.avatarUrl,
      }));

      setMessage("Avatar updated");
    } catch (e) {
      setMessage(e.message);
    }
  }

  if (!p) {
    return (
      <DashboardLayout>
        <PageLoading />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
        <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-br from-[#5c1220]/40 to-white/[0.025] p-6 sm:p-8">
          <div className="flex flex-col gap-7 sm:flex-row sm:items-center">
            <div className="relative w-fit">
              <Avatar src={p.avatarUrl} name={p.username} />

              <label className="absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-[#d9a653] text-[#100d10]">
                <Camera size={14} />

                <input
                  type="file"
                  accept="image/*"
                  onChange={avatar}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <p className="text-[9px] uppercase tracking-[.22em] text-[#d9a653]">
                Your account
              </p>

              <h1 className="mt-1 font-[var(--font-display)] text-4xl text-[#efe7da]">
                {p.username}
              </h1>

              <p className="mt-2 text-xs text-[#94888d]">
                {p.email}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            [UserRound, "Viewer", "Role"],
            [Heart, "Likes", "Saved reactions"],
            [Star, "Reviews", "Your ratings"],
            [Mail, p.email, "Account"],
          ].map(([I, v, l]) => (
            <div
              key={l}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
            >
              <I size={15} className="text-[#d9a653]" />

              <b className="mt-3 block truncate text-sm text-[#efe7da]">
                {v}
              </b>

              <span className="text-[8px] uppercase tracking-[.14em] text-[#756a6f]">
                {l}
              </span>
            </div>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <h2 className="font-[var(--font-display)] text-xl text-[#efe7da]">
            Profile information
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-[10px] text-[#91858a]">
              Username

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
              />
            </label>

            <label className="text-[10px] text-[#91858a]">
              Email

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-[#efe7da] outline-none focus:border-[#d9a653]/40"
              />
            </label>

            <label className="text-[10px] text-[#91858a] sm:col-span-2">
              Bio

              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={1000}
                rows={5}
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs leading-5 text-[#efe7da] outline-none focus:border-[#d9a653]/40"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-[#d9a653]">{message}</span>

            <button
              disabled={saving}
              onClick={save}
              className="inline-flex items-center gap-2 rounded-xl bg-[#d9a653] px-5 py-3 text-xs font-bold text-[#100d10]"
            >
              <Save size={14} />
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <h2 className="font-[var(--font-display)] text-xl text-[#efe7da]">
            Your taste
          </h2>

          <div className="mt-4 flex flex-wrap gap-2">
            {(p.genrePreferences || []).map((g) => (
              <span
                key={g}
                className="rounded-full border border-[#d9a653]/20 bg-[#5c1220]/50 px-3 py-1.5 text-[9px] text-[#d9bd88]"
              >
                {g}
              </span>
            ))}

            {!p.genrePreferences?.length && (
              <span className="text-xs text-[#756a6f]">
                No genre preferences selected.
              </span>
            )}
          </div>
        </section>
      </main>
    </DashboardLayout>
  );
}