import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

type VaultFile = {
  path: string;
  name: string;
  modifiedAt: number;
};

type VaultFolder = {
  path: string;
  name: string;
};

type SearchResult = {
  path: string;
  title: string;
  snippet: string;
  matchType: "filename" | "content";
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

async function walkVault(root: string, current = root): Promise<{
  files: VaultFile[];
  folders: VaultFolder[];
}> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: VaultFile[] = [];
  const folders: VaultFolder[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      const relativePath = path.relative(root, absolutePath);
      folders.push({
        path: relativePath,
        name: entry.name
      });

      const child = await walkVault(root, absolutePath);
      files.push(...child.files);
      folders.push(...child.folders);
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

  return {
    files: files.sort((a, b) => a.path.localeCompare(b.path, "zh-CN")),
    folders: folders.sort((a, b) => a.path.localeCompare(b.path, "zh-CN"))
  };
}

function resolveVaultPath(vaultPath: string, relativePath: string) {
  const resolved = path.resolve(vaultPath, relativePath);
  const root = path.resolve(vaultPath);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid file path outside vault.");
  }

  return resolved;
}

function normalizeMarkdownPath(input: string) {
  const trimmed = input.trim();
  const withExtension = trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`;
  return withExtension
    .split(/[\\/]+/)
    .filter(Boolean)
    .join(path.sep);
}

async function getAvailablePath(vaultPath: string, preferredRelativePath: string) {
  const parsed = path.parse(preferredRelativePath);
  let candidate = preferredRelativePath;
  let index = 2;

  while (true) {
    const absolutePath = resolveVaultPath(vaultPath, candidate);

    try {
      await fs.access(absolutePath);
      candidate = path.join(parsed.dir, `${parsed.name} ${index}${parsed.ext}`);
      index += 1;
    } catch {
      return candidate;
    }
  }
}

async function assertPathExists(filePath: string) {
  await fs.access(filePath);
}

function createSnippet(content: string, query: string) {
  const normalizedContent = content.replace(/\s+/g, " ").trim();
  const index = normalizedContent.toLowerCase().indexOf(query.toLowerCase());

  if (index === -1) {
    return normalizedContent.slice(0, 120);
  }

  const start = Math.max(0, index - 48);
  const end = Math.min(normalizedContent.length, index + query.length + 72);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedContent.length ? "..." : "";

  return `${prefix}${normalizedContent.slice(start, end)}${suffix}`;
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
  const { files, folders } = await walkVault(vaultPath);

  return {
    path: vaultPath,
    name: path.basename(vaultPath),
    files,
    folders
  };
});

ipcMain.handle("vault:listFiles", async (_event, vaultPath: string) => {
  return walkVault(vaultPath);
});

ipcMain.handle("vault:search", async (_event, vaultPath: string, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [] satisfies SearchResult[];
  }

  const { files } = await walkVault(vaultPath);
  const results: SearchResult[] = [];

  for (const file of files) {
    const filePath = resolveVaultPath(vaultPath, file.path);
    const filenameMatches = file.path.toLowerCase().includes(normalizedQuery);
    const content = await fs.readFile(filePath, "utf8");
    const contentMatches = content.toLowerCase().includes(normalizedQuery);

    if (!filenameMatches && !contentMatches) {
      continue;
    }

    results.push({
      path: file.path,
      title: file.path,
      snippet: contentMatches ? createSnippet(content, query) : "文件名匹配",
      matchType: contentMatches ? "content" : "filename"
    });
  }

  return results.slice(0, 100);
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

ipcMain.handle(
  "vault:createFile",
  async (_event, vaultPath: string, preferredRelativePath: string, content: string) => {
    const normalizedPath = normalizeMarkdownPath(preferredRelativePath || "新笔记.md");
    const relativePath = await getAvailablePath(vaultPath, normalizedPath);
    const filePath = resolveVaultPath(vaultPath, relativePath);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");

    return {
      path: relativePath,
      name: path.basename(relativePath),
      modifiedAt: Date.now()
    };
  }
);

ipcMain.handle("vault:createFolder", async (_event, vaultPath: string, folderName: string) => {
  const normalizedName = (folderName.trim() || "新文件夹")
    .split(/[\\/]+/)
    .filter(Boolean)
    .join(path.sep);
  let candidate = normalizedName;
  let index = 2;

  while (true) {
    const folderPath = resolveVaultPath(vaultPath, candidate);

    try {
      await fs.access(folderPath);
      candidate = `${normalizedName} ${index}`;
      index += 1;
    } catch {
      await fs.mkdir(folderPath, { recursive: true });
      return {
        path: candidate,
        name: path.basename(candidate)
      };
    }
  }
});

ipcMain.handle(
  "vault:renameFile",
  async (_event, vaultPath: string, currentRelativePath: string, nextRelativePath: string) => {
    const currentPath = resolveVaultPath(vaultPath, currentRelativePath);
    const normalizedNextPath = normalizeMarkdownPath(nextRelativePath);
    const nextPath = resolveVaultPath(vaultPath, normalizedNextPath);

    await assertPathExists(currentPath);

    try {
      await fs.access(nextPath);
      throw new Error("目标文件已存在。");
    } catch (error) {
      if (error instanceof Error && error.message === "目标文件已存在。") {
        throw error;
      }
    }

    await fs.mkdir(path.dirname(nextPath), { recursive: true });
    await fs.rename(currentPath, nextPath);

    const stat = await fs.stat(nextPath);

    return {
      path: normalizedNextPath,
      name: path.basename(normalizedNextPath),
      modifiedAt: stat.mtimeMs
    };
  }
);

ipcMain.handle("vault:deleteFile", async (_event, vaultPath: string, relativePath: string) => {
  const filePath = resolveVaultPath(vaultPath, relativePath);
  await assertPathExists(filePath);

  try {
    await shell.trashItem(filePath);
  } catch {
    await fs.rm(filePath, { force: true });
  }

  return true;
});

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
