import { useState, type DragEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, Pencil, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ProjectTocNode, TocMovePlacement } from '@/shared/project'

type DropHint = { targetId: string; position: 'before' | 'after' | 'inside' } | null

interface ProjectTreeProps {
  nodes: ProjectTocNode[]
  activeMdPath: string | null
  onSelect: (mdPath: string) => void
  onRename?: (node: ProjectTocNode) => void
  onDelete?: (node: ProjectTocNode) => void
  onMove?: (nodeId: string, placement: TocMovePlacement) => void
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

function FolderNode({
  depth,
  title,
  hasChildren,
  children,
  node,
  onRename,
  onDelete,
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
}: ProjectTreeProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<DropHint>(null)
  const dragEnabled = Boolean(onMove)

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

  if (nodes.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs text-muted-foreground">—</p>
    )
  }
  return (
    <nav className="space-y-0.5 overflow-y-auto p-2" onDragEnd={endDrag}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          activeMdPath={activeMdPath}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          dragEnabled={dragEnabled}
          dropHint={dropHint}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={() => setDropHint(null)}
          onDrop={handleDrop}
        />
      ))}
    </nav>
  )
}
