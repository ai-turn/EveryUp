import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../services/api';
import type { ApiRequest, ApiRequestListParams } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';

export interface UseApiRequestsState {
  items: ApiRequest[];
  total: number;
  loading: boolean;
  error: string | null;
}

export function useApiRequests(
  serviceId: string,
  params?: ApiRequestListParams
): UseApiRequestsState & { refresh: () => void } {
  const [state, setState] = useState<UseApiRequestsState>({
    items: [],
    total: 0,
    loading: false,
    error: null,
  });

  // Separate the search param from the rest for debounce handling
  const { search, ...nonSearchParams } = params ?? {};
  const [debouncedSearch, setDebouncedSearch] = useState<string | undefined>(search);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search changes by 300ms
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  const fetchData = useCallback(async () => {
    if (!serviceId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const mergedParams: ApiRequestListParams = {
        ...nonSearchParams,
        ...(debouncedSearch !== undefined ? { search: debouncedSearch } : {}),
      };
      const response = await api.getServiceApiRequests(serviceId, mergedParams);
      setState({ items: response.items, total: response.total, loading: false, error: null });
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: getErrorMessage(err) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, debouncedSearch, JSON.stringify(nonSearchParams)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refresh: fetchData };
}
