import { useState } from 'react'
import { buildTree, formatBytes } from '../services/fileTree'
import type { DockedFile } from '../types'

interface Props {
  files: DockedFile[]
  onRemove?: (id: string) => void
}

export function TreeView({ files, onRemove }: Props) {
  const tree = buildTree(files)
  // Chemins des dossiers repliés manuellement par l'utilisateur (tout est ouvert par défaut,
  // seuls les dossiers explicitement fermés apparaissent ici).
  const [closedPaths, setClosedPaths] = useState<Set<string>>(new Set())

  function toggle(path: string, isOpen: boolean) {
    setClosedPaths((prev) => {
      const next = new Set(prev)
      if (isOpen) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return <TreeLevel nodes={tree} onRemove={onRemove} closedPaths={closedPaths} onToggle={toggle} />
}

function TreeLevel({
  nodes,
  onRemove,
  closedPaths,
  onToggle,
}: {
  nodes: ReturnType<typeof buildTree>
  onRemove?: (id: string) => void
  closedPaths: Set<string>
  onToggle: (path: string, isOpen: boolean) => void
}) {
  return (
    <>
      {nodes.map((node) =>
        node.isFolder ? (
          <details
            key={node.path}
            open={!closedPaths.has(node.path)}
            className="tree-folder"
            onToggle={(e) => onToggle(node.path, e.currentTarget.open)}
          >
            <summary className="folder-row">
              📁 {node.name}
              <span className="count">· {countFiles(node)} élément{countFiles(node) > 1 ? 's' : ''}</span>
            </summary>
            <div style={{ paddingLeft: 16 }}>
              <TreeLevel nodes={node.children} onRemove={onRemove} closedPaths={closedPaths} onToggle={onToggle} />
            </div>
          </details>
        ) : node.file ? (
          <div key={node.path} className={`ticket ${node.file.excluded ? 'is-excluded' : ''}`}>
            <div className="ticket-icon">{node.file.excluded ? '⛔' : '📄'}</div>
            <div className="ticket-body">
              <div className="ticket-path">{node.name}</div>
              <div className="ticket-meta">
                {formatBytes(node.file.size)}
                {node.file.excluded ? ` · exclu (${node.file.excludeReason})` : ''}
              </div>
            </div>
            {onRemove && (
              <button className="ticket-remove" onClick={() => onRemove(node.file!.id)} aria-label="Supprimer">
                ✕
              </button>
            )}
          </div>
        ) : null
      )}
    </>
  )
}

function countFiles(node: ReturnType<typeof buildTree>[number]): number {
  if (!node.isFolder) return 1
  return node.children.reduce((sum, c) => sum + countFiles(c), 0)
}
