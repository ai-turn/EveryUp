import { useState } from 'react';
import { Button, MaterialIcon } from '../../../components/common';
import { api } from '../../../services/api';
import { copyTextToClipboard } from '../../../hooks/useClipboardCopy';
import { getErrorMessage } from '../../../utils/errors';
import { toast } from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

type Step = 'form' | 'key';

export function AddServiceModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await api.createAgent(trimmed);
      setApiKey(res.apiKey);
      setStep('key');
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    // copyTextToClipboard falls back to a textarea + execCommand on plain HTTP,
    // where navigator.clipboard is unavailable (non-secure context).
    try {
      await copyTextToClipboard(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('복사에 실패했습니다. 키를 직접 선택해 복사하세요.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-bg-surface rounded-2xl shadow-2xl border border-ui-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-soft">
          <h2 className="text-base font-semibold text-text-base">
            {step === 'form' ? '프로젝트 추가' : 'API 키 발급 완료'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-text-base transition-colors">
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleCreate} className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">
                프로젝트 이름
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="예: my-api, payment-service"
                autoFocus
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-ui-hover-soft border border-ui-border text-text-base placeholder-slate-400 dark:placeholder-text-dim-dark focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
              <p className="text-xs text-text-dim">
                에이전트 Docker 이미지에 설정할 이름입니다
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                취소
              </Button>
              <Button type="submit" disabled={!name.trim() || submitting} className="flex-1">
                {submitting ? '생성 중...' : '생성'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <MaterialIcon name="warning" className="text-amber-500 text-lg shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                이 키는 지금만 표시됩니다. 복사 후 안전한 곳에 보관하세요.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">API 키</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2.5 rounded-xl bg-ui-hover-soft border border-ui-border text-xs font-mono text-text-base break-all">
                  {apiKey}
                </code>
                <button onClick={handleCopy}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    copied
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-ui-hover text-text-secondary hover:bg-ui-active'
                  }`}>
                  <MaterialIcon name={copied ? 'check' : 'content_copy'} className="text-base" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">에이전트 설정</p>
              <pre className="px-3 py-2.5 rounded-xl bg-slate-900 dark:bg-black text-xs font-mono text-slate-100 overflow-x-auto">{`EVERYUP_AGENT_API_KEY=${apiKey}`}</pre>
            </div>
            <Button onClick={onClose} className="w-full">
              완료
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
