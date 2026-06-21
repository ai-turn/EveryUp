import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, PageHeader } from '../../components/common';
import { api, type AgentServiceFlat } from '../../services/api';

function StatusDot({ healthy }: { healthy: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {healthy && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span
        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
          healthy ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
    </span>
  );
}

function EmptyState() {
  const { t } = useTranslate();
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-ui-hover-dark">
        <MaterialIcon name="sensors" className="text-3xl text-slate-400 dark:text-text-dim-dark" />
      </div>
      <div>
        <p className="text-slate-700 dark:text-white font-semibold text-lg">
          {t('연결된 에이전트가 없습니다')}
        </p>
        <p className="text-slate-500 dark:text-text-muted-dark text-sm mt-1 max-w-sm">
          {t('Agent를 배포하고 Docker 라벨을 추가하면 서비스가 자동으로 감지됩니다')}
        </p>
      </div>
    </div>
  );
}

export function HealthCheckPage() {
  const { t } = useTranslate();
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();

  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.getAllAgentServicesFlat();
      setServices(data);
    } catch {
      // non-critical — empty state shown
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = services.filter(
    (s) =>
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.endpoint.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const healthyCount = services.filter((s) => s.healthy).length;
  const unhealthyCount = services.filter((s) => !s.healthy).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('헬스체크')}
        subtitle={t('Agent가 감지한 서비스 상태')}
      />

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('전체'), value: services.length, color: 'text-slate-900 dark:text-white' },
          { label: t('정상'), value: healthyCount, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: t('장애'), value: unhealthyCount, color: unhealthyCount > 0 ? 'text-red-500' : 'text-slate-400 dark:text-text-dim-dark' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl px-5 py-4"
          >
            <p className="text-xs text-slate-500 dark:text-text-muted-dark uppercase tracking-wider mb-1">
              {kpi.label}
            </p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <MaterialIcon
          name="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-text-dim-dark text-lg"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('서비스 또는 에이전트 이름으로 검색')}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-text-dim-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Service list */}
      {loading ? (
        <div className="flex items-center justify-center h-40 gap-3 text-slate-500 dark:text-text-muted-dark">
          <MaterialIcon name="sync" className="text-2xl animate-spin" />
          <span>{tc('common.loading')}</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-ui-border-dark text-xs text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                <th className="text-left px-5 py-3">{t('서비스')}</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">{t('에이전트')}</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">{t('엔드포인트')}</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">{t('지연시간')}</th>
                <th className="text-left px-5 py-3">{t('상태')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-ui-border-dark">
              {filtered.map((svc) => (
                <tr
                  key={`${svc.agentId}/${svc.key}`}
                  onClick={() => navigate(`/services/${svc.agentId}/${encodeURIComponent(svc.key)}`)}
                  className="hover:bg-slate-50 dark:hover:bg-ui-hover-dark cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2.5">
                      <StatusDot healthy={svc.healthy} />
                      <span>{svc.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-text-muted-dark hidden sm:table-cell">
                    {svc.agentName}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-text-muted-dark hidden md:table-cell max-w-60 truncate">
                    <code className="text-xs">{svc.endpoint || '-'}</code>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-text-secondary-dark hidden lg:table-cell">
                    {svc.lastLatency || '-'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        svc.healthy
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {svc.healthy ? t('정상') : t('장애')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
