import { Eraser, FileText, GripHorizontal, PenTool, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Banner } from './ui'

const CANVAS_W = 720
const CANVAS_H = 420
const INK_COLORS = [
  { value: '#1c1915', label: 'Ink black' },
  { value: '#1e5c40', label: 'Pine green' },
  { value: '#8c3424', label: 'Clay red' },
] as const

export function ScratchpadDrawer({
  attemptId,
  text,
  error,
  disabled,
  onTextChange,
  onClose,
}: {
  attemptId: string
  text: string
  error: string
  disabled: boolean
  onTextChange: (next: string) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<'draw' | 'text'>('draw')
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState<string>(INK_COLORS[0].value)
  const [strokeSize, setStrokeSize] = useState<number>(2.5)
  const [canUndo, setCanUndo] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const panelRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const historyRef = useRef<string[]>([])
  const drawRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    width: number
    height: number
  } | null>(null)

  const storageKey = `holdfast-scratch-ink:${attemptId}`

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (!saved) return
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
      }
      img.src = saved
    } catch {
      // ignore storage read issues
    }
  }, [storageKey])

  useEffect(() => {
    const onResize = () => {
      const panel = panelRef.current
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      setPos((current) => {
        if (!current) return current
        return {
          x: Math.min(Math.max(8, current.x), Math.max(8, window.innerWidth - rect.width - 8)),
          y: Math.min(Math.max(8, current.y), Math.max(8, window.innerHeight - 64)),
        }
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const persistCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      window.localStorage.setItem(storageKey, canvas.toDataURL('image/png'))
    } catch {
      // ignore storage quota errors
    }
  }

  const pushSnapshot = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const snap = canvas.toDataURL('image/png')
      historyRef.current = [...historyRef.current.slice(-19), snap]
      setCanUndo(true)
    } catch {
      // ignore snapshot failure
    }
  }

  const undo = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const prev = historyRef.current.pop()
    setCanUndo(historyRef.current.length > 0)
    if (!canvas || !ctx || prev === undefined) return
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
      persistCanvas()
    }
    img.src = prev
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    pushSnapshot()
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
  }

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
    }
  }

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const canvas = event.currentTarget
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    pushSnapshot()
    const pt = getCanvasPoint(event)
    drawRef.current = { pointerId: event.pointerId, lastX: pt.x, lastY: pt.y }

    const pressureScale = event.pointerType === 'pen' && event.pressure > 0 ? 0.65 + event.pressure * 0.7 : 1
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = (tool === 'eraser' ? 16 : strokeSize * 1.45) * pressureScale
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const active = drawRef.current
    if (!active || active.pointerId !== event.pointerId || disabled) return
    const canvas = event.currentTarget
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    event.preventDefault()
    const pt = getCanvasPoint(event)
    const pressureScale = event.pointerType === 'pen' && event.pressure > 0 ? 0.65 + event.pressure * 0.7 : 1
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = color
    ctx.lineWidth = (tool === 'eraser' ? 16 : strokeSize * 1.45) * pressureScale
    ctx.beginPath()
    ctx.moveTo(active.lastX, active.lastY)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    ctx.restore()
    drawRef.current = { pointerId: event.pointerId, lastX: pt.x, lastY: pt.y }
  }

  const onCanvasPointerEnd = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const active = drawRef.current
    if (!active || active.pointerId !== event.pointerId) return
    drawRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    persistCanvas()
  }

  const onDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button')) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const panel = panelRef.current
    if (!panel) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = panel.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      width: rect.width,
      height: rect.height,
    }
    setPos({ x: rect.left, y: rect.top })
    setDragging(true)
  }

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    const nextX = drag.originX + (event.clientX - drag.startX)
    const nextY = drag.originY + (event.clientY - drag.startY)
    const maxX = Math.max(8, window.innerWidth - drag.width - 8)
    const maxY = Math.max(8, window.innerHeight - Math.min(drag.height, 80) - 8)
    setPos({
      x: Math.min(Math.max(8, nextX), maxX),
      y: Math.min(Math.max(8, nextY), maxY),
    })
  }

  const onDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <aside
      ref={panelRef}
      className={`drawer scratchpad-drawer${dragging ? ' dragging' : ''}`}
      style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
      aria-label="Scratchpad"
    >
      <div
        className="drawer-head drawer-drag"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <div className="drawer-title-group">
          <GripHorizontal size={16} className="drawer-grip" aria-hidden="true" />
          <h2>Scratchpad</h2>
        </div>
        <div className="row" style={{ gap: '0.35rem' }}>
          <div className="scratch-mode-tabs" role="tablist" aria-label="Scratchpad mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'draw'}
              className={mode === 'draw' ? 'active' : undefined}
              onClick={() => setMode('draw')}
            >
              <PenTool size={13} /> Draw
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'text'}
              className={mode === 'text' ? 'active' : undefined}
              onClick={() => setMode('text')}
            >
              <FileText size={13} /> Notes
            </button>
          </div>
          <button type="button" className="btn-ghost btn-icon" aria-label="Close scratchpad" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <div style={{ display: mode === 'draw' ? 'grid' : 'none', gap: '0.55rem' }}>
        <div className="scratch-tools">
          <div className="row" style={{ gap: '0.3rem' }}>
            <button
              type="button"
              className={`scratch-tool-btn${tool === 'pen' ? ' active' : ''}`}
              disabled={disabled}
              onClick={() => setTool('pen')}
              title="Pen"
            >
              <PenTool size={14} /> Pen
            </button>
            <button
              type="button"
              className={`scratch-tool-btn${tool === 'eraser' ? ' active' : ''}`}
              disabled={disabled}
              onClick={() => setTool('eraser')}
              title="Eraser"
            >
              <Eraser size={14} /> Eraser
            </button>
          </div>
          <div className="row" style={{ gap: '0.3rem' }}>
            {INK_COLORS.map((swatch) => (
              <button
                key={swatch.value}
                type="button"
                className={`scratch-swatch${color === swatch.value && tool === 'pen' ? ' active' : ''}`}
                style={{ background: swatch.value }}
                aria-label={swatch.label}
                disabled={disabled}
                onClick={() => {
                  setColor(swatch.value)
                  setTool('pen')
                }}
              />
            ))}
            <button
              type="button"
              className={`scratch-size-btn${strokeSize === 2.5 ? ' active' : ''}`}
              aria-label="Fine pen"
              disabled={disabled}
              onClick={() => setStrokeSize(2.5)}
            >
              S
            </button>
            <button
              type="button"
              className={`scratch-size-btn${strokeSize === 5 ? ' active' : ''}`}
              aria-label="Bold pen"
              disabled={disabled}
              onClick={() => setStrokeSize(5)}
            >
              M
            </button>
          </div>
          <div className="row" style={{ gap: '0.25rem' }}>
            <button
              type="button"
              className="scratch-tool-btn"
              disabled={disabled || !canUndo}
              onClick={undo}
              aria-label="Undo stroke"
              title="Undo"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              className="scratch-tool-btn"
              disabled={disabled}
              onClick={clearCanvas}
              aria-label="Clear canvas"
              title="Clear"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="scratch-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className={`scratch-canvas${tool === 'eraser' ? ' erasing' : ''}`}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerEnd}
            onPointerCancel={onCanvasPointerEnd}
          />
        </div>
        <p className="meta" style={{ margin: 0, fontSize: '0.78rem' }}>
          Pen, touch, or mouse · Drag header to move · Rough work only.
        </p>
      </div>

      {mode === 'text' && (
        <div style={{ display: 'grid', gap: '0.45rem' }}>
          <textarea
            rows={7}
            placeholder="Type rough notes here…"
            value={text}
            disabled={disabled}
            onChange={(event) => onTextChange(event.target.value)}
          />
          <p className="meta" style={{ margin: 0, fontSize: '0.78rem' }}>
            Rough work only — not graded.
          </p>
        </div>
      )}
    </aside>
  )
}
