/**
 * 目录滚动同步 bridge（RD-06）。
 *
 * 注入到 CHM HTML 页面：父窗口下发「当前页面的目录锚点列表」，
 * bridge 监听滚动，回报当前视口激活锚点，供父窗口高亮目录项。
 *
 * 消息协议（与 find bridge 同模式，postMessage '*'）：
 *   父 → iframe:  { channel: 'chm-assistant-toc-anchors', anchorIds: string[] }
 *   iframe → 父: { channel: 'chm-assistant-toc-active', anchor: string | null }
 */

export const CHM_TOC_SYNC_SCRIPT = `<script id="chm-assistant-toc-sync">(function () {
  if (window.__chmAssistantTocSync) return
  window.__chmAssistantTocSync = true

  var anchorIds = []
  var anchors = [] // { id, top }
  var lastReported = undefined

  /** 兼容现代 id 与传统 <a name="…"> 锚点。 */
  function findAnchor(id) {
    var el = document.getElementById(id)
    if (el) return el
    var byName = document.getElementsByName && document.getElementsByName(id)
    if (byName && byName.length) return byName[0]
    return null
  }

  function collectAnchors() {
    anchors = []
    for (var i = 0; i < anchorIds.length; i++) {
      var el = findAnchor(anchorIds[i])
      if (!el) continue
      var rect = el.getBoundingClientRect()
      anchors.push({ id: anchorIds[i], top: rect.top + window.pageYOffset })
    }
    anchors.sort(function (a, b) { return a.top - b.top })
  }

  /** 当前视口激活锚点：视口上 1/3 内最后一个锚点（其下方内容即当前章节）。 */
  function computeActive() {
    if (!anchors.length) return null
    var threshold = window.pageYOffset + window.innerHeight / 3
    var active = null
    for (var i = 0; i < anchors.length; i++) {
      if (anchors[i].top <= threshold) active = anchors[i].id
      else break
    }
    return active
  }

  function report() {
    var anchor = computeActive()
    if (anchor === lastReported) return
    lastReported = anchor
    try {
      if (window.parent !== window) {
        window.parent.postMessage(
          { channel: 'chm-assistant-toc-active', anchor: anchor },
          '*',
        )
      }
    } catch (_e) { /* 忽略跨源限制 */ }
  }

  var ticking = false
  function onScrollOrResize() {
    if (ticking) return
    ticking = true
    window.requestAnimationFrame(function () {
      ticking = false
      report()
    })
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true })
  window.addEventListener('resize', onScrollOrResize, { passive: true })

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.channel !== 'chm-assistant-toc-anchors') return
    anchorIds = Array.isArray(e.data.anchorIds) ? e.data.anchorIds : []
    collectAnchors()
    report()
  })

  function init() {
    collectAnchors()
    report()
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init()
  } else {
    document.addEventListener('DOMContentLoaded', init)
    window.addEventListener('load', init)
  }
})()</script>`

export function injectTocSyncBridge(html: string): string {
  if (html.includes('id="chm-assistant-toc-sync"')) {
    return html
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${CHM_TOC_SYNC_SCRIPT}</body>`)
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${CHM_TOC_SYNC_SCRIPT}</html>`)
  }
  return `${html}${CHM_TOC_SYNC_SCRIPT}`
}
