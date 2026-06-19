import { useState, useEffect, useCallback, useRef } from 'react';
import { env } from '../config/env';

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * 데이터 페칭 기본 훅. mock/API 자동 전환.
 * - env.useMock=true → mockData 즉시 반환
 * - env.useMock=false → fetchFn() 실행
 *
 * @param mockData  mock 모드에서 반환할 데이터
 * @param fetchFn   실제 API 호출 함수
 * @param deps      re-fetch 트리거 의존성 배열
 */
export function useDataFetch<T>(
  mockData: T,
  fetchFn: () => Promise<T>,
  deps: unknown[] = []
): FetchState<T> {
  const [data, setData] = useState<T | null>(env.useMock ? mockData : null);
  const [loading, setLoading] = useState(!env.useMock);
  const [error, setError] = useState<Error | null>(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const initialLoadDone = useRef(false);

  const fetch = useCallback(async () => {
    if (env.useMock) {
      setData(mockData);
      setLoading(false);
      return;
    }

    if (!initialLoadDone.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await fetchFnRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [mockData]);

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps]);

  return { data, loading, error, refetch: fetch };
}
