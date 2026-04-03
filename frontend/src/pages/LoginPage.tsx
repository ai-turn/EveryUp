import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { env } from '../config/env'
import { MaterialIcon } from '../components/common'
import { IconHealthCheck } from '../components/icons/SidebarIcons'

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

  if (isAuthenticated) {
    navigate(from, { replace: true })
    return null
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
      <div className="min-h-screen bg-background-light dark:bg-bg-main-dark flex items-center justify-center">
        <MaterialIcon name="progress_activity" className="text-4xl text-primary animate-spin" />
      </div>
    )
  }

  const isSetup = needsSetup === true
  const inputErrorClass = error ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-200 dark:border-ui-border-dark focus:ring-primary'

  return (
    <div className="min-h-screen bg-background-light dark:bg-bg-main-dark flex items-center justify-center p-4">
      <div>
        {/* Logo / Title */}
        <div className="text-center mb-8 w-96">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <IconHealthCheck size={24} className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary tracking-tight mb-1">EveryUp</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {isSetup ? t('login.setupTitle') : t('login.loginTitle')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            {isSetup ? t('login.setupSubtitle') : t('login.loginSubtitle')}
          </p>
        </div>

        {/* Login card */}
        <div className="w-96">
          {/* relative wrapper — height equals card only, anchor for recovery panel */}
          <div className="relative">
            <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl shadow-sm p-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                  <MaterialIcon name="error_outline" className="text-base mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {isSetup && (
                <div className="flex items-start gap-2 text-blue-500 dark:text-blue-400 text-sm bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2.5">
                  <MaterialIcon name="info" className="text-base mt-0.5 shrink-0" />
                  <span>{t('login.setupNotice')}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="login-username" className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{t('login.username')}</label>
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(''); }}
                    required
                    autoFocus
                    className={`w-full bg-slate-50 dark:bg-ui-hover-dark border ${inputErrorClass} rounded-lg px-3 py-3 text-slate-900 dark:text-white text-sm placeholder-slate-400 outline-none focus:ring-2 focus:border-transparent transition-all`}
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    {t('login.password')}{isSetup && ` (${t('login.passwordMinLength')})`}
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    required
                    className={`w-full bg-slate-50 dark:bg-ui-hover-dark border ${inputErrorClass} rounded-lg px-3 py-3 text-slate-900 dark:text-white text-sm placeholder-slate-400 outline-none focus:ring-2 focus:border-transparent transition-all`}
                    placeholder={isSetup ? t('login.passwordMinLength') : t('login.password')}
                  />
                </div>
                {!isSetup && (
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={() => setShowForgot(!showForgot)}
                      className="text-xs text-blue-500 hover:text-blue-600 underline underline-offset-2 transition-colors"
                    >
                      {t('login.forgotPassword')}
                    </button>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 text-sm shadow-sm hover:shadow-md active:scale-95 transition-all mt-2"
                >
                  {loading && <MaterialIcon name="progress_activity" className="text-base animate-spin" />}
                  {loading ? t('login.processing') : isSetup ? t('login.setupButton') : t('login.loginButton')}
                </button>
              </form>
            </div>

            {/* Recovery panel — outside card div, bottom-aligned with card border */}
            {!isSetup && showForgot && (
              <div className="animate-slide-in-right absolute bottom-0 left-full ml-4 w-96 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl shadow-sm p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {t('login.forgotPassword')}
                </p>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark">
                  {t('login.forgotPasswordDesc')}
                </p>

                {/* Method 1: Env var */}
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('login.recoveryMethod1Title')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-text-muted-dark">
                    {t('login.recoveryMethod1Desc')}
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">① {t('login.recoveryMethod1Step1')}</p>
                    <pre className="text-[11px] bg-slate-50 dark:bg-bg-main-dark border border-slate-200 dark:border-ui-border-dark rounded-lg p-2.5 overflow-x-auto text-slate-700 dark:text-slate-300 leading-relaxed">
{`# docker-compose.yml
environment:
  MT_ADMIN_USERNAME: admin
  MT_ADMIN_PASSWORD: newpassword

docker compose restart`}
                    </pre>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">② {t('login.recoveryMethod1Step2')}</p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">③ {t('login.recoveryMethod1Step3')}</p>
                </div>

                {/* Method 2: Remove data volume */}
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('login.recoveryMethod2Title')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-text-muted-dark">
                    {t('login.recoveryMethod2Desc')}
                  </p>
                  <pre className="text-[11px] bg-slate-50 dark:bg-bg-main-dark border border-slate-200 dark:border-ui-border-dark rounded-lg p-2.5 overflow-x-auto text-slate-700 dark:text-slate-300 leading-relaxed">
{`# 컨테이너 중지 후 데이터 볼륨 삭제
docker compose down
docker volume rm everyup-data

# 재시작 — 초기 설정 화면으로 돌아옴
docker compose up -d`}
                  </pre>
                </div>
              </div>
            )}
          </div>{/* end relative wrapper */}

          <p className="text-center text-slate-400 dark:text-slate-600 text-xs mt-4">
            {t('login.hint')}
          </p>
        </div>
      </div>
    </div>
  )
}
