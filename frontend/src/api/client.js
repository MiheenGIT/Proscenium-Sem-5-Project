import axios from "axios";

const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8000",
  timeout: 30000,
});

API.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("proscenium_auth");
    const auth = raw ? JSON.parse(raw) : null;

    if (auth?.token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
  } catch {
    // Ignore invalid local auth data.
  }

  return config;
});

function extractErrorMessage(err, fallback = "Request failed") {
  const data = err?.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data?.detail) {
    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data.detail)) {
      return data.detail
        .map((e) => {
          const field =
            Array.isArray(e?.loc) && e.loc.length
              ? e.loc[e.loc.length - 1]
              : "field";

          return `${field}: ${e.msg}`;
        })
        .join(" — ");
    }
  }

  return fallback;
}

async function request({
  onUploadProgress,
  ...config
}) {
  try {
    const res = await API.request({
      ...config,
      onUploadProgress: onUploadProgress
        ? (evt) =>
            onUploadProgress(
              Math.round(
                (evt.loaded * 100) /
                  (evt.total || evt.loaded)
              )
            )
        : undefined,
    });

    return res.data;
  } catch (err) {
    throw new Error(
      extractErrorMessage(
        err,
        `Request failed (${err?.response?.status ?? "network error"})`
      )
    );
  }
}

export function getRequest(path) {
  return request({
    url: path,
    method: "GET",
  });
}

export function postJson(path, body) {
  return request({
    url: path,
    method: "POST",
    data: body,
  });
}

export function postForm(
  path,
  formData,
  onUploadProgress
) {
  return request({
    url: path,
    method: "POST",
    data: formData,
    onUploadProgress,
  });
}

export function putJson(path, body) {
  return request({
    url: path,
    method: "PUT",
    data: body,
  });
}

export function putForm(path, formData) {
  return request({
    url: path,
    method: "PUT",
    data: formData,
  });
}

export function patchJson(path, body) {
  return request({
    url: path,
    method: "PATCH",
    data: body,
  });
}

export function deleteRequest(path) {
  return request({
    url: path,
    method: "DELETE",
  });
}

export function postEmpty(path) {
  return request({
    url: path,
    method: "POST",
  });
}

export default API;