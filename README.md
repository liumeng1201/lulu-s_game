# 六六游戏屋

一个适合孩子在浏览器中游玩的小游戏集合。首页以自适应宫格展示已经完成的游戏，可在 PC、iPad 和手机浏览器中访问。

## 已有游戏

- **接星星**：移动篮子接住星星，接住 10 颗就能获胜；漏掉 3 颗后本轮结束。

## 开始游戏

在项目目录启动本地服务器：

```bash
python3 -m http.server 4173
```

然后访问 <http://localhost:4173>，从游戏大厅选择想玩的游戏。

## 操作方法

“接星星”支持以下操作：

- 键盘：按 `←`、`→` 移动篮子，按空格键暂停或继续。
- 手机或平板：按住页面下方的左右按钮。
- 点击右上角的声音按钮可以打开或关闭音效。
- 点击游戏页顶部的“游戏大厅”可返回首页。

## 项目结构

```text
index.html                         游戏大厅
assets/css/home.css                大厅布局与响应式样式
assets/images/                     游戏封面资源
games/catch-stars/index.html       “接星星”游戏页面
games/catch-stars/game.css         游戏样式
games/catch-stars/game.js          游戏逻辑
.github/workflows/deploy-pages.yml GitHub Pages 发布流程
```

## 添加新游戏

1. 在 `games/` 下为游戏新建独立目录，并把页面、样式和脚本放入该目录。
2. 在 `assets/images/` 中加入比例统一的游戏封面。
3. 在根目录 `index.html` 的 `.game-grid` 中增加游戏卡片，并链接到新游戏页面。
4. 更新首页显示的游戏数量和本 README 的“已有游戏”列表。

## 发布到互联网

项目通过 GitHub Actions 发布到 GitHub Pages。第一次发布前，在仓库 **Settings → Pages** 中将 **Source** 设为 **GitHub Actions**，然后把代码合并或推送到 `main` 分支。之后每次更新 `main` 都会自动重新发布。

## 开发分支

本地开发统一使用 `codex` 分支。首次克隆仓库后可运行：

```bash
git switch -c codex
git push -u origin codex
```

后续提交通过 Pull Request 合并到 `main`，避免直接修改发布分支。
