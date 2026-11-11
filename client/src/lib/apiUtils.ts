// Único caminho para pedidos à API.
// Sessão: o token de acesso (curto, 15 min) vive só em memória; o refresh token é um cookie httpOnly
// que o servidor gere em /login, /api/register, /api/auth/2fa e /api/auth/refresh.

let accessToken: string | null = null;

export const getAccessToken = () => accessToken;
/** Compatibilidade com código antigo. */
export const getAuthToken = getAccessToken;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Páginas acessíveis sem sessão: um 401 aqui não redireciona para o login. */
const PUBLIC_PATHS = ['/', '/login', '/register', '/recuperar', '/repor-palavra-passe', '/verificar-email', '/privacidade', '/termos', '/ajuda', '/planos'];
const isPublicPath = (path: string) => PUBLIC_PATHS.includes(path);

let refreshing: Promise<boolean> | null = null;

/** Renova o token de acesso com o cookie de sessão. Pedidos em simultâneo partilham a mesma renovação. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!response.ok) {
        accessToken = null;
        return false;
      }
      const data = await response.json();
      accessToken = data.token ?? null;
      return !!accessToken;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Sessão terminada: volta ao login (o recarregamento completo também limpa a cache). */
export function handleUnauthorized() {
  accessToken = null;
  const path = window.location.pathname;
  if (!isPublicPath(path)) {
    window.location.assign(`/login?next=${encodeURIComponent(path + window.location.search)}`);
  }
}

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: ValidationIssue[],
    /** ex.: 'PLAN_LIMIT' */
    public code?: string,
    /** funcionalidade bloqueada pelo plano (ex.: 'vehicles', 'pushNotifications') */
    public feature?: string,
  ) {
    super(message);
  }
}

/** O pedido falhou porque o plano atual não inclui a funcionalidade (402). */
export const isPlanLimit = (error: unknown): error is ApiError => error instanceof ApiError && error.status === 402;

/** Evento global para a app mostrar "Ver planos" (ouvido em App.tsx). */
export const PLAN_LIMIT_EVENT = 'plan-limit';

const usesSessionCookie = (url: string) => url === '/login' || url.startsWith('/api/auth/') || url === '/api/register';

/**
 * Pedido autenticado: junta o token, envia FormData tal como está, renova a sessão num 401
 * (uma vez) e lança ApiError com a mensagem do servidor nos outros erros.
 */
export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, credentials: usesSessionCookie(url) ? 'include' : options.credentials });
  } catch {
    throw new ApiError(0, 'Sem ligação ao servidor. Verifique a sua ligação à internet.');
  }

  // 401 em /login e /api/auth/* são credenciais erradas, não sessão expirada
  if (response.status === 401 && !usesSessionCookie(url)) {
    if (retry && (await refreshSession())) return makeAuthenticatedRequest(url, options, false);
    handleUnauthorized();
  }

  if (!response.ok) {
    let message = response.status === 429 ? 'Demasiadas tentativas. Tente novamente mais tarde.' : `Erro ${response.status}`;
    let errors: ValidationIssue[] | undefined;
    let code: string | undefined;
    let feature: string | undefined;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
      if (Array.isArray(body?.errors)) errors = body.errors;
      code = body?.code;
      feature = body?.feature;
    } catch { /* corpo sem JSON (ex.: texto do rate limit) */ }
    const error = new ApiError(response.status, message, errors, code, feature);
    if (response.status === 402) window.dispatchEvent(new CustomEvent(PLAN_LIMIT_EVENT, { detail: error }));
    throw error;
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

/** Descarrega um ficheiro autenticado (ex.: exportação de dados, .ics) com o nome indicado pelo servidor. */
export async function downloadProtected(url: string, fallbackName: string) {
  const response = await makeAuthenticatedRequest(url);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? fallbackName;
  const blobUrl = URL.createObjectURL(await response.blob());
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

/**
 * Abre um ficheiro protegido (só com o header Authorization) num separador novo.
 * O separador abre antes do await para o Safari/iOS não o bloquear como pop-up.
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
