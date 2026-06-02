import { markdown } from "@codemirror/lang-markdown";
import CodeMirror from "@uiw/react-codemirror";
import MarkdownIt from "markdown-it";
import { FileText, FolderOpen, Search, SplitSquareHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

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
  "首页.md",
  "日记/2026-06-03.md",
  "项目/Markdown77.md",
  "项目/MVP功能规格说明.md"
];

export function App() {
  const [content, setContent] = useState(initialContent);
  const [activeFile, setActiveFile] = useState("首页.md");
  const [query, setQuery] = useState("");

  const rendered = useMemo(() => md.render(content), [content]);
  const visibleFiles = demoFiles.filter((file) =>
    file.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M77</span>
          <div>
            <h1>Markdown77</h1>
            <p>Desktop MVP</p>
          </div>
        </div>
        <button className="toolbar-button" type="button">
          <FolderOpen size={18} />
          <span>打开 Vault</span>
        </button>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索文件"
            />
          </div>

          <nav className="file-list" aria-label="Vault files">
            {visibleFiles.map((file) => (
              <button
                className={file === activeFile ? "file-item active" : "file-item"}
                key={file}
                type="button"
                onClick={() => setActiveFile(file)}
              >
                <FileText size={16} />
                <span>{file}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="editor-pane">
          <div className="pane-header">
            <div>
              <span className="label">当前文件</span>
              <strong>{activeFile}</strong>
            </div>
            <div className="mode-indicator">
              <SplitSquareHorizontal size={16} />
              <span>分屏</span>
            </div>
          </div>

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
        <span>Vault: Demo</span>
        <span>已保存</span>
      </footer>
    </div>
  );
}
