import { signal } from '@preact/signals';
import { SubmissionForm } from './components/SubmissionForm';
import { Confirmation } from './components/Confirmation';
import { VizPage } from './viz/VizPage';
import { AdminPage } from './admin/AdminPage';
import type { SubmitResponse } from './api';

type FormState = 'form' | 'submitting' | 'success';

export const formState = signal<FormState>('form');
export const submissionData = signal<SubmitResponse | null>(null);

// Check localStorage for existing submission
const stored = localStorage.getItem('guestbook_submission');
if (stored) {
  try {
    submissionData.value = JSON.parse(stored);
    formState.value = 'success';
  } catch {
    /* ignore corrupt data */
  }
}

export function App() {
  // Path-based routing
  if (window.location.pathname === '/admin') {
    return <AdminPage />;
  }
  if (window.location.pathname === '/viz') {
    return <VizPage />;
  }

  if (formState.value === 'success' && submissionData.value) {
    return <Confirmation data={submissionData.value} />;
  }
  return <SubmissionForm />;
}
