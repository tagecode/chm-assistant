# Third-party notices

## CHMLib

CHM parsing is provided by [CHMLib](https://github.com/jedwing/CHMLib) (GNU LGPL v2.1).
Source is vendored under `native/third_party/chmlib/`. See `COPYING` in that directory.

## chmcmd (optional, macOS / Linux builds)

Some release builds bundle **chmcmd** from the [Free Pascal](https://www.freepascal.org/) / CHM tools
chain under `resources/compilers/<platform>-<arch>/chmcmd`. When present, it is invoked to compile
`.hhp` projects to `.chm` on non-Windows platforms.

- **License:** GNU General Public License version 2 (GPL-2)
- **Source:** Obtain corresponding Free Pascal / chmcmd sources from your distribution or
  [Free Pascal Project](https://www.freepascal.org/) as required by GPL-2
- **Windows:** This application does **not** redistribute Microsoft **HTML Help Compiler (`hhc.exe`)**.
  Users must install HTML Help Workshop separately; see `docs/compiler-setup.md`.

## Other components

Electron, React, Vite, Tailwind CSS, shadcn/ui, iconv-lite, node-html-parser, and other dependencies
are used under their respective open-source licenses. Refer to each package’s license in
`node_modules` when preparing a release bundle.
