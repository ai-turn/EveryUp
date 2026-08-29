import { useTranslate } from '@tolgee/react';

export type CollectionStatus = 'collecting' | 'partial' | 'delayed' | 'not-configured';

const STYLE: Record<CollectionStatus, string> = {
  collecting: 'border-status-healthy/20 bg-status-healthy/10 text-status-healthy',
  partial: 'border-status-warn/20 bg-status-warn/10 text-status-warn',
  delayed: 'border-status-warn/20 bg-status-warn/10 text-status-warn',
  'not-configured': 'border-status-idle/20 bg-status-idle/10 text-status-idle',
};

const LABEL: Record<CollectionStatus, string> = {
  collecting: '수집 중',
  partial: '부분 수집',
  delayed: '수집 지연',
  'not-configured': '미설정',
};

/** Collection state is deliberately independent from the service health badge. */
export function CollectionStatusBadge({ status }: { status: CollectionStatus }) {
  const { t } = useTranslate();
  return <span className={`inline-flex shrink-0 rounded border px-1.5 py-0.5 text-2xs font-bold ${STYLE[status]}`}>{t(LABEL[status])}</span>;
}
