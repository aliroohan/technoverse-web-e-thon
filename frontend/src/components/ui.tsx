import { Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="spinner-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeOpacity="0.24" strokeWidth="2.6" />
      <path
        d="M12 2.75A9.25 9.25 0 1 1 3.98 16.62"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  )
}

export function Loader({ label = 'Loading', full = false }: { label?: string; full?: boolean }) {
  const size = full ? 64 : 50
  return (
    <div className={full ? 'loader-stage full' : 'loader-stage'} role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <svg
        className="loader-svg"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="32" cy="32" r="22" stroke="rgba(28, 25, 21, 0.1)" strokeWidth="1.5" />
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 32 32"
            to="360 32 32"
            dur="1.25s"
            repeatCount="indefinite"
          />
          <circle cx="32" cy="10" r="4.2" fill="var(--pine)" />
          <circle cx="51.05" cy="43" r="3.8" fill="var(--brass)" />
          <circle cx="12.95" cy="43" r="3.4" fill="var(--ink)" />
        </g>
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="360 32 32"
            to="0 32 32"
            dur="1.7s"
            repeatCount="indefinite"
          />
          <circle cx="32" cy="20" r="2.6" fill="var(--pine)" fillOpacity="0.65" />
          <circle cx="32" cy="44" r="2.6" fill="var(--brass)" fillOpacity="0.65" />
        </g>
      </svg>
    </div>
  )
}

export function Button({
  variant = 'solid',
  block = false,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'ghost' | 'danger'
  block?: boolean
  loading?: boolean
}) {
  const variantClass = variant === 'ghost' ? 'btn-ghost' : variant === 'danger' ? 'btn-danger' : 'btn'
  const classes = [variantClass, block ? 'btn-block' : '', loading ? 'is-loading' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      <span className="btn-content">{children}</span>
      {loading && (
        <span className="btn-spinner" aria-hidden="true">
          <Spinner size={18} />
        </span>
      )}
    </button>
  )
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

type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

function readOptions(children: ReactNode): SelectOption[] {
  const items: SelectOption[] = []
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) continue
    if (child.type !== 'option') continue
    const rawLabel = Children.toArray(child.props.children)
      .map((part) => (typeof part === 'string' || typeof part === 'number' ? String(part) : ''))
      .join('')
    const val = child.props.value !== undefined ? String(child.props.value) : rawLabel
    items.push({
      value: val,
      label: rawLabel || val,
      disabled: Boolean(child.props.disabled),
    })
  }
  return items
}

export function Select({
  children,
  className,
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  name,
  'aria-label': ariaLabel,
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = readOptions(children)
  const [internal, setInternal] = useState(() =>
    defaultValue !== undefined ? String(defaultValue) : (options[0]?.value ?? ''),
  )
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const currentValue = value !== undefined ? String(value) : internal
  const selected = options.find((opt) => opt.value === currentValue) ?? options[0]

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const updatePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < 220 && rect.top > spaceBelow
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        minWidth: rect.width,
        ...(openUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      })
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (nextValue: string) => {
    if (value === undefined) setInternal(nextValue)
    setOpen(false)
    if (onChange) {
      onChange({
        target: { value: nextValue, name: name ?? '' },
        currentTarget: { value: nextValue, name: name ?? '' },
      } as ChangeEvent<HTMLSelectElement>)
    }
  }

  return (
    <div ref={rootRef} className={['select-box', className].filter(Boolean).join(' ')}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="select-value">{selected?.label ?? ''}</span>
        <ChevronDown size={15} className={`select-chevron${open ? ' open' : ''}`} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <ul ref={menuRef} className="select-menu" style={menuStyle} role="listbox" aria-label={ariaLabel}>
            {options.map((option) => {
              const isSelected = option.value === currentValue
              return (
                <li key={`${option.value}-${option.label}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    className={`select-option${isSelected ? ' selected' : ''}`}
                    onClick={() => choose(option.value)}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check size={14} className="select-check" aria-hidden="true" />}
                  </button>
                </li>
              )
            })}
          </ul>,
          document.body,
        )}
    </div>
  )
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
          <Button type="button" variant="ghost" className="btn-icon" aria-label="Close" title="Close" onClick={onClose}>
            <X size={16} />
          </Button>
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
          <Button type="button" variant="ghost" className="btn-icon" aria-label="Close" title="Close" onClick={onClose}>
            <X size={16} />
          </Button>
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
    <div className="row" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }} aria-label="Pagination">
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
