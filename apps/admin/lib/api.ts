import type { ApiError } from '@viecpro/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
/** Trang web công khai (viecpro.vn) – mở tin bị báo cáo trong tab mới */
export const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3100').replace(/\/$/, '');

/** Header chống CSRF – API bắt buộc khi xác thực bằng cookie (RULE-BE.md mục 9.3) */
const CSRF = { 'X-Requested-With': 'viecpro' };

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    super(body.message);
  }
  get code() {
    return this.body.code;
  }
}

/**
 * Access token chỉ giữ trong bộ nhớ (không localStorage / sessionStorage).
 * Tải lại trang → lấy token mới từ cookie httpOnly qua /auth/admin/refresh.
 */
let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
let refreshing: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** AuthProvider đăng ký hàm làm mới token để client tự gọi khi gặp 401 */
export function onTokenRefresh(handler: (() => Promise<string | null>) | null) {
  refreshHandler = handler;
}

async function parse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function send(path: string, init: RequestInit, token: string | null) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...CSRF,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

/** Gọi API admin; access token hết hạn thì tự refresh 1 lần rồi gửi lại */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init, accessToken);
  if (res.status === 401 && refreshHandler) {
    refreshing ??= refreshHandler().finally(() => {
      refreshing = null;
    });
    const token = await refreshing;
    if (token) res = await send(path, init, token);
  }
  const data = await parse(res);
  if (!res.ok) {
    const body = (data && typeof data === 'object' ? data : { statusCode: res.status, code: 'INTERNAL_ERROR', message: 'Có lỗi xảy ra' }) as ApiError;
    throw new ApiRequestError(res.status, body);
  }
  return data as T;
}

export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

/** Tải file (CSV) có kèm token */
export async function download(path: string) {
  let res = await send(path, {}, accessToken);
  if (res.status === 401 && refreshHandler) {
    const token = await refreshHandler();
    if (token) res = await send(path, {}, token);
  }
  if (!res.ok) throw new ApiRequestError(res.status, (await parse(res)) as ApiError);
  const name = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ?? 'bao-cao.csv';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Gọi API không cần token (đăng nhập, refresh) */
export async function publicPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await send(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }, null);
  const data = await parse(res);
  if (!res.ok) throw new ApiRequestError(res.status, data as ApiError);
  return data as T;
}
