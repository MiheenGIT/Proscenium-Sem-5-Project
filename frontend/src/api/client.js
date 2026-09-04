import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
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
    // Ignore invalid stored auth.
  }

  return config;
});

function getErrorMessage(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;

  if (!error?.response) {
    return "Unable to connect to the server. Check that the backend is running.";
  }

  if (status === 401) {
    return "Your admin session has expired. Please sign in again.";
  }

  if (status === 403) {
    return "Access denied. Admin permission is required.";
  }

  if (status === 404) {
    return "The requested resource was not found.";
  }

  if (status === 422) {
    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item) => {
          const field =
            Array.isArray(item?.loc) && item.loc.length
              ? item.loc[item.loc.length - 1]
              : "field";

          return `${field}: ${item.msg}`;
        })
        .join(" — ");
    }

    return data?.detail || "Validation failed.";
  }

  if (status >= 500) {
    return "The server encountered an error. Check the backend terminal.";
  }

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  return error?.message || `Request failed (${status || "unknown error"})`;
}

async function request({
  onUploadProgress,
  ...config
}) {
  try {
    const response = await API.request({
      ...config,
      onUploadProgress: onUploadProgress
        ? (event) => {
            const total = event.total || event.loaded || 1;
            onUploadProgress(
              Math.round((event.loaded * 100) / total)
            );
          }
        : undefined,
    });

    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export function getRequest(path) {
  return request({
    method: "GET",
    url: path,
  });
}

export function postJson(path, body) {
  return request({
    method: "POST",
    url: path,
    data: body,
  });
}

export function postEmpty(path) {
  return request({
    method: "POST",
    url: path,
  });
}

export function putJson(path, body) {
  return request({
    method: "PUT",
    url: path,
    data: body,
  });
}

export function patchJson(path, body) {
  return request({
    method: "PATCH",
    url: path,
    data: body,
  });
}

export function deleteRequest(path) {
  return request({
    method: "DELETE",
    url: path,
  });
}

export function postForm(path, formData, onUploadProgress) {
  return request({
    method: "POST",
    url: path,
    data: formData,
    timeout: 0,
    onUploadProgress,
  });
}

export function putForm(path, formData) {
  return request({
    method: "PUT",
    url: path,
    data: formData,
  });
}

export default API;