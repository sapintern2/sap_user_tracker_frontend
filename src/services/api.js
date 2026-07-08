const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return response.json();
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

export function getUploadHistory() {
  return request("/history/uploads");
}

export function getUploadDownloadUrl(uploadId) {
  return `${API_BASE_URL}/history/uploads/${uploadId}/download`;
}

export function getMasterReportUrl() {
  return `${API_BASE_URL}/reports/master/download`;
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
