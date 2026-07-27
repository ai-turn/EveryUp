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
        <p className="text-sm text-text-muted">{t('settings.audit.empty')}</p>
      ) : (
        <ul className="divide-y divide-ui-border-soft">
          {events.map((event) => {
            const count = bodyCountOf(event.metadata);
            return (
              <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-semibold text-text-secondary">{event.username}</span>
                <span className="min-w-0 flex-1 truncate text-text-muted" title={event.traceId}>
                  {t('settings.audit.viewedTrace', { trace: (event.traceId ?? '').slice(0, 12) })}
                </span>
                {typeof count === 'number' && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
                    {t('settings.audit.bodyCount', { count })}
                  </span>
                )}
                <span className="font-mono text-xs text-text-dim">
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
