# User guide

[Back to the project](../README_EN.md) · [简体中文](usage.md)

## Login and saving

Use `/system`, or `/#/system` with Hash routing. Sign in with a Token that can write to the repository, then set a password under Login password management. An image repository on another Git platform requires its own Token.

Editing first updates content in the current browser. **Save** in Website management commits the data to the branch resolved during the build. Once your Git-connected host deploys that commit, refresh to see the published content.

Setting, changing or removing a password also requires deployment. Use a strong password and a dedicated Token. If you forget the password, sign in with a valid Token and set a new one. See [authentication details](authentication.md) for security boundaries.

## Categories, websites and tags

- First-level categories group resources, second-level categories organize page navigation and third-level categories contain websites.
- Website management opens with all websites. Search names, URLs or descriptions and filter by category or availability.
- Select a third-level category to add websites. Clear the search and unavailable filter to reorder links in that category.
- Editing, moving, references and bulk deletion use the same navigation data. Bulk actions include only checked rows currently visible in the list.
- Tag settings manage names, colors, order and optional links. Select tags in the website editor.
- Side cards show an Edit button after sign-in. Configure visitor permissions under **System settings → Advanced settings**.

Category links such as `/side?id=3` can be bookmarked and shared. Repeated clicks keep the same URL. IDs depend on your own navigation data.

Login-only visibility is a display setting; published static data may still be read directly.

## Category icons

Configure icons under **Website management → First / second / third-level categories → Edit**.

Use image URLs or Font Awesome Free 6 classes:

```text
https://example.com/icon.png
fas fa-film
fab fa-github
fa-solid fa-book
```

The editor previews the icon. Side and Super use each second-level category's own icon configuration. Font Awesome assets are included in the build.

## Themes and site settings

System settings has five tabs:

| Tab                     | Contents                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| Site information        | Logo, title, description, keywords, language, email and image CDN        |
| Display and interaction | Search, shortcuts, loading content, widgets and mobile PWA               |
| Theme settings          | Default and mobile themes, banners, cards and footers                    |
| Daily text              | Sources, custom text, title, attribution and character limit             |
| Advanced settings       | Visitor permissions, shortcuts, save requests, HTML and crawler settings |

**Save** submits changes from every tab. The site description is used for SEO; an empty theme page title uses the global title. Use trusted content for custom HTML.

Side provides banner search, category navigation and grid cards. Configure its heading, banner, page title and footer under **Theme settings → Side**. Other themes have their own tabs. The mobile theme can be selected independently or follow the current page.

## Daily quotes and text

Configure the card under **System settings → Daily text**. It appears below the Side banner.

| Source       | Content          |
| ------------ | ---------------- |
| `hitokoto`   | Quotes           |
| `jinrishici` | Poetry           |
| `xygeng`     | Random sentences |
| `60s`        | Daily news       |
| `history`    | On this day      |

Use up to five sources, one per line, with a display limit of 100–4000 characters per source. Custom APIs support JSON, arrays and plain text. You can provide a label and a field path:

```text
hitokoto
My quote | https://example.com/quote | data.content
```

Append `| nofrom` to hide attribution or `| withfrom` to show it. APIs must allow browser cross-origin requests. Use HTTPS APIs on HTTPS sites.

Leave sources empty to use only custom text. Templates support newlines and `{date}`, `{time}`, `{weekday}`, `{month}` and `{day}`, for example:

```text
Today is {date}.
Make time to explore something new.
```

Dates and times use the visitor's local clock. Hiding the title keeps the text; disabling the card stops requests. Sources are cached separately by day. One failed source does not block the others, and Retry requests failed sources again.

## Backups and imports

Download a JSON backup in Website management. It includes navigation, settings, tags, search and widget data. Importing a backup replaces the corresponding data, so save your own backup first.

Bookmark import accepts browser bookmark HTML files. Discarding local edits restores the currently published data.

## Repository and image configuration

Use [nav.config.yaml](../nav.config.yaml).

| Field          | Purpose                                                                       |
| -------------- | ----------------------------------------------------------------------------- |
| `gitRepoUrl`   | Navigation source and data repository                                         |
| `branch`       | `auto` follows the deployment branch; an explicit name pins the commit target |
| `imageRepoUrl` | Image repository; the `branch` query parameter selects its branch             |
| `hashMode`     | Enables Hash routing                                                          |
| `address`      | API server URL; leave empty for static hosting                                |
| `email`        | Submission notification email, requiring the corresponding service            |

GitLab needs a project ID, for example `https://gitlab.com/USER/REPO?projectId=123`. An image repository may also specify a branch: `https://gitlab.com/USER/IMAGES?projectId=456&branch=images`.

Create the image repository and branch beforehand and grant write access. Images on the same Git platform use the main Token; another platform needs a separate Token.

API server mode requires a compatible server supplied separately. Configure its `password`, `port`, `mailConfig` and related fields for that service. Manage static login passwords in the admin; do not place Tokens or passwords in ordinary settings or YAML.

## Verification and upgrades

`pnpm test` covers daily text, icons, settings migration, deployment branches and admin credentials. After a production build, run `pnpm run test:auth-ui`, `pnpm run test:themes` and `pnpm run test:auth-bundle` to check published credential assets.

Set `NAV_TEST_HASH_MODE=1` for Hash login checks; in PowerShell, use `$env:NAV_TEST_HASH_MODE = '1'`. Browser checks use test credentials and in-memory APIs.

Back up `data/` and YAML before upgrading, and review source and configuration differences. After switching deployment branches, sign in with a Token and configure a password on the new branch.
