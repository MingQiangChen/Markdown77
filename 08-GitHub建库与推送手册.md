# GitHub 建库与推送手册

本文记录 Markdown77 项目从本地文档到 GitHub 仓库的完整流程。

## 目标

把本地项目推送到 GitHub：

```text
https://github.com/MingQiangChen/Markdown77
```

## 本地项目目录

当前 Git 仓库目录：

```text
/Users/chenmingqiang/.codex/Markdown77
```

iCloud Obsidian 技术文档目录：

```text
/Users/chenmingqiang/Library/Mobile Documents/iCloud~md~obsidian/Documents/Cmqobsisian/Markdown77
```

## 为什么不用 iCloud 目录直接做 Git 仓库

iCloud Obsidian 目录不适合直接初始化 Git 仓库。

原因：

- iCloud 容器可能限制 `.git` 元数据写入。
- iCloud 同步可能和 Git 文件锁冲突。
- `.git/config`、`.git/index` 等文件频繁变化，容易造成同步问题。

推荐做法：

- Obsidian 目录用于阅读和维护技术文档。
- 普通本地目录用于 Git 仓库和 GitHub 推送。

## 创建本地 Git 仓库

创建项目目录：

```bash
mkdir -p /Users/chenmingqiang/.codex/Markdown77
```

复制 Obsidian 文档：

```bash
cp -R "/Users/chenmingqiang/Library/Mobile Documents/iCloud~md~obsidian/Documents/Cmqobsisian/Markdown77/." /Users/chenmingqiang/.codex/Markdown77/
```

初始化 Git：

```bash
cd /Users/chenmingqiang/.codex/Markdown77
git init
```

设置仓库本地提交身份：

```bash
git config user.name chenmingqiang
git config user.email chenmingqiang@example.com
```

首次提交：

```bash
git add .
git commit -m "Initial Markdown77 technical docs"
```

## 创建 GitHub 仓库

在 GitHub 创建仓库：

```text
Repository name: Markdown77
Owner: MingQiangChen
```

创建时不要勾选：

- README
- .gitignore
- license

因为本地仓库已经有这些文件。

## 添加远程仓库

HTTPS 方式：

```bash
git remote add origin https://github.com/MingQiangChen/Markdown77.git
```

如果已经添加过远程仓库，可以修改：

```bash
git remote set-url origin https://github.com/MingQiangChen/Markdown77.git
```

把分支改成 `main`：

```bash
git branch -M main
```

## 终端网络问题处理

如果出现：

```text
Could not resolve host: github.com
```

说明终端无法解析 GitHub。

可以给 Wi-Fi 设置 DNS：

```bash
sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 1.1.1.1
sudo killall -HUP mDNSResponder
```

检查 DNS：

```bash
scutil --dns
```

检查 GitHub：

```bash
curl -I https://github.com
```

如果浏览器能访问 GitHub，但终端不能，常见原因是：

- VPN 只代理浏览器。
- 系统代理为空。
- VPN/TUN 软件改写了 DNS。
- 终端所在环境被沙箱限制。

## HTTPS 推送认证问题

如果执行：

```bash
git push -u origin main
```

出现：

```text
fatal: could not read Username for 'https://github.com'
```

说明当前终端不能交互输入 GitHub 用户名和 token。

推荐改用 SSH。

## 生成 GitHub SSH Key

生成 SSH key：

```bash
ssh-keygen -t ed25519 -C "MingQiangChen@github" -f /Users/chenmingqiang/.ssh/id_ed25519_github -N ""
```

查看公钥：

```bash
cat /Users/chenmingqiang/.ssh/id_ed25519_github.pub
```

把公钥添加到 GitHub：

```text
GitHub -> Settings -> SSH and GPG keys -> New SSH key
```

Title 示例：

```text
MacBook Markdown77
```

Key type：

```text
Authentication Key
```

## 测试 SSH 认证

```bash
ssh -i /Users/chenmingqiang/.ssh/id_ed25519_github -o StrictHostKeyChecking=accept-new -T git@github.com
```

成功时会显示：

```text
Hi MingQiangChen! You've successfully authenticated, but GitHub does not provide shell access.
```

## 切换远程仓库到 SSH

```bash
git remote set-url origin git@github.com:MingQiangChen/Markdown77.git
```

指定本仓库使用这个 SSH key：

```bash
git config core.sshCommand "ssh -i /Users/chenmingqiang/.ssh/id_ed25519_github -o IdentitiesOnly=yes"
```

## 推送到 GitHub

```bash
git push -u origin main
```

成功时会显示：

```text
To github.com:MingQiangChen/Markdown77.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

## 日常更新流程

以后修改文档后，在本地仓库目录执行：

```bash
cd /Users/chenmingqiang/.codex/Markdown77
git status
git add .
git commit -m "更新技术文档"
git push
```

## 注意事项

- 不要把私钥 `id_ed25519_github` 上传到 GitHub。
- 只上传 `.pub` 公钥到 GitHub。
- 不要在 iCloud 目录里直接操作 `.git`。
- 如果 GitHub 推送失败，先检查网络，再检查 SSH key。
