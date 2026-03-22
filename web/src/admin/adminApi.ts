export async function login(password: string): Promise<{ status: string }> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || 'Login failed');
  }
  return res.json();
}

export interface AdminStatus {
  authenticated: boolean;
  submissions_open: boolean;
}

export async function checkSession(): Promise<AdminStatus> {
  const res = await fetch('/api/admin/status', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

export async function toggleSubmissions(): Promise<{ submissions_open: boolean }> {
  const res = await fetch('/api/admin/toggle', {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Toggle failed');
  return res.json();
}

export async function deleteSubmission(id: number): Promise<void> {
  const res = await fetch(`/api/admin/submissions/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Delete failed');
}

export async function deleteAllSubmissions(): Promise<{ deleted: number }> {
  const res = await fetch('/api/admin/submissions', {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Delete all failed');
  return res.json();
}

export interface AdminStats {
  total_pods: number;
  namespace_count: number;
  top_locations: Array<{ country_code: string; country_flag: string; count: number }>;
  submissions_open: boolean;
}

export async function getStats(): Promise<AdminStats> {
  const res = await fetch('/api/admin/stats', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Stats failed');
  return res.json();
}
