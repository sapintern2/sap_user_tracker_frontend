import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Eye,
  X,
  Database,
  RefreshCw,
  Upload,
  Users,
} from "lucide-react";

import {
  getCurrentUsers,
  getDashboard,
  getUploadHistory,
  getUploadDownloadUrl,
  uploadExcel,
} from "../services/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ label, value, onClick, active }) {
  if (onClick) {
    return (
      <article className={`stat-card ${active ? "active" : ""}`}>
        <span>{label}</span>
        <strong>{value ?? 0}</strong>
        <button className="view-button" type="button" onClick={onClick}>
          <Eye size={15} aria-hidden="true" />
          View
        </button>
      </article>
    );
  }

  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </article>
  );
}

function CurrentUsersTable({ title, users, loading }) {
  if (loading) {
    return <div className="empty-state">Loading users...</div>;
  }

  if (!users?.length) {
    return <div className="empty-state">No users to show for {title}.</div>;
  }

  return (
    <table className="deleted-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Target Classification</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.username}>
            <td>{user.username}</td>
            <td>{user.category || "Unclassified"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeletedUsersTable({ users }) {
  if (!users?.length) {
    return <div className="empty-state">No deleted users for this date.</div>;
  }

  return (
    <table className="deleted-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Target Classification</th>
          <th>Deleted Date</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={`${user.username}-${user.deleted_date}`}>
            <td>{user.username}</td>
            <td>{user.category || "Unclassified"}</td>
            <td>{user.deleted_date}</td>
            <td>{user.last_seen_date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TrendList({ rows }) {
  const maxCount = useMemo(
    () => Math.max(1, ...(rows || []).map((row) => row.count)),
    [rows],
  );

  if (!rows?.length) {
    return <div className="empty-state">No deletion trend yet.</div>;
  }

  return (
    <ul className="trend-list">
      {rows.map((row) => (
        <li className="trend-item" key={row.date}>
          <span>{row.date}</span>
          <strong>{row.count}</strong>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${(row.count / maxCount) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function UploadHistoryList({ uploads }) {
  if (!uploads?.length) {
    return <div className="empty-state compact">No uploads yet.</div>;
  }

  return (
    <ul className="upload-history-list">
      {uploads.map((upload) => (
        <li className="upload-history-item" key={upload.id}>
          <div>
            <strong>{upload.upload_date}</strong>
            <span title={upload.file_name}>{upload.file_name}</span>
          </div>
          <dl>
            <div>
              <dt>Users</dt>
              <dd>{upload.total_users}</dd>
            </div>
            <div>
              <dt>Deleted</dt>
              <dd>{upload.deleted_users}</dd>
            </div>
          </dl>
          <a className="download-link" href={getUploadDownloadUrl(upload.id)}>
            Download
          </a>
        </li>
      ))}
    </ul>
  );
}

function App() {
  const [selectedDate, setSelectedDate] = useState(today());
  const [dashboard, setDashboard] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadDate, setUploadDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [userList, setUserList] = useState({
    title: "Total Users",
    category: null,
    users: [],
  });
  const [usersLoading, setUsersLoading] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [isUploadHistoryOpen, setIsUploadHistoryOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getDashboard(selectedDate);
      setDashboard(data);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const loadUploadHistory = useCallback(async () => {
    try {
      const data = await getUploadHistory();
      setUploadHistory(data.uploads ?? []);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  }, []);

  const openUploadHistory = useCallback(async () => {
    await loadUploadHistory();
    setIsUploadHistoryOpen(true);
  }, [loadUploadHistory]);

  useEffect(() => {
    loadDashboard();
    loadUploadHistory();
  }, [loadDashboard, loadUploadHistory]);

  const loadCurrentUsers = useCallback(async (title, category = null) => {
    setUsersLoading(true);
    setMessage(null);
    try {
      const data = await getCurrentUsers(category);
      setUserList({ title, category, users: data.users ?? [] });
      setIsUserListOpen(true);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setUsersLoading(false);
    }
  }, []);

  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile) {
      setMessage({ type: "error", text: "Choose an Excel file first." });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const result = await uploadExcel(selectedFile, uploadDate);
      setMessage({
        type: "success",
        text: `Uploaded ${result.total_users} users. Deleted users detected: ${result.deleted_users}.`,
      });
      setSelectedFile(null);
      await loadDashboard();
      await loadUploadHistory();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setUploading(false);
    }
  }

  const summary = dashboard?.summary ?? {};
  const latestUpload = dashboard?.latest_upload;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">
              <Database size={22} aria-hidden="true" />
            </div>
            <div>
              <h1>SAP User Tracker</h1>
              <p>Daily SAP access monitoring</p>
            </div>
          </div>
          <div className="api-status">
            <span className="status-dot" />
            Backend connected
          </div>
        </div>
      </header>

      <main className="main-grid">
        <div className="content-stack">
          <section className="section">
            <div className="section-heading">
              <div>
                <h2>Dashboard</h2>
                <p>
                  {latestUpload
                    ? `Latest upload: ${latestUpload.upload_date}`
                    : "Upload your first SAP export to populate the dashboard."}
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={loadDashboard}
                disabled={loading}
                title="Refresh dashboard"
              >
                <RefreshCw size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="stats-grid">
              <StatCard
                label="Total Users"
                value={summary.total_users}
                onClick={() => loadCurrentUsers("Total Users")}
              />
              <StatCard
                label="Advanced Users"
                value={summary.advanced_users}
                onClick={() => loadCurrentUsers("Advanced Users", "advanced_users")}
              />
              <StatCard
                label="Core Users"
                value={summary.core_users}
                onClick={() => loadCurrentUsers("Core Users", "core_users")}
              />
              <StatCard
                label="Self-Service Users"
                value={summary.self_service_users}
                onClick={() =>
                  loadCurrentUsers("Self-Service Users", "self_service_users")
                }
              />
              <StatCard
                label="Deleted On Selected Date"
                value={summary.deleted_users_for_selected_date}
              />
              <StatCard
                label="Total Uploads"
                value={summary.total_uploads}
                onClick={openUploadHistory}
              />
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <h2>Deleted Users</h2>
                <p>Filter deleted users day by day.</p>
              </div>
              <div className="controls">
                <CalendarDays size={18} aria-hidden="true" />
                <input
                  className="date-input"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
            </div>

            <DeletedUsersTable users={dashboard?.deleted_users ?? []} />
          </section>
        </div>

        <aside className="side-column">
          <section className="panel section">
            <div className="section-heading">
              <div>
                <h2>Upload Excel</h2>
                <p>Use the daily SAP export file.</p>
              </div>
              <Upload size={20} aria-hidden="true" />
            </div>

            <form className="upload-form" onSubmit={handleUpload}>
              <div className="field">
                <label htmlFor="upload-date">Upload date</label>
                <input
                  id="upload-date"
                  className="date-input"
                  type="date"
                  value={uploadDate}
                  onChange={(event) => setUploadDate(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="sap-file">SAP export</label>
                <input
                  id="sap-file"
                  className="file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
              </div>

              <button className="primary-button" type="submit" disabled={uploading}>
                <Upload size={18} aria-hidden="true" />
                {uploading ? "Uploading" : "Upload"}
              </button>
            </form>

            {message ? (
              <div className={`message ${message.type}`}>{message.text}</div>
            ) : null}
          </section>

          <section className="panel section">
            <div className="section-heading">
              <div>
                <h2>Deletion Trend</h2>
                <p>Daily deleted-user counts.</p>
              </div>
              <Users size={20} aria-hidden="true" />
            </div>
            <TrendList rows={dashboard?.deleted_user_trend ?? []} />
          </section>
        </aside>
      </main>

      {isUserListOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-list-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="user-list-title">{userList.title}</h2>
                <p>Current users from the latest upload.</p>
              </div>
              <div className="modal-actions">
                <strong className="list-count">{userList.users.length}</strong>
                <button
                  className="icon-button close-button"
                  type="button"
                  onClick={() => setIsUserListOpen(false)}
                  title="Close"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="scroll-panel modal-scroll">
              <CurrentUsersTable
                title={userList.title}
                users={userList.users}
                loading={usersLoading}
              />
            </div>
          </section>
        </div>
      ) : null}

      {isUploadHistoryOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal compact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-history-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="upload-history-title">Upload History</h2>
                <p>Uploaded SAP export files.</p>
              </div>
              <div className="modal-actions">
                <strong className="list-count">{uploadHistory.length}</strong>
                <button
                  className="icon-button close-button"
                  type="button"
                  onClick={() => setIsUploadHistoryOpen(false)}
                  title="Close"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <UploadHistoryList uploads={uploadHistory} />
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;
