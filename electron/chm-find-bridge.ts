/** 注入 CHM HTML 页面，供父窗口 postMessage 触发页内查找与高亮。 */
export const CHM_FIND_BRIDGE_STYLE = `<style id="chm-assistant-find-style">
::highlight(chm-find-all) {
  background-color: rgba(255, 224, 51, 0.95);
  color: inherit;
}
::highlight(chm-find-active) {
  background-color: rgba(255, 150, 50, 0.98);
  color: inherit;
}
mark.chm-assistant-find {
  background-color: rgba(255, 224, 51, 0.95);
  color: inherit;
  padding: 0;
}
mark.chm-assistant-find-active {
  background-color: rgba(255, 150, 50, 0.98);
  color: inherit;
  padding: 0;
  outline: 1px solid rgba(230, 134, 0, 0.9);
}
</style>`

export const CHM_FIND_BRIDGE_SCRIPT = `<script id="chm-assistant-find-bridge">(function () {
  if (window.__chmAssistantFindBridge) return
  window.__chmAssistantFindBridge = true

  var state = { query: '', index: -1, matches: [] }

  function supportsHighlightApi() {
    return typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined'
  }

  function unwrapMarks() {
    var marks = document.querySelectorAll('mark.chm-assistant-find, mark.chm-assistant-find-active')
    marks.forEach(function (mark) {
      var parent = mark.parentNode
      if (!parent) return
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
      parent.removeChild(mark)
      if (parent.normalize) parent.normalize()
    })
  }

  function clearHighlights() {
    if (supportsHighlightApi()) {
      CSS.highlights.delete('chm-find-all')
      CSS.highlights.delete('chm-find-active')
    }
    unwrapMarks()
  }

  function collectMatches(query) {
    var matches = []
    var needle = query.toLowerCase()
    if (!needle || !document.body) return matches
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement
        if (!p) return NodeFilter.FILTER_REJECT
        if (p.closest('mark.chm-assistant-find, mark.chm-assistant-find-active')) {
          return NodeFilter.FILTER_REJECT
        }
        var tag = p.tagName
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
          return NodeFilter.FILTER_REJECT
        }
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })
    var node
    while ((node = walker.nextNode())) {
      var text = node.textContent || ''
      var lower = text.toLowerCase()
      var idx = 0
      while ((idx = lower.indexOf(needle, idx)) !== -1) {
        matches.push({ node: node, start: idx })
        idx += needle.length
      }
    }
    return matches
  }

  function rangeForMatch(m, query) {
    var range = document.createRange()
    range.setStart(m.node, m.start)
    range.setEnd(m.node, m.start + query.length)
    return range
  }

  function applyHighlights(query, activeIndex) {
    clearHighlights()
    if (!state.matches.length || activeIndex < 0) return

    if (supportsHighlightApi()) {
      var allRanges = state.matches.map(function (m) {
        return rangeForMatch(m, query)
      })
      CSS.highlights.set('chm-find-all', new Highlight(...allRanges))
      CSS.highlights.set(
        'chm-find-active',
        new Highlight(allRanges[activeIndex]),
      )
      return
    }

    for (var i = state.matches.length - 1; i >= 0; i--) {
      var m = state.matches[i]
      var range = rangeForMatch(m, query)
      var mark = document.createElement('mark')
      mark.className =
        i === activeIndex ? 'chm-assistant-find-active' : 'chm-assistant-find'
      try {
        range.surroundContents(mark)
      } catch (_err) {
        var contents = range.extractContents()
        mark.appendChild(contents)
        range.insertNode(mark)
      }
    }
  }

  function selectMatch(m, query) {
    var range = rangeForMatch(m, query)
    var sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
    var el = m.node.parentElement
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function reply(source, payload) {
    if (source) source.postMessage(payload, '*')
  }

  window.addEventListener('message', function (e) {
    if (!e.data) return

    if (e.data.channel === 'chm-assistant-find-clear') {
      state = { query: '', index: -1, matches: [] }
      clearHighlights()
      var sel = window.getSelection()
      if (sel) sel.removeAllRanges()
      return
    }

    if (e.data.channel === 'chm-assistant-find-preview') {
      var previewQuery = String(e.data.query || '').trim()
      if (!previewQuery) {
        state = { query: '', index: -1, matches: [] }
        clearHighlights()
        return
      }
      state.query = previewQuery
      state.matches = collectMatches(previewQuery)
      state.index = state.matches.length ? 0 : -1
      if (state.index >= 0) {
        applyHighlights(previewQuery, state.index)
        selectMatch(state.matches[state.index], previewQuery)
      } else {
        clearHighlights()
      }
      return
    }

    if (e.data.channel !== 'chm-assistant-find') return

    var q = String(e.data.query || '').trim()
    if (!q) {
      state = { query: '', index: -1, matches: [] }
      clearHighlights()
      reply(e.source, {
        channel: 'chm-assistant-find-result',
        found: false,
        requestId: e.data.requestId,
      })
      return
    }

    var forward = e.data.forward !== false
    if (state.query !== q) {
      state.query = q
      state.matches = collectMatches(q)
      state.index = forward ? -1 : 0
    }

    var found = false
    if (state.matches.length) {
      if (forward) {
        state.index = (state.index + 1) % state.matches.length
      } else {
        if (state.index <= 0) state.index = state.matches.length
        state.index = state.index - 1
      }
      applyHighlights(q, state.index)
      selectMatch(state.matches[state.index], q)
      found = true
    } else {
      clearHighlights()
    }

    reply(e.source, {
      channel: 'chm-assistant-find-result',
      found: found,
      requestId: e.data.requestId,
      index: state.index,
      total: state.matches.length,
    })
  })
})()</script>`

export function injectFindBridge(html: string): string {
  let out = html
  if (!out.includes('id="chm-assistant-find-style"')) {
    out = `${CHM_FIND_BRIDGE_STYLE}${out}`
  }
  if (out.includes('id="chm-assistant-find-bridge"')) {
    return out
  }
  if (/<\/body>/i.test(out)) {
    return out.replace(/<\/body>/i, `${CHM_FIND_BRIDGE_SCRIPT}</body>`)
  }
  if (/<\/html>/i.test(out)) {
    return out.replace(/<\/html>/i, `${CHM_FIND_BRIDGE_SCRIPT}</html>`)
  }
  return `${out}${CHM_FIND_BRIDGE_SCRIPT}`
}
