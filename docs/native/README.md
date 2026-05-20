# 原生模块（CHMLib）

主进程通过 Node-API 插件 `native/build/Release/chm_addon.node` 调用 CHMLib；`chm:` 自定义协议从会话中读取对象字节并在主进程内转码后返回给渲染进程。

## 构建

- **当前机器的 Node.js（可选，用于快速验证编译）**：`pnpm run native:build`（内含 `configure`）。
- **与已安装 Electron 相同的 ABI（开发/运行桌面端必需）**：`pnpm run native:rebuild`

打包时请将 `native/build/Release/chm_addon.node` 一并产出；`electron-builder` 已在 `package.json` 的 `extraResources` 中配置复制到 `resources/native/`。

## 技术栈

- **运行时绑定**：Node-API（`node-addon-api`）+ `node-gyp`。
- **源码**：CHMLib（C）位于 `native/third_party/chmlib/src`（LGPL-2.1，见同目录 `COPYING`）。

## 架构要点

1. 安装对应平台的构建链（macOS：Xcode CLI Tools；Windows：Visual Studio Build Tools）。
2. 主进程通过 `ipcMain` 与会话 ID 暴露只读 API；渲染进程通过 `chm://<sessionId>/...` 拉取正文，不直接碰原生指针。

## 许可

CHMLib 为 LGPL-2.1。分发二进制时需在应用内或 `NOTICES` 中保留版权与许可全文（界面「关于」已链向上游仓库）。
