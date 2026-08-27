import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/AuthLayout.jsx";
import { postForm } from "../../api/client";
import "../../components/FormControls.css";

const GENRE_OPTIONS = [
  "Drama",
  "Thriller",
  "Comedy",
  "Documentary",
  "Sci-Fi",
  "Horror",
  "Romance",
  "Animation",
];

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState("viewer"); // "viewer" | "director"

  // shared
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // viewer-only
  const [genres, setGenres] = useState([]);
  const [maturitySetting, setMaturitySetting] = useState("all");

  // director-only
  const [studioName, setStudioName] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleGenre(g) {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0] || null;
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData();
    formData.append("username", username);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("date_of_birth", dob);
    if (bio) formData.append("bio", bio);
    if (avatarFile) formData.append("avatar", avatarFile);

    let path;
    if (role === "viewer") {
      path = "/auth/register/viewer";
      genres.forEach((g) => formData.append("genrePreferences", g));
      formData.append("maturitySetting", maturitySetting);
    } else {
      path = "/auth/register/creator";
      if (studioName) formData.append("studioName", studioName);
      if (portfolioUrl) formData.append("portfolioUrl", portfolioUrl);
    }

    try {
      await postForm(path, formData);
      navigate("/login", { state: { justRegistered: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="First visit"
      title="Create your account"
      subtitle="Choose how you'll take your seat — watching from the house, or directing from the wings."
    >
      {error && <div className="form-error">{error}</div>}

      <div className="role-toggle" role="tablist" aria-label="Account type">
        <button
          type="button"
          role="tab"
          aria-pressed={role === "viewer"}
          onClick={() => setRole("viewer")}
        >
          Viewer
        </button>
        <button
          type="button"
          role="tab"
          aria-pressed={role === "director"}
          onClick={() => setRole("director")}
        >
          Director
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="field-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              maxLength={30}
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="dob">
              Date of birth
            </label>
            <input
              id="dob"
              type="date"
              className="field-input"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
          <p className="field-hint">At least 8 characters.</p>
        </div>

        {role === "viewer" && (
          <>
            <div className="field">
              <span className="field-label">Genres you're into</span>
              <div className="chip-group">
                {GENRE_OPTIONS.map((g) => (
                  <button
                    type="button"
                    key={g}
                    className="chip"
                    aria-pressed={genres.includes(g)}
                    onClick={() => toggleGenre(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="maturity">
                Maturity setting
              </label>
              <select
                id="maturity"
                className="field-select"
                value={maturitySetting}
                onChange={(e) => setMaturitySetting(e.target.value)}
              >
                <option value="all">All audiences</option>
                <option value="mature">Include mature content</option>
              </select>
            </div>
          </>
        )}

        {role === "director" && (
          <>
            <div className="field">
              <label className="field-label" htmlFor="studioName">
                Studio name (optional)
              </label>
              <input
                id="studioName"
                className="field-input"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="portfolioUrl">
                Portfolio URL (optional)
              </label>
              <input
                id="portfolioUrl"
                type="url"
                className="field-input"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
          </>
        )}

        <div className="field">
          <label className="field-label" htmlFor="bio">
            Bio (optional)
          </label>
          <textarea
            id="bio"
            className="field-textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={1000}
          />
        </div>

        <div className="field">
          <span className="field-label">Avatar (optional)</span>
          <div className="field-file">
            {avatarPreview && (
              <img className="field-file-thumb" src={avatarPreview} alt="" />
            )}
            <input type="file" accept="image/*" onChange={handleAvatarChange} />
          </div>
        </div>

        <button className="submit-btn" type="submit" disabled={submitting}>
          {submitting
            ? "Creating account…"
            : role === "director"
            ? "Create director account"
            : "Create viewer account"}
        </button>
      </form>

      <p className="form-footer">
        Already have a ticket? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
