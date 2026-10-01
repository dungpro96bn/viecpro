import type { ApiError, AuthResponse } from '@viecpro/shared';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const CSRF_HEADER = { 'X-Requested-With': 'viecpro' };

let accessToken: string | null = null;
let tokenVersion = 0;
let refreshRequest: Promise<AuthResponse | null> | null = null;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(error: ApiError, status: number) {
    super(error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = error.code;
    this.fields = error.fields;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  tokenVersion += 1;
}

async function refreshWebSession(): Promise<AuthResponse | null> {
  if (refreshRequest) return refreshRequest;
  const version = tokenVersion;
  refreshRequest = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...CSRF_HEADER },
        body: JSON.stringify({ platform: 'web' }),
      });
      if (!response.ok) {
        if (tokenVersion === version) accessToken = null;
        return null;
      }
      const session = (await response.json()) as AuthResponse;
      if (tokenVersion !== version) return null;
      accessToken = session.accessToken;
      tokenVersion += 1;
      return session;
    } catch {
      if (tokenVersion === version) accessToken = null;
      return null;
    } finally {
      refreshRequest = null;
    }
  })();
  return refreshRequest;
}

export async function restoreWebSession(): Promise<AuthResponse | null> {
  return refreshWebSession();
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const request = async () => {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
  };

  let response = await request();
  // Route /auth/* (đăng nhập sai, OTP sai…) trả 401 là lỗi nghiệp vụ, không phải hết hạn phiên → không tự refresh
  if (response.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await refreshWebSession();
    if (refreshed) response = await request();
  }
  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as ApiError | null;
  if (!response.ok) {
    throw new ApiClientError(
      payload ?? { statusCode: response.status, code: 'INTERNAL_ERROR', message: 'Không thể kết nối hệ thống' },
      response.status,
    );
  }
  return payload as T;
}

export function apiMessage(error: unknown, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string {
  return error instanceof ApiClientError ? error.message : fallback;
}
