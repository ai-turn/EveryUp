import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type AuditEvent } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { env } from '../../../config/env';
import { SectionCard } from './SectionCard';

const BODY_VIEW_ACTION = 'trace.body.view';

function bodyCountOf(metadata?: string): number | undefined {
  if (!metadata) return undefined;
  try {
    const parsed = JSON.parse(metadata) as { capturedBodyEvents?: number };
    return parsed.capturedBodyEvents;
  } catch {
    return undefined;
  }
}

// Admin-only audit trail of captured-body views. Renders nothing for
// non-admins or in mock mode, so it can be dropped into the settings views
// unconditionally.
export function AuditLogSection() {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin || env.useMock) return;
    api
      .getAuditEvents({ action: BODY_VIEW_ACTION, limit: 50 })
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <SectionCard title={t('settings.audit.title')} subtitle={t('settings.audit.subtitle')}>
      {events.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-text-muted-dark">{t('settings.audit.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-ui-border-dark">
          {events.map((event) => {
            const count = bodyCountOf(event.metadata);
            return (
              <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-semibold text-slate-700 dark:text-text-secondary-dark">{event.username}</span>
                <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-text-muted-dark" title={event.traceId}>
                  {t('settings.audit.viewedTrace', { trace: (event.traceId ?? '').slice(0, 12) })}
                </span>
                {typeof count === 'number' && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
                    {t('settings.audit.bodyCount', { count })}
                  </span>
                )}
                <span className="font-mono text-xs text-slate-400 dark:text-text-dim-dark">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
