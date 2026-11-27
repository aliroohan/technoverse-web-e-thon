import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { Button } from './ui'

export function VerifyShare({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const url = `${window.location.origin}/verify/${code}`

  return (
    <div className="row">
      <a href={url}>{url}</a>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setCopyError(false)
          void navigator.clipboard
            .writeText(url)
            .then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 2000)
            })
            .catch(() => {
              setCopyError(true)
            })
        }}
      >
        <Link2 size={15} /> {copied ? 'Copied' : copyError ? 'Copy failed' : 'Copy link'}
      </Button>
    </div>
  )
}
