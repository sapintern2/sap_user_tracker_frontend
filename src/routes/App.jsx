import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  CalendarDays,
  ArrowRight,
  Shield,
  Eye,
  X,
  Database,
  FileSpreadsheet,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
  Upload,
  UserCircle,
  UserCheck,
  Users,
} from "lucide-react";

import {
  changePassword,
  clearAdminLogins,
  clearSession,
  blockAdminUser,
  createAdminUser,
  deleteAdminUser,
  getCurrentUsers,
  getAdminLogins,
  getAdminUsers,
  getClassificationMovements,
  getDashboard,
  getMe,
  getStoredToken,
  getStoredUser,
  getUploadHistory,
  deleteUpload,
  downloadMasterReport,
  downloadUpload,
  login,
  resetAdminUserPassword,
  storeSession,
  unblockAdminUser,
  uploadExcel,
} from "../services/api";

function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

const MOVEMENT_CARDS = [
  {
    label: "Advanced to Core",
    fromCategory: "advanced_users",
    toCategory: "core_users",
    summaryKey: "advanced_to_core",
  },
  {
    label: "Advanced to Self-Service",
    fromCategory: "advanced_users",
    toCategory: "self_service_users",
    summaryKey: "advanced_to_self_service",
  },
  {
    label: "Core to Advanced",
    fromCategory: "core_users",
    toCategory: "advanced_users",
    summaryKey: "core_to_advanced",
  },
  {
    label: "Core to Self-Service",
    fromCategory: "core_users",
    toCategory: "self_service_users",
    summaryKey: "core_to_self_service",
  },
  {
    label: "Self-Service to Advanced",
    fromCategory: "self_service_users",
    toCategory: "advanced_users",
    summaryKey: "self_service_to_advanced",
  },
  {
    label: "Self-Service to Core",
    fromCategory: "self_service_users",
    toCategory: "core_users",
    summaryKey: "self_service_to_core",
  },
];

const CATEGORY_OPTIONS = [
  { label: "Advanced Users", value: "advanced_users" },
  { label: "Core Users", value: "core_users" },
  { label: "Self-Service Users", value: "self_service_users" },
];

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
          <th>ID</th>
          <th>Name</th>
          <th>Target Classification</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.username}>
            <td>{user.username}</td>
            <td>{user.user_id || "-"}</td>
            <td>{user.full_name || "-"}</td>
            <td>{user.category || "Unclassified"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MovementUsersTable({ title, users, loading }) {
  if (loading) {
    return <div className="empty-state">Loading movements...</div>;
  }

  if (!users?.length) {
    return <div className="empty-state">No users moved for {title}.</div>;
  }

  return (
    <table className="deleted-table">
      <thead>
        <tr>
          <th>User</th>
          <th>ID</th>
          <th>Name</th>
          <th>From</th>
          <th>To</th>
          <th>Movement Date</th>
          <th>Previous Upload</th>
          <th>Current Upload</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={`${user.username}-${user.movement_date}-${user.from_category}-${user.to_category}`}>
            <td>{user.username}</td>
            <td>{user.user_id || "-"}</td>
            <td>{user.full_name || "-"}</td>
            <td>{user.from_category || "Unclassified"}</td>
            <td>{user.to_category || "Unclassified"}</td>
            <td>{formatDate(user.movement_date)}</td>
            <td>{formatDate(user.previous_upload_date)}</td>
            <td>{formatDate(user.current_upload_date)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function getCategoryLabel(category) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

function getMovementConfig(fromCategory, toCategory) {
  return MOVEMENT_CARDS.find(
    (movement) =>
      movement.fromCategory === fromCategory && movement.toCategory === toCategory,
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
      (user.user_id || "").toLowerCase().includes(term) ||
      (user.full_name || "").toLowerCase().includes(term) ||
      (user.category || "").toLowerCase().includes(term),
  );
}

function filterMovements(users, searchTerm) {
  const term = searchTerm.trim().toLowerCase();
  if (!term) {
    return users;
  }

  return users.filter(
    (user) =>
      user.username.toLowerCase().includes(term) ||
      (user.user_id || "").toLowerCase().includes(term) ||
      (user.full_name || "").toLowerCase().includes(term) ||
      (user.from_category || "").toLowerCase().includes(term) ||
      (user.to_category || "").toLowerCase().includes(term),
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

function UploadHistoryList({ uploads, onDeleteUpload, onDownloadUpload, deletingUploadId }) {
  if (!uploads?.length) {
    return <div className="empty-state compact">No uploads yet.</div>;
  }

  return (
    <ul className="upload-history-list">
      {uploads.map((upload) => (
        <li className="upload-history-item" key={upload.id}>
          <div>
            <div className="upload-title-row">
              <strong>{formatDate(upload.upload_date)}</strong>
              {upload.is_latest ? <span className="latest-pill">Latest</span> : null}
            </div>
            <span className="upload-file-name" title={upload.file_name}>
              {upload.file_name}
            </span>
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
            <button
              className="download-link compact-action"
              type="button"
              onClick={() => onDownloadUpload(upload)}
            >
              Download
            </button>
            <button
              className="danger-button compact-action"
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

function LoginScreen({ onLogin, loading, message }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onLogin(email, password);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-mark">
          <Database size={24} aria-hidden="true" />
        </div>
        <h1>SAP User Tracker</h1>
        <p>Sign in with your allowed company email.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={loading}>
            <Lock size={17} aria-hidden="true" />
            {loading ? "Signing in" : "Sign In"}
          </button>
        </form>
        {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
      </section>
    </main>
  );
}

function PasswordChangeScreen({ user, onChangePassword, onLogout, loading, message }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onChangePassword(newPassword, confirmPassword);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-mark">
          <Lock size={24} aria-hidden="true" />
        </div>
        <h1>Change Password</h1>
        <p>{user.name}, update your default password before opening the dashboard.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Updating" : "Update Password"}
          </button>
        </form>
        <button className="secondary-button auth-secondary" type="button" onClick={onLogout}>
          Use another account
        </button>
        {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
      </section>
    </main>
  );
}

function AdminPanel({
  users,
  loginEvents,
  currentUser,
  loading,
  actionUserId,
  message,
  activeTab,
  onTabChange,
  onClose,
  onPrepareAddUser,
  onBlockUser,
  onUnblockUser,
  onResetPassword,
  onDeleteUser,
  onClearLogins,
  loginDate,
  onLoginDateChange,
  onResetLoginDate,
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onPrepareAddUser(name, email, () => {
      setName("");
      setEmail("");
    });
  }

  return (
    <div className="modal-backdrop admin-backdrop" role="presentation">
      <section className="modal admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <div className="modal-header">
          <div>
            <h2 id="admin-title">Admin Panel</h2>
            <p>Manage allowed users, access status, and login activity.</p>
          </div>
          <div className="modal-actions">
            <button className="icon-button close-button" type="button" onClick={onClose} title="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="admin-tabs">
          <button
            className={activeTab === "users" ? "active" : ""}
            type="button"
            onClick={() => onTabChange("users")}
          >
            Users
          </button>
          <button
            className={activeTab === "logins" ? "active" : ""}
            type="button"
            onClick={() => onTabChange("logins")}
          >
            Login Activity
          </button>
        </div>

        {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}

        {activeTab === "users" ? (
          <>
            <form className="admin-add-form" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <button className="primary-button" type="submit" disabled={loading}>
                Add User
              </button>
            </form>
            <div className="scroll-panel admin-scroll">
              <table className="deleted-table admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>First Login</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="strong-cell">{user.name}</td>
                      <td title={user.email}>{user.email}</td>
                      <td>
                        <span className={`status-pill ${user.role === "admin" ? "admin" : ""}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${user.is_active ? "success" : "danger"}`}>
                          {user.is_active ? "Active" : "Blocked"}
                        </span>
                      </td>
                      <td>{user.must_change_password ? "Pending" : "Done"}</td>
                      <td>{formatDateTime(user.last_login_at) || "-"}</td>
                      <td>
                        <div className="admin-row-actions">
                          {user.is_active ? (
                            <button
                              className="danger-button compact-action icon-action"
                              type="button"
                              onClick={() => onBlockUser(user)}
                              disabled={user.id === currentUser.id || actionUserId === user.id}
                              title="Block user"
                              aria-label={`Block ${user.name}`}
                            >
                              <Ban size={15} aria-hidden="true" />
                            </button>
                          ) : (
                            <button
                              className="secondary-button compact-action icon-action"
                              type="button"
                              onClick={() => onUnblockUser(user)}
                              disabled={actionUserId === user.id}
                              title="Unblock user"
                              aria-label={`Unblock ${user.name}`}
                            >
                              <UserCheck size={15} aria-hidden="true" />
                            </button>
                          )}
                          <button
                            className="secondary-button compact-action icon-action"
                            type="button"
                            onClick={() => onResetPassword(user)}
                            disabled={actionUserId === user.id}
                            title="Reset password"
                            aria-label={`Reset password for ${user.name}`}
                          >
                            <KeyRound size={15} aria-hidden="true" />
                          </button>
                          <button
                            className="danger-button compact-action icon-action"
                            type="button"
                            onClick={() => onDeleteUser(user)}
                            disabled={user.id === currentUser.id || actionUserId === user.id}
                            title="Delete user"
                            aria-label={`Delete ${user.name}`}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && users.length === 0 ? (
                    <tr>
                      <td className="empty-table-cell" colSpan="7">
                        No users found.
                      </td>
                    </tr>
                  ) : null}
                  {loading ? (
                    <tr>
                      <td className="empty-table-cell" colSpan="7">
                        Loading users...
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="admin-filter-row">
              <DateField value={loginDate} onChange={onLoginDateChange} max={today()} />
              <button
                className="icon-button"
                type="button"
                onClick={onResetLoginDate}
                title="Show today's login activity"
              >
                <RefreshCw size={18} aria-hidden="true" />
              </button>
              <button
                className="icon-button danger-icon-button"
                type="button"
                onClick={onClearLogins}
                disabled={!loginEvents.length || loading}
                title="Clear login activity for selected date"
                aria-label="Clear login activity for selected date"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="scroll-panel admin-scroll">
              <table className="deleted-table admin-table login-activity-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {loginEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{formatTime(event.created_at)}</td>
                      <td className="strong-cell">{event.name || "-"}</td>
                      <td title={event.email}>{event.email}</td>
                      <td>
                        <span className={`status-pill ${event.success ? "success" : "danger"}`}>
                          {event.success ? "Success" : "Failed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!loading && loginEvents.length === 0 ? (
                    <tr>
                      <td className="empty-table-cell" colSpan="4">
                        No login activity found for this date.
                      </td>
                    </tr>
                  ) : null}
                  {loading ? (
                    <tr>
                      <td className="empty-table-cell" colSpan="4">
                        Loading login activity...
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [authLoading, setAuthLoading] = useState(Boolean(getStoredToken()));
  const [authMessage, setAuthMessage] = useState(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [adminTab, setAdminTab] = useState("users");
  const [adminLoginDate, setAdminLoginDate] = useState(today());
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoginEvents, setAdminLoginEvents] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminActionUserId, setAdminActionUserId] = useState(null);
  const [adminMessage, setAdminMessage] = useState(null);
  const [addPendingUser, setAddPendingUser] = useState(null);
  const [blockPendingUser, setBlockPendingUser] = useState(null);
  const [resetPendingUser, setResetPendingUser] = useState(null);
  const [deletePendingUser, setDeletePendingUser] = useState(null);
  const [clearLoginsPending, setClearLoginsPending] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
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
  const [movementList, setMovementList] = useState({
    title: "Classification Movements",
    fromCategory: null,
    toCategory: null,
    users: [],
  });
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementSearch, setMovementSearch] = useState("");
  const [movementFrom, setMovementFrom] = useState("advanced_users");
  const [movementTo, setMovementTo] = useState("core_users");
  const [uploadHistory, setUploadHistory] = useState([]);
  const [isUploadHistoryOpen, setIsUploadHistoryOpen] = useState(false);
  const [uploadPendingDelete, setUploadPendingDelete] = useState(null);
  const [deletingUploadId, setDeletingUploadId] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getDashboard(selectedDate, statsDate);
      if (!statsDate && data.latest_upload?.upload_date) {
        setStatsDate(data.latest_upload.upload_date);
        setSelectedDate(data.latest_upload.upload_date);
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
    if (!getStoredToken()) {
      setAuthLoading(false);
      return;
    }

    async function loadSession() {
      try {
        const data = await getMe();
        setCurrentUser(data.user);
      } catch {
        clearSession();
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    loadSession();
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.must_change_password) {
      return;
    }

    loadDashboard();
    loadUploadHistory();
  }, [currentUser, loadDashboard, loadUploadHistory]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const hasOpenModal =
      isUserListOpen ||
      isUploadHistoryOpen ||
      uploadPendingDelete ||
      isAdminPanelOpen ||
      addPendingUser ||
      blockPendingUser ||
      resetPendingUser ||
      deletePendingUser ||
      clearLoginsPending ||
      isLogoutConfirmOpen;
    document.body.classList.toggle("modal-open", hasOpenModal);

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [
    isUserListOpen,
    isUploadHistoryOpen,
    uploadPendingDelete,
    isAdminPanelOpen,
    addPendingUser,
    blockPendingUser,
    resetPendingUser,
    deletePendingUser,
    clearLoginsPending,
    isLogoutConfirmOpen,
  ]);

  const loadAdminData = useCallback(async (tab) => {
    setAdminLoading(true);
    setAdminMessage(null);
    try {
      if (tab === "users") {
        const data = await getAdminUsers();
        setAdminUsers(data.users ?? []);
      } else {
        const data = await getAdminLogins(adminLoginDate);
        setAdminLoginEvents(data.events ?? []);
      }
    } catch (error) {
      const text =
        error.status === 401
          ? "Your login session expired. Please log in again."
          : error.status === 403
            ? "Admin access is required to load this data."
            : error.message;
      setAdminMessage({ type: "error", text });
    } finally {
      setAdminLoading(false);
    }
  }, [adminLoginDate]);

  useEffect(() => {
    if (!isAdminPanelOpen) {
      return;
    }

    loadAdminData(adminTab);
  }, [adminLoginDate, adminTab, isAdminPanelOpen, loadAdminData]);

  function openAdminPanel() {
    setIsAdminPanelOpen(true);
    setAdminTab("users");
  }

  function handleAdminTabChange(tab) {
    setAdminTab(tab);
  }

  function handleResetAdminLoginDate() {
    const todayValue = today();
    if (adminLoginDate === todayValue) {
      loadAdminData("logins");
      return;
    }

    setAdminLoginDate(todayValue);
  }

  function prepareAddAdminUser(name, email, onSuccess) {
    setAddPendingUser({
      name: name.trim(),
      email: email.trim(),
      onSuccess,
    });
  }

  async function handleAddAdminUser(pendingUser) {
    setAdminLoading(true);
    setAdminMessage(null);
    try {
      await createAdminUser(pendingUser.name, pendingUser.email);
      setAdminMessage({ type: "success", text: "User added with the default first-login password." });
      pendingUser.onSuccess();
      setAddPendingUser(null);
      await loadAdminData("users");
    } catch (error) {
      setAdminMessage({ type: "error", text: error.message });
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleAdminUserAction(user, action) {
    setAdminActionUserId(user.id);
    setAdminMessage(null);
    try {
      if (action === "block") {
        await blockAdminUser(user.id);
        setBlockPendingUser(null);
      } else if (action === "unblock") {
        await unblockAdminUser(user.id);
      } else if (action === "delete") {
        await deleteAdminUser(user.id);
        setDeletePendingUser(null);
      } else {
        await resetAdminUserPassword(user.id);
        setResetPendingUser(null);
      }
      await loadAdminData("users");
    } catch (error) {
      setAdminMessage({ type: "error", text: error.message });
    } finally {
      setAdminActionUserId(null);
    }
  }

  async function handleClearAdminLogins() {
    setAdminLoading(true);
    setAdminMessage(null);
    try {
      const result = await clearAdminLogins(adminLoginDate);
      setClearLoginsPending(false);
      setAdminLoginEvents([]);
      setAdminMessage({
        type: "success",
        text: `Cleared ${result.deleted ?? 0} login activity records and ${result.last_login_cleared ?? 0} last-login values for ${formatDate(adminLoginDate)}.`,
      });
      await loadAdminData(adminTab);
    } catch (error) {
      setAdminMessage({ type: "error", text: error.message });
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleLogin(email, password) {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const data = await login(email, password);
      storeSession(data.access_token, data.user);
      setCurrentUser(data.user);
    } catch (error) {
      setAuthMessage({ type: "error", text: error.message });
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleChangePassword(newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      setAuthMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setPasswordLoading(true);
    setAuthMessage(null);
    try {
      const data = await changePassword(newPassword);
      storeSession(data.access_token, data.user);
      setCurrentUser(data.user);
    } catch (error) {
      setAuthMessage({ type: "error", text: error.message });
    } finally {
      setPasswordLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    setIsLogoutConfirmOpen(false);
    setCurrentUser(null);
    setDashboard(null);
    setUploadHistory([]);
    setMessage(null);
    setAuthMessage(null);
  }

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

  const loadMovements = useCallback(async (movement) => {
    setMovementsLoading(true);
    setMessage(null);
    try {
      const data = await getClassificationMovements(
        movement.fromCategory,
        movement.toCategory,
        statsDate,
      );
      setMovementList({
        title: movement.label,
        fromCategory: movement.fromCategory,
        toCategory: movement.toCategory,
        users: data.users ?? [],
      });
      setMovementSearch("");
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setMovementsLoading(false);
    }
  }, [statsDate]);

  const selectedMovement = useMemo(
    () =>
      MOVEMENT_CARDS.find(
        (movement) =>
          movement.fromCategory === movementFrom && movement.toCategory === movementTo,
      ),
    [movementFrom, movementTo],
  );
  useEffect(() => {
    if (!selectedMovement) {
      setMovementList({
        title: "Classification Movements",
        fromCategory: movementFrom,
        toCategory: movementTo,
        users: [],
      });
      setMovementSearch("");
      return;
    }

    loadMovements(selectedMovement);
  }, [loadMovements, movementFrom, movementTo, selectedMovement]);

  function selectMovementPath(fromCategory, toCategory) {
    if (fromCategory === toCategory) {
      return;
    }

    setMovementFrom(fromCategory);
    setMovementTo(toCategory);
  }

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
    setDeletingUploadId(upload.id);
    setMessage(null);
    try {
      await deleteUpload(upload.id);
      setUploadPendingDelete(null);
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

  async function handleDownloadUpload(upload) {
    setMessage(null);
    try {
      await downloadUpload(upload.id);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  }

  async function handleDownloadMasterReport() {
    setMessage(null);
    try {
      await downloadMasterReport();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  }

  function resetDeletedUsersDate() {
    setSelectedDate(latestUpload?.upload_date ?? today());
  }

  function resetDashboardDate() {
    setStatsDate(latestUpload?.upload_date ?? today());
  }

  const summary = dashboard?.summary ?? {};
  const movementSummary = dashboard?.classification_movements_summary ?? {};
  const latestUpload = dashboard?.latest_upload;
  const selectedUpload = dashboard?.selected_upload;
  const filteredUserList = filterUsers(userList.users, userSearch);
  const filteredMovementList = filterMovements(movementList.users, movementSearch);

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-mark">
            <Database size={24} aria-hidden="true" />
          </div>
          <h1>SAP User Tracker</h1>
          <p>Checking your login session...</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} loading={authLoading} message={authMessage} />;
  }

  if (currentUser.must_change_password) {
    return (
      <PasswordChangeScreen
        user={currentUser}
        onChangePassword={handleChangePassword}
        onLogout={handleLogout}
        loading={passwordLoading}
        message={authMessage}
      />
    );
  }

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
          <div className="topbar-actions">
            <button
              className={`theme-toggle ${theme === "dark" ? "dark" : "light"}`}
              type="button"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              title={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}
            >
              {theme === "dark" ? (
                <Sun size={18} aria-hidden="true" />
              ) : (
                <Moon size={18} aria-hidden="true" />
              )}
            </button>
            <div className="profile-menu">
              <UserCircle size={22} aria-hidden="true" />
              <div>
                <strong>{currentUser.name}</strong>
                <span>{currentUser.email}</span>
              </div>
              {currentUser.role === "admin" ? (
                <button className="admin-button" type="button" onClick={openAdminPanel}>
                  <Shield size={15} aria-hidden="true" />
                  Admin
                </button>
              ) : null}
              <button
                className="icon-button logout-button"
                type="button"
                onClick={() => setIsLogoutConfirmOpen(true)}
                title="Logout"
              >
                <LogOut size={17} aria-hidden="true" />
              </button>
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

          <section className="section movement-section">
            <div className="section-heading">
              <div>
                <h2>Classification Movements</h2>
                <p>Users whose target classification changed on this upload.</p>
              </div>
              <ArrowRight size={20} aria-hidden="true" />
            </div>

            <div className="movement-matrix" aria-label="Classification transfer matrix">
              <div className="matrix-corner">From / To</div>
              {CATEGORY_OPTIONS.map((option) => (
                <div className="matrix-heading" key={`to-${option.value}`}>
                  {option.label}
                </div>
              ))}
              {CATEGORY_OPTIONS.map((fromOption) => (
                <React.Fragment key={`row-${fromOption.value}`}>
                  <div className="matrix-heading row-heading">{fromOption.label}</div>
                  {CATEGORY_OPTIONS.map((toOption) => {
                    const movement = getMovementConfig(fromOption.value, toOption.value);
                    const count = movement ? movementSummary[movement.summaryKey] ?? 0 : null;
                    const isActive =
                      movementFrom === fromOption.value && movementTo === toOption.value;

                    if (!movement) {
                      return (
                        <div
                          className="matrix-cell disabled"
                          key={`${fromOption.value}-${toOption.value}`}
                        >
                          -
                        </div>
                      );
                    }

                    return (
                      <button
                        className={`matrix-cell ${isActive ? "active" : ""}`}
                        key={`${fromOption.value}-${toOption.value}`}
                        type="button"
                        onClick={() => selectMovementPath(fromOption.value, toOption.value)}
                        title={`${getCategoryLabel(fromOption.value)} to ${getCategoryLabel(toOption.value)}`}
                      >
                        {count}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            <div className="movement-results">
              <div className="search-row">
                <input
                  className="search-input"
                  type="search"
                  placeholder="Search user, ID, or name"
                  value={movementSearch}
                  onChange={(event) => setMovementSearch(event.target.value)}
                  disabled={!selectedMovement}
                />
              </div>
              <div className="scroll-panel movement-scroll">
                {selectedMovement ? (
                  <MovementUsersTable
                    title={movementList.title}
                    users={filteredMovementList}
                    loading={movementsLoading}
                  />
                ) : (
                  <div className="empty-state">Choose two different classifications.</div>
                )}
              </div>
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
                <label className="file-drop" htmlFor="sap-file">
                  <FileSpreadsheet size={22} aria-hidden="true" />
                  <span>{selectedFile ? selectedFile.name : "Choose Excel file"}</span>
                  <small>.xlsx or .xls</small>
                </label>
                <input
                  id="sap-file"
                  className="file-input-hidden"
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
            <button className="report-download" type="button" onClick={handleDownloadMasterReport}>
              <FileSpreadsheet size={18} aria-hidden="true" />
              Download Master Report
            </button>
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
              onDeleteUpload={setUploadPendingDelete}
              onDownloadUpload={handleDownloadUpload}
              deletingUploadId={deletingUploadId}
            />
          </section>
        </div>
      ) : null}

      {uploadPendingDelete ? (
        <div className="modal-backdrop confirm-backdrop" role="presentation">
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-upload-title"
          >
            <div className="confirm-icon" aria-hidden="true">
              <Trash2 size={22} />
            </div>
            <div>
              <h2 id="delete-upload-title">Delete latest upload?</h2>
              <p>
                This will remove the upload, its users, deleted-user results,
                classification movements, and the uploaded Excel file.
              </p>
            </div>
            <dl className="confirm-details">
              <div>
                <dt>Upload date</dt>
                <dd>{formatDate(uploadPendingDelete.upload_date)}</dd>
              </div>
              <div>
                <dt>File</dt>
                <dd title={uploadPendingDelete.file_name}>{uploadPendingDelete.file_name}</dd>
              </div>
              <div>
                <dt>Total users</dt>
                <dd>{uploadPendingDelete.total_users}</dd>
              </div>
              <div>
                <dt>Deleted users</dt>
                <dd>{uploadPendingDelete.deleted_users}</dd>
              </div>
            </dl>
            <div className="confirm-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setUploadPendingDelete(null)}
                disabled={deletingUploadId === uploadPendingDelete.id}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => handleDeleteUpload(uploadPendingDelete)}
                disabled={deletingUploadId === uploadPendingDelete.id}
              >
                <Trash2 size={16} aria-hidden="true" />
                {deletingUploadId === uploadPendingDelete.id ? "Deleting" : "Delete Upload"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isLogoutConfirmOpen ? (
        <div className="modal-backdrop confirm-backdrop" role="presentation">
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
          >
            <div className="confirm-icon" aria-hidden="true">
              <LogOut size={22} />
            </div>
            <div>
              <h2 id="logout-title">Log out?</h2>
              <p>You will need to sign in again to access the SAP User Tracker.</p>
            </div>
            <dl className="confirm-details">
              <div>
                <dt>Name</dt>
                <dd>{currentUser.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd title={currentUser.email}>{currentUser.email}</dd>
              </div>
            </dl>
            <div className="confirm-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
              >
                Cancel
              </button>
              <button className="danger-button" type="button" onClick={handleLogout}>
                <LogOut size={16} aria-hidden="true" />
                Log Out
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isAdminPanelOpen ? (
        <AdminPanel
          users={adminUsers}
          loginEvents={adminLoginEvents}
          currentUser={currentUser}
          loading={adminLoading}
          actionUserId={adminActionUserId}
          message={adminMessage}
          activeTab={adminTab}
          onTabChange={handleAdminTabChange}
          onClose={() => setIsAdminPanelOpen(false)}
          onPrepareAddUser={prepareAddAdminUser}
          onBlockUser={setBlockPendingUser}
          onUnblockUser={(user) => handleAdminUserAction(user, "unblock")}
          onResetPassword={setResetPendingUser}
          onDeleteUser={setDeletePendingUser}
          onClearLogins={() => setClearLoginsPending(true)}
          loginDate={adminLoginDate}
          onLoginDateChange={setAdminLoginDate}
          onResetLoginDate={handleResetAdminLoginDate}
        />
      ) : null}

      {addPendingUser ? (
        <div className="modal-backdrop confirm-backdrop" role="presentation">
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-title"
          >
            <div className="confirm-icon" aria-hidden="true">
              <UserCheck size={22} />
            </div>
            <div>
              <h2 id="add-user-title">Add user?</h2>
              <p>The user will be allowed to log in with the default first-login password.</p>
            </div>
            <dl className="confirm-details">
              <div>
                <dt>Name</dt>
                <dd>{addPendingUser.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd title={addPendingUser.email}>{addPendingUser.email}</dd>
              </div>
              <div>
                <dt>Default password</dt>
                <dd>Pannipitiya@123</dd>
              </div>
              <div>
                <dt>First login</dt>
                <dd>Password change required</dd>
              </div>
            </dl>
            <div className="confirm-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setAddPendingUser(null)}
                disabled={adminLoading}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => handleAddAdminUser(addPendingUser)}
                disabled={adminLoading}
              >
                <UserCheck size={16} aria-hidden="true" />
                {adminLoading ? "Adding" : "Add User"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {blockPendingUser ? (
        <div className="modal-backdrop confirm-backdrop" role="presentation">
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-user-title"
          >
            <div className="confirm-icon" aria-hidden="true">
              <Shield size={22} />
            </div>
            <div>
              <h2 id="block-user-title">Block user?</h2>
              <p>This user will not be able to sign in until an admin unblocks them.</p>
            </div>
            <dl className="confirm-details">
              <div>
                <dt>Name</dt>
                <dd>{blockPendingUser.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd title={blockPendingUser.email}>{blockPendingUser.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{blockPendingUser.role}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{blockPendingUser.is_active ? "Active" : "Blocked"}</dd>
              </div>
            </dl>
            <div className="confirm-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setBlockPendingUser(null)}
                disabled={adminActionUserId === blockPendingUser.id}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => handleAdminUserAction(blockPendingUser, "block")}
                disabled={adminActionUserId === blockPendingUser.id}
              >
                <Shield size={16} aria-hidden="true" />
                {adminActionUserId === blockPendingUser.id ? "Blocking" : "Block User"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {resetPendingUser ? (
        <div className="modal-backdrop confirm-backdrop" role="presentation">
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-title"
          >
            <div className="confirm-icon" aria-hidden="true">
              <Lock size={22} />
            </div>
            <div>
              <h2 id="reset-password-title">Reset password?</h2>
              <p>The user will use the default password and must change it at the next login.</p>
            </div>
            <dl className="confirm-details">
              <div>
                <dt>Name</dt>
                <dd>{resetPendingUser.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd title={resetPendingUser.email}>{resetPendingUser.email}</dd>
              </div>
              <div>
                <dt>Default password</dt>
                <dd>Pannipitiya@123</dd>
              </div>
              <div>
                <dt>Next login</dt>
                <dd>Password change required</dd>
              </div>
            </dl>
            <div className="confirm-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setResetPendingUser(null)}
                disabled={adminActionUserId === resetPendingUser.id}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => handleAdminUserAction(resetPendingUser, "reset")}
                disabled={adminActionUserId === resetPendingUser.id}
              >
                <Lock size={16} aria-hidden="true" />
                {adminActionUserId === resetPendingUser.id ? "Resetting" : "Reset Password"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deletePendingUser ? (
        <div className="modal-backdrop confirm-backdrop" role="presentation">
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
          >
            <div className="confirm-icon" aria-hidden="true">
              <Trash2 size={22} />
            </div>
            <div>
              <h2 id="delete-user-title">Delete user?</h2>
              <p>This removes the user from allowed access. Their old login history stays available.</p>
            </div>
            <dl className="confirm-details">
              <div>
                <dt>Name</dt>
                <dd>{deletePendingUser.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd title={deletePendingUser.email}>{deletePendingUser.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{deletePendingUser.role}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>Login disabled immediately</dd>
              </div>
            </dl>
            <div className="confirm-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setDeletePendingUser(null)}
                disabled={adminActionUserId === deletePendingUser.id}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => handleAdminUserAction(deletePendingUser, "delete")}
                disabled={adminActionUserId === deletePendingUser.id}
              >
                <Trash2 size={16} aria-hidden="true" />
                {adminActionUserId === deletePendingUser.id ? "Deleting" : "Delete User"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {clearLoginsPending ? (
        <div className="modal-backdrop confirm-backdrop" role="presentation">
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-logins-title"
          >
            <div className="confirm-icon" aria-hidden="true">
              <Trash2 size={22} />
            </div>
            <div>
              <h2 id="clear-logins-title">Clear login activity?</h2>
              <p>This will remove all login activity records for the selected date.</p>
            </div>
            <dl className="confirm-details">
              <div>
                <dt>Date</dt>
                <dd>{formatDate(adminLoginDate)}</dd>
              </div>
              <div>
                <dt>Records</dt>
                <dd>{adminLoginEvents.length}</dd>
              </div>
            </dl>
            <div className="confirm-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setClearLoginsPending(false)}
                disabled={adminLoading}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={handleClearAdminLogins}
                disabled={adminLoading}
              >
                <Trash2 size={16} aria-hidden="true" />
                {adminLoading ? "Clearing" : "Clear Activity"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default App;
