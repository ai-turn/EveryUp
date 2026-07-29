import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { env } from '../../config/env'
import { Button, MaterialIcon, Input } from '../../components/common'
import { IconHealthCheck } from '../../components/icons/SidebarIcons'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['auth', 'common'])
  // Validate redirect path to prevent open redirect attacks
  const rawFrom = (location.state as { from?: string })?.from
  const from = rawFrom && rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/'

  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)

  // Check if first-run setup is needed
  useEffect(() => {
    fetch(`${env.apiBaseUrl}/auth/setup/status`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setNeedsSetup(json.data.needs_setup)
      })
      .catch(() => setError(t('login.error.network')))
  }, [])

  // 렌더 중에 navigate()를 부르면 렌더 단계 부작용이라 내비게이션 루프를 만들 수 있다.
  // 리다이렉트를 렌더 결과로 표현하는 것이 react-router가 의도한 방식이다.
  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const endpoint = needsSetup ? '/auth/setup' : '/auth/login'

    try {
      const res = await fetch(`${env.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const json = await res.json()
      if (json.success) {
        login(json.data)
        navigate(from, { replace: true })
      } else {
        setError(json.error?.message || t('login.error.generic'))
        setLoading(false)
      }
    } catch {
      setError(t('login.error.network'))
      setLoading(false)
    }
  }

  // Still loading setup status
  if (needsSetup === null && !error) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <MaterialIcon name="progress_activity" className="text-4xl text-primary animate-spin" />
      </div>
    )
  }

  const isSetup = needsSetup === true

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <div>
        {/* Logo / Title */}
        <div className="text-center mb-8 w-[26rem] max-w-full">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <IconHealthCheck size={24} className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary tracking-tight mb-1">EveryUp</div>
          <h2 className="text-xl font-bold text-text-base">
            {isSetup ? t('login.setupTitle') : t('login.loginTitle')}
          </h2>
          <p className="text-text-muted text-sm mt-1">
            {isSetup ? t('login.setupSubtitle') : t('login.loginSubtitle')}
          </p>
        </div>

        {/* Login card */}
        <div className="w-[26rem] max-w-full">
          {/* relative wrapper — height equals card only, anchor for recovery panel */}
          <div className="relative">
            <div className="bg-bg-surface border border-ui-border rounded-xl shadow-sm p-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                  <span className="w-4 h-5 shrink-0 inline-flex items-center justify-center">
                    <MaterialIcon name="error_outline" className="text-sm leading-none" />
                  </span>
                  <span>{error}</span>
                </div>
              )}

              {isSetup && (
                <div className="flex items-start gap-2 text-sky-600 dark:text-sky-400 text-sm bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2.5">
                  <span className="w-4 h-5 shrink-0 inline-flex items-center justify-center">
                    <MaterialIcon name="info" className="text-sm leading-none" />
                  </span>
                  <span>{t('login.setupNotice')}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="login-username" className="block text-sm font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('login.username')}</label>
                  <Input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(''); }}
                    required
                    autoFocus
                    invalid={!!error}
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="block text-sm font-bold text-text-muted uppercase tracking-wider mb-1.5">
                    {t('login.password')}{isSetup && ` (${t('login.passwordMinLength')})`}
                  </label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    required
                    invalid={!!error}
                    placeholder={isSetup ? t('login.passwordMinLength') : t('login.password')}
                  />
                </div>
                {!isSetup && (
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={() => setShowForgot(!showForgot)}
                      className="text-sm text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                    >
                      {t('login.forgotPassword')}
                    </button>
                  </div>
                )}
                <Button type="submit" size="lg" disabled={loading} className="w-full mt-2">
                  {loading && <MaterialIcon name="progress_activity" className="text-sm animate-spin" />}
                  {loading ? t('login.processing') : isSetup ? t('login.setupButton') : t('login.loginButton')}
                </Button>
              </form>
            </div>

            {/* Recovery panel — outside card div, bottom-aligned with card border */}
            {!isSetup && showForgot && (
              <div className="animate-slide-in-right absolute bottom-0 left-full ml-4 w-[26rem] bg-bg-surface border border-ui-border rounded-xl shadow-sm p-5 space-y-4">
                <p className="text-sm font-semibold text-text-secondary">
                  {t('login.forgotPassword')}
                </p>
                <p className="text-sm text-text-muted">
                  {t('login.forgotPasswordDesc')}
                </p>

                {/* Method 1: Env var */}
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-text-secondary">
                    {t('login.recoveryMethod1Title')}
                  </p>
                  <p className="text-sm text-text-muted">
                    {t('login.recoveryMethod1Desc')}
                  </p>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-text-muted">① {t('login.recoveryMethod1Step1')}</p>
                    <pre className="text-xs bg-bg-main border border-ui-border rounded-lg p-2.5 overflow-x-auto text-text-secondary leading-relaxed">
{`# docker-compose.yml
environment:
  EVERYUP_ADMIN_USERNAME: admin
  EVERYUP_ADMIN_PASSWORD: newpassword

docker compose restart`}
                    </pre>
                  </div>
                  <p className="text-sm font-semibold text-text-muted">② {t('login.recoveryMethod1Step2')}</p>
                  <p className="text-sm font-semibold text-text-muted">③ {t('login.recoveryMethod1Step3')}</p>
                </div>

                {/* Method 2: Remove data volume */}
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-text-secondary">
                    {t('login.recoveryMethod2Title')}
                  </p>
                  <p className="text-sm text-text-muted">
                    {t('login.recoveryMethod2Desc')}
                  </p>
                  <pre className="text-xs bg-bg-main border border-ui-border rounded-lg p-2.5 overflow-x-auto text-text-secondary leading-relaxed">
{`# 컨테이너 중지 후 데이터 볼륨 삭제
docker compose down
docker volume rm everyup-data

# 재시작 — 초기 설정 화면으로 돌아옴
docker compose up -d`}
                  </pre>
                </div>

                {/* GitHub README link */}
                <a
                  href="https://github.com/ai-turn/everyup#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-text-dim hover:text-primary dark:hover:text-primary transition-colors"
                >
                  <MaterialIcon name="open_in_new" className="text-xs" />
                  GitHub README
                </a>
              </div>
            )}
          </div>{/* end relative wrapper */}

          <p className="text-center text-text-dim text-sm mt-4">
            {t('login.hint')}
          </p>
        </div>
      </div>
    </div>
  )
}
