interface Props {
  label: string;
  name: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onInput: (value: string) => void;
  autoFocus?: boolean;
}

export function TextInput({
  label,
  name,
  required,
  maxLength,
  placeholder,
  value,
  error,
  disabled,
  onInput,
  autoFocus,
}: Props) {
  return (
    <div>
      <label class="field-label" for={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        class={`text-input${error ? " error" : ""}`}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        autoFocus={autoFocus}
        aria-describedby={error ? `${name}-error` : undefined}
        autocomplete="name"
      />
      {error && (
        <p id={`${name}-error`} class="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
