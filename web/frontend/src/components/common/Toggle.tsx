interface ToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	title?: string;
	ariaLabel?: string;
}

export function Toggle({ checked, onChange, disabled = false, title, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
		aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      title={title}
      className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
        checked ? 'bg-primary' : 'bg-ui-active'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
