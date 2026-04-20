import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../common';
import { useNotificationBell } from '../../hooks/useNotificationBell';
import type { NotificationHistory, NotificationStatus, NotificationAlertType } from '../../services/api';

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return rtf.format(0, 'minute');
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, 'hour');
  const days = Math.floor(hrs / 24);
  return rtf.format(-days, 'day');
}

const STATUS_ICON: Record<NotificationStatus, { name: string; className: string }> = {
  sent: { name: 'check_circle', className: 'text-success' },
  failed: { name: 'cancel', className: 'text-error' },
  pending: { name: 'pending', className: 'text-warning' },
};

const ALERT_TYPE_ICON: Record<NotificationAlertType, string> = {
  resource: 'memory',
  healthcheck: 'monitor_heart',
  log: 'description',
  scheduled: 'schedule',
  endpoint: 'http',
};

// ─── Notification Item ───────────────────────────────────────────────────────

interface NotificationItemProps {
  item: NotificationHistory;
  isUnread: boolean;
  lang: string;
  onRead: (id: number) => void;
}

function NotificationItem({ item, isUnread, lang, onRead }: NotificationItemProps) {
  const statusIcon = STATUS_ICON[item.status] ?? { name: 'notifications', className: 'text-text-muted' };
  const typeIcon = ALERT_TYPE_ICON[item.alertType] ?? 'notifications';

  const handleClick = () => {
    onRead(item.id);
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer
        hover:bg-ui-hover dark:hover:bg-ui-hover-dark
        ${isUnread ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
    >
      {/* Type icon */}
      <div className="shrink-0 mt-0.5">
        <MaterialIcon
          name={typeIcon}
          className="text-text-muted dark:text-text-muted-dark text-lg"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-snug line-clamp-2 ${isUnread ? 'text-text-base dark:text-text-base-dark font-medium' : 'text-text-muted dark:text-text-muted-dark'}`}>
          {item.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <MaterialIcon name={statusIcon.name} className={`text-xs ${statusIcon.className}`} />
          <span className="text-xs text-text-dim dark:text-text-dim-dark">
            {timeAgo(item.createdAt, lang)}
          </span>
          {item.serviceName && (
            <span className="text-xs text-text-dim dark:text-text-dim-dark truncate">
              · {item.serviceName}
            </span>
          )}
        </div>
      </div>

      {/* Unread indicator */}
      {isUnread && (
        <div className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary" />
      )}
    </button>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

interface BadgeProps {
  count: number;
}

function Badge({ count }: BadgeProps) {
  if (count <= 0) return null;
  const label = count > 9 ? '9+' : String(count);
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 flex items-center justify-center
      bg-error text-white text-[10px] font-bold rounded-full leading-none tabular-nums pb-px ring-2 ring-white dark:ring-bg-main-dark">
      {label}
    </span>
  );
}

// ─── Main Dropdown ───────────────────────────────────────────────────────────

interface NotificationDropdownProps {
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export function NotificationDropdown({ open, onClose, onToggle }: NotificationDropdownProps) {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const { previewItems, unreadCount, readIds, loading, markAsRead, markAllAsRead } = useNotificationBell();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleViewAll = () => {
    markAllAsRead();
    onClose();
    navigate('/alerts');
  };

  const handleItemRead = (id: number) => {
    markAsRead(id);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={onToggle}
        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
        aria-label={t('notificationBell.title')}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="relative inline-flex">
          <IconBell />
          <Badge count={unreadCount} />
        </span>
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-xl border border-ui-border dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ui-border dark:border-ui-border-dark">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-base dark:text-text-base-dark">
                {t('notificationBell.title')}
              </span>
              {unreadCount > 0 && (
                <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount} {t('notificationBell.unreadLabel')}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary hover:text-primary-hover transition-colors cursor-pointer"
              >
                {t('notificationBell.markAllRead')}
              </button>
            )}
          </div>

          {/* Items */}
          <div className="divide-y divide-ui-border dark:divide-ui-border-dark">
            {loading && previewItems.length === 0 ? (
              <div className="px-4 py-6 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="w-5 h-5 rounded-full bg-ui-hover dark:bg-ui-hover-dark shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-ui-hover dark:bg-ui-hover-dark rounded w-full" />
                      <div className="h-3 bg-ui-hover dark:bg-ui-hover-dark rounded w-2/3" />
                      <div className="h-2 bg-ui-hover dark:bg-ui-hover-dark rounded w-1/4 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            ) : previewItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 gap-2">
                <MaterialIcon name="notifications_none" className="text-text-dim dark:text-text-dim-dark text-3xl" />
                <p className="text-sm text-text-muted dark:text-text-muted-dark">{t('notificationBell.empty')}</p>
              </div>
            ) : (
              previewItems.map(item => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  isUnread={!readIds.has(item.id)}
                  lang={i18n.language}
                  onRead={handleItemRead}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-ui-border dark:border-ui-border-dark">
            <button
              onClick={handleViewAll}
              className="w-full px-4 py-2.5 text-xs font-medium text-primary hover:bg-ui-hover dark:hover:bg-ui-hover-dark transition-colors cursor-pointer"
            >
              {t('notificationBell.viewAll')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
