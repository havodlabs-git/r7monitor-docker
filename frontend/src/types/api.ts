/**
 * Tipos partilhados entre frontend e backend.
 * O AppRouter é importado do backend via inferência de tipos em desenvolvimento.
 * Em produção, o frontend comunica com o backend via HTTP/tRPC.
 *
 * Para usar os tipos do backend no frontend:
 *   1. Em desenvolvimento: o Vite resolve o import relativo ao backend/
 *   2. Em produção Docker: os tipos são apenas usados em build-time
 */

// Re-exportar o tipo AppRouter do backend para uso no frontend
// O caminho relativo funciona porque em build o TypeScript resolve os tipos
export type { AppRouter } from "../../../backend/src/routers";
