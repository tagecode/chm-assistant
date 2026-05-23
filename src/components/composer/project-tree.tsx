import { useCallback, useEffect, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, FilePlus, FileText, Folder, FolderPlus, Pencil, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ProjectTocNode, TocMovePlacement } from '@/shared/project'

type DropHint = { targetId: string; position: 'before' | 'after' | 'inside' } | null

type TreeContextTarget = { node: ProjectTocNode | null; x: number; y: number } | null

interface ProjectTreeProps {
  nodes: ProjectTocNode[]
  activeMdPath: string | null
  onSelect: (mdPath: string) => void
  onRename?: (node: ProjectTocNode) => void
  onDelete?: (node: ProjectTocNode) => void
  onMove?: (nodeId: string, placement: TocMovePlacement) => void
  onNewPage?: (contextNode: ProjectTocNode | null) => void
  onNewFolder?: (contextNode: ProjectTocNode | null) => void
  contextMenuLabels?: { newPage: string; newFolder: string }
}

function resolveDropPlacement(
  node: ProjectTocNode,
  clientY: number,
  rect: DOMRect,
): TocMovePlacement {
  const isFolder = !node.mdPath
  const ratio = (clientY - rect.top) / rect.height
  if (isFolder && ratio > 0.25 && ratio < 0.75) {
    return { kind: 'inside', parentId: node.id }
  }
  if (ratio < 0.5) {
    return { kind: 'before', targetId: node.id }
  }
  return { kind: 'after', targetId: node.id }
}

function NodeActions({
  node,
  onRename,
  onDelete,
}: {
  node: ProjectTocNode
  onRename?: (node: ProjectTocNode) => void
  onDelete?: (node: ProjectTocNode) => void
}) {
  if (!onRename && !onDelete) return null
  return (
    <span className="ml-auto flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
      {onRename ? (
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted"
          aria-label="rename"
          onClick={(e) => {
            e.stopPropagation()
            onRename(node)
          }}
        >
          <Pencil className="size-3" />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="rounded p-0.5 hover:bg-destructive/20"
          aria-label="delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(node)
          }}
        >
          <Trash2 className="size-3 text-destructive" />
        </button>
      ) : null}
    </span>
  )
}

function dropHintClass(
  hint: DropHint,
  nodeId: string,
  position: 'before' | 'after' | 'inside',
): string {
  if (!hint || hint.targetId !== nodeId || hint.position !== position) return ''
  if (position === 'inside') return 'ring-2 ring-primary/50 bg-primary/10'
  if (position === 'before') return 'border-t-2 border-primary'
  return 'border-b-2 border-primary'
}

function TreeContextMenu({
  target,
  onClose,
  onNewPage,
  onNewFolder,
  labels,
}: {
  target: TreeContextTarget
  onClose: () => void
  onNewPage?: (contextNode: ProjectTocNode | null) => void
  onNewFolder?: (contextNode: ProjectTocNode | null) => void
  labels: { newPage: string; newFolder: string }
}) {
  useEffect(() => {
    if (!target) return
    const close = () => onClose()
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [target, onClose])

  if (!target || (!onNewPage && !onNewFolder)) return null

  return (
    <div
      className="fixed z-50 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover py-1 text-sm shadow-md"
      style={{ left: target.x, top: target.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {onNewPage ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => {
            onNewPage(target.node)
            onClose()
          }}
        >
          <FilePlus className="size-3.5 shrink-0 opacity-70" />
          {labels.newPage}
        </button>
      ) : null}
      {onNewFolder ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => {
            onNewFolder(target.node)
            onClose()
          }}
        >
          <FolderPlus className="size-3.5 shrink-0 opacity-70" />
          {labels.newFolder}
        </button>
      ) : null}
    </div>
  )
}

function FolderNode({
  depth,
  title,
  hasChildren,
  children,
  node,
  onRename,
  onDelete,
  onContextMenu,
  dragEnabled,
  dropHint,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  depth: number
  title: string
  hasChildren: boolean
  children: ReactNode
  node: ProjectTocNode
  onRename?: (node: ProjectTocNode) => void
  onDelete?: (node: ProjectTocNode) => void
  onContextMenu: (e: MouseEvent, node: ProjectTocNode) => void
  dragEnabled: boolean
  dropHint: DropHint
  onDragStart: (e: DragEvent, node: ProjectTocNode) => void
  onDragOver: (e: DragEvent, node: ProjectTocNode) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent, node: ProjectTocNode) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          'group flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm font-medium text-foreground/90 hover:bg-muted/50',
          dropHintClass(dropHint, node.id, 'inside'),
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        draggable={dragEnabled}
        onContextMenu={(e) => onContextMenu(e, node)}
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={(e) => onDragOver(e, node)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, node)}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1"
          onClick={() => hasChildren && setOpen((v) => !v)}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="size-3.5 shrink-0" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0" />
            )
          ) : (
            <span className="inline-block size-3.5 shrink-0" />
          )}
          <Folder className="size-3.5 shrink-0 text-primary/80" />
          <span className="truncate">{title}</span>
        </button>
        <NodeActions node={node} onRename={onRename} onDelete={onDelete} />
      </div>
      {open ? children : null}
    </div>
  )
}

function TreeNode({
  node,
  depth,
  activeMdPath,
  onSelect,
  onRename,
  onDelete,
  onContextMenu,
  dragEnabled,
  dropHint,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  node: ProjectTocNode
  depth: number
  activeMdPath: string | null
  onSelect: (mdPath: string) => void
  onRename?: (node: ProjectTocNode) => void
  onDelete?: (node: ProjectTocNode) => void
  onContextMenu: (e: MouseEvent, node: ProjectTocNode) => void
  dragEnabled: boolean
  dropHint: DropHint
  onDragStart: (e: DragEvent, node: ProjectTocNode) => void
  onDragOver: (e: DragEvent, node: ProjectTocNode) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent, node: ProjectTocNode) => void
}) {
  const hasChildren = (node.children?.length ?? 0) > 0
  const isFile = Boolean(node.mdPath)
  const active = node.mdPath === activeMdPath

  if (isFile) {
    return (
      <div
        className={cn(
          'group flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm transition',
          active
            ? 'bg-primary/15 text-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          dropHintClass(dropHint, node.id, 'before'),
          dropHintClass(dropHint, node.id, 'after'),
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        draggable={dragEnabled}
        onContextMenu={(e) => onContextMenu(e, node)}
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={(e) => onDragOver(e, node)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, node)}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          onClick={() => node.mdPath && onSelect(node.mdPath)}
        >
          <FileText className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{node.title}</span>
        </button>
        <NodeActions node={node} onRename={onRename} onDelete={onDelete} />
      </div>
    )
  }

  return (
    <FolderNode
      depth={depth}
      title={node.title}
      hasChildren={hasChildren}
      node={node}
      onRename={onRename}
      onDelete={onDelete}
      onContextMenu={onContextMenu}
      dragEnabled={dragEnabled}
      dropHint={dropHint}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {node.children?.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          activeMdPath={activeMdPath}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          onContextMenu={onContextMenu}
          dragEnabled={dragEnabled}
          dropHint={dropHint}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      ))}
    </FolderNode>
  )
}

export function ProjectTree({
  nodes,
  activeMdPath,
  onSelect,
  onRename,
  onDelete,
  onMove,
  onNewPage,
  onNewFolder,
  contextMenuLabels,
}: ProjectTreeProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<DropHint>(null)
  const [contextTarget, setContextTarget] = useState<TreeContextTarget>(null)
  const dragEnabled = Boolean(onMove)

  const handleContextMenu = useCallback((e: MouseEvent, node: ProjectTocNode) => {
    if (!onNewPage && !onNewFolder) return
    e.preventDefault()
    e.stopPropagation()
    setContextTarget({ node, x: e.clientX, y: e.clientY })
  }, [onNewFolder, onNewPage])

  const handleBlankContextMenu = useCallback((e: MouseEvent) => {
    if (!onNewPage && !onNewFolder) return
    e.preventDefault()
    e.stopPropagation()
    setContextTarget({ node: null, x: e.clientX, y: e.clientY })
  }, [onNewFolder, onNewPage])

  const handleDragStart = (e: DragEvent, node: ProjectTocNode) => {
    if (!onMove) return
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', node.id)
    setDraggingId(node.id)
  }

  const handleDragOver = (e: DragEvent, node: ProjectTocNode) => {
    if (!onMove || !draggingId || draggingId === node.id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const placement = resolveDropPlacement(node, e.clientY, rect)
    setDropHint({
      targetId: node.id,
      position: placement.kind === 'inside' ? 'inside' : placement.kind,
    })
  }

  const handleDrop = (e: DragEvent, node: ProjectTocNode) => {
    if (!onMove) return
    e.preventDefault()
    const nodeId = e.dataTransfer.getData('text/plain') || draggingId
    if (!nodeId || nodeId === node.id) {
      setDraggingId(null)
      setDropHint(null)
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    onMove(nodeId, resolveDropPlacement(node, e.clientY, rect))
    setDraggingId(null)
    setDropHint(null)
  }

  const endDrag = () => {
    setDraggingId(null)
    setDropHint(null)
  }

  const contextLabels = contextMenuLabels ?? {
    newPage: 'New page',
    newFolder: 'New folder',
  }

  return (
    <>
      <div
        className="flex min-h-0 flex-1 flex-col"
        onContextMenu={handleBlankContextMenu}
      >
        <nav
          className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2"
          onDragEnd={endDrag}
        >
          {nodes.length === 0 ? (
            <p className="pointer-events-none px-2 py-4 text-center text-xs text-muted-foreground">
              —
            </p>
          ) : (
            nodes.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                activeMdPath={activeMdPath}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                onContextMenu={handleContextMenu}
                dragEnabled={dragEnabled}
                dropHint={dropHint}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={() => setDropHint(null)}
                onDrop={handleDrop}
              />
            ))
          )}
        </nav>
      </div>
      <TreeContextMenu
        target={contextTarget}
        onClose={() => setContextTarget(null)}
        onNewPage={onNewPage}
        onNewFolder={onNewFolder}
        labels={contextLabels}
      />
    </>
  )
}
