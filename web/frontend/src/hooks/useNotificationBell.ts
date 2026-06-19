import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import type { NotificationHistory } from '../services/api';

const STORAGE_KEY = 'mt-notif-read-ids';
const POLL_INTERVAL = 60_000;
const PREVIEW_LIMIT = 5;
const FETCH_LIMIT = 50;
const MAX_STORED_IDS = 500;

function loadReadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {
    // ignore parse errors
  }
  return new Set();
}

function saveReadIds(ids: Set<number>) {
  try {
    // Keep only the most recent IDs to prevent unbounded localStorage growth
    const arr = Array.from(ids).slice(-MAX_STORED_IDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore storage errors
  }
}

export interface UseNotificationBellResult {
  previewItems: NotificationHistory[];
  unreadCount: number;
  readIds: Set<number>;
  loading: boolean;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
}

export function useNotificationBell(): UseNotificationBellResult {
  const [allItems, setAllItems] = useState<NotificationHistory[]>([]);
  const [readIds, setReadIds] = useState<Set<number>>(loadReadIds);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.getNotificationHistory({ limit: FETCH_LIMIT });
      setAllItems(res?.items ?? []);
    } catch {
      // Silently fail — header must not crash on API errors
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      await fetchNotifications();
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications]);

  useEffect(() => {
    void loadNotifications();
    timerRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchNotifications, loadNotifications]);

  const unreadCount = allItems.filter(n => !readIds.has(n.id)).length;

  const markAsRead = useCallback((id: number) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev);
      allItems.forEach(n => next.add(n.id));
      saveReadIds(next);
      return next;
    });
  }, [allItems]);

  return {
    previewItems: allItems.slice(0, PREVIEW_LIMIT),
    unreadCount,
    readIds,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
