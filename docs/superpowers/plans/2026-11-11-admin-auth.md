# 后台双模式登录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 A 的导航后台加入 B 的密码 / Token 二选一登录，并更新与 A 实际代码一致的文档。

**Architecture:** 复用 A 的 Angular、ng-zorro 和 Axios API。纯认证工具负责加密、公开凭证读取和仓库身份，独立服务负责校验 / 密码提交，现有 user 工具继续为全站提供会话接口。

**Tech Stack:** Angular 21、TypeScript、Web Crypto、Axios、tsx、现有 Puppeteer。

**Spec:** `docs/superpowers/specs/2026-11-11-admin-auth-design.md`

## Global Constraints

- 只修改 `D:/codex-work/nav1-main`；B 只读，不修改仓库地址、分支、导航数据和主题选择。
- 不新增依赖；保留自有部署服务器密码与独立图床支持。
- PBKDF2-SHA-256 600,000 次、AES-256-GCM、16 字节 salt、12 字节 IV、128 位认证标签；`nav-auth` v1 与 B 的凭证隔离。
- 至少 8 个字符且包含字母和数字；Token 只写 sessionStorage，不保存密码或密钥。
- A 没有 Git 元数据：备份后原位修改，以测试和文件记录代替提交 / 工作树操作。

## Review Focus

- 错误密码、仓库 / 分支或图床改变：不能解锁凭证。
- 图床校验失败、登录取消或存储受限：不能留下部分登录状态。
- 凭证 404、HTML 回退、损坏和网络失败：明确区别，并允许 Token 兜底。
- 两个窗口同时修改密码：拒绝旧版本覆盖；GitLab 同时检查 last_commit_id。
- 移除 / 损坏凭证后构建：清除旧资源，拒绝发布明文 Token / 密码。

## Task 1: 认证工具、会话与静态资源

**Files:** 创建 `src/utils/admin-auth.ts`、`src/utils/auth-session.ts`、`scripts/prepare-auth.ts`；修改 `src/utils/user.ts`、`scripts/start.ts`、`angular.json`、`.gitignore`；测试 `scripts/test-admin-auth.ts`、`scripts/test-auth-build.ts`。

**Interfaces:** `encryptAuth(credentials, password, identity): Promise<string>`、`decryptAuth(source, password, identity): Promise<AuthCredentials>`、`parseAuth(source)`、`authIdentity(config)`、`loadPublicAuth(baseURI): Promise<string | null>`；会话提供 `readSession / writeSession / clearSession`；`prepareAuth(root = process.cwd()): void`。

- [x] 先写并运行密码规则、真实加解密 / 身份隔离、公开配置异常、会话隔离 / 存储失败和临时目录资源生成测试；验证未实现时断言失败。
- [x] 实现最小认证工具与会话接口，保留全站现有 getToken / getImageToken 调用方式；初始化先验证凭证，再处理其他数据。
- [x] 将生成的凭证作为独立 Angular 静态资源，加入生成目录忽略规则。
- [x] 运行 `pnpm exec tsx scripts/test-admin-auth.ts` 和 `pnpm exec tsx scripts/test-auth-build.ts`，预期全部断言通过。

## Task 2: 双模式登录、统一权限校验与密码管理

**Files:** 修改 `src/api/index.ts`、`src/app/app.component.ts`、登录组件、站点设置组件与 locale；创建 `src/api/auth.ts`、`src/services/auth.ts`、`src/components/login-password/`；测试 `scripts/test-auth-api.ts`、`scripts/test-auth-ui.ts`。

**Interfaces:** `verifyToken` 保留原返回结构并增加仓库写权限校验；凭证 API 提供 `getAuthFile` 和 `commitAuthFile`；`AuthService` 提供 `loadPublic / loadManagement / login / cancelPendingLogin / setPassword / removePassword`。

- [x] 先测试没有写权限 / 归档仓库、图床失败、取消登录、Token 失效和密码文件版本冲突；运行确认当前行为不满足要求。
- [x] 修正共享 Token 校验并去掉启动时重复的仓库所有者限制，接入密码和 Token 两种入口；认证成功后才原子保存会话。
- [x] 在站点设置的普通表单外添加密码管理组件。保留错误输入，保存 / 删除独立凭证并触发现有部署钩子。
- [x] 运行认证 API 与浏览器测试，预期 Token / 密码都可进入后台，失败与取消不会保存会话，输入校验和密码管理完整可用。

## Task 3: 文档、缓存与最终验证

**Files:** 修改 `README.md`、`README_EN.md`、`netlify.toml`、`vercel.json`；创建 `public/_headers`、`docs/authentication.md`；在 `package.json` 注册认证测试命令。

- [x] 根据 A 的源码重写快速开始、配置、后台登录与部署说明；纠正缺失工作流 / 服务器源码情况下的旧承诺，保留原作者和许可证。
- [x] 给凭证资源增加 no-store 响应头，说明密码与自有服务器 password 的区别、等待部署和 Token 轮换。
- [x] 运行认证测试、TypeScript / Angular 生产构建、lint 和真实浏览器检查；不提交真实凭证、不操作远程仓库。
- [x] 进行一次独立代码审查，修复会影响使用或安全的发现并重新验证相关路径。

## 执行记录

- 已确认 A 原始目录无 Git 元数据，B 存在用户未提交修改；B 保持只读。
- 原始 A 备份：`D:/codex-work/.codex-backups/nav1-main-before-admin-auth-20261111.zip`。
- 使用本机 pnpm 11 安装现有锁定依赖；关闭严格构建脚本报错以保持不执行被阻止的依赖脚本，未修改依赖版本。
- 已补齐代码直接使用、锁文件已经存在的 `@ant-design/icons-angular@20.0.0` 声明，没有引入新的技术依赖；修正 pnpm 构建允许列表的占位文本。
- lint 限定到 `src scripts`，避免无 Git 元数据时扫描依赖；启动 / 构建脚本直接调用已有 tsx 程序，兼容只提供 pnpm 的环境。
- Task 1 已完成：加解密、公开配置错误、会话和凭证生成 / 清理测试均通过。
- Task 2 已完成：三平台 API 请求、权限 / 取消 / 图床失败 / 存储失败 / 版本冲突测试，以及 History 子路径浏览器流程均通过。
- Task 3 文档和缓存配置已完成，正在生产构建和最终独立审查。

- 最终检查通过：pnpm test、TypeScript、Prettier、生产构建、History / Hash 子路径浏览器检查，以及真实生产凭证资源自检；lint 为 0 错误、6 条原有提示。
- 独立审查仅发现构建期间导航数据变化：所有 7 个原始数据 / manifest 文件已按备份逐字节恢复，并核对 SHA-256。保留原始压缩数据和空白默认文件；使用正常 init / build 流程生成运行资源。
- 未执行真实 Token 的远程写入、线上部署或自有服务器联调；B 项目未由本任务修改。
