import axios from "axios";

const API = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:8000",
});

// =========================================================
// AUTO ATTACH AUTH TOKEN
// =========================================================

API.interceptors.request.use((config) => {
  const stored =
    localStorage.getItem("proscenium_auth");

  if (stored) {
    try {
      const { token } = JSON.parse(stored);

      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization =
          `Bearer ${token}`;
      }
    } catch {
      // Malformed storage.
      // Request continues without authentication.
    }
  }

  return config;
});


// =========================================================
// ERROR MESSAGE
// =========================================================

function extractErrorMessage(
  error,
  fallback
) {
  const detail =
    error?.response?.data?.detail;

  if (!detail) {
    if (
      error?.code === "ERR_NETWORK" ||
      error?.message === "Network Error"
    ) {
      return (
        "Unable to connect to the server. " +
        "Make sure the FastAPI backend is running on port 8000."
      );
    }

    return fallback;
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field =
          Array.isArray(item?.loc)
            ? item.loc[item.loc.length - 1]
            : "field";

        return `${field}: ${
          item?.msg || "Invalid value"
        }`;
      })
      .join(" — ");
  }

  return fallback;
}


// =========================================================
// GENERIC REQUEST
// =========================================================

async function request({
  onUploadProgress,
  ...config
}) {
  try {
    const response =
      await API.request({
        ...config,

        onUploadProgress:
          onUploadProgress
            ? (event) => {
                const total =
                  event.total ||
                  event.loaded ||
                  1;

                const percent =
                  Math.round(
                    (event.loaded * 100) /
                      total
                  );

                onUploadProgress(
                  percent
                );
              }
            : undefined,
      });

    return response.data;
  } catch (error) {
    throw new Error(
      extractErrorMessage(
        error,
        `Request failed (${
          error?.response?.status ??
          "network error"
        })`
      )
    );
  }
}


// =========================================================
// GET
// =========================================================

export function getRequest(path) {
  return request({
    url: path,
    method: "GET",
  });
}


// =========================================================
// POST JSON
// =========================================================

export function postJson(
  path,
  body
) {
  return request({
    url: path,
    method: "POST",
    data: body,
  });
}


// =========================================================
// POST FORM
// =========================================================

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


// =========================================================
// POST EMPTY
// =========================================================

export function postEmpty(path) {
  return request({
    url: path,
    method: "POST",
  });
}


// =========================================================
// PUT JSON
// =========================================================

export function putJson(
  path,
  body
) {
  return request({
    url: path,
    method: "PUT",
    data: body,
  });
}


// =========================================================
// PUT FORM
// =========================================================

export function putForm(
  path,
  formData
) {
  return request({
    url: path,
    method: "PUT",
    data: formData,
  });
}


// =========================================================
// PATCH JSON
// IMPORTANT:
// AccountPages.jsx uses this.
// =========================================================

export function patchJson(
  path,
  body
) {
  return request({
    url: path,
    method: "PATCH",
    data: body,
  });
}


// =========================================================
// PATCH FORM
// =========================================================

export function patchForm(
  path,
  formData
) {
  return request({
    url: path,
    method: "PATCH",
    data: formData,
  });
}


// =========================================================
// DELETE
// =========================================================

export function deleteRequest(path) {
  return request({
    url: path,
    method: "DELETE",
  });
}


// =========================================================
// DEFAULT AXIOS INSTANCE
// =========================================================

export default API;