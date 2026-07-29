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
  // latest-ref: fetchFn을 deps에 넣지 않고도 최신 클로저를 쓰기 위한 것.
  // 갱신을 렌더 중에 하면 안 된다 — React가 렌더를 버릴 수 있어 커밋되지 않은
  // 클로저가 ref에 남는다. 커밋 이후에 쓰고, 아래 fetch effect보다 먼저 선언해
  // deps가 바뀐 커밋에서도 fetch가 최신 fn을 보게 한다.
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  });

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
