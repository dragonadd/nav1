# Discovery Navigation

A navigation website that can be deployed as static files and edited online. The current code uses Angular 21, TypeScript 5.9, ng-zorro-antd and Tailwind CSS. Navigation data lives in a Git repository; the admin interface saves changes through Git APIs.

[简体中文](README.md) · [Original project](https://github.com/xjh22222228/nav) · [Preview](https://nav3.cn) · [Authentication details](docs/authentication.md)

## Features

- Three-level categories, websites, tags, moving, references, bulk operations and browser bookmark import / export.
- Light, Super, Sim, Side, Shortcut and App themes, responsive layout, dark mode and configurable cards.
- Custom search engines, site search, shortcuts and remembered browsing position.
- Calendar, countdowns, holidays, images, carousels, news and HTML widgets.
- Site settings, SEO, logos, custom head / footer HTML, image repositories and mobile PWA settings. The page template also includes the Busuanzi statistics script.
- GitHub, Gitee and GitLab management, with password or Token admin login.
- Grouped navigation, clear page headings and consistent tables / forms, with a collapsible mobile sidebar and responsive save bar.
- Separate encrypted login credentials and tab-scoped Token sessions.

Icon fetching, translation and submission notifications may use upstream APIs. Login-only visibility flags control what the frontend displays; they do not make published static data confidential.

## Local development

Use a complete Node.js **22.12+ or 24+** installation with `node`, `npm` and pnpm available.

```bash
git clone https://github.com/YOUR-USER/YOUR-NAV-REPOSITORY.git
cd YOUR-NAV-REPOSITORY
pnpm install --frozen-lockfile
pnpm run start:reload
```

Open [http://localhost:7002](http://localhost:7002). `pnpm start` disables live reload. Initialization generates `nav.config.json` and normalizes the existing navigation data. For a source archive, install dependencies and edit [nav.config.yaml](nav.config.yaml); online saving still requires a real writable Git repository.

## Configuration

Deployment and repository settings are in [nav.config.yaml](nav.config.yaml). Most display settings are edited in **Admin → Site settings**.

| Field                                             | Purpose                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `gitRepoUrl`                                      | Source / data repository on GitHub, Gitee or GitLab                                                     |
| `branch`                                          | Defaults to `auto`, following the deployment branch; use an explicit name only to pin the commit target |
| `imageRepoUrl`                                    | Image repository; `?branch=NAME` selects its branch                                                     |
| `hashMode`                                        | Set to `true` on GitHub Pages; History routing requires SPA fallback                                    |
| `email`                                           | Submission notification address; requires the corresponding service                                     |
| `address`                                         | Existing self-hosted API compatibility; leave empty for static hosting                                  |
| `password`, `port`, `mailConfig`, `XFAPIPassword` | Existing server settings, separate from static admin login passwords                                    |

GitLab URLs require `projectId`, for example `https://gitlab.com/USER/REPO?projectId=123`. An image URL may additionally contain `&branch=images`. Create the image repository and branch beforehand and grant the Token the required access.

Never put real Tokens or static login passwords in YAML, ordinary settings or navigation data.

## Admin login

Use `/system` with History routing or `/#/system` with Hash routing. A GitHub Pages project site uses `https://USER.github.io/REPO/#/system`.

### First login with a Token

Without a configured password, the admin dialog offers Token login.

- [GitHub fine-grained Token](https://github.com/settings/personal-access-tokens/new): authorize only the needed navigation / image repositories, grant Contents read / write and set an expiry date.
- [Gitee personal Token](https://gitee.com/profile/personal_access_tokens): grant the required repository access.
- [GitLab personal Token](https://gitlab.com/-/user_settings/personal_access_tokens): configure the project ID and required API / repository permissions.

Images on the same platform use the main Token. An image repository on another platform requires its own Token. All required credentials are checked before a session is saved. Collaborators with write access can log in as well as the owner.

Login checks the Git user and repository permissions. Actual writes remain subject to Token scopes, branch protection and image-branch access.

### Set a password and choose either login method

1. Open **Admin → Site settings → Login password management**.
2. Enter and confirm a password of at least **8 characters containing letters and numbers**. A unique random password of **12 or more characters** is recommended.
3. Save. The current Git credentials are encrypted and committed separately as `data/auth.json`.
4. Wait for **the same branch to deploy successfully**, then refresh. Password login becomes the default and Token login remains available.

Use the same panel to change the password or confirm removal. Removal restores Token-only login after deployment. Without automatic deployment, rebuild and publish manually.

If the password is forgotten, credentials are damaged or the Token expires, use a valid Token on the current branch and reset the password. A decrypted Token rejected by Git is reported separately from an incorrect password. Concurrent password changes reject stale versions and retain your input.

### Credentials and sessions

Passwords derive non-exportable keys through PBKDF2-SHA-256 with 600,000 iterations. AES-256-GCM encrypts the main Token and, when needed, the separate image Token. The repository file contains only algorithm parameters and ciphertext, bound to the main repository, image repository and commit branches.

Tokens are stored only in this tab's `sessionStorage`. Refresh preserves login and logout clears it; duplicated tabs or browser session restoration may retain storage. Upgrading clears old localStorage credentials and requires login again. Passwords and derived keys are never stored, and the information page masks the Token.

Published ciphertext can be downloaded for offline password guessing. Changing a password or deleting the file does not revoke Tokens in old ciphertext. To revoke old access, first rotate / revoke the Token on the Git platform, then configure a password using the new Token. Custom HTML and scripts must be trusted; password encryption requires HTTPS or localhost.

See [Authentication details](docs/authentication.md) for formats, cache behavior and protection boundaries.

## Build and deployment

### Before deployment

1. Fork the project or upload this source to your own Git repository. Commit the source and `pnpm-lock.yaml`; exclude `node_modules` and `dist`.
2. Set `gitRepoUrl` to your repository and keep `branch: auto` and `address: ''`. Builds resolve the actual deployment branch; content and password commits target that branch. Any valid Git branch name is supported. Configure your image repository and create its branch beforehand if needed.
3. The GitHub Pages workflow enables Hash routing during its build. Other platforms keep YAML `hashMode`, usually `false`. For a local manual Pages build, set `hashMode: true`. Commit the configuration before importing the repository.

### Git-connected hosting

These platforms rebuild automatically when admin changes create a Git commit.

| Platform                                         | Steps                                                                                                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Netlify](https://app.netlify.com/)              | Create a site from Git, authorize your repository and select the source branch. Keep the root `netlify.toml` settings and deploy.                                                                       |
| [Vercel](https://vercel.com/new)                 | Import the repository, use its root as Root Directory, set Build Command to `pnpm run build` and Output Directory to `dist/browser`. Select the actual Production Branch and keep YAML `branch: auto`.  |
| [Cloudflare Pages](https://dash.cloudflare.com/) | Create a **Pages** project under Workers & Pages and connect Git. Select the repository and production branch, choose no framework preset, use `pnpm run build` and output `dist/browser`, then deploy. |

Use Node.js **22.12+ or 24+**. If an install command is requested, use `pnpm install --frozen-lockfile`. Netlify already specifies Node 22; select the Node version in Vercel settings, or set `NODE_VERSION=22.12.0` in Cloudflare Pages. Check the platform's default domain before adding a custom domain.

**Any Cloudflare branch:** keep `branch: auto`; Cloudflare supplies `CF_PAGES_BRANCH` automatically. Select the actual production branch or allow the desired preview branches. The admin commit branch should match the deployed source; for example, a `release/v2.3` site saves to `release/v2.3`. After switching branches, refresh and log in with a Token to set a new password. Old branch credentials are not migrated automatically.

Automatic resolution checks Cloudflare, GitHub Actions, Netlify, Vercel and GitLab branch metadata, then the local Git branch. Missing metadata stops the build instead of guessing `main`. For source ZIPs or environments without branch metadata, specify a branch explicitly.

### GitHub Pages

The included [deployment workflow](.github/workflows/deploy-gh-pages.yml) uses GitHub Actions, like project B:

1. Commit the source and workflow to your own repository. Set YAML `gitRepoUrl` to that repository, keep `branch: auto`, and keep `address` empty.
2. In **Settings → Pages**, choose **GitHub Actions** under **Build and deployment → Source**. Switch existing branch-based Pages sites to this setting too.
3. Open **Actions** and enable workflows if requested for a fork. Select **Deploy to GitHub Pages → Run workflow** and choose the actual publishing branch.
4. Wait for both build and deploy to succeed, then visit `https://USER.github.io/REPO/`, or `https://USER.github.io/` for a repository named `USER.github.io`.

Later pushes to the publishing branch, including admin content and password commits, deploy automatically. No manual upload or `gh-pages` branch is required. Relative assets and build-time Hash routing support both root and project sites; append `#/system` to the site URL for admin.

**Choose the Pages publishing branch:** automatic deployment uses the repository's default branch unless a repository Actions variable `NAV_PAGES_BRANCH` is set. For another branch, create that variable under **Settings → Secrets and variables → Actions → Variables**, using its full name. Keep YAML `branch: auto`; no workflow edits are needed. Manual Run workflow publishes its selected branch; subsequent automatic deployments follow the variable. GitHub Pages has one site per repository, so pushes to other branches skip deployment rather than overwriting it.

A keeps an explicit repository URL and validates it against the workflow source. Cloudflare branch settings are independent of `NAV_PAGES_BRANCH`. No extra deployment Token is needed.

Configure a custom domain under **Settings → Pages → Custom domain** and follow GitHub's DNS instructions. If deploying to Netlify, Vercel or Cloudflare Pages, remove this workflow to avoid duplicate builds.

### First use and troubleshooting

Open `/system`, or `/#/system` on GitHub Pages, keeping any project-path prefix. Log in with a writable repository Token, then configure a password under **Site settings → Login password management**. Changes take effect after the same branch deploys successfully.

- **Refreshing admin returns 404:** check SPA fallback for History routing; use Hash routing on GitHub Pages.
- **Updates are missing:** keep YAML `branch: auto`, compare the admin's resolved commit branch with the platform's deployed source, and check the latest build and automatic branch deployment settings. Explicit branch names should match the deployed source.
- **Image uploads fail:** create the image repository and branch, and grant the Token write access.

### Local build and output

```bash
pnpm run build
# GitHub Pages, with hashMode: true
pnpm run build-gh-pages
```

Publish **`dist/browser`**. The build generates the page template and SEO content. Valid encrypted credentials are published separately at `data/auth.json`; blank / removed credentials are cleaned up, while plaintext or damaged credentials stop the build.

Keep YAML `branch: auto` to use the branch resolved during the build. Match the deployed source manually only when specifying an explicit branch name. Saving a password completes a Git commit, not deployment; a timestamp cannot fetch a version that has not been published.

The frontend retains self-hosted API compatibility, but this directory does not include server code, a Dockerfile or PM2 startup scripts. The `address` mode needs a separately supplied compatible API server.

## Verification and maintenance

```bash
pnpm test
pnpm run lint
# After building, with Chrome / Edge or a Puppeteer browser available
pnpm run test:auth-ui
# Verify published credentials and restore the normal build afterward
pnpm run test:auth-bundle
```

Authentication tests use test credentials and in-memory Git APIs. Set `NAV_TEST_HASH_MODE=1` to check Hash routing. On Windows PowerShell, use `$env:NAV_TEST_HASH_MODE = '1'`.

`src/view/` holds themes and admin pages; `src/components/` contains components; `src/api/` contains APIs; `data/` contains navigation / settings; `scripts/` initializes and builds the site. `nav.config.json`, `src/index.html`, `src/generated/auth/` and `dist/` are generated.

Back up your data and YAML configuration before upgrading. This project is customized; review upstream changes and resolve conflicts individually.

## Credits and license

Original project: [xjh22222228/nav](https://github.com/xjh22222228/nav), by xiejiahe. The dual login mechanism references [NavBlog](https://github.com/dragonadd/Navblog) and is adapted to this navigation site's existing admin, image and data flows.

For commercial sites, themes, projects, and applications, keep your source code private/proprietary by purchasing a [Commercial License](https://official.nav3.cn/pricing).

Licensed under the GNU General Public License 3.0 for compatible open source projects and non-commercial use. See [LICENSE](LICENSE).

Copyright 2024-present xiejiahe
