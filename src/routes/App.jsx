import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Eye,
  X,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

import {
  getCurrentUsers,
  getDashboard,
  getMasterReportUrl,
  getUploadHistory,
  getUploadDownloadUrl,
  deleteUpload,
  uploadExcel,
} from "../services/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year.slice(-2)}`;
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

function DateField({ value, onChange, max, id }) {
  const inputRef = useRef(null);

  function openPicker() {
    if (inputRef.current?.showPicker) {
      inputRef.current.showPicker();
      return;
    }

    inputRef.current?.click();
  }

  return (
    <div className="date-field">
      <button className="date-display" type="button" onClick={openPicker}>
        <CalendarDays size={16} aria-hidden="true" />
        <span>{formatDate(value) || "dd/mm/yy"}</span>
      </button>
      <input
        id={id}
        ref={inputRef}
        className="native-date-input"
        type="date"
        value={value}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
      />
    </div>
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

function filterUsers(users, searchTerm) {
  const term = searchTerm.trim().toLowerCase();
  if (!term) {
    return users;
  }

  return users.filter(
    (user) =>
      user.username.toLowerCase().includes(term) ||
      (user.category || "").toLowerCase().includes(term),
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
            <td>{formatDate(user.deleted_date)}</td>
            <td>{formatDate(user.last_seen_date)}</td>
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
    <div className="trend-scroll">
      <ul className="trend-list">
        {rows.map((row) => (
          <li className="trend-item" key={row.date}>
            <span>{formatDate(row.date)}</span>
            <strong>{row.count}</strong>
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${(row.count / maxCount) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UploadHistoryList({ uploads, onDeleteUpload, deletingUploadId }) {
  if (!uploads?.length) {
    return <div className="empty-state compact">No uploads yet.</div>;
  }

  return (
    <ul className="upload-history-list">
      {uploads.map((upload) => (
        <li className="upload-history-item" key={upload.id}>
          <div>
            <strong>{formatDate(upload.upload_date)}</strong>
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
          <div className="upload-actions">
            <a className="download-link" href={getUploadDownloadUrl(upload.id)}>
              Download
            </a>
            <button
              className="danger-button"
              type="button"
              onClick={() => onDeleteUpload(upload)}
              disabled={!upload.is_latest || deletingUploadId === upload.id}
              title={
                upload.is_latest
                  ? "Delete this latest upload and revert"
                  : "Only the latest upload can be deleted"
              }
            >
              <Trash2 size={15} aria-hidden="true" />
              {deletingUploadId === upload.id ? "Deleting" : "Delete"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function App() {
  const [selectedDate, setSelectedDate] = useState(today());
  const [statsDate, setStatsDate] = useState("");
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
  const [userSearch, setUserSearch] = useState("");
  const [uploadHistory, setUploadHistory] = useState([]);
  const [isUploadHistoryOpen, setIsUploadHistoryOpen] = useState(false);
  const [deletingUploadId, setDeletingUploadId] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getDashboard(selectedDate, statsDate);
      if (!statsDate && data.latest_upload?.upload_date) {
        setStatsDate(data.latest_upload.upload_date);
      }
      setDashboard(data);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statsDate]);

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
      const data = await getCurrentUsers(category, statsDate);
      setUserList({ title, category, users: data.users ?? [] });
      setUserSearch("");
      setIsUserListOpen(true);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setUsersLoading(false);
    }
  }, [statsDate]);

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

  async function handleDeleteUpload(upload) {
    const confirmed = window.confirm(
      `Delete the latest upload from ${formatDate(upload.upload_date)}? This will remove its users, deleted-user results, and uploaded file.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingUploadId(upload.id);
    setMessage(null);
    try {
      await deleteUpload(upload.id);
      setMessage({
        type: "success",
        text: "Latest upload deleted. Data has been reverted to the previous upload.",
      });
      await loadDashboard();
      await loadUploadHistory();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setDeletingUploadId(null);
    }
  }

  function resetDeletedUsersDate() {
    setSelectedDate(latestUpload?.upload_date ?? today());
  }

  function resetDashboardDate() {
    setStatsDate(latestUpload?.upload_date ?? today());
  }

  const summary = dashboard?.summary ?? {};
  const latestUpload = dashboard?.latest_upload;
  const selectedUpload = dashboard?.selected_upload;
  const filteredUserList = filterUsers(userList.users, userSearch);

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
        </div>
      </header>

      <main className="main-grid">
        <div className="content-stack">
          <section className="section">
            <div className="section-heading">
              <div>
                <h2>Dashboard</h2>
                <p>
                  {selectedUpload
                    ? `Showing records for: ${formatDate(selectedUpload.upload_date)}`
                    : "Upload your first SAP export to populate the dashboard."}
                </p>
              </div>
              <div className="controls">
                <DateField
                  value={statsDate}
                  onChange={setStatsDate}
                  max={latestUpload?.upload_date ?? undefined}
                />
                <button
                  className="icon-button"
                  type="button"
                  onClick={resetDashboardDate}
                  disabled={loading}
                  title="Show latest dashboard records"
                >
                  <RefreshCw size={18} aria-hidden="true" />
                </button>
              </div>
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
                label="Deleted On Dashboard Date"
                value={summary.deleted_users_for_stats_date}
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
                <strong className="list-count">
                  {summary.deleted_users_for_selected_date ?? 0}
                </strong>
                <DateField value={selectedDate} onChange={setSelectedDate} />
                <button
                  className="icon-button"
                  type="button"
                  onClick={resetDeletedUsersDate}
                  title="Show latest deleted users"
                >
                  <RefreshCw size={18} aria-hidden="true" />
                </button>
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
                <DateField id="upload-date" value={uploadDate} onChange={setUploadDate} />
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

          <section className="panel section">
            <div className="section-heading">
              <div>
                <h2>Reports</h2>
                <p>Master audit workbook.</p>
              </div>
              <FileSpreadsheet size={20} aria-hidden="true" />
            </div>
            <a className="report-download" href={getMasterReportUrl()}>
              <FileSpreadsheet size={18} aria-hidden="true" />
              Download Master Report
            </a>
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
                <strong className="list-count">{filteredUserList.length}</strong>
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
            <div className="search-row">
              <input
                className="search-input"
                type="search"
                placeholder="Search user"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
              />
            </div>
            <div className="scroll-panel modal-scroll">
              <CurrentUsersTable
                title={userList.title}
                users={filteredUserList}
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
            <UploadHistoryList
              uploads={uploadHistory}
              onDeleteUpload={handleDeleteUpload}
              deletingUploadId={deletingUploadId}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;
