import fs from 'node:fs'
import path from 'node:path'

// Minimal verification: decode + resolve path exists
const root = 'D:/chm-test'
const encoded = 'assets/%E5%A1%94%E6%88%88.png'
const decoded = decodeURIComponent(encoded)
const abs = path.join(root, decoded)
console.log('decoded:', decoded)
console.log('exists:', fs.existsSync(abs))

// Simulate markdown-it encoded src through decodeResourceRef logic
function decodeResourceRef(ref) {
  try {
    return decodeURIComponent(ref)
  } catch {
    return ref
  }
}

const ref = decodeResourceRef(encoded)
const resolved = path.join(root, ref)
console.log('resolved exists:', fs.existsSync(resolved))
