/** chm-assistant.chmproj 文件格式（version 1） */

export const CHMPROJ_FILENAME = 'chm-assistant.chmproj'

export interface ProjectTocNode {
  id: string
  /** 侧栏显示标题 */
  title: string
  /** 相对项目根目录的 Markdown 路径（正斜杠） */
  mdPath?: string
  /** 文件夹节点在磁盘上的相对路径（正斜杠） */
  dirPath?: string
  children?: ProjectTocNode[]
}

export interface ChmProjectWindowOptions {
  width?: number
  height?: number
  /** Default topic 显示名（可选） */
  defaultTopic?: string
}

export interface ChmProjectCompileOptions {
  /** 输出文件名，默认 `<title>.chm` */
  outputFile?: string
  openAfterCompile?: boolean
}

export interface ChmProjectConfig {
  version: 1
  title: string
  author?: string
  language: string
  charset: 'utf-8'
  defaultPage: string
  createdAt: string
  updatedAt?: string
  toc: ProjectTocNode[]
  /** Markdown 源文件目录（相对项目根），默认 docs */
  docsDir?: string
  /** 静态资源目录（相对项目根），默认 assets */
  assetsDir?: string
  window?: ChmProjectWindowOptions
  compile?: ChmProjectCompileOptions
}

export type TocMovePlacement =
  | { kind: 'before'; targetId: string }
  | { kind: 'after'; targetId: string }
  | { kind: 'inside'; parentId: string }

export type CompileLogLevel = 'info' | 'warn' | 'error'

export interface CompileLogLine {
  level: CompileLogLevel
  message: string
  /** 源 Markdown 相对路径 */
  sourcePath?: string
  line?: number
}

export type CompileProjectResult =
  | { ok: true; chmPath: string; logs: CompileLogLine[] }
  | { ok: false; error: string; logs: CompileLogLine[] }

export interface ProjectLoadResult {
  ok: true
  rootPath: string
  config: ChmProjectConfig
  /** 相对路径，正斜杠 */
  activeMdPath: string | null
}

export type ProjectLoadError =
  | { ok: false; code: 'NOT_FOUND' | 'INVALID' | 'IO_ERROR'; message: string }
