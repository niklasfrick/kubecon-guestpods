import { europeanCountries, otherCountries } from "../data/countries";

interface Props {
  label: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  error?: string;
}

export function CountrySelect({
  label,
  value,
  onChange,
  disabled,
  error,
}: Props) {
  return (
    <div>
      <label class="field-label" for="country">
        {label}
      </label>
      <select
        id="country"
        name="country"
        class="country-select"
        value={value}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
        disabled={disabled}
        aria-describedby={error ? "country-error" : undefined}
      >
        <option value="" disabled>
          Select country...
        </option>
        <optgroup label="Europe">
          {europeanCountries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Other countries">
          {otherCountries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </optgroup>
      </select>
      {error && (
        <p id="country-error" class="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
