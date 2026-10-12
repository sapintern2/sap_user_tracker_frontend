const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

let backendProcess = null;
let mainWindow = null;

const BACKEND_PORT = 18765;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

function getBackendDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend");
  }

  return path.join(__dirname, "..", "backend");
}

function getBackendPath() {
  return path.join(getBackendDir(), "SAPTrackerBackend-v2.exe");
}

function getAppDataDir() {
  return path.join(app.getPath("appData"), "SAP User Tracker");
}

function getExternalConfigPath() {
  return path.join(getAppDataDir(), "config.env");
}

function ensureExternalConfigFile() {
  const appDataDir = getAppDataDir();
  const configPath = getExternalConfigPath();

  fs.mkdirSync(appDataDir, { recursive: true });

  if (!fs.existsSync(configPath)) {
    // Keep credentials external to the installer. The backend safely supplies
    // its SQLite default when DATABASE_URL is absent.
    fs.writeFileSync(configPath, "", { flag: "wx" });
  }

  return configPath;
}

function getSapExportsDir() {
  return path.join(app.getPath("desktop"), "SAP_EXPORTS");
}

function ensureSapExportsDir() {
  const sapExportsDir = getSapExportsDir();

  fs.mkdirSync(sapExportsDir, {
    recursive: true,
  });

  return sapExportsDir;
}

function updateSapExportFolder(configPath, sapExportsDir) {
  if (!fs.existsSync(configPath)) {
    console.error(
      "Cannot update SAP export folder because config file does not exist:",
      configPath
    );
    return false;
  }

  let config = fs.readFileSync(configPath, "utf8");

  const normalizedPath = sapExportsDir.replace(/\\/g, "\\\\");

  const newSetting = `SAP_EXPORT_WATCH_FOLDER=${normalizedPath}`;

  const settingRegex = /^SAP_EXPORT_WATCH_FOLDER=.*$/m;

  if (settingRegex.test(config)) {
    config = config.replace(settingRegex, newSetting);
  } else {
    if (!config.endsWith("\n")) {
      config += "\n";
    }

    config += `${newSetting}\n`;
  }

  fs.writeFileSync(configPath, config, "utf8");

  console.log(
    "SAP export watch folder configured:",
    sapExportsDir
  );

  return true;
}

function getAppIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "cbl_icon.png");
  }

  return path.join(
    __dirname,
    "..",
    "src",
    "assets",
    "cbl_icon.png"
  );
}

function startBackend() {
  const sapExportsDir = ensureSapExportsDir();

  console.log("SAP export folder:", sapExportsDir);

  const backendDir = getBackendDir();
  const backendPath = getBackendPath();
  const configPath = ensureExternalConfigFile();

  console.log("Backend directory:", backendDir);
  console.log("Backend executable:", backendPath);
  console.log("External configuration:", configPath);

  const configUpdated = updateSapExportFolder(
    configPath,
    sapExportsDir
  );

  if (!configUpdated) {
    console.error("Failed to update SAP export folder configuration.");
    return;
  }

  backendProcess = spawn(backendPath, [], {
    cwd: backendDir,
    windowsHide: true,
    env: {
      ...process.env,
      SAP_TRACKER_CONFIG_FILE: configPath,
      SAP_TRACKER_PORT: String(BACKEND_PORT),
    },
  });

  backendProcess.on("error", (error) => {
    console.error("Failed to start backend:", error);
  });

  backendProcess.stdout?.on("data", (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr?.on("data", (data) => {
    console.error(`Backend: ${data}`);
  });

  backendProcess.on("exit", (code) => {
    console.log(`Backend exited with code ${code}`);
    backendProcess = null;
  });
}

function waitForBackend(attempts = 30) {
  return new Promise((resolve) => {
    function check(remaining) {
      const request = http.get(`${BACKEND_URL}/health`, (response) => {
        response.resume();

        if (response.statusCode >= 200 && response.statusCode < 500) {
          resolve(true);
        } else {
          retry(remaining);
        }
      });

      request.setTimeout(2000, () => request.destroy());
      request.on("error", () => retry(remaining));
    }

    function retry(remaining) {
      if (remaining <= 0) {
        console.error("Backend did not start in time.");
        resolve(false);
        return;
      }

      setTimeout(() => check(remaining - 1), 500);
    }

    check(attempts);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    icon: getAppIconPath(),

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const frontendPath = path.join(
    __dirname,
    "..",
    "dist",
    "index.html"
  );

  mainWindow.loadFile(frontendPath);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Never make the desktop window depend on a successful backend launch. A
  // missing dependency or an antivirus-blocked backend used to leave users
  // with no window and no explanation after installation.
  createWindow();
  startBackend();

  const backendReady = await waitForBackend();
  if (!backendReady && mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "SAP User Tracker could not start its local service",
      message: "The application window is open, but its local service did not start.",
      detail:
        "Close the application and try again. If the problem continues, ensure SAPTrackerBackend.exe has not been blocked by antivirus software and that port 18765 is available.",
    });
  }
});

app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
