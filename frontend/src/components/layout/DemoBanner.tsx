import { env } from '../../config/env'

export function DemoBanner() {
  if (!env.isDemoMode) return null

  return (
    <div className="w-full bg-amber-400 text-amber-900 text-xs font-medium py-2 px-4 flex items-center justify-center gap-2 shrink-0 z-50">
      <span>🎯</span>
      <span>This is a live demo — all data is simulated and not connected to a real server.</span>
      <a
        href="https://github.com/AI-turn/EveryUp"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-semibold hover:text-amber-950 transition-colors"
      >
        View on GitHub →
      </a>
    </div>
  )
}
