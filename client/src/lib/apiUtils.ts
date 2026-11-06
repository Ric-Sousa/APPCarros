// Single path for every authenticated request to the API.

export function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

/** Session expired/invalid: drop the token and go to login (full reload also clears the query cache). */
export function handleUnauthorized() {
  localStorage.removeItem('token');
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Authenticated fetch. Adds the Bearer token, sends FormData as-is, handles 401 globally
 * and throws ApiError with the server's message on non-2xx.
 */
export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) handleUnauthorized();
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {}
    throw new ApiError(response.status, message);
  }
  return response;
}

async function request<T>(method: string, url: string, data?: unknown): Promise<T> {
  const body = data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data);
  const response = await makeAuthenticatedRequest(url, { method, body });
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const get = <T>(url: string) => request<T>('GET', url);
export const post = <T>(url: string, data?: unknown) => request<T>('POST', url, data);
export const put = <T>(url: string, data?: unknown) => request<T>('PUT', url, data);
export const patch = <T>(url: string, data?: unknown) => request<T>('PATCH', url, data);
export const del = <T>(url: string) => request<T>('DELETE', url);

/** Fetch a protected file (Authorization header only) and open it in a new tab. */
export async function openProtectedUrl(url: string) {
  const response = await makeAuthenticatedRequest(url);
  const blobUrl = URL.createObjectURL(await response.blob());
  window.open(blobUrl, '_blank');
}

export function handleApiError(error: unknown, defaultMessage: string = 'Ocorreu um erro'): string {
  return error instanceof Error ? error.message : defaultMessage;
}
