const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "sap_user_tracker_token";
const USER_KEY = "sap_user_tracker_user";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const value = localStorage.getItem(USER_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function storeSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getAuthHeaders() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers ?? {}),
  };
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      message = response.statusText || message;
    }

    if (response.status === 401) {
      clearSession();
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function downloadFile(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Download failed";
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
  const filename = filenameMatch?.[1] ?? "download.xlsx";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function getMe() {
  return request("/auth/me");
}

export function changePassword(newPassword) {
  return request("/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      new_password: newPassword,
    }),
  });
}

export function getAdminUsers() {
  return request("/admin/users");
}

export function createAdminUser(name, email) {
  return request("/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email }),
  });
}

export function blockAdminUser(userId) {
  return request(`/admin/users/${userId}/block`, {
    method: "POST",
  });
}

export function unblockAdminUser(userId) {
  return request(`/admin/users/${userId}/unblock`, {
    method: "POST",
  });
}

export function resetAdminUserPassword(userId) {
  return request(`/admin/users/${userId}/reset-password`, {
    method: "POST",
  });
}

export function deleteAdminUser(userId) {
  return request(`/admin/users/${userId}`, {
    method: "DELETE",
  });
}

export function getAdminLogins(loginDate) {
  const params = loginDate ? `?login_date=${loginDate}` : "";
  return request(`/admin/logins${params}`);
}

export function clearAdminLogins(loginDate) {
  return request(`/admin/logins?login_date=${loginDate}`, {
    method: "DELETE",
  });
}

export function getDashboard(deletedDate, statsDate) {
  const params = new URLSearchParams();
  if (deletedDate) {
    params.set("deleted_date", deletedDate);
  }
  if (statsDate) {
    params.set("stats_date", statsDate);
  }
  const query = params.toString();
  return request(`/dashboard${query ? `?${query}` : ""}`);
}

export function getDeletedUsers(deletedDate) {
  const params = deletedDate ? `?deleted_date=${deletedDate}` : "";
  return request(`/deleted-users${params}`);
}

export function getCurrentUsers(category, statsDate) {
  const params = new URLSearchParams();
  if (category) {
    params.set("category", category);
  }
  if (statsDate) {
    params.set("stats_date", statsDate);
  }
  const query = params.toString();
  return request(`/dashboard/users${query ? `?${query}` : ""}`);
}

export function getNewUsers(statsDate) {
  const params = statsDate ? `?stats_date=${statsDate}` : "";
  return request(`/dashboard/new-users${params}`);
}

export function getClassificationMovements(fromCategory, toCategory, statsDate) {
  const params = new URLSearchParams();
  if (fromCategory) {
    params.set("from_category", fromCategory);
  }
  if (toCategory) {
    params.set("to_category", toCategory);
  }
  if (statsDate) {
    params.set("stats_date", statsDate);
  }
  const query = params.toString();
  return request(`/dashboard/movements${query ? `?${query}` : ""}`);
}

export function getUploadHistory() {
  return request("/history/uploads");
}

export function getUploadDownloadUrl(uploadId) {
  return `${API_BASE_URL}/history/uploads/${uploadId}/download`;
}

export function getMasterReportUrl() {
  return `${API_BASE_URL}/reports/master/download`;
}

export function downloadUpload(uploadId) {
  return downloadFile(`/history/uploads/${uploadId}/download`);
}

export function downloadMasterReport() {
  return downloadFile("/reports/master/download");
}

export function deleteUpload(uploadId) {
  return request(`/history/uploads/${uploadId}`, {
    method: "DELETE",
  });
}

export function uploadExcel(file, uploadDate) {
  const formData = new FormData();
  formData.append("file", file);

  if (uploadDate) {
    formData.append("upload_date", uploadDate);
  }

  return request("/upload", {
    method: "POST",
    body: formData,
  });
}

export function uploadLatestFromFolder() {
  return request("/upload/latest-from-folder", {
    method: "POST",
  });
}
