import { useState, useRef, useEffect } from 'preact/hooks';
import { login } from './adminApi';

interface LoginFormProps {
  onLogin: () => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus password field on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-dismiss error after 3 seconds
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(t);
  }, [error]);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (submitting || !password) return;

    setSubmitting(true);
    setError(null);

    try {
      await login(password);
      onLogin();
    } catch {
      setError('Invalid password. Check with the cluster operator.');
      setPassword('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="admin-login">
      <form class="card" onSubmit={handleSubmit}>
        <h1 class="admin-heading">Cluster Admin</h1>
        <p class="admin-login-sub">Enter admin password to continue</p>
        {error && <div class="error-banner">{error}</div>}
        <input
          ref={inputRef}
          type="password"
          class="text-input"
          placeholder="Password"
          autocomplete="current-password"
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          disabled={submitting}
        />
        <button type="submit" class="submit-btn" disabled={submitting || !password}>
          {submitting ? 'Authenticating...' : 'Authenticate'}
        </button>
      </form>
    </div>
  );
}
