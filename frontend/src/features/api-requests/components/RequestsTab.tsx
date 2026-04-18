import { useState, useCallback, useEffect } from 'react';
import { MaterialIcon } from '../../../components/common';
import { useSidePanel } from '../../../contexts/SidePanelContext';
import { useApiRequests } from '../hooks/useApiRequests';
import { RequestFilters } from './RequestFilters';
import { RequestsTable } from './RequestsTable';
import { RequestDetailDrawer } from './RequestDetailDrawer';
import type { ApiRequest, ApiRequestListParams } from '../../../services/api';

export interface RequestsTabProps {
  serviceId: string;
  onGoToSettings: () => void;
}

const DEFAULT_LIMIT = 50;

function isDefaultParams(params: ApiRequestListParams): boolean {
  return (
    !params.search &&
    !params.method &&
    !params.minStatus &&
    !params.maxStatus &&
    !params.pathPrefix &&
    !params.errorsOnly
  );
}

export function RequestsTab({ serviceId, onGoToSettings }: RequestsTabProps) {
  const { openPanel } = useSidePanel();

  // Filter params (without offset/limit — managed separately)
  const [filterParams, setFilterParams] = useState<ApiRequestListParams>({
    from: new Date(Date.now() - 24 * 3600_000).toISOString(),
  });
  const [offset, setOffset] = useState(0);

  // Accumulated items across "load more" pages
  const [accumulatedItems, setAccumulatedItems] = useState<ApiRequest[]>([]);

  // Build the params for the current fetch
  const fetchParams: ApiRequestListParams = { ...filterParams, limit: DEFAULT_LIMIT, offset };

  const { items, total, loading, error } = useApiRequests(serviceId, fetchParams);

  // When new items arrive, merge them into the accumulated list.
  // offset === 0 means a fresh fetch (filters changed), so replace.
  useEffect(() => {
    if (loading) return;
    if (offset === 0) {
      setAccumulatedItems(items);
    } else {
      setAccumulatedItems((prev) => [...prev, ...items]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loading]);

  const handleParamsChange = useCallback((next: ApiRequestListParams) => {
    setFilterParams(next);
    setOffset(0);
    // Don't clear items here — keep showing stale data while re-fetching
    // to avoid flicker. The useEffect replaces items when offset===0.
  }, []);

  const handleLoadMore = useCallback(() => {
    setOffset((prev) => prev + DEFAULT_LIMIT);
  }, []);

  const handleSelect = useCallback(
    (request: ApiRequest) => {
      openPanel(
        `${request.method} ${request.pathTemplate}`,
        <RequestDetailDrawer request={request} />
      );
    },
    [openPanel]
  );

  const showEmpty =
    !loading && !error && accumulatedItems.length === 0 && isDefaultParams(filterParams);
  const showNoResults =
    !loading && !error && accumulatedItems.length === 0 && !isDefaultParams(filterParams);

  return (
    <div className="space-y-4">
      <RequestFilters params={filterParams} onChange={handleParamsChange} />

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <MaterialIcon name="error_outline" className="text-base shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center mb-6">
            <MaterialIcon name="http" className="text-4xl text-slate-400 dark:text-text-dim-dark" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            No requests captured yet
          </h3>
          <p className="text-slate-500 dark:text-text-muted-dark text-center max-w-md mb-6">
            Configure API capture to start recording HTTP requests for this service.
          </p>
          <button
            onClick={onGoToSettings}
            className="px-6 py-3 bg-primary hover:bg-primary/90 rounded-lg text-white font-bold transition-colors"
          >
            Configure capture
          </button>
        </div>
      )}

      {showNoResults && (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center mb-4">
            <MaterialIcon name="search_off" className="text-3xl text-slate-400 dark:text-text-dim-dark" />
          </div>
          <p className="text-slate-500 dark:text-text-muted-dark text-sm">
            No requests match the current filters.
          </p>
        </div>
      )}

      {!showEmpty && (
        <>
          <RequestsTable items={accumulatedItems} loading={loading} onSelect={handleSelect} />

          {accumulatedItems.length > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-text-muted-dark px-1">
              <span>
                Showing {accumulatedItems.length} of {total}
              </span>
              {accumulatedItems.length < total && (
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-ui-hover-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark font-medium text-slate-700 dark:text-text-secondary-dark transition-colors disabled:opacity-50"
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
