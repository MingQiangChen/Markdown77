import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

type VaultFile = {
  path: string;
  name: string;
  modifiedAt: number;
};

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    title: "Markdown77",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

async function walkMarkdownFiles(root: string, current = root): Promise<VaultFile[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: VaultFile[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(root, absolutePath)));
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
      continue;
    }

    const stat = await fs.stat(absolutePath);
    files.push({
      path: path.relative(root, absolutePath),
      name: entry.name,
      modifiedAt: stat.mtimeMs
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path, "zh-CN"));
}

function resolveVaultPath(vaultPath: string, relativePath: string) {
  const resolved = path.resolve(vaultPath, relativePath);
  const root = path.resolve(vaultPath);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid file path outside vault.");
  }

  return resolved;
}

ipcMain.handle("vault:open", async () => {
  const options: OpenDialogOptions = {
    title: "打开 Vault 文件夹",
    properties: ["openDirectory", "createDirectory"]
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const vaultPath = result.filePaths[0];
  const files = await walkMarkdownFiles(vaultPath);

  return {
    path: vaultPath,
    name: path.basename(vaultPath),
    files
  };
});

ipcMain.handle("vault:listFiles", async (_event, vaultPath: string) => {
  return walkMarkdownFiles(vaultPath);
});

ipcMain.handle("vault:readFile", async (_event, vaultPath: string, relativePath: string) => {
  const filePath = resolveVaultPath(vaultPath, relativePath);
  return fs.readFile(filePath, "utf8");
});

ipcMain.handle(
  "vault:writeFile",
  async (_event, vaultPath: string, relativePath: string, content: string) => {
    const filePath = resolveVaultPath(vaultPath, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
    return true;
  }
);

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
