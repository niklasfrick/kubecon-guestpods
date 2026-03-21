export interface SubmitRequest {
  name: string;
  country_code: string;
  homelab_level: number;
}

export interface SubmitResponse {
  id: number;
  name: string;
  country_code: string;
  country_flag: string;
  homelab_level: number;
  homelab_emoji: string;
  created_at: string;
}

export interface ErrorResponse {
  error: string;
  field?: string;
}

export async function submitEntry(
  data: SubmitRequest,
): Promise<SubmitResponse> {
  const res = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (res.status === 403) {
    // Submissions closed -- redirect to visualization
    window.location.href = "/viz";
    throw new Error("Submissions closed");
  }

  const body = await res.json();

  if (!res.ok) {
    const err = body as ErrorResponse;
    throw new SubmissionError(err.error, err.field, res.status);
  }

  return body as SubmitResponse;
}

/** Fetch all existing submissions for initial visualization load. */
export async function fetchSubmissions(): Promise<SubmitResponse[]> {
  const res = await fetch('/api/submissions');
  if (!res.ok) {
    throw new Error(`Failed to load submissions: ${res.status}`);
  }
  return res.json();
}

export class SubmissionError extends Error {
  field?: string;
  status: number;
  constructor(message: string, field?: string, status: number = 400) {
    super(message);
    this.field = field;
    this.status = status;
  }
}
