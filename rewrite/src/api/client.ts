export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE = '/api';

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Double submit CSRF protection: read csrf_token cookie and attach header
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  // Optional API bearer token if stored in localStorage
  const apiToken = localStorage.getItem('api_token');
  if (apiToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${apiToken}`);
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = res.headers.get('Content-Type') || '';
  const isJson = contentType.includes('application/json');

  let data: any = null;
  if (isJson) {
    data = await res.json().catch(() => ({}));
  } else {
    data = await res.text();
  }

  if (res.status === 401) {
    const msg = (data && data.message) || 'Unauthorized';
    throw new ApiError(401, msg);
  }

  if (!res.ok) {
    const message = (data && data.message) || res.statusText || 'An error occurred';
    throw new ApiError(res.status, message);
  }

  return data as T;
}
