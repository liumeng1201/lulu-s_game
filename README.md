# 露露接星星

一个适合初学者阅读和修改的浏览器小游戏。移动篮子接住星星，接住 10 颗就能获胜；漏掉 3 颗后本轮结束。

## 开始游戏

直接用浏览器打开 `index.html`，或在项目目录启动一个本地服务器：

```bash
python3 -m http.server 4173
```

然后访问 <http://localhost:4173>。

## 发布到互联网

这个项目已经准备了 GitHub Actions，会在代码进入 `main` 分支后自动发布到 GitHub Pages。

第一次发布前，请让家长或老师协助完成下面的设置：

1. 把项目上传到一个 GitHub 仓库。
2. 打开仓库的 **Settings → Pages**。
3. 在 **Build and deployment** 中，把 **Source** 选择为 **GitHub Actions**。
4. 把代码合并或推送到 `main` 分支，也可以在 **Actions** 页面手动运行“部署游戏到 GitHub Pages”。
5. 等待工作流出现绿色对勾，打开部署步骤显示的网址。

一般情况下，公开网址会是：

```text
https://你的GitHub用户名.github.io/仓库名称/
```

每次更新 `main` 分支后，网站都会自动重新发布。发布时不需要填写密码或把任何密钥保存到代码中。

## 操作方法

- 键盘：按 `←`、`→` 移动篮子，按空格键暂停或继续。
- 手机或平板：按住页面下方的左右按钮。
- 点击右上角的声音按钮可以打开或关闭音效。

## 文件介绍

- `index.html`：游戏舞台和文字。
- `styles.css`：颜色、布局和动画。
- `game.js`：移动、接住星星、分数与输赢规则。
- `.github/workflows/deploy-pages.yml`：自动发布网站的 GitHub Actions 工作流。

想继续练习时，可以试着修改 `game.js` 顶部的胜利分数，或改变 `styles.css` 中的颜色。
