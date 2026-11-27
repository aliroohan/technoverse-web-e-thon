import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export function Button({
  variant = 'solid',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid' | 'ghost' | 'danger' }) {
  const className = variant === 'ghost' ? 'btn-ghost' : variant === 'danger' ? 'btn-danger' : 'btn'
  return <button className={className} {...props} />
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
          <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <Button type="button" variant="ghost" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
