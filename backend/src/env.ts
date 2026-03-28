import "dotenv/config";

export const ENV = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
  // CORS — origens permitidas (separadas por vírgula)
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:80").split(",").map(s => s.trim()),
  // Manus OAuth (opcional — deixar vazio para desativar)
  oauthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  appId: process.env.APP_ID ?? "",
};
