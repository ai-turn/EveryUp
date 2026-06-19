import { useCallback } from 'react';
import toast from 'react-hot-toast';

interface UseClipboardCopyOptions {
  successMessage?: string;
  errorMessage?: string;
}

async function copyWithClipboardApi(text: string): Promise<void> {
  if (!window.isSecureContext || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is unavailable outside a secure context.');
  }

  await navigator.clipboard.writeText(text);
}

function copyWithTextareaFallback(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const copied = document.execCommand('copy');
    if (!copied) {
      throw new Error('Fallback copy command was rejected.');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await copyWithClipboardApi(text);
  } catch {
    copyWithTextareaFallback(text);
  }
}

export function useClipboardCopy(options: UseClipboardCopyOptions = {}) {
  const {
    successMessage = '클립보드에 복사되었습니다.',
    errorMessage = '복사에 실패했습니다.',
  } = options;

  const copy = useCallback(async (text: string) => {
    try {
      await copyTextToClipboard(text);
      toast.success(successMessage);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error(errorMessage);
      return false;
    }
  }, [successMessage, errorMessage]);

  return { copy };
}
