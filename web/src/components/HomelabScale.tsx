const levels = [
  { level: 1, emoji: "\u{1F4AD}", label: "What's a homelab?" },
  { level: 2, emoji: "\u{1F353}", label: "A Pi and a dream" },
  { level: 3, emoji: "\u{1F5A5}\uFE0F", label: "The spare laptop era" },
  {
    level: 4,
    emoji: "\u{1F5C4}\uFE0F",
    label: "My partner asks about the electricity bill",
  },
  {
    level: 5,
    emoji: "\u{1F680}",
    label: "I have an on-call rotation for my house",
  },
];

interface Props {
  value: number | null;
  onChange: (level: number) => void;
  disabled?: boolean;
}

export function HomelabScale({ value, onChange, disabled }: Props) {
  const selected = levels.find((l) => l.level === value);

  return (
    <div class="homelab-scale">
      <label class="field-label">Homelab level</label>
      <div class="scale-track">
        {levels.map((l) => (
          <button
            key={l.level}
            type="button"
            class={`scale-option${value === l.level ? " selected" : ""}`}
            onClick={() => onChange(l.level)}
            disabled={disabled}
            aria-label={l.label}
          >
            {l.emoji}
          </button>
        ))}
      </div>
      <p class={`scale-description${selected ? " visible" : ""}`}>
        {selected ? selected.label : "\u00A0"}
      </p>
    </div>
  );
}
