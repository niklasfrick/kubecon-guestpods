import { useState } from 'preact/hooks';
import { toggleSubmissions } from './adminApi';

interface ToggleButtonProps {
  isOpen: boolean;
  onToggle: (newState: boolean) => void;
}

export function ToggleButton({ isOpen, onToggle }: ToggleButtonProps) {
  const [disabled, setDisabled] = useState(false);

  async function handleClick() {
    if (disabled) return;

    // Optimistic UI: flip immediately
    const previousState = isOpen;
    onToggle(!isOpen);
    setDisabled(true);

    try {
      const result = await toggleSubmissions();
      onToggle(result.submissions_open);
    } catch {
      // Revert on error
      onToggle(previousState);
    } finally {
      // Re-enable after 500ms debounce
      setTimeout(() => setDisabled(false), 500);
    }
  }

  return (
    <button
      class={`admin-toggle ${isOpen ? 'open' : 'closed'}`}
      aria-pressed={!isOpen}
      disabled={disabled}
      onClick={handleClick}
    >
      {isOpen ? 'Close Submissions' : 'Reopen Submissions'}
    </button>
  );
}
