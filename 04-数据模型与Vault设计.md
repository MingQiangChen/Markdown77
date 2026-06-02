# 数据模型与 Vault 设计

## Vault 原则

Vault 是普通文件夹。

```text
Vault/
  notes/
  assets/
  .markdown77/
```

用户笔记必须是普通 Markdown 文件。

## 推荐结构

```text
Vault/
  日记/
    2026-06-03.md
  项目/
    Markdown77.md
  attachments/
    image-001.png
  .markdown77/
    config.json
    cache.db
```

## 不建议

不要把正文存进封闭数据库。

原因：

- 用户迁移困难。
- 同步冲突更难处理。
- 离线恢复成本高。
- 不符合 Markdown 用户预期。

## SQLite 索引

SQLite 只用于缓存和索引。

建议表：

```text
files
  id
  path
  mtime
  size
  hash

links
  source_file
  target
  link_text

tags
  file
  tag

blocks
  file
  block_id
  content

attachments
  file
  path
  type

search_index
  file
  content
```

## 链接格式

支持：

```markdown
[[笔记标题]]
[[笔记标题|显示文字]]
[[文件夹/笔记标题]]
#标签
```

## 附件策略

默认放到：

```text
attachments/
```

插入图片时生成相对路径：

```markdown
![[attachments/image-001.png]]
```
