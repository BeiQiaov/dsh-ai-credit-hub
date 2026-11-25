# 把 dsh-ai-credit-hub 发布到插件市场

目标：别人在 DeepSeek Harness 里打开 **插件 → 插件市场**，搜到你的插件，点一下就装上。

整个链路是三段：**GitHub 仓库 → 提交到精选列表 → 市场与站点自动收录**。你只需要做前两段。

---

## 0. 先确认「自己的仓库能不能被装」

市场只收录、也只安装满足下面条件的仓库。逐条对过再提交，能省掉一轮打回：

| 要求 | 你这个包的现状 |
| --- | --- |
| `package.json` 声明 `dsh.bundle` | ✅ `"bundle": { "patch": "./cordis.patch.yml" }` |
| 有配套的 `cordis.patch.yml` | ✅ 里面 insert 了 `ai-credit-hub` 行 |
| 有真实可用的代码 | ✅ 纯 JS，无构建步骤 |
| 仓库创建满 1 天 | ⬜ 建仓后**第二天**再提 PR |
| 仓库加了 `dsh-plugin` topic | ⬜ 建仓后去 GitHub 设置里加 |
| 描述只用平实语言、且与代码一致 | ✅ README 与 DETAIL 都只写实际行为 |

> ⚠️ **最容易被打回的一点**：只声明 `dsh.client` 是不够的，必须是 `dsh.bundle`。你已经有了，别在搬家时弄丢。

---

## 1. 建 GitHub 仓库并推上去

插件目录现在是 `E:\MXYE\dsh-ai-credit-hub`，包文件在仓库根目录，`repository` / `homepage` / `bugs` 已填成 `BeiQiaov/dsh-ai-credit-hub`。

仓库已初始化并关联远端，剩下的就是推送（本地还领先 origin 一个提交）：

```sh
cd E:/MXYE/dsh-ai-credit-hub
git push -u origin main
```

推完做两件事：

1. 仓库 **Settings → Topics** 加上 `dsh-plugin`。
2. 仓库 **Settings → General → Features** 勾上 Discussions（可选，但市场里的评论区会用到）。

---

## 2.（可选但强烈建议）发布到 npm

市场优先用 npm 上的预构建包安装，**免掉 `allowBuilds` 构建授权**，用户装得更快。不发布也能上架，只是走源码安装。

```sh
npm login          # 你当前未登录（npm whoami 报 ENEEDAUTH）
cd E:/MXYE/dsh-ai-credit-hub
npm publish --access public
```

`dsh-ai-credit-hub` 这个名字我已经查过 npm，**目前无人占用**。

发布后**不需要**在市场条目里填任何 npm 字段——关联会自动从 registry 采集，手写 `npm:` 键反而会被校验拒绝。

---

## 3. 提交到精选列表（这是「上架」的真正动作）

市场和站点都不吃别人直接投稿，它们的列表来自这个仓库：

> **https://github.com/awesome-dsh-plugin/awesome-dsh-plugin**

**只需要加一个文件**，不要动 README（README 是脚本生成的，手改会冲突）：

文件路径：`data/plugins/BeiQiaov__dsh-ai-credit-hub.yml`

```yaml
url: https://github.com/BeiQiaov/dsh-ai-credit-hub
name: BeiQiaov/dsh-ai-credit-hub
category: usage

description:
  en: 'Gathers the remaining credit balance of Doubao, Qwen Work, WorkBuddy, Trae and Qoder into one draggable strip, expandable to a per-package breakdown; it reads only the read-only local routes those connector plugins already publish, and each row appears only when its connector is installed and signed in.'
  zh: '把豆包、千问工作、WorkBuddy、Trae、Qoder 的剩余积分收进一条可拖动的小长条，展开可看每个额度包的明细；只读取这些连接器插件已发布的只读本地路由，未安装或未登录的连接器不会显示数字。'

# 可选：GitHub 托管的方形位图（png/jpg/webp，SVG 会被拒），约 96px 显示；不写就用你的 GitHub 头像
# icon: https://raw.githubusercontent.com/BeiQiaov/dsh-ai-credit-hub/main/assets/icon-180.png
```

几个必须注意的点：

- **描述里有 `: `（英文冒号+空格）就必须整体加引号**，否则 YAML 解析失败。上面已经加好了。
- **可选** 加 `tarball:` 指向 GitHub Release 的预构建 `.tgz`。如果你不发 npm，这一项能让用户跳过构建。用 `latest/download/` 时**文件名不能带版本号**，否则你下次发版这个链接就 404 了。
- **一个 PR 最多 3 条**。你只有一条，没问题。
- **只改自己那一条**。如果你在更新已有条目，别顺手改邻居。

提交 PR 后：CI 会依次检查条目数量、`dsh.bundle`、仓库年龄、格式与站点构建。**CI 通过只是前置条件**，之后会有维护者读你的仓库、核对描述是否名副其实。需要改时会打 `held: author` 标签并在 PR 里说明——推修复到同一分支、留一条评论即可，不用重开 PR。

合并后站点自动重建，通常**一天内**生效。

---

## 4. 用户那边会看到什么

收录生效后，任何人在这台机器上：

- 打开 **插件 → 插件市场**，搜 `credit` 或你的插件名，
- 卡片上能看到描述、截图（如果仓库根目录放了 `screenshots.json`）、下载量（如果发了 npm），
- 点安装即可。

或者完全不用界面，一行命令：

```sh
dsh plugin --profile <profile> add dsh-ai-credit-hub
```

---

## 5. 提交前自查清单

- [x] `package.json` 里三处占位符已替换为 `BeiQiaov/dsh-ai-credit-hub`
- [ ] `dsh.bundle` 仍在，`cordis.patch.yml` 仍在
- [ ] 仓库创建满 1 天、已加 `dsh-plugin` topic
- [ ] `node tools/check.mjs` 能跑通（需要本机有对应连接器）
- [ ] 条目 YAML 的 `url` 与你真实仓库地址**完全一致**
- [ ] 描述与实际功能一致，没有夸张词

---

## 现在这台机器上的状态

插件已按可发布形态改名并重装：

- 包名 `dsh-ai-credit-hub`（原来是 `@local/ai-credit-hub`，`@local/` 作用域不能发布）
- 客户端 loader id 与 patch 里的 `name` 已同步改成新包名，否则安装后会找不到 bundle
- profile 里旧包名的残留链接已清掉，只保留一份，避免重复注册
- 补齐了 `README.md`、`LICENSE`、`repository`/`keywords` 等发布所需字段
- 自检通过：语法 OK，五个适配器对当前运行的 GUI（`127.0.0.1:57252`）读取正常，4 个渲染场景全绿

**你自己的仓库、npm 账号、GitHub PR 我这边没有凭据，做不了；上面 1–3 步需要你执行。**