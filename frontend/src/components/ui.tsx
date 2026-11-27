import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export function Button({
  variant = 'solid',
  block = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid' | 'ghost' | 'danger'; block?: boolean }) {
  const variantClass = variant === 'ghost' ? 'btn-ghost' : variant === 'danger' ? 'btn-danger' : 'btn'
  const classes = [variantClass, block ? 'btn-block' : '', className].filter(Boolean).join(' ')
  return <button className={classes} {...props} />
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />
}

export function Area(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: ReactNode }) {
  return (
    <p className={tone === 'error' ? 'banner error' : tone === 'ok' ? 'banner ok' : 'banner'} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dialog-root">
      <button type="button" className="dialog-backdrop" aria-label="Close" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const titleId = useId()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-root">
      <button type="button" className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </aside>
    </div>
  )
}

export function Pagination({
  page,
  totalPages,
  total,
  label = 'items',
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  label?: string
  onPageChange: (nextPage: number) => void
}) {
  if (total === 0) return null
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginTop: '1rem' }} aria-label="Pagination">
      <span className="meta">
        Page {page} of {totalPages} · {total} {label}
      </span>
      {totalPages > 1 && (
        <div className="row">
          <Button
            type="button"
            variant="ghost"
            className="btn-icon"
            aria-label="Previous page"
            title="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="btn-icon"
            aria-label="Next page"
            title="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
