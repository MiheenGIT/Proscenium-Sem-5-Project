import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
});

// Auto-injects the token on every request — no more passing it
// into every call manually.
API.interceptors.request.use((config) => {
  const stored = localStorage.getItem("proscenium_auth");
  if (stored) {
    try {
      const { token } = JSON.parse(stored);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // malformed storage — request goes out unauthenticated
    }
  }
  return config;
});

/**
 * Turns FastAPI's error payloads (a string, or a Pydantic list of
 * {loc, msg} objects) into one readable line for the UI.
 */
function extractErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : "field";
        return `${field}: ${e.msg}`;
      })
      .join(" — ");
  }
  return fallback;
}

async function request({ onUploadProgress, ...config }) {
  try {
    const res = await API.request({
      ...config,
      onUploadProgress: onUploadProgress
        ? (evt) => onUploadProgress(Math.round((evt.loaded * 100) / (evt.total || evt.loaded)))
        : undefined,
    });
    return res.data;
  } catch (err) {
    throw new Error(
      extractErrorMessage(err, `Request failed (${err?.response?.status ?? "network error"})`)
    );
  }
}

export function postJson(path, body) {
  return request({ url: path, method: "POST", data: body });
}

export function postForm(path, formData, onUploadProgress) {
  return request({ url: path, method: "POST", data: formData, onUploadProgress });
}

export function getRequest(path) {
  return request({ url: path, method: "GET" });
}

export function deleteRequest(path) {
  return request({ url: path, method: "DELETE" });
}

export function putForm(path, formData) {
  return request({ url: path, method: "PUT", data: formData });
}

export function putJson(path, body) {
  return request({ url: path, method: "PUT", data: body });
}

/** Authenticated POST with no body — used for actions like resubmit. */
export function postEmpty(path) {
  return request({ url: path, method: "POST" });
}

export default API;