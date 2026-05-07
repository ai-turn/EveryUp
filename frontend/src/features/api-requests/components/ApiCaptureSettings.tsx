import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslate } from '@tolgee/react';
import { api, ApiCaptureConfig, ApiCaptureMode } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';

export interface ApiCaptureSettingsProps {
  serviceId: string;
}

const MODE_OPTIONS: { value: ApiCaptureMode; labelKey: string; descKey: string; icon: string }[] = [
  { value: 'disabled',    labelKey: '캡처 안함',  descKey: '요청을 캡처하지 않습니다',              icon: 'block' },
  { value: 'errors_only', labelKey: '에러만',     descKey: '5xx 응답만 캡처합니다',                 icon: 'error_outline' },
  { value: 'sampled',     labelKey: '샘플링',     descKey: '에러는 모두, 비에러는 설정 비율만 캡처합니다', icon: 'filter_alt' },
  { value: 'all',         labelKey: '모든 요청',  descKey: '모든 요청을 캡처합니다 (비용 주의)',    icon: 'all_inclusive' },
];

const DEFAULT_CONFIG: ApiCaptureConfig = { mode: 'disabled', sampleRate: 10 };

function configsEqual(a: ApiCaptureConfig, b: ApiCaptureConfig): boolean {
  return a.mode === b.mode && a.sampleRate === b.sampleRate;
}

function ModeGrid({ value, onChange }: { value: ApiCaptureMode; onChange: (v: ApiCaptureMode) => void }) {
  const { t } = useTranslate();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
      {MODE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
              active
                ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                : 'border-slate-200 dark:border-ui-border-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              active ? 'bg-primary/15 text-primary' : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-400 dark:text-text-dim-dark'
            }`}>
              <MaterialIcon name={opt.icon} className="text-base" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${active ? 'text-primary' : 'text-slate-800 dark:text-white'}`}>
                {t(opt.labelKey)}
              </p>
              <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5 leading-snug">
                {t(opt.descKey)}
              </p>
            </div>
            {active && <MaterialIcon name="check_circle" className="text-primary text-lg shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

export function ApiCaptureSettings({ serviceId }: ApiCaptureSettingsProps) {
  const { t } = useTranslate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<ApiCaptureConfig>(DEFAULT_CONFIG);
  const [form, setForm] = useState<ApiCaptureConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getApiCaptureConfig(serviceId)
      .then((cfg) => { if (!cancelled) { setForm(cfg); setOriginal(cfg); } })
      .catch((err) => { if (!cancelled) toast.error(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [serviceId]);

  const isDirty = useMemo(() => !configsEqual(form, original), [form, original]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateApiCaptureConfig(serviceId, form);
      setForm(updated);
      setOriginal(updated);
      toast.success(t('API 캡처 설정이 저장되었습니다'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const modeOpt = MODE_OPTIONS.find((m) => m.value === form.mode);
  const modeLabel = modeOpt ? t(modeOpt.labelKey) : form.mode;
  const summaryParts = [modeLabel];
  if (form.mode === 'sampled') summaryParts.push(t('{rate}% 샘플링', { rate: form.sampleRate }));

  return (
    <div className="space-y-5 pb-24">
      {/* Summary banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isDirty
          ? 'border-amber-300 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20'
          : 'border-slate-200 dark:border-ui-border-dark bg-slate-50/60 dark:bg-ui-hover-dark/30'
      }`}>
        <MaterialIcon
          name={isDirty ? 'edit_note' : 'check_circle'}
          className={`text-lg shrink-0 ${isDirty ? 'text-amber-500' : 'text-emerald-500'}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
              {t('현재 설정')}
            </p>
            {isDirty && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <span className="w-1 h-1 rounded-full bg-amber-500" /> {t('저장 안됨')}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-800 dark:text-white mt-0.5 truncate">
            {summaryParts.join(' · ')}
          </p>
        </div>
      </div>

      {/* Capture card */}
      <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-5 sm:p-6">
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-ui-border-dark/60">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MaterialIcon name="cloud_download" className="text-primary text-lg" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('캡처')}</h3>
            <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
              {t('이 서비스에서 어떤 요청을 캡처할지 선택합니다')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <ModeGrid value={form.mode} onChange={(v) => setForm((f) => ({ ...f, mode: v }))} />

          {form.mode !== 'disabled' && (
            <div className="flex items-baseline gap-3 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/15 border border-red-200/60 dark:border-red-800/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 shrink-0">
                {t('항상 포함')}
              </span>
              <p className="text-xs text-slate-700 dark:text-text-secondary-dark leading-relaxed">
                {t('5xx 에러 응답은 모드와 샘플 비율에 관계없이 항상 캡처됩니다.')}
              </p>
            </div>
          )}

          {form.mode === 'sampled' && (
            <div className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-slate-50/60 dark:bg-ui-hover-dark/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-white">{t('샘플 비율')}</span>
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary">
                  <span className="text-sm font-bold tabular-nums">{form.sampleRate}</span>
                  <span className="text-xs">%</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={form.sampleRate}
                onChange={(e) => setForm((f) => ({ ...f, sampleRate: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-text-dim-dark font-medium">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Info banner: body capture removed */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-sky-200 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-900/15">
        <MaterialIcon name="info" className="text-sky-500 text-lg shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-sky-800 dark:text-sky-300">{t('요청 본문은 수집하지 않습니다')}</p>
          <p className="text-xs text-sky-700 dark:text-sky-400 mt-0.5 leading-relaxed">
            {t('메타데이터(경로, 상태코드, 레이턴시)만 수집됩니다. 요청/응답 본문이 필요하면 서비스 로그에 request_id를 남겨두세요.')}
          </p>
        </div>
      </div>

      {/* Sticky save bar */}
      {isDirty && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-white/95 dark:bg-bg-surface-dark/95 backdrop-blur shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-sm font-medium text-slate-700 dark:text-text-secondary-dark truncate">
              {t('저장하지 않은 변경사항이 있습니다')}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setForm(original)}
              disabled={saving}
              className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark font-medium transition-colors disabled:opacity-50"
            >
              {t('되돌리기')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <MaterialIcon name="save" className="text-base" />
              )}
              {t('변경사항 저장')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
