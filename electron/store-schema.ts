import type { AppSettings, RecentEntry, ThemeMode, WorkspaceSession } from '../src/shared/electron'
import { RECENT_MAX_COUNT_DEFAULT } from '../src/shared/recent'

export interface PersistedState extends AppSettings {
  recent: RecentEntry[]
  workspace: WorkspaceSession | null
}

export const storeDefaults: PersistedState = {
  theme: 'system' as ThemeMode,
  locale: 'system',
  readerEncoding: 'auto',
  /** 空字符串表示自动检测（Unix 优先内置 chmcmd） */
  chmCompilerPath: '',
  /** 编译中转根目录（空为系统默认）；须为纯 ASCII 路径 */
  compileTempDir: '',
  recentMaxCount: RECENT_MAX_COUNT_DEFAULT,
  recent: [],
  workspace: null,
}
