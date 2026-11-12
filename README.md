# 发现导航

一个可纯静态部署、支持在线编辑的导航网站。当前代码基于 Angular 21、TypeScript 5.9、ng-zorro-antd 和 Tailwind CSS，导航数据保存在 Git 仓库，后台通过 Git API 保存修改。

[English](README_EN.md) · [原项目](https://github.com/xjh22222228/nav) · [官方预览](https://nav3.cn) · [后台登录机制详解](docs/authentication.md)

## 功能

- 三级分类、网站和标签管理，支持移动、引用、批量操作及浏览器书签导入 / 导出。
- Light、Super、Sim、Side、Shortcut、App 主题，响应式布局、暗黑模式和多种卡片样式。
- 自定义搜索引擎、站内搜索、快捷操作及浏览位置记忆。
- 日历、下班倒计时、节假日、图片、轮播、新闻、HTML 等可配置组件。
- 站点标题、SEO、Logo、页头 / 页脚 HTML、图床和移动端 PWA 配置；当前页面模板也接入了不蒜子统计脚本。
- GitHub、Gitee、GitLab 在线管理，以及密码 / Token 二选一后台登录。
- 分组侧栏、页面说明及统一表格 / 表单样式；手机侧栏默认收起，保存条随布局适配。
- 密码管理支持设置、修改、确认移除；凭证独立加密提交，Token 仅保存到当前标签页会话。

网站图标抓取、翻译、收录通知等联网辅助功能还会使用上游 API，不能把它们理解为完全离线功能。“登录后显示”的分类 / 网站标记属于前端显示控制，静态资源本身不提供数据保密机制。

## 本地运行

建议使用 Node.js **22.12+ 或 24+**，以及 pnpm。使用完整的 Node.js 安装，确保 `node`、`npm` 和 `pnpm` 可用。

```bash
git clone https://github.com/你的用户名/你的导航仓库.git
cd 你的导航仓库
pnpm install --frozen-lockfile
pnpm run start:reload
```

打开 [http://localhost:7002](http://localhost:7002)。也可以运行 `pnpm start`，该命令关闭实时刷新。启动会先运行初始化，生成 `nav.config.json` 并整理现有导航数据。

如果拿到的是源码压缩包，先安装依赖，再修改根目录的 [nav.config.yaml](nav.config.yaml)。在线保存需要关联一个可写的真实 Git 仓库；本地目录没有 `.git` 并不会自动建立远程仓库。

## 配置

仓库和部署配置在 [nav.config.yaml](nav.config.yaml)，网站展示内容通常在 **后台 → 站点设置** 中修改。

| 字段                                              | 用途                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `gitRepoUrl`                                      | 导航源码 / 数据仓库，支持 `github.com`、`gitee.com`、`gitlab.com`     |
| `branch`                                          | 后台实际提交的分支，必须与站点部署来源一致；当前配置为 `main`         |
| `imageRepoUrl`                                    | 图床仓库，可用 `?branch=分支名` 指定图床分支；GitLab 还需 `projectId` |
| `hashMode`                                        | GitHub Pages 设为 `true`；History 路由需要托管平台配置 SPA 回退       |
| `email`                                           | 收录通知邮箱，相关功能依赖对应通知服务                                |
| `address`                                         | 兼容原有自有服务器 API；静态部署保持空值                              |
| `password`、`port`、`mailConfig`、`XFAPIPassword` | 原有自有服务器配置，不是静态站点自定义登录密码                        |

例如，GitLab 仓库写法为 `https://gitlab.com/用户名/仓库?projectId=项目ID`，图床可写为 `https://gitlab.com/用户名/图片仓库?projectId=项目ID&branch=images`。图床仓库及指定分支需要提前创建，并为 Token 授予对应写权限。

不要将真实 Token 或静态登录密码写入 YAML、普通站点设置或导航数据。静态站点的登录密码通过下方后台入口管理。

## 后台登录

后台入口仍然是 `/system`：

| 部署方式             | 示例入口                                   |
| -------------------- | ------------------------------------------ |
| 根路径、History 路由 | `https://你的站点/system`                  |
| 根路径、Hash 路由    | `https://你的站点/#/system`                |
| GitHub Pages 子目录  | `https://用户名.github.io/仓库名/#/system` |

### 1. 首次使用 Token 登录

尚未设置密码时，只显示 Token 登录。请输入有目标仓库写权限的 Token。

- **GitHub**：[申请 Token](https://github.com/settings/personal-access-tokens/new)。优先只授权导航仓库及必要的图床仓库，给予 Contents 读写权限并设置到期时间。经典 Token 按目标仓库选择所需权限；后台普通数据编辑不需要修改 workflow 文件。
- **Gitee**：[申请私人令牌](https://gitee.com/profile/personal_access_tokens)，授予目标仓库所需权限。
- **GitLab**：[申请 Personal Access Token](https://gitlab.com/-/user_settings/personal_access_tokens)，配置 `projectId` 并授予相应 API / 仓库写权限。

同平台图床使用主 Token；跨平台图床会额外显示独立图床 Token 输入框。两项验证成功后才保存登录会话。有写权限的协作者也可登录，不局限于仓库所有者。

登录会验证 Git 用户及仓库权限，但 Token scope、分支保护和图床分支是否允许实际写入，仍由 Git 平台最终校验。

### 2. 设置密码，以后二选一登录

1. 进入 **后台 → 站点设置 → 登录密码管理**。
2. 填写新登录密码和确认密码，至少 **8 个字符并包含字母和数字**，推荐使用 **12 位以上的独有随机密码**。
3. 点击“保存登录密码”。后台会加密当前 Git 凭证，单独提交 `data/auth.json`。
4. 等待 **当前分支重新部署成功**，刷新后默认提供密码登录，也能切换 Token 登录。

修改密码使用同一入口；移除密码需要确认，部署成功后恢复为只提供 Token 登录。没有自动部署时，需要手动重新构建并发布。

忘记密码、凭证损坏或 Token 过期时，使用有效 Token 登录当前分支，重新设置密码。密码解密后的 Git Token 验证失败会单独提示，不会被当成密码错误。两个窗口同时修改密码时，会拒绝旧版本覆盖并保留当前输入。

### 3. 凭证与会话

密码通过 PBKDF2-SHA-256（600,000 次）派生密钥，AES-256-GCM 加密主 Token 和必要时的独立图床 Token。仓库文件只有算法参数和密文，没有明文 Token、密码或密钥，并绑定主仓库、图床和提交分支。

Token 仅写入当前标签页的 `sessionStorage`。刷新保留登录，退出登录清除会话；浏览器恢复会话或复制标签页可能保留存储。升级会清除旧 `localStorage` 凭证，需要重新登录。密码和派生密钥不保存到浏览器存储，信息页隐藏明文 Token。

公开密文可以被下载后离线猜解。换密码或删除文件不能撤销旧密文中的 Token；需要撤销旧访问能力时，先在 Git 平台轮换 / 撤销 Token，再用新 Token 设置密码。自定义 HTML 和脚本必须可信，密码功能使用 HTTPS 或 localhost。

详细格式、缓存、构建和保护边界见 [后台登录机制](docs/authentication.md)。

## 构建与部署

### 部署前准备

1. Fork 项目或把当前源码上传到自己的 Git 仓库，提交源码和 `pnpm-lock.yaml`，不要上传 `node_modules`、`dist`。
2. 修改 `nav.config.yaml`：`gitRepoUrl` 填自己的仓库，`branch` 填实际部署分支（通常是 `main`），静态部署保持 `address: ''`。使用自己的图床时，同时配置 `imageRepoUrl` 并提前创建图床分支。
3. GitHub Pages 设置 `hashMode: true`，其他平台通常用 `false`。提交修改，再按下面的平台步骤部署。

### 静态托管平台

Netlify、Vercel 和 Cloudflare Pages 都可以连接 Git 仓库，后续后台保存触发 Git 提交时，平台会自动重新构建。

| 平台                                             | 操作步骤                                                                                                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Netlify](https://app.netlify.com/)              | 新建站点，选择从 Git 导入并授权自己的仓库；选择部署分支，保留根目录 `netlify.toml` 的构建设置；点击部署。                                                        |
| [Vercel](https://vercel.com/new)                 | 导入自己的仓库；项目根目录保持仓库根目录，构建命令填 `pnpm run build`，输出目录填 `dist/browser`；确认 Production Branch 与 YAML 的 `branch` 一致后部署。        |
| [Cloudflare Pages](https://dash.cloudflare.com/) | 在 Workers & Pages 中创建 **Pages** 项目并连接 Git；选择仓库与生产分支，框架预设选“无”，构建命令填 `pnpm run build`，构建输出目录填 `dist/browser`；保存并部署。 |

构建环境使用 Node.js **22.12+ 或 24+**；安装命令可设为 `pnpm install --frozen-lockfile`。Netlify 已在配置中指定 Node 22；Vercel 在项目设置选择 Node 版本；Cloudflare Pages 可添加环境变量 `NODE_VERSION=22.12.0`。部署成功后，先打开平台提供的默认域名确认首页正常，再添加自己的域名。

### GitHub Pages

当前副本没有自动发布工作流，可以先手动发布：

1. 把仓库克隆到本地，确认 Git 的 `origin` 指向自己的仓库，设置 `hashMode: true` 并提交。
2. 在仓库根目录执行：

   ```bash
   pnpm install --frozen-lockfile
   pnpm run build-gh-pages
   pnpm dlx gh-pages -d dist/browser --nojekyll
   ```

   最后一条命令临时运行发布工具，将产物推送到 `origin` 的 `gh-pages` 分支，需要本机 Git 有该仓库的推送权限。

3. 打开仓库 **Settings → Pages**，Source 选择 **Deploy from a branch**，分支选择 `gh-pages`，目录选择 `/ (root)`。等待发布完成后访问 `https://用户名.github.io/仓库名/`。

这种方式需要手动更新：后台保存后，先在本地 `git pull`，再重新构建并执行发布命令。需要每次保存后自动更新，可另行配置 [GitHub Actions 发布工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

### 首次使用与常见问题

部署成功后打开 `/system`，GitHub Pages 使用 `/#/system`，子目录站点保留仓库名前缀。首次用具有仓库写权限的 Token 登录，再到 **系统设置 → 登录密码管理** 设置密码。后台修改和密码设置都需要等待该分支重新部署成功后生效。

- **首页能打开，刷新后台出现 404**：检查 History 路由的 SPA 回退；GitHub Pages 使用 Hash 路由。
- **部署成功但看不到更新**：确认平台部署分支与 YAML `branch` 一致，再检查最新构建是否成功；手动发布需要重新构建上传。
- **图片无法上传**：确认图床仓库、图床分支已经存在，且 Token 有相应写权限。

### 本地构建与发布目录

```bash
# 普通静态托管
pnpm run build

# GitHub Pages，配合 hashMode: true
pnpm run build-gh-pages
```

发布目录均为 **`dist/browser`**。构建会生成页面模板和 SEO 内容；有效登录凭证单独发布到 `data/auth.json`。空白 / 移除凭证会清理资源，明文或损坏的凭证会阻止构建。

连接 Git 仓库时，部署分支应与 `nav.config.yaml` 的 `branch` 一致。密码保存只完成 Git 提交，必须等该分支部署成功后才生效；请求时间戳不能提前读取尚未发布的文件。

前端保留原有自有服务器 API 兼容入口，但当前目录没有服务器、Dockerfile 或 PM2 启动脚本。要使用 `address` 模式，需要另外提供兼容 API 服务；普通静态部署保持 `address` 为空。

## 验证与维护

```bash
pnpm test
pnpm run lint
# 构建后运行浏览器检查（需要 Chrome / Edge，或 Puppeteer 浏览器）
pnpm run test:auth-ui
# 检查生产资源发布与明文凭证泄漏，完成后恢复普通构建
pnpm run test:auth-bundle
```

认证测试使用测试凭证和内存 Git API，不写入真实远程仓库。Hash 路由可通过环境变量 `NAV_TEST_HASH_MODE=1` 验证；Windows PowerShell 使用 `$env:NAV_TEST_HASH_MODE = '1'`。

主要目录：`src/view/` 为主题和后台页面，`src/components/` 为组件，`src/api/` 为 API，`data/` 为导航 / 配置数据，`scripts/` 为初始化和构建。`nav.config.json`、`src/index.html`、`src/generated/auth/` 和 `dist/` 为生成内容。

升级前备份自己的 `data/` 和 YAML 配置，并检查源代码差异。本项目已做定制，合并上游时应逐项处理冲突，不能保证直接执行旧的自动合并命令适合所有副本。

## 致谢与许可证

原项目：[xjh22222228/nav](https://github.com/xjh22222228/nav)，作者 xiejiahe。后台双模式登录参考 [NavBlog](https://github.com/dragonadd/Navblog) 的实现，并适配导航站现有后台、图床和数据流程。

For commercial sites, themes, projects, and applications, keep your source code private/proprietary by purchasing a [Commercial License](https://official.nav3.cn/pricing).

Licensed under the GNU General Public License 3.0 for compatible open source projects and non-commercial use. See [LICENSE](LICENSE).

Copyright 2024-present xiejiahe
