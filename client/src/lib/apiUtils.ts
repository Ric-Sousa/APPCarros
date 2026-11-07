// Single path for every authenticated request to the API.

export function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

/** Session expired/invalid: drop the token and go to login (full reload also clears the query cache). */
export function handleUnauthorized() {
  localStorage.removeItem('token');
  if (!['/login', '/register', '/'].includes(window.location.pathname)) {
    window.location.assign('/login');
  }
}

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors?: ValidationIssue[]) {
    super(message);
  }
}

/**
 * Authenticated fetch. Adds the Bearer token, sends FormData as-is, handles 401 globally
 * and throws ApiError with the server's message (and validation issues) on non-2xx.
 */
export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError(0, 'Sem ligação ao servidor. Verifique a sua ligação à internet.');
  }

  // 401 em /login significa só credenciais erradas, não sessão expirada
  if (response.status === 401 && url !== '/login') handleUnauthorized();
  if (!response.ok) {
    let message = response.status === 429 ? 'Demasiadas tentativas. Tente novamente mais tarde.' : `Erro ${response.status}`;
    let errors: ValidationIssue[] | undefined;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
      if (Array.isArray(body?.errors)) errors = body.errors;
    } catch {}
    throw new ApiError(response.status, message, errors);
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
export const del = <T>(url: string, data?: unknown) => request<T>('DELETE', url, data);

/**
 * Fetch a protected file (Authorization header only) and open it in a new tab.
 * The tab is opened synchronously (before the await) so Safari/iOS doesn't block it as a pop-up.
 */
export async function openProtectedUrl(url: string) {
  const tab = window.open('', '_blank');
  try {
    const response = await makeAuthenticatedRequest(url);
    const blobUrl = URL.createObjectURL(await response.blob());
    if (tab) tab.location.href = blobUrl;
    else window.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** Mensagem para mostrar ao utilizador; em erros de validação inclui o primeiro campo inválido. */
export function handleApiError(error: unknown, defaultMessage: string = 'Ocorreu um erro'): string {
  if (error instanceof ApiError && error.errors?.length) {
    const issue = error.errors[0];
    const field = issue.path?.length ? `${issue.path.join('.')}: ` : '';
    return `${error.message} (${field}${issue.message})`;
  }
  return error instanceof Error ? error.message : defaultMessage;
}
