import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart2, Clock, Eye, EyeOff, Lock, LogIn, Mail, Play, Plus, ShieldCheck, Wifi } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Banner, Button, Field, TextInput } from '../components/ui'
import { ApiError, apiRequest } from '../lib/api-client'
import { homeFor } from '../lib/session'
import type { SessionUser } from '../types/domain'

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const user = await apiRequest<SessionUser>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      queryClient.setQueryData(['me'], user)
      await navigate({ to: homeFor(user.role) })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login">
      <section className="login-hero">
        {/* Organic parchment waves + faint clock dial */}
        <svg
          className="login-art-bg"
          viewBox="0 0 800 720"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="hfClockGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fffdf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f4efe6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path
            d="M0 0 H800 V720 H0 Z"
            fill="#f4efe6"
          />
          <path
            d="M-60 90 C140 20, 290 190, 480 120 C650 60, 740 160, 860 90 L860 740 L-60 740 Z"
            fill="#faf6ee"
          />
          <path
            d="M-40 430 C160 350, 320 530, 520 460 C690 400, 770 490, 860 440 L860 760 L-40 760 Z"
            fill="#fffdf8"
            opacity="0.72"
          />
          <ellipse cx="460" cy="320" rx="340" ry="250" fill="url(#hfClockGlow)" />

          {/* Faint editorial clock dial watermark */}
          <g transform="translate(650 135) scale(0.58)" opacity="0.22" stroke="#9e9382" fill="none">
            <circle cx="0" cy="0" r="148" strokeWidth="1.8" />
            <circle cx="0" cy="0" r="126" strokeWidth="1.2" strokeDasharray="3 10" />
            <line x1="0" y1="-138" x2="0" y2="-122" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="138" y1="0" x2="122" y2="0" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="0" y1="138" x2="0" y2="122" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="-138" y1="0" x2="-122" y2="0" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="69" y1="-119" x2="61" y2="-105" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="119" y1="-69" x2="105" y2="-61" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="119" y1="69" x2="105" y2="61" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="69" y1="119" x2="61" y2="105" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="-69" y1="119" x2="-61" y2="105" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="-119" y1="69" x2="-105" y2="61" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="-119" y1="-69" x2="-105" y2="-61" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="-69" y1="-119" x2="-61" y2="-105" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="0" y1="0" x2="58" y2="-56" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="0" y1="0" x2="-46" y2="-28" strokeWidth="3.4" strokeLinecap="round" />
            <circle cx="0" cy="0" r="5.5" fill="#9e9382" />
          </g>
        </svg>

        {/* Flowing Diagonal Bridge Stage */}
        <div className="login-bridge-stage" aria-label="Examination workflow">
          <svg className="login-bridge-svg" viewBox="0 0 740 280" fill="none" aria-hidden="true">
            <path
              d="M 46 54 C 95 54, 128 92, 178 92 C 245 92, 300 122, 370 122 C 445 122, 495 186, 562 186 C 614 186, 646 214, 694 214"
              stroke="rgba(30, 92, 64, 0.22)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              className="bridge-flow-line"
              d="M 46 54 C 95 54, 128 92, 178 92 C 245 92, 300 122, 370 122 C 445 122, 495 186, 562 186 C 614 186, 646 214, 694 214"
              stroke="#1e5c40"
              strokeOpacity="0.6"
              strokeWidth="2"
              strokeDasharray="6 9"
              strokeLinecap="round"
            />

            {/* Starting point (upper-left) */}
            <circle cx="46" cy="54" r="10" fill="#fffdf8" stroke="#1e5c40" strokeWidth="2.2" />
            <circle cx="46" cy="54" r="4.5" fill="#1e5c40" />

            {/* Midpoint waypoints */}
            <circle cx="274" cy="107" r="4.5" fill="#8a5a12" />
            <circle cx="466" cy="154" r="4.5" fill="#1e5c40" />

            {/* Ending point (lower-right) */}
            <circle cx="694" cy="214" r="10" fill="#fffdf8" stroke="#1c1915" strokeWidth="2.2" />
            <circle cx="694" cy="214" r="4.5" fill="#1c1915" />
          </svg>

          <div className="bridge-node bridge-node-1">
            <span className="bridge-orb orb-sage" aria-hidden="true">
              <Plus size={25} strokeWidth={2.3} />
            </span>
            <span className="bridge-label">Create Exam</span>
          </div>

          <div className="bridge-node bridge-node-2">
            <span className="bridge-orb orb-pine" aria-hidden="true">
              <Play size={22} strokeWidth={2.2} fill="currentColor" style={{ marginLeft: '2px' }} />
            </span>
            <span className="bridge-label">Conduct Exam</span>
          </div>

          <div className="bridge-node bridge-node-3">
            <span className="bridge-orb orb-ink" aria-hidden="true">
              <BarChart2 size={23} strokeWidth={2.2} />
            </span>
            <span className="bridge-label">View Results</span>
          </div>
        </div>

        <div className="login-hero-foot">
          <h1>Holdfast</h1>
          <p className="lede" style={{ marginTop: '0.55rem', marginBottom: 0 }}>
            Server-owned clock. Failure-resilient sitting.
          </p>
        </div>
      </section>

      <section className="login-panel">
        <svg className="login-panel-art" viewBox="0 0 500 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <circle cx="440" cy="80" r="190" fill="none" stroke="rgba(30, 92, 64, 0.08)" strokeWidth="1.5" />
          <circle cx="440" cy="80" r="140" fill="none" stroke="rgba(138, 90, 18, 0.09)" strokeWidth="1" strokeDasharray="4 8" />
          <circle cx="70" cy="650" r="170" fill="none" stroke="rgba(28, 25, 21, 0.06)" strokeWidth="1.5" />
        </svg>

        <form className="stack login-card" onSubmit={(event) => void submit(event)}>
          <div className="login-card-head">
            <span className="login-crest" aria-hidden="true">
              <ShieldCheck size={20} strokeWidth={1.85} />
            </span>
            <div>
              <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 540, fontSize: '1.8rem', margin: 0, lineHeight: 1.1 }}>
                Sign in
              </h2>
              <p className="meta" style={{ margin: '0.2rem 0 0' }}>Institution credentials</p>
            </div>
          </div>

          {error && <Banner tone="error">{error}</Banner>}

          <Field label="Email">
            <div style={{ position: 'relative' }}>
              <Mail
                size={15}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '0.8rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-soft)',
                  pointerEvents: 'none',
                }}
              />
              <TextInput
                type="email"
                autoComplete="username"
                placeholder="name@holdfast.test"
                style={{ paddingLeft: '2.3rem' }}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </Field>

          <Field label="Password">
            <div style={{ position: 'relative' }}>
              <Lock
                size={15}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '0.8rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-soft)',
                  pointerEvents: 'none',
                }}
              />
              <TextInput
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                style={{ paddingLeft: '2.3rem', paddingRight: '2.5rem' }}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  position: 'absolute',
                  right: '0.45rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  background: 'transparent',
                  color: 'var(--ink-soft)',
                  padding: '0.3rem',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  borderRadius: '8px',
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <Button type="submit" block loading={pending}>
            <LogIn size={16} /> Log in
          </Button>

          <div className="login-card-foot">
            <span className="meta-chip"><Clock size={13} /> Server clock</span>
            <span className="meta-chip"><Wifi size={13} /> Resilient</span>
            <span className="meta-chip"><ShieldCheck size={13} /> Verified</span>
          </div>
        </form>
      </section>
    </div>
  )
}
