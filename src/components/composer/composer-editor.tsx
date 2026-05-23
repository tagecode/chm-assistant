import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef } from 'react'
import type { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

export interface ComposerEditorHandle {
  revealLine: (line: number) => void
  insertAtCursor: (text: string) => void
}

interface ComposerEditorProps {
  value: string
  onChange: (value: string) => void
  loadingLabel: string
  onSave?: () => void
}

export const ComposerEditor = forwardRef<ComposerEditorHandle, ComposerEditorProps>(
  function ComposerEditor({ value, onChange, loadingLabel, onSave }, ref) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
    const onSaveRef = useRef(onSave)

    useEffect(() => {
      onSaveRef.current = onSave
    }, [onSave])

    const handleMount: OnMount = (ed, monaco) => {
      editorRef.current = ed
      ed.addAction({
        id: 'chm-assistant-composer-save',
        label: 'Save',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
          onSaveRef.current?.()
        },
      })
    }

    useImperativeHandle(ref, () => ({
      revealLine(line: number) {
        const ed = editorRef.current
        if (!ed) return
        ed.revealLineInCenter(Math.max(1, line))
        ed.setPosition({ lineNumber: Math.max(1, line), column: 1 })
        ed.focus()
      },
      insertAtCursor(text: string) {
        const ed = editorRef.current
        if (!ed) return
        const sel = ed.getSelection()
        if (!sel) return
        ed.executeEdits('insert', [
          {
            range: sel,
            text,
            forceMoveMarkers: true,
          },
        ])
        ed.focus()
      },
    }))

    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {loadingLabel}
          </div>
        }
      >
        <MonacoEditor
          height="100%"
          defaultLanguage="markdown"
          theme="vs-dark"
          value={value}
          onChange={(v) => onChange(v ?? '')}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            wordWrap: 'on',
            fontSize: 14,
            automaticLayout: true,
          }}
        />
      </Suspense>
    )
  },
)
