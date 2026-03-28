// Constantes standalone (sem dependência do monorepo Manus)
export const COOKIE_NAME = "r7monitor_session";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const UNAUTHED_ERR_MSG = "Not authenticated";

/**
 * Gera a URL de login.
 * Em modo standalone (Docker), redireciona para /login.
 */
export const getLoginUrl = (returnPath?: string) => {
  const path = returnPath ?? "/";
  return `/login?returnTo=${encodeURIComponent(path)}`;
};
