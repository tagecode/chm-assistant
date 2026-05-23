import { execSync } from 'node:child_process'

/**
 * 读取 Windows 系统 ANSI 代码页（ACP，即 Win32 GetACP）。
 * 936 = 简体中文 GBK；950 = 繁体 Big5；65001 = 「Beta: UTF-8 全球语言」已开启。
 * 非 Windows 或检测失败时返回 null。
 */
export function detectWindowsAnsiCodePage(): number | null {
  if (process.platform !== 'win32') {
    return null
  }
  try {
    const out = execSync(
      'powershell -NoProfile -Command "[System.Text.Encoding]::Default.CodePage"',
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
    )
    const cp = Number.parseInt(out.trim(), 10)
    return Number.isFinite(cp) && cp > 0 ? cp : null
  } catch {
    return null
  }
}

/**
 * chmcmd（Free Pascal）按系统 ACP 读取 .hhp/.hhc/.hhk 字节。
 * Windows hh.exe 对目录/索引则更接近 Language LCID 对应的传统 ANSI 页（如 0x804 → 936）。
 * 二者在「UTF-8 Beta 已开」的现代 Windows 上无法靠单一编码同时最优。
 */
export type CompileNavEncodingStrategy = 'utf-8' | 'system-acp' | 'legacy-zh-gbk'

export function evaluateNavEncodingOptions(opts: {
  platform: NodeJS.Platform
  ansiCodePage: number | null
  compilerKind: 'hhc' | 'chmcmd'
  projectLanguage: string
}): {
  recommended: CompileNavEncodingStrategy
  reason: string
  appReaderOk: boolean
  windowsHhExeTocOk: 'likely' | 'unlikely' | 'unknown'
} {
  const isZh = opts.projectLanguage.toLowerCase().startsWith('zh')
  const cp = opts.ansiCodePage

  if (opts.compilerKind === 'chmcmd') {
    if (cp === 65001) {
      return {
        recommended: 'utf-8',
        reason:
          'chmcmd 在 UTF-8 系统 (ACP 65001) 下按 UTF-8 读工程文件；与当前应用阅读器一致。',
        appReaderOk: true,
        windowsHhExeTocOk: 'unlikely',
      }
    }
    if (cp === 936 && isZh) {
      return {
        recommended: 'system-acp',
        reason:
          'chmcmd 在 GBK 系统 (ACP 936) 下按 GBK 读工程；与 hh.exe 目录/索引期望较一致，但 HTML 须同为 GBK 或需实测。',
        appReaderOk: true,
        windowsHhExeTocOk: 'likely',
      }
    }
    return {
      recommended: 'utf-8',
      reason: 'chmcmd 默认优先 UTF-8 中间文件 + Charset=65001，与应用阅读器已验证路径一致。',
      appReaderOk: true,
      windowsHhExeTocOk: isZh ? 'unlikely' : 'unknown',
    }
  }

  // hhc.exe
  if (isZh) {
    return {
      recommended: 'legacy-zh-gbk',
      reason: 'hhc.exe 对中文目录/索引 historically 需要 GBK 工程文件 (Charset=936)。',
      appReaderOk: true,
      windowsHhExeTocOk: 'likely',
    }
  }
  return {
    recommended: cp === 65001 ? 'utf-8' : 'system-acp',
    reason: 'hhc 非中文项目可跟随系统 ACP 或 UTF-8。',
    appReaderOk: true,
    windowsHhExeTocOk: 'unknown',
  }
}
