import { markdown } from "@codemirror/lang-markdown";
import CodeMirror, { type EditorView } from "@uiw/react-codemirror";
import MarkdownIt from "markdown-it";
import {
  AlertCircle,
  CalendarDays,
  FileText,
  FolderPlus,
  FolderOpen,
  FilePlus2,
  ChevronRight,
  ChevronDown,
  ListTree,
  Pencil,
  RefreshCcw,
  Save,
  Search,
  SplitSquareHorizontal,
  Tags,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Backlink,
  SearchResult,
  TagIndexEntry,
  VaultFile,
  VaultFolder,
  VaultInfo
} from "./global";

type TreeNode = {
  path: string;
  name: string;
  type: "folder" | "file";
  children: TreeNode[];
};

type OutlineItem = {
  id: string;
  level: number;
  title: string;
  line: number;
};

type FrontmatterInfo = {
  entries: Array<{
    key: string;
    value: string;
  }>;
  tags: string[];
  title?: string;
  created?: string;
  updated?: string;
};

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

const initialContent = `---
title: Markdown77
tags: [markdown, desktop, mvp]
created: 2026-06-03
---

# Markdown77

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeWikiTarget(target: string) {
  const trimmed = target.trim();
  const withExtension = trimmed.toLowerCase().endsWith(".md") ? trimmed : `${trimmed}.md`;
  return withExtension.replace(/\\/g, "/");
}

function renderWikiLinks(markdownText: string) {
  const escaped = markdownText.replace(/\[\[([^\]]+)\]\]/g, (_match, rawValue: string) => {
    const [rawTarget, rawLabel] = rawValue.split("|");
    const target = normalizeWikiTarget(rawTarget);
    const label = (rawLabel ?? rawTarget).trim();

    return `<button class="wiki-link" type="button" data-wiki-target="${escapeHtml(
      target
    )}">${escapeHtml(label)}</button>`;
  });

  return md.render(escaped);
}

function splitFrontmatter(markdownText: string) {
  const lines = markdownText.split("\n");

  if (lines[0]?.trim() !== "---") {
    return {
      body: markdownText,
      bodyStartLine: 1,
      rawFrontmatter: ""
    };
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");

  if (endIndex < 0) {
    return {
      body: markdownText,
      bodyStartLine: 1,
      rawFrontmatter: ""
    };
  }

  return {
    body: lines.slice(endIndex + 1).join("\n").replace(/^\n/, ""),
    bodyStartLine: endIndex + 2,
    rawFrontmatter: lines.slice(1, endIndex).join("\n")
  };
}

function parseTagValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((tag) => tag.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  return trimmed
    .split(/[,\s]+/)
    .map((tag) => tag.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function parseFrontmatter(markdownText: string): FrontmatterInfo {
  const { rawFrontmatter } = splitFrontmatter(markdownText);

  if (!rawFrontmatter) {
    return {
      entries: [],
      tags: []
    };
  }

  const entries: FrontmatterInfo["entries"] = [];
  const tags: string[] = [];
  const lines = rawFrontmatter.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);

    if (!pair) {
      continue;
    }

    const key = pair[1];
    let value = pair[2].trim().replace(/^["']|["']$/g, "");
    const normalizedKey = key.toLowerCase();

    if (normalizedKey === "tags") {
      const inlineTags = parseTagValue(value);

      if (inlineTags.length > 0) {
        tags.push(...inlineTags);
      } else {
        let cursor = index + 1;

        while (cursor < lines.length) {
          const listItem = /^\s*-\s+(.+)$/.exec(lines[cursor]);

          if (!listItem) {
            break;
          }

          tags.push(listItem[1].trim().replace(/^["']|["']$/g, ""));
          cursor += 1;
        }
      }
    }

    if (value && normalizedKey !== "tags") {
      entries.push({ key, value });
    } else if (normalizedKey === "tags") {
      entries.push({ key, value: tags.length > 0 ? tags.join(", ") : "无" });
    }
  }

  const valueFor = (key: string) =>
    entries.find((entry) => entry.key.toLowerCase() === key)?.value;

  return {
    entries,
    tags: Array.from(new Set(tags)),
    title: valueFor("title"),
    created: valueFor("created"),
    updated: valueFor("updated")
  };
}

function buildFileTree(files: VaultFile[], folders: VaultFolder[]) {
  const root: TreeNode = {
    path: "",
    name: "",
    type: "folder",
    children: []
  };
  const folderMap = new Map<string, TreeNode>([["", root]]);

  function ensureFolder(folderPath: string) {
    if (folderMap.has(folderPath)) {
      return folderMap.get(folderPath)!;
    }

    const parts = folderPath.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let next = folderMap.get(currentPath);

      if (!next) {
        next = {
          path: currentPath,
          name: part,
          type: "folder",
          children: []
        };
        folderMap.set(currentPath, next);
        current.children.push(next);
      }

      current = next;
    }

    return current;
  }

  folders.forEach((folder) => ensureFolder(folder.path.replace(/\\/g, "/")));

  files.forEach((file) => {
    const normalizedPath = file.path.replace(/\\/g, "/");
    const parts = normalizedPath.split("/");
    const fileName = parts.pop() ?? file.name;
    const parent = ensureFolder(parts.join("/"));

    parent.children.push({
      path: normalizedPath,
      name: fileName,
      type: "file",
      children: []
    });
  });

  function sortTree(node: TreeNode) {
    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      return a.name.localeCompare(b.name, "zh-CN");
    });
    node.children.forEach(sortTree);
  }

  sortTree(root);
  return root.children;
}

function extractOutline(markdownText: string): OutlineItem[] {
  const frontmatter = splitFrontmatter(markdownText);

  return frontmatter.body
    .split("\n")
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);

      if (!match) {
        return null;
      }

      const title = match[2].replace(/\s+#+$/, "").trim();

      if (!title) {
        return null;
      }

      return {
        id: `${frontmatter.bodyStartLine + index}-${title}`,
        level: match[1].length,
        title,
        line: frontmatter.bodyStartLine + index
      };
    })
    .filter((item): item is OutlineItem => Boolean(item));
}

export function App() {
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [files, setFiles] = useState<VaultFile[]>(demoFiles);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [content, setContent] = useState(initialContent);
  const [activeFile, setActiveFile] = useState("首页.md");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [tagIndex, setTagIndex] = useState<TagIndexEntry[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [saveState, setSaveState] = useState("演示模式");
  const [error, setError] = useState<string | null>(null);
  const activeFileRef = useRef(activeFile);
  const contentRef = useRef(content);
  const editorViewRef = useRef<EditorView | null>(null);
  const lastSavedContentRef = useRef(content);
  const isLoadingFileRef = useRef(false);

  const normalizedQuery = query.trim();
  const frontmatter = useMemo(() => parseFrontmatter(content), [content]);
  const previewContent = useMemo(() => splitFrontmatter(content).body, [content]);
  const rendered = useMemo(() => renderWikiLinks(previewContent), [previewContent]);
  const outline = useMemo(() => extractOutline(content), [content]);
  const visibleFiles = useMemo(
    () =>
      normalizedQuery
        ? files.filter((file) =>
            file.path.toLowerCase().includes(normalizedQuery.toLowerCase())
          )
        : files,
    [files, normalizedQuery]
  );
  const visibleFolders = useMemo(
    () =>
      normalizedQuery
        ? folders.filter((folder) =>
            folder.path.toLowerCase().includes(normalizedQuery.toLowerCase())
          )
        : folders,
    [folders, normalizedQuery]
  );
  const fileTree = useMemo(
    () => buildFileTree(visibleFiles, visibleFolders),
    [visibleFiles, visibleFolders]
  );
  const activeTagEntry = useMemo(
    () => tagIndex.find((entry) => entry.tag === activeTag) ?? null,
    [activeTag, tagIndex]
  );
  const canUseFileSystem = Boolean(window.markdown77);

  async function persistContent(filePath = activeFileRef.current, text = contentRef.current) {
    if (!vault || !filePath || !window.markdown77) {
      return false;
    }

    setError(null);
    setSaveState("保存中");
    await window.markdown77.writeFile(vault.path, filePath, text);
    lastSavedContentRef.current = text;
    setSaveState("已自动保存");
    await refreshFiles();
    await refreshBacklinks(vault, filePath);
    await refreshTags(vault);
    return true;
  }

  async function saveIfDirty() {
    if (!vault || !activeFileRef.current || !window.markdown77) {
      return;
    }

    if (contentRef.current === lastSavedContentRef.current) {
      return;
    }

    await persistContent(activeFileRef.current, contentRef.current);
  }

  async function loadVaultInfo(nextVault: VaultInfo) {
    setVault(nextVault);
    setFiles(nextVault.files);
    setFolders(nextVault.folders);
    setActiveTag(null);
    setExpandedFolders(new Set(nextVault.folders.map((folder) => folder.path)));
    setSaveState("Vault 已打开");
    await refreshTags(nextVault);

    const fileToOpen = nextVault.lastFilePath
      ? nextVault.files.find((file) => file.path === nextVault.lastFilePath)
      : nextVault.files[0];

    if (fileToOpen) {
      await openFile(nextVault, fileToOpen.path);
    } else {
      setActiveFile("");
      setContent("# 新 Vault\n\n这个 Vault 里还没有 Markdown 文件。");
      setBacklinks([]);
    }
  }

  async function openVault() {
    if (!window.markdown77) {
      setError("请在 Electron 桌面壳中打开 Vault。");
      return;
    }

    setError(null);
    await saveIfDirty();
    const nextVault = await window.markdown77.openVault();

    if (!nextVault) {
      return;
    }

    await loadVaultInfo(nextVault);
  }

  async function refreshFiles() {
    if (!vault || !window.markdown77) {
      return;
    }

    const contents = await window.markdown77.listFiles(vault.path);
    setFiles(contents.files);
    setFolders(contents.folders);
    await refreshTags(vault);
  }

  function toggleFolder(folderPath: string) {
    setExpandedFolders((current) => {
      const next = new Set(current);

      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }

      return next;
    });
  }

  function renderTree(nodes: TreeNode[], depth = 0): ReactNode {
    return nodes.map((node) => {
      const indent = depth * 14;

      if (node.type === "folder") {
        const isExpanded = expandedFolders.has(node.path);

        return (
          <div className="tree-node" key={node.path}>
            <button
              className="tree-folder"
              style={{ paddingLeft: 8 + indent }}
              type="button"
              onClick={() => toggleFolder(node.path)}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <FolderOpen size={15} />
              <span>{node.name}</span>
            </button>
            {isExpanded && node.children.length > 0 && renderTree(node.children, depth + 1)}
          </div>
        );
      }

      return (
        <button
          className={node.path === activeFile ? "tree-file active" : "tree-file"}
          key={node.path}
          style={{ paddingLeft: 22 + indent }}
          type="button"
          onClick={() => {
            if (vault) {
              void openFile(vault, node.path);
            } else {
              setActiveFile(node.path);
            }
          }}
        >
          <FileText size={16} />
          <span>{node.name}</span>
        </button>
      );
    });
  }

  async function refreshBacklinks(nextVault = vault, filePath = activeFile) {
    if (!nextVault || !filePath || !window.markdown77) {
      setBacklinks([]);
      return;
    }

    const nextBacklinks = await window.markdown77.getBacklinks(nextVault.path, filePath);
    setBacklinks(nextBacklinks);
  }

  async function refreshTags(nextVault = vault) {
    if (!nextVault || !window.markdown77) {
      setTagIndex([]);
      return;
    }

    const nextTags = await window.markdown77.getTags(nextVault.path);
    setTagIndex(nextTags);
    setActiveTag((currentTag) =>
      currentTag && nextTags.some((entry) => entry.tag === currentTag) ? currentTag : null
    );
  }

  async function openFile(nextVault: VaultInfo, filePath: string) {
    if (!window.markdown77) {
      setActiveFile(filePath);
      return;
    }

    setError(null);
    await saveIfDirty();
    isLoadingFileRef.current = true;
    const text = await window.markdown77.readFile(nextVault.path, filePath);
    setActiveFile(filePath);
    setContent(text);
    activeFileRef.current = filePath;
    contentRef.current = text;
    lastSavedContentRef.current = text;
    await window.markdown77.setLastFile(filePath);
    setSaveState("已加载");
    await refreshBacklinks(nextVault, filePath);
    window.setTimeout(() => {
      isLoadingFileRef.current = false;
    }, 0);
  }

  async function saveFile() {
    if (!vault || !activeFile || !window.markdown77) {
      return;
    }

    setError(null);
    await persistContent(activeFile, content);
    setSaveState("已保存");
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
      `---\ntitle: ${title}\ntags: []\ncreated: ${new Date().toISOString().slice(0, 10)}\n---\n\n# ${title}\n\n`
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
      await refreshTags(vault);

      if (contents.files[0]) {
        await openFile(vault, contents.files[0].path);
      } else {
        setActiveFile("");
        setContent("# 空 Vault\n\n这个 Vault 里还没有 Markdown 文件。");
        setBacklinks([]);
        setSaveState("已删除");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败。");
    }
  }

  async function openWikiLink(target: string) {
    if (!vault || !window.markdown77) {
      setError("请先打开一个 Vault。");
      return;
    }

    const existingFile = files.find(
      (file) => file.path.toLowerCase() === target.toLowerCase()
    );

    if (existingFile) {
      await openFile(vault, existingFile.path);
      return;
    }

    const confirmed = window.confirm(`${target} 不存在。是否创建这个笔记？`);

    if (!confirmed) {
      return;
    }

    const title = target.replace(/\.md$/i, "").split(/[\\/]/).pop() || "新笔记";
    const newFile = await window.markdown77.createFile(
      vault.path,
      target,
      `---\ntitle: ${title}\ntags: []\ncreated: ${new Date().toISOString().slice(0, 10)}\n---\n\n# ${title}\n\n`
    );
    await refreshFiles();
    await openFile(vault, newFile.path);
    setSaveState("已创建链接笔记");
  }

  function jumpToOutlineItem(item: OutlineItem) {
    const view = editorViewRef.current;

    if (!view) {
      return;
    }

    const line = view.state.doc.line(Math.min(item.line, view.state.doc.lines));
    view.dispatch({
      selection: { anchor: line.from },
      scrollIntoView: true
    });
    view.focus();
  }

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  useEffect(() => {
    if (!window.markdown77) {
      return;
    }

    let isActive = true;
    setSaveState("正在恢复 Vault");

    void window.markdown77
      .getLastVault()
      .then((lastVault) => {
        if (!isActive) {
          return;
        }

        if (lastVault) {
          void loadVaultInfo(lastVault);
        } else {
          setSaveState("演示模式");
        }
      })
      .catch((restoreError) => {
        if (isActive) {
          setError(restoreError instanceof Error ? restoreError.message : "恢复 Vault 失败。");
          setSaveState("恢复失败");
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    contentRef.current = content;

    if (!vault || !activeFile || !window.markdown77) {
      return;
    }

    if (isLoadingFileRef.current || content === lastSavedContentRef.current) {
      return;
    }

    setSaveState("有未保存修改");

    const timeout = window.setTimeout(() => {
      void persistContent(activeFile, content).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : "自动保存失败。");
        setSaveState("自动保存失败");
      });
    }, 900);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [content, activeFile, vault]);

  useEffect(() => {
    if (!vault || !window.markdown77 || !normalizedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let isActive = true;
    setIsSearching(true);

    const timeout = window.setTimeout(() => {
      void window.markdown77
        ?.search(vault.path, normalizedQuery)
        .then((results) => {
          if (isActive) {
            setSearchResults(results);
          }
        })
        .catch((searchError) => {
          if (isActive) {
            setError(searchError instanceof Error ? searchError.message : "搜索失败。");
          }
        })
        .finally(() => {
          if (isActive) {
            setIsSearching(false);
          }
        });
    }, 180);

    return () => {
      isActive = false;
      window.clearTimeout(timeout);
    };
  }, [normalizedQuery, vault]);

  function handlePreviewClick(event: React.MouseEvent<HTMLElement>) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const wikiButton = target.closest<HTMLButtonElement>("[data-wiki-target]");

    if (!wikiButton) {
      return;
    }

    const wikiTarget = wikiButton.dataset.wikiTarget;

    if (!wikiTarget) {
      return;
    }

    void openWikiLink(wikiTarget);
  }

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

          {vault && normalizedQuery && (
            <section className="search-results" aria-label="Search results">
              <div className="section-title">
                <span>全文搜索</span>
                <small>{isSearching ? "搜索中" : `${searchResults.length} 个结果`}</small>
              </div>
              {searchResults.map((result) => (
                <button
                  className="search-result"
                  key={`${result.path}-${result.matchType}`}
                  type="button"
                  onClick={() => {
                    if (vault) {
                      void openFile(vault, result.path);
                    }
                  }}
                >
                  <strong>{result.title}</strong>
                  <span>{result.snippet}</span>
                </button>
              ))}
              {!isSearching && searchResults.length === 0 && (
                <p className="empty-hint">没有正文匹配。</p>
              )}
            </section>
          )}

          {vault && activeTagEntry && !normalizedQuery && (
            <section className="tag-results" aria-label="Tag results">
              <div className="section-title">
                <span>标签：{activeTagEntry.tag}</span>
                <button
                  className="clear-filter-button"
                  type="button"
                  onClick={() => setActiveTag(null)}
                  title="清除标签过滤"
                >
                  <X size={13} />
                </button>
              </div>
              {activeTagEntry.files.map((file) => (
                <button
                  className="tag-result"
                  key={file.path}
                  type="button"
                  onClick={() => {
                    if (vault) {
                      void openFile(vault, file.path);
                    }
                  }}
                >
                  <strong>{file.title}</strong>
                  <span>{file.path}</span>
                </button>
              ))}
            </section>
          )}

          <nav className="file-tree" aria-label="Vault files">
            {fileTree.length > 0 ? renderTree(fileTree) : <p className="empty-hint">没有文件。</p>}
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
                onCreateEditor={(view) => {
                  editorViewRef.current = view;
                }}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true
                }}
              />
            </div>
            <article
              className="preview"
              onClick={handlePreviewClick}
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          </div>

          {vault && activeFile && (
            <div className="inspector-panels">
              <section className="properties-panel">
                <div className="section-title">
                  <span>属性</span>
                  <small>{frontmatter.entries.length} 项</small>
                </div>
                {frontmatter.entries.length > 0 ? (
                  <div className="property-list">
                    {frontmatter.title && (
                      <div className="property-row">
                        <FileText size={14} />
                        <span>标题</span>
                        <strong>{frontmatter.title}</strong>
                      </div>
                    )}
                    {frontmatter.created && (
                      <div className="property-row">
                        <CalendarDays size={14} />
                        <span>创建</span>
                        <strong>{frontmatter.created}</strong>
                      </div>
                    )}
                    {frontmatter.updated && (
                      <div className="property-row">
                        <CalendarDays size={14} />
                        <span>更新</span>
                        <strong>{frontmatter.updated}</strong>
                      </div>
                    )}
                    <div className="tag-row">
                      <Tags size={14} />
                      <span>标签</span>
                      <div className="tag-list">
                        {frontmatter.tags.length > 0 ? (
                          frontmatter.tags.map((tag) => (
                            <button
                              className="tag-chip"
                              key={tag}
                              type="button"
                              onClick={() => setActiveTag(tag)}
                            >
                              {tag}
                            </button>
                          ))
                        ) : (
                          <strong>无</strong>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="empty-hint">当前笔记还没有 Frontmatter。</p>
                )}
              </section>

              <section className="outline-panel">
                <div className="section-title">
                  <span>大纲</span>
                  <small>{outline.length} 个标题</small>
                </div>
                {outline.length > 0 ? (
                  <div className="outline-list">
                    {outline.map((item) => (
                      <button
                        className="outline-item"
                        key={item.id}
                        style={{ paddingLeft: 8 + (item.level - 1) * 14 }}
                        type="button"
                        onClick={() => jumpToOutlineItem(item)}
                      >
                        <ListTree size={14} />
                        <span>{item.title}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-hint">当前笔记还没有标题。</p>
                )}
              </section>

              <section className="backlinks-panel">
                <div className="section-title">
                  <span>反向链接</span>
                  <small>{backlinks.length} 个来源</small>
                </div>
                {backlinks.length > 0 ? (
                  <div className="backlinks-list">
                    {backlinks.map((backlink) => (
                      <button
                        className="backlink-item"
                        key={backlink.sourcePath}
                        type="button"
                        onClick={() => {
                          if (vault) {
                            void openFile(vault, backlink.sourcePath);
                          }
                        }}
                      >
                        <strong>{backlink.sourcePath}</strong>
                        <span>{backlink.snippet}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="empty-hint">还没有其他笔记链接到当前笔记。</p>
                )}
              </section>
            </div>
          )}
        </section>
      </main>

      <footer className="statusbar">
        <span>Vault: {vault ? vault.path : "Demo"}</span>
        <span>{saveState}</span>
      </footer>
    </div>
  );
}
