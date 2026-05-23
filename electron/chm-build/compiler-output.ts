/** hhc 退出码为 0 时仍可能失败；chmcmd 的 Note/Warning 为信息性输出。 */
export function compilerOutputIndicatesFailure(
  stdout: string,
  stderr: string,
): boolean {
  const text = `${stdout}\n${stderr}`
  if (
    /HHC5003|HHC5010|HHC6003|The following files were not compiled/i.test(
      text,
    )
  ) {
    return true
  }
  // chmcmd 以 "Error:" 表示失败；"Note:" / "Warning:" 在退出码 0 时为正常信息
  return (
    /^error:/im.test(text) ||
    /seems corrupt|Can't find project file|Invalid number of parameters/i.test(
      text,
    )
  )
}

export function pickCompilerErrorLine(
  stdout: string,
  stderr: string,
): string | null {
  const lines = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i] ?? ''
    if (/EFCreateError|Unable to create file/i.test(line)) {
      return line
    }
  }
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i] ?? ''
    if (/HHC\d+:/i.test(line)) {
      return line
    }
  }
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i] ?? ''
    if (/^error:/i.test(line) || /seems corrupt/i.test(line)) {
      return line
    }
  }
  return null
}
