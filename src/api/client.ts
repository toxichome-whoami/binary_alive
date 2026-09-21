export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE = '/api';

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

let csrfPromise: Promise<any> | null = null;

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Double submit CSRF protection: read csrf_token cookie and attach header
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    let csrfToken = getCookie('csrf_token');
    if (!csrfToken) {
      if (!csrfPromise) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        csrfPromise = fetch(`${BASE}/auth/csrf`, { 
          credentials: 'include',
          signal: controller.signal
        }).finally(() => {
          clearTimeout(timeoutId);
          csrfPromise = null;
        }).catch(() => null);
      }
      await csrfPromise;
      csrfToken = getCookie('csrf_token');
    }
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
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
    throw new ApiError(401, msg, data);
  }

  if (!res.ok) {
    const message = (data && data.message) || res.statusText || 'An error occurred';
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}
