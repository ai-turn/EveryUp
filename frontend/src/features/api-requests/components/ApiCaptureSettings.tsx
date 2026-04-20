import { useState, useEffect, KeyboardEvent, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslate } from '@tolgee/react';
import { api, ApiCaptureConfig, ApiCaptureMode } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';

export interface ApiCaptureSettingsProps {
  serviceId: string;
}

const MODE_OPTIONS: { value: ApiCaptureMode; labelKey: string; descKey: string; icon: string }[] = [
  { value: 'disabled',    labelKey: '캡처 안함',    descKey: '요청을 캡처하지 않습니다',              icon: 'block' },
  { value: 'errors_only', labelKey: '에러만',       descKey: '5xx 응답만 캡처합니다',                 icon: 'error_outline' },
  { value: 'sampled',     labelKey: '샘플링',       descKey: '요청의 일부 비율만 캡처합니다',         icon: 'filter_alt' },
  { value: 'all',         labelKey: '모든 요청',    descKey: '모든 요청을 캡처합니다 (비용 주의)',    icon: 'all_inclusive' },
];

const BODY_SIZE_PRESETS = [
  { value: 2048,  label: '2 KiB' },
  { value: 8192,  label: '8 KiB' },
  { value: 32768, label: '32 KiB' },
  { value: 65536, label: '64 KiB' },
];

const HEADER_PRESETS   = ['Authorization', 'Cookie', 'Set-Cookie', 'X-Api-Key', 'X-Auth-Token'];
const BODY_FIELD_PRESETS = ['password', 'token', 'secret', 'accessToken', 'refreshToken', 'apiKey'];

const DEFAULT_CONFIG: ApiCaptureConfig = {
  mode: 'disabled',
  sampleRate: 10,
  bodyMaxBytes: 8192,
  maskedHeaders: [],
  maskedBodyFields: [],
};

function formatKiB(bytes: number): string {
  if (bytes === 0) return '0 B';
  const kib = bytes / 1024;
  return kib >= 1 ? `${kib % 1 === 0 ? kib : kib.toFixed(1)} KiB` : `${bytes} B`;
}

function configsEqual(a: ApiCaptureConfig, b: ApiCaptureConfig): boolean {
  if (a.mode !== b.mode) return false;
  if (a.sampleRate !== b.sampleRate) return false;
  if (a.bodyMaxBytes !== b.bodyMaxBytes) return false;
  if (a.maskedHeaders.length !== b.maskedHeaders.length) return false;
  if (a.maskedBodyFields.length !== b.maskedBodyFields.length) return false;
  for (let i = 0; i < a.maskedHeaders.length; i++)    if (a.maskedHeaders[i]    !== b.maskedHeaders[i])    return false;
  for (let i = 0; i < a.maskedBodyFields.length; i++) if (a.maskedBodyFields[i] !== b.maskedBodyFields[i]) return false;
  return true;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-5 sm:p-6">
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-ui-border-dark/60">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <MaterialIcon name={icon} className="text-primary text-lg" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-ui-border-dark/60">{children}</div>
    </section>
  );
}

function FieldRow({
  title,
  hint,
  children,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,14rem)_1fr] gap-3 lg:gap-8 py-5 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-slate-800 dark:text-white">{title}</span>
        {hint && <p className="text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ModeGrid({
  value,
  onChange,
}: {
  value: ApiCaptureMode;
  onChange: (v: ApiCaptureMode) => void;
}) {
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
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                active ? 'bg-primary/15 text-primary' : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-400 dark:text-text-dim-dark'
              }`}
            >
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

function SampleRateControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslate();
  return (
    <div className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-slate-50/60 dark:bg-ui-hover-dark/30 p-4 space-y-3">
      <div className="flex items-center justify-end gap-4">
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary">
          <span className="text-sm font-bold tabular-nums">{value}</span>
          <span className="text-xs">%</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-text-dim-dark font-medium">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
      <p className="text-xs text-slate-500 dark:text-text-muted-dark">
        {t('샘플링 비율 설명 {rate}', { rate: value })}
      </p>
    </div>
  );
}

function BodySizeControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useTranslate();
  const isPreset = BODY_SIZE_PRESETS.some((p) => p.value === value);
  const [custom, setCustom] = useState(!isPreset);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {BODY_SIZE_PRESETS.map((p) => {
          const active = !custom && value === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => { setCustom(false); onChange(p.value); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-muted-dark border-transparent hover:bg-slate-200 dark:hover:bg-ui-active-dark'
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
            custom
              ? 'bg-primary text-white border-primary'
              : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-muted-dark border-transparent hover:bg-slate-200 dark:hover:bg-ui-active-dark'
          }`}
        >
          {t('직접 입력')}
        </button>
      </div>

      {custom && (
        <div className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-slate-50/60 dark:bg-ui-hover-dark/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-slate-800 dark:text-white">{t('사용자 지정 크기')}</span>
            <span className="text-sm font-bold text-primary tabular-nums">{formatKiB(value)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={65536}
            step={1024}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-slate-400 dark:text-text-dim-dark font-medium">
            <span>0</span>
            <span>16 KiB</span>
            <span>32 KiB</span>
            <span>48 KiB</span>
            <span>64 KiB</span>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-text-muted-dark">
        {t('본문 크기 제한 설명 {size}', { size: formatKiB(value) })}
      </p>
    </div>
  );
}

function MaskTagField({
  placeholder,
  presets,
  values,
  onAdd,
  onRemove,
}: {
  placeholder: string;
  presets: string[];
  values: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
}) {
  const { t } = useTranslate();
  const [input, setInput] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onAdd(input);
      setInput('');
    }
  };

  const unusedPresets = presets.filter((p) => !values.includes(p));

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-700/30 bg-amber-50 dark:bg-amber-900/20 text-xs font-medium text-amber-700 dark:text-amber-300"
            >
              <MaterialIcon name="visibility_off" className="text-xs" />
              {v}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="ml-0.5 text-amber-500/70 hover:text-red-500 transition-colors"
                aria-label={t('{name} 제거', { name: v })}
              >
                <MaterialIcon name="close" className="text-xs" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-ui-border-dark
            bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white placeholder:text-slate-400
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        <button
          type="button"
          onClick={() => { onAdd(input); setInput(''); }}
          disabled={!input.trim()}
          className="px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('추가')}
        </button>
      </div>

      {unusedPresets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-medium text-slate-400 dark:text-text-dim-dark mr-0.5">{t('자주 쓰는 값')}:</span>
          {unusedPresets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onAdd(p)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-slate-300 dark:border-ui-border-dark text-[11px] text-slate-500 dark:text-text-muted-dark hover:border-primary hover:text-primary transition-colors"
            >
              <MaterialIcon name="add" className="text-xs" />
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

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

  const handleReset = () => setForm(original);

  const addTag = (field: 'maskedHeaders' | 'maskedBodyFields', raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setForm((f) => f[field].includes(v) ? f : { ...f, [field]: [...f[field], v] });
  };
  const removeTag = (field: 'maskedHeaders' | 'maskedBodyFields', i: number) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((_, idx) => idx !== i) }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Summary pieces
  const modeOpt = MODE_OPTIONS.find((m) => m.value === form.mode);
  const modeLabel = modeOpt ? t(modeOpt.labelKey) : form.mode;
  const summaryParts: string[] = [modeLabel];
  if (form.mode === 'sampled') summaryParts.push(t('{rate}% 샘플링', { rate: form.sampleRate }));
  summaryParts.push(t('본문 {size} 제한', { size: formatKiB(form.bodyMaxBytes) }));
  const maskCount = form.maskedHeaders.length + form.maskedBodyFields.length;
  if (maskCount > 0) summaryParts.push(t('{count}개 마스킹', { count: maskCount }));

  return (
    <div className="space-y-5 pb-24">
      {/* Summary banner */}
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
          isDirty
            ? 'border-amber-300 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20'
            : 'border-slate-200 dark:border-ui-border-dark bg-slate-50/60 dark:bg-ui-hover-dark/30'
        }`}
      >
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
      <SectionCard
        icon="cloud_download"
        title={t('캡처')}
        subtitle={t('이 서비스에서 어떤 요청을 캡처할지 선택합니다')}
      >
        <FieldRow
          title={t('캡처 모드')}
          hint={t('캡처 안함 모드가 아닌 경우 에러는 항상 캡처됩니다')}
        >
          <ModeGrid value={form.mode} onChange={(v) => setForm((f) => ({ ...f, mode: v }))} />
        </FieldRow>

        {form.mode === 'sampled' && (
          <FieldRow
            title={t('샘플 비율')}
            hint={t('캡처할 비에러 요청의 비율입니다')}
          >
            <SampleRateControl
              value={form.sampleRate}
              onChange={(v) => setForm((f) => ({ ...f, sampleRate: v }))}
            />
          </FieldRow>
        )}
      </SectionCard>

      {/* Privacy & storage card */}
      <SectionCard
        icon="shield"
        title={t('개인정보 및 저장')}
        subtitle={t('본문 크기를 제한하고 민감한 값을 마스킹해서 저장합니다')}
      >
        <FieldRow
          title={t('최대 본문 크기')}
          hint={t('요청과 응답 본문 모두에 적용됩니다. 초과분은 잘립니다')}
        >
          <BodySizeControl
            value={form.bodyMaxBytes}
            onChange={(v) => setForm((f) => ({ ...f, bodyMaxBytes: v }))}
          />
        </FieldRow>

        <FieldRow
          title={
            <span className="inline-flex items-center gap-1.5">
              <MaterialIcon name="visibility_off" className="text-sm text-slate-400 dark:text-text-dim-dark" />
              {t('마스킹할 헤더')}
            </span>
          }
          hint={
            <>
              {t('이 이름과 일치하는 헤더 값은 다음으로 대체됩니다')}{' '}
              <code className="bg-slate-100 dark:bg-ui-hover-dark px-1 rounded text-xs">***</code>.
            </>
          }
        >
          <MaskTagField
            placeholder={t('헤더 이름을 입력하고 Enter')}
            presets={HEADER_PRESETS}
            values={form.maskedHeaders}
            onAdd={(v) => addTag('maskedHeaders', v)}
            onRemove={(i) => removeTag('maskedHeaders', i)}
          />
        </FieldRow>

        <FieldRow
          title={
            <span className="inline-flex items-center gap-1.5">
              <MaterialIcon name="data_object" className="text-sm text-slate-400 dark:text-text-dim-dark" />
              {t('마스킹할 본문 필드')}
            </span>
          }
          hint={
            <>
              {t('이 이름과 일치하는 JSON 필드는 다음으로 대체됩니다')}{' '}
              <code className="bg-slate-100 dark:bg-ui-hover-dark px-1 rounded text-xs">***</code>.
            </>
          }
        >
          <MaskTagField
            placeholder={t('필드 이름을 입력하고 Enter')}
            presets={BODY_FIELD_PRESETS}
            values={form.maskedBodyFields}
            onAdd={(v) => addTag('maskedBodyFields', v)}
            onRemove={(i) => removeTag('maskedBodyFields', i)}
          />
        </FieldRow>
      </SectionCard>

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
              onClick={handleReset}
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
