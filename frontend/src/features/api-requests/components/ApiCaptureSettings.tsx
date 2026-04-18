import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { toast } from 'react-hot-toast';
import { api, ApiCaptureConfig, ApiCaptureMode } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';

export interface ApiCaptureSettingsProps {
  serviceId: string;
}

const MODE_OPTIONS: { value: ApiCaptureMode; label: string; desc: string }[] = [
  { value: 'disabled',    label: 'Disabled',     desc: "Don't capture any requests" },
  { value: 'errors_only', label: 'Errors Only',  desc: 'Capture only error responses (5xx)' },
  { value: 'sampled',     label: 'Sampled',      desc: 'Capture a sample of all requests' },
  { value: 'all',         label: 'All Requests', desc: 'Capture every request' },
];

function formatKiB(bytes: number): string {
  if (bytes === 0) return '0 B';
  const kib = bytes / 1024;
  return kib >= 1 ? `${kib % 1 === 0 ? kib : kib.toFixed(1)} KiB` : `${bytes} B`;
}

export function ApiCaptureSettings({ serviceId }: ApiCaptureSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ApiCaptureConfig>({
    mode: 'disabled',
    sampleRate: 10,
    bodyMaxBytes: 8192,
    maskedHeaders: [],
    maskedBodyFields: [],
  });

  const [headerInput, setHeaderInput] = useState('');
  const [bodyFieldInput, setBodyFieldInput] = useState('');
  const headerInputRef = useRef<HTMLInputElement>(null);
  const bodyFieldInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getApiCaptureConfig(serviceId)
      .then((cfg) => { if (!cancelled) setForm(cfg); })
      .catch((err) => { if (!cancelled) toast.error(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [serviceId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateApiCaptureConfig(serviceId, form);
      setForm(updated);
      toast.success('API capture settings saved.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const addTag = (
    field: 'maskedHeaders' | 'maskedBodyFields',
    value: string,
    clear: () => void
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!form[field].includes(trimmed)) {
      setForm((f) => ({ ...f, [field]: [...f[field], trimmed] }));
    }
    clear();
  };

  const removeTag = (field: 'maskedHeaders' | 'maskedBodyFields', index: number) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== index) }));
  };

  const handleTagKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    field: 'maskedHeaders' | 'maskedBodyFields',
    value: string,
    clear: () => void
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(field, value, clear);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
          API Capture Settings
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">
          Control how incoming API requests to this service are captured and stored.
        </p>
      </div>

      {/* Capture mode */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-text-base-dark">Capture Mode</p>
        {MODE_OPTIONS.map(({ value, label, desc }) => (
          <label
            key={value}
            className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
              border-slate-200 dark:border-ui-border-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark
              has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="radio"
              name={`captureMode-${serviceId}`}
              value={value}
              checked={form.mode === value}
              onChange={() => setForm((f) => ({ ...f, mode: value }))}
              className="accent-primary"
            />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{label}</p>
              <p className="text-xs text-slate-500 dark:text-text-muted-dark">{desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Sample rate */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700 dark:text-text-base-dark">
          Sample Rate (%)
        </label>
        <input
          type="number"
          min={0}
          max={100}
          value={form.sampleRate}
          disabled={form.mode !== 'sampled'}
          onChange={(e) => setForm((f) => ({ ...f, sampleRate: Math.min(100, Math.max(0, Number(e.target.value))) }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-ui-border-dark
            bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white
            disabled:opacity-40 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        <p className="text-xs text-slate-500 dark:text-text-muted-dark">
          {form.mode === 'sampled'
            ? `${form.sampleRate}% of requests will be captured.`
            : 'Only applies when mode is "Sampled".'}
        </p>
      </div>

      {/* Body max bytes */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700 dark:text-text-base-dark">
          Max Body Size
        </label>
        <input
          type="number"
          min={0}
          max={65536}
          step={1024}
          value={form.bodyMaxBytes}
          onChange={(e) => setForm((f) => ({ ...f, bodyMaxBytes: Math.min(65536, Math.max(0, Number(e.target.value))) }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-ui-border-dark
            bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        <p className="text-xs text-slate-500 dark:text-text-muted-dark">
          {formatKiB(form.bodyMaxBytes)} — request and response bodies larger than this will be truncated.
        </p>
      </div>

      {/* Masked headers */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-slate-700 dark:text-text-base-dark">Masked Headers</p>
        <p className="text-xs text-slate-500 dark:text-text-muted-dark">
          Header values will be replaced with <code className="bg-slate-100 dark:bg-ui-hover-dark px-1 rounded text-xs">***</code> in captured requests.
        </p>
        {form.maskedHeaders.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {form.maskedHeaders.map((h, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-ui-hover-dark
                  text-xs font-medium text-slate-700 dark:text-text-base-dark"
              >
                {h}
                <button
                  type="button"
                  onClick={() => removeTag('maskedHeaders', i)}
                  className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${h}`}
                >
                  <MaterialIcon name="close" className="text-xs" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={headerInputRef}
            type="text"
            value={headerInput}
            onChange={(e) => setHeaderInput(e.target.value)}
            onKeyDown={(e) => handleTagKeyDown(e, 'maskedHeaders', headerInput, () => setHeaderInput(''))}
            placeholder="Add header name…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-ui-border-dark
              bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          <button
            type="button"
            onClick={() => addTag('maskedHeaders', headerInput, () => setHeaderInput(''))}
            className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-ui-hover-dark
              text-slate-600 dark:text-text-muted-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark
              transition-colors font-medium"
          >
            Add
          </button>
        </div>
      </div>

      {/* Masked body fields */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-slate-700 dark:text-text-base-dark">Masked Body Fields</p>
        <p className="text-xs text-slate-500 dark:text-text-muted-dark">
          JSON field values matching these names will be replaced with <code className="bg-slate-100 dark:bg-ui-hover-dark px-1 rounded text-xs">***</code>.
        </p>
        {form.maskedBodyFields.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {form.maskedBodyFields.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-ui-hover-dark
                  text-xs font-medium text-slate-700 dark:text-text-base-dark"
              >
                {f}
                <button
                  type="button"
                  onClick={() => removeTag('maskedBodyFields', i)}
                  className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${f}`}
                >
                  <MaterialIcon name="close" className="text-xs" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={bodyFieldInputRef}
            type="text"
            value={bodyFieldInput}
            onChange={(e) => setBodyFieldInput(e.target.value)}
            onKeyDown={(e) => handleTagKeyDown(e, 'maskedBodyFields', bodyFieldInput, () => setBodyFieldInput(''))}
            placeholder="Add JSON field name…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-ui-border-dark
              bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          <button
            type="button"
            onClick={() => addTag('maskedBodyFields', bodyFieldInput, () => setBodyFieldInput(''))}
            className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-ui-hover-dark
              text-slate-600 dark:text-text-muted-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark
              transition-colors font-medium"
          >
            Add
          </button>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-all active:scale-95"
      >
        {saving ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <MaterialIcon name="save" className="text-base" />
        )}
        Save
      </button>
    </div>
  );
}
