# CHM Assistant

> A cross-platform desktop application for reading CHM files, creating Markdown documents, and compiling them into CHM files with a single click.

[CI](https://github.com/tagecode/chm-assistant/actions/workflows/ci.yml)
[License: MIT](LICENSE)
[Release](https://github.com/tagecode/chm-assistant/releases)
[Electron](https://www.electronjs.org/)
[pnpm](https://pnpm.io/)

[中文](README.md) · [Install](#install) · [Features](#features) · [Development](#development) · [Docs](#docs) · [Contributing](#contributing) · [License](#license)

---

## Overview

**CHM Assistant** (中文名：**CHM 助手**) combines CHM reading and Markdown authoring in one desktop app: open `.chm` files, maintain help projects in Markdown, compile with one click, and preview builds in the built-in reader.

**v0.1.0** is the first public release with MVP scope: CHM reading, Markdown authoring, cross-platform compilation, and built-in preview. See [docs/feature.md](docs/feature.md) for the roadmap.

---

## Features

- **CHM reading** — TOC / index navigation, back/forward, full-text search, in-page find, GBK / UTF-8 encoding, multiple themes
- **Markdown authoring** — Monaco editor, project tree, asset management, live preview, jump to line from compile logs
- **One-click compile** — Generates `.hhp` / `.hhc` / `.hhk`, invokes platform compilers to produce `.chm`, opens the result in the built-in reader
- **Cross-platform** — Consistent experience on macOS, Windows, and Linux; installers bundle `chmcmd` so no extra compiler setup is usually needed

Stack: [Electron](https://www.electronjs.org/) · [React](https://react.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Vite](https://vite.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/)

CHM parsing is based on [CHMLib](https://github.com/jedwing/CHMLib) (LGPL-2.1), wrapped via a Node native module (N-API).

---

## Platform support


| Platform | Architectures | Formats                 |
| -------- | ------------- | ----------------------- |
| macOS    | arm64, x64    | `.dmg`, `.zip`          |
| Windows  | x64           | NSIS installer (`.exe`) |
| Linux    | x64, arm64    | AppImage, `.deb`        |


---

## Install

Download the installer for your platform from [GitHub Releases](https://github.com/tagecode/chm-assistant/releases).

Asset naming: `CHM Assistant-v{version}-{os}-{arch}.{ext}` (e.g. `CHM Assistant-v0.1.0-win-x64.exe`).

### Quick start

1. Install and launch CHM Assistant
2. **Read CHM** — Choose “Open CHM file” on the home screen, or drag a `.chm` onto the window
3. **Author & compile** — Create or open a project, write Markdown, then compile; the output opens in the built-in reader

> **Notes**
>
> - Reading CHM **does not** require any compiler
> - For authoring, official installers bundle `chmcmd`; on Windows you can also point to `hhc.exe` (HTML Help Workshop) in settings
> - Unsigned macOS builds may need to be allowed once in System Settings on first launch

Compiler details: [docs/compiler-setup.md](docs/compiler-setup.md)

---

## Development

### Requirements


| Dependency         | Version / notes                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Node.js            | **24** (matches CI)                                                                                    |
| pnpm               | **9**                                                                                                  |
| Native build tools | macOS: Xcode CLT · Windows: VS Build Tools (C++) · Linux: see `scripts/ci-install-linux-build-deps.sh` |


### Run locally

```bash
git clone https://github.com/tagecode/chm-assistant.git
cd chm-assistant
pnpm install
pnpm run native:rebuild   # after first clone or native code changes
pnpm run dev
```

### Common commands


| Command               | Description                                        |
| --------------------- | -------------------------------------------------- |
| `pnpm run build`      | Typecheck + build renderer / main                  |
| `pnpm run lint`       | ESLint                                             |
| `pnpm run test:mvp`   | Build + static checks + Electron native smoke test |
| `pnpm run dist:mac`   | Package macOS installer                            |
| `pnpm run dist:win`   | Package Windows installer                          |
| `pnpm run dist:linux` | Package Linux installer                            |


Packaging runs `compilers:stage` to bundle `chmcmd`. CI and release flow: [docs/ci.md](docs/ci.md).

Release: bump `version` in `package.json`, push a matching tag (e.g. `v0.1.0`) to trigger the Release workflow.

---

## Docs


| Document                                                             | Description                        |
| -------------------------------------------------------------------- | ---------------------------------- |
| [docs/prd.md](docs/prd.md)                                           | Product requirements (PRD)         |
| [docs/feature.md](docs/feature.md)                                   | Feature roadmap                    |
| [docs/mvp.md](docs/mvp.md)                                           | MVP task list                      |
| [docs/compiler-setup.md](docs/compiler-setup.md)                     | CHM compiler setup & licensing     |
| [docs/ci.md](docs/ci.md)                                             | GitHub Actions packaging & release |
| [docs/mvp-acceptance-checklist.md](docs/mvp-acceptance-checklist.md) | MVP acceptance checklist           |
| [public/NOTICES.md](public/NOTICES.md)                               | Third-party licenses               |


---

## Contributing

Issues and feature discussion: [GitHub Issues](https://github.com/tagecode/chm-assistant/issues). Improvements via Pull Requests are welcome.

1. Fork the repo and branch from `main`
2. Run `pnpm run lint` and `pnpm run test:mvp` locally
3. Open a PR describing changes and how you tested

For larger changes, please open an Issue first to align scope.

---

## License


| Component                                   | License                                    |
| ------------------------------------------- | ------------------------------------------ |
| Application code in this repo               | [MIT](LICENSE) · Copyright © 2026 TageCode |
| [CHMLib](https://github.com/jedwing/CHMLib) | LGPL-2.1                                   |
| Bundled `chmcmd` in installers              | GPL-2                                      |


Full third-party notices: [public/NOTICES.md](public/NOTICES.md).