// Constantes standalone (sem dependência do monorepo Manus)
export const COOKIE_NAME = "r7monitor_session";

/**
 * Gera a URL de login com returnTo para redirecionar após autenticação.
 */
export const getLoginUrl = (returnPath?: string) => {
  const path = returnPath ?? "/";
  return `/login?returnTo=${encodeURIComponent(path)}`;
};
