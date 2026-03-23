import { signal } from '@preact/signals';
import { SubmissionForm } from './components/SubmissionForm';
import { VizPage } from './viz/VizPage';
import { AdminPage } from './admin/AdminPage';
type AppView = 'loading' | 'form' | 'viz';
type FormState = 'form' | 'submitting';

export const formState = signal<FormState>('form');

// Determine initial view: already submitted → viz, otherwise check server
const hasSubmitted = localStorage.getItem('guestbook_submission') !== null;
export const appView = signal<AppView>(hasSubmitted ? 'viz' : 'loading');

if (!hasSubmitted) {
  fetch('/api/status')
    .then(r => r.json())
    .then((data: { submissions_open: boolean }) => {
      appView.value = data.submissions_open ? 'form' : 'viz';
    })
    .catch(() => {
      // Default to form on error (server might not support status endpoint yet)
      appView.value = 'form';
    });
}

export function App() {
  if (window.location.pathname === '/admin') {
    return <AdminPage />;
  }
  if (window.location.pathname === '/viz') {
    return <VizPage />;
  }

  // Main attendee view at /
  if (appView.value === 'loading') return null;
  if (appView.value === 'viz') return <VizPage />;
  return <SubmissionForm />;
}
