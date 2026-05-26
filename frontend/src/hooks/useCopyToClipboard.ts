import { useClipboardCopy } from './useClipboardCopy';

/**
 * Backward-compatible alias for older copy call sites.
 */
export function useCopyToClipboard() {
  return useClipboardCopy();
}
