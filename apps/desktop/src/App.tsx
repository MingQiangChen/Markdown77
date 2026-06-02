import { markdown } from "@codemirror/lang-markdown";
import CodeMirror from "@uiw/react-codemirror";
import MarkdownIt from "markdown-it";
import {
  AlertCircle,
  FileText,
  FolderPlus,
  FolderOpen,
  FilePlus2,
  Pencil,
  RefreshCcw,
  Save,
  Search,
  SplitSquareHorizontal,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { VaultFile, VaultFolder, VaultInfo } from "./global";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

const initialContent = `# Markdown77

欢迎使用 Markdown77 桌面 MVP 原型。

## 第一版范围

- 本地 Vault 文件夹
- Markdown 编辑器
- 实时预览
- 文件树
- 全文搜索
- 双向链接 [[笔记]]

## 示例链接

你可以写 \`[[项目计划]]\` 这样的双向链接。
`;

const demoFiles = [
  {
    path: "首页.md",
    name: "首页.md",
    modifiedAt: Date.now()
  },
  {
    path: "日记/2026-06-03.md",
    name: "2026-06-03.md",
    modifiedAt: Date.now()
  },
  {
    path: "项目/Markdown77.md",
    name: "Markdown77.md",
    modifiedAt: Date.now()
  },
  {
    path: "项目/MVP功能规格说明.md",
    name: "MVP功能规格说明.md",
    modifiedAt: Date.now()
  }
];

export function App() {
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [files, setFiles] = useState<VaultFile[]>(demoFiles);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [content, setContent] = useState(initialContent);
  const [activeFile, setActiveFile] = useState("首页.md");
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState("演示模式");
  const [error, setError] = useState<string | null>(null);

  const rendered = useMemo(() => md.render(content), [content]);
  const visibleFiles = files.filter((file) =>
    file.path.toLowerCase().includes(query.trim().toLowerCase())
  );
  const visibleFolders = folders.filter((folder) =>
    folder.path.toLowerCase().includes(query.trim().toLowerCase())
  );
  const canUseFileSystem = Boolean(window.markdown77);

  async function openVault() {
    if (!window.markdown77) {
      setError("请在 Electron 桌面壳中打开 Vault。");
      return;
    }

    setError(null);
    const nextVault = await window.markdown77.openVault();

    if (!nextVault) {
      return;
    }

    setVault(nextVault);
    setFiles(nextVault.files);
    setFolders(nextVault.folders);
    setSaveState("Vault 已打开");

    if (nextVault.files[0]) {
      await openFile(nextVault, nextVault.files[0].path);
    } else {
      setActiveFile("");
      setContent("# 新 Vault\n\n这个 Vault 里还没有 Markdown 文件。");
    }
  }

  async function refreshFiles() {
    if (!vault || !window.markdown77) {
      return;
    }

    const contents = await window.markdown77.listFiles(vault.path);
    setFiles(contents.files);
    setFolders(contents.folders);
  }

  async function openFile(nextVault: VaultInfo, filePath: string) {
    if (!window.markdown77) {
      setActiveFile(filePath);
      return;
    }

    setError(null);
    const text = await window.markdown77.readFile(nextVault.path, filePath);
    setActiveFile(filePath);
    setContent(text);
    setSaveState("已加载");
  }

  async function saveFile() {
    if (!vault || !activeFile || !window.markdown77) {
      return;
    }

    setError(null);
    setSaveState("保存中");
    await window.markdown77.writeFile(vault.path, activeFile, content);
    setSaveState("已保存");
    await refreshFiles();
  }

  async function createNote() {
    if (!vault || !window.markdown77) {
      setError("请先打开一个 Vault。");
      return;
    }

    const preferredPath = window.prompt("新笔记路径", "新笔记.md");

    if (!preferredPath) {
      return;
    }

    setError(null);
    const title = preferredPath.replace(/\.md$/i, "").split(/[\\/]/).pop() || "新笔记";
    const newFile = await window.markdown77.createFile(
      vault.path,
      preferredPath,
      `# ${title}\n\n`
    );
    await refreshFiles();
    await openFile(vault, newFile.path);
    setSaveState("已创建");
  }

  async function createFolder() {
    if (!vault || !window.markdown77) {
      setError("请先打开一个 Vault。");
      return;
    }

    const folderName = window.prompt("新文件夹名称", "新文件夹");

    if (!folderName) {
      return;
    }

    setError(null);
    await window.markdown77.createFolder(vault.path, folderName);
    await refreshFiles();
    setSaveState("文件夹已创建");
  }

  async function renameActiveFile() {
    if (!vault || !activeFile || !window.markdown77) {
      return;
    }

    const nextPath = window.prompt("重命名笔记", activeFile);

    if (!nextPath || nextPath === activeFile) {
      return;
    }

    try {
      setError(null);
      const renamedFile = await window.markdown77.renameFile(vault.path, activeFile, nextPath);
      await refreshFiles();
      await openFile(vault, renamedFile.path);
      setSaveState("已重命名");
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "重命名失败。");
    }
  }

  async function deleteActiveFile() {
    if (!vault || !activeFile || !window.markdown77) {
      return;
    }

    const confirmed = window.confirm(`确定删除 ${activeFile}？`);

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      await window.markdown77.deleteFile(vault.path, activeFile);
      const contents = await window.markdown77.listFiles(vault.path);
      setFiles(contents.files);
      setFolders(contents.folders);

      if (contents.files[0]) {
        await openFile(vault, contents.files[0].path);
      } else {
        setActiveFile("");
        setContent("# 空 Vault\n\n这个 Vault 里还没有 Markdown 文件。");
        setSaveState("已删除");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败。");
    }
  }

  useEffect(() => {
    if (!vault || !activeFile || !window.markdown77) {
      return;
    }

    setSaveState("有未保存修改");
  }, [content, activeFile, vault]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M77</span>
          <div>
            <h1>Markdown77</h1>
            <p>{vault ? vault.name : "Desktop MVP"}</p>
          </div>
        </div>
        <button className="toolbar-button" type="button" onClick={openVault}>
          <FolderOpen size={18} />
          <span>打开 Vault</span>
        </button>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-tools">
            <div className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索文件"
              />
            </div>

            <div className="create-actions">
              <button
                className="tool-icon-button"
                type="button"
                onClick={createNote}
                disabled={!vault}
                title="新建笔记"
              >
                <FilePlus2 size={16} />
              </button>
              <button
                className="tool-icon-button"
                type="button"
                onClick={createFolder}
                disabled={!vault}
                title="新建文件夹"
              >
                <FolderPlus size={16} />
              </button>
            </div>
          </div>

          {vault && visibleFolders.length > 0 && (
            <div className="folder-list" aria-label="Vault folders">
              {visibleFolders.map((folder) => (
                <div className="folder-item" key={folder.path}>
                  <FolderOpen size={15} />
                  <span>{folder.path}</span>
                </div>
              ))}
            </div>
          )}

          <nav className="file-list" aria-label="Vault files">
            {visibleFiles.map((file) => (
              <button
                className={file.path === activeFile ? "file-item active" : "file-item"}
                key={file.path}
                type="button"
                onClick={() => {
                  if (vault) {
                    void openFile(vault, file.path);
                  } else {
                    setActiveFile(file.path);
                  }
                }}
              >
                <FileText size={16} />
                <span>{file.path}</span>
              </button>
            ))}
          </nav>

          {!canUseFileSystem && (
            <div className="sidebar-note">
              <AlertCircle size={16} />
              <span>浏览器预览为演示模式。运行 Electron 后可读写本地文件。</span>
            </div>
          )}
        </aside>

        <section className="editor-pane">
          <div className="pane-header">
            <div>
              <span className="label">当前文件</span>
              <strong>{activeFile || "未选择文件"}</strong>
            </div>
            <div className="header-actions">
              {vault && (
                <button className="icon-button" type="button" onClick={refreshFiles}>
                  <RefreshCcw size={16} />
                  <span>刷新</span>
                </button>
              )}
              {vault && activeFile && (
                <button className="icon-button primary" type="button" onClick={saveFile}>
                  <Save size={16} />
                  <span>保存</span>
                </button>
              )}
              {vault && activeFile && (
                <button className="icon-button" type="button" onClick={renameActiveFile}>
                  <Pencil size={16} />
                  <span>重命名</span>
                </button>
              )}
              {vault && activeFile && (
                <button className="icon-button danger" type="button" onClick={deleteActiveFile}>
                  <Trash2 size={16} />
                  <span>删除</span>
                </button>
              )}
              <div className="mode-indicator">
                <SplitSquareHorizontal size={16} />
                <span>分屏</span>
              </div>
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="split-view">
            <div className="editor-surface">
              <CodeMirror
                value={content}
                height="100%"
                extensions={[markdown()]}
                onChange={setContent}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true
                }}
              />
            </div>
            <article
              className="preview"
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          </div>
        </section>
      </main>

      <footer className="statusbar">
        <span>Vault: {vault ? vault.path : "Demo"}</span>
        <span>{saveState}</span>
      </footer>
    </div>
  );
}
