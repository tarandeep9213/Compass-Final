import { useRef, useState, useCallback } from 'react'

export interface UploadedFile {
  id: string
  file: File
  name: string
  size: number
  type: string
}

interface Props {
  accept: string
  maxSizeMb?: number
  files: UploadedFile[]
  onAdd: (files: UploadedFile[]) => void
  onRemove: (fileId: string) => void
  disabled?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['pdf'].includes(ext)) return '\u{1F4C4}'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '\u{1F4CA}'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return '\u{1F5BC}'
  return '\u{1F4C4}'
}

export default function FileUploadDropzone({ accept, maxSizeMb = 25, files, onAdd, onRemove, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const maxBytes = maxSizeMb * 1024 * 1024
    const added: UploadedFile[] = []
    const tooLarge: string[] = []

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i]
      if (f.size > maxBytes) {
        tooLarge.push(f.name)
        continue
      }
      added.push({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        name: f.name,
        size: f.size,
        type: f.type,
      })
    }

    if (tooLarge.length > 0) {
      setError(`File(s) exceed ${maxSizeMb} MB limit: ${tooLarge.join(', ')}`)
      setTimeout(() => setError(null), 4000)
    }
    if (added.length > 0) onAdd(added)
  }, [maxSizeMb, onAdd])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!disabled) processFiles(e.dataTransfer.files)
  }, [disabled, processFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setDragOver(true)
  }, [disabled])

  return (
    <div>
      {/* Drop zone */}
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        style={{
          border: `2px dashed ${dragOver ? 'var(--g5)' : 'var(--ow2)'}`,
          borderRadius: 10,
          padding: 32,
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: dragOver ? 'var(--g0)' : 'transparent',
          transition: 'border-color 0.15s, background 0.15s',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>{'\u{1F4C1}'}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tm)', marginBottom: 4 }}>
          Drag files here or click to browse
        </div>
        <div style={{ fontSize: 11, color: 'var(--ts)' }}>
          Accepted: {accept} &middot; Max {maxSizeMb} MB
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => { processFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          borderRadius: 7,
          background: 'var(--red-bg)',
          color: '#991b1b',
          fontSize: 12,
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {files.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 0',
                borderBottom: '1px solid var(--ow2)',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{fileIcon(f.name)}</span>
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ts)', flexShrink: 0 }}>
                {formatSize(f.size)}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(f.id) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--red)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
