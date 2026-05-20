/// <reference types="vite/client" />

import type { ElectronApi } from '@/shared/electron'

declare global {
  interface Window {
    electronAPI?: ElectronApi
  }
}
