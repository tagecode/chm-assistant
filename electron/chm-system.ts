import { decodeChmSystemString } from './chm-text'

/** 解析 /#SYSTEM（ITT 内部 #SYSTEM 流）中的常用字符串项。参见 chmspec #SYSTEM。 */
export interface ChmSystemStrings {
  contentsFile?: string
  indexFile?: string
  defaultTopic?: string
  title?: string
}

function readNtString(data: Buffer, readerEncodingPref: string): string {
  if (data.length === 0) {
    return ''
  }
  if (data.length >= 4 && data[1] === 0 && data[3] === 0 && data[0] !== 0) {
    let end16 = 0
    for (let i = 0; i + 1 < data.length; i += 2) {
      if (data[i] === 0 && data[i + 1] === 0) {
        end16 = i
        break
      }
    }
    if (end16 === 0) {
      end16 = data.length - (data.length % 2)
    }
    return decodeChmSystemString(data.subarray(0, end16), readerEncodingPref)
  }
  let end = data.indexOf(0)
  if (end < 0) {
    end = data.length
  }
  return decodeChmSystemString(data.subarray(0, end), readerEncodingPref)
}

export function parseChmSystem(
  systemBuf: Buffer,
  readerEncodingPref = 'auto',
): ChmSystemStrings {
  const out: ChmSystemStrings = {}
  if (systemBuf.length < 8) {
    return out
  }
  let off = 4
  while (off + 4 <= systemBuf.length) {
    const code = systemBuf.readUInt16LE(off)
    const len = systemBuf.readUInt16LE(off + 2)
    off += 4
    if (len > systemBuf.length - off) {
      break
    }
    const data = systemBuf.subarray(off, off + len)
    off += len
    const str = readNtString(data, readerEncodingPref).replace(/\\/g, '/')
    if (!str) {
      continue
    }
    if (code === 0) {
      out.contentsFile = str
    } else if (code === 1) {
      out.indexFile = str
    } else if (code === 2) {
      out.defaultTopic = str
    } else if (code === 3) {
      out.title = str
    }
  }
  return out
}

export function findSystemInternalPath(paths: string[]): string | null {
  const norm = paths.map((p) => p.replace(/\\/g, '/'))
  for (const p of norm) {
    const base = p.split('/').pop()?.toLowerCase() ?? ''
    if (base === '#system') {
      return p
    }
  }
  const hit = norm.find((p) => p === '/#SYSTEM' || p === '#SYSTEM')
  return hit ?? null
}
