import type { Response } from 'express';

type CookieConfig = {
  secure: boolean;
  accessTtlSeconds: number;
  refreshDays: number;
  rememberMe: boolean;
};

export function setAuthCookies(
  response: Response,
  accessToken: string,
  refreshToken: string,
  config: CookieConfig,
) {
  response.cookie('access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secure,
    path: '/',
    maxAge: config.accessTtlSeconds * 1000,
  });
  response.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secure,
    path: '/auth/refresh',
    ...(config.rememberMe
      ? { maxAge: config.refreshDays * 24 * 60 * 60 * 1000 }
      : {}),
  });
}

export function clearAuthCookies(response: Response, secure: boolean) {
  response.clearCookie('access_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  response.clearCookie('refresh_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/auth/refresh',
  });
}

export function getCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}
