const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiFetch(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const networkError = new Error('Could not reach the server. Is the API running?');
    networkError.status = 0;
    throw networkError;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || `Request failed with status ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return data;
}
