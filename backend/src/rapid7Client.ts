/**
 * Cliente para as APIs do Rapid7 Insight Platform.
 * Implementa cache em memória com TTL de 2 minutos para evitar rate limiting.
 *
 * APIs utilizadas (conforme documentação oficial e script Python de referência):
 *   InsightConnect v1: /connect/v1/jobs           — lista de jobs (requer R7-Organization-Id)
 *   InsightConnect v2: /connect/v2/workflows/{id} — detalhes de workflow (requer R7-Organization-Id)
 *   InsightIDR v1:     /idr/v1/investigations      — lista de investigations
 *   InsightIDR v1:     /idr/v1/comments?target={rrn} — comentários de uma investigation
 *   Log Search:        /management/logs            — log sources
 *   Log Search:        /management/logsets         — logsets
 *
 * Autenticação:
 *   - Header "X-Api-Key": API Key do Insight Platform
 *   - Header "R7-Organization-Id": Organization ID (UUID) — obrigatório para InsightConnect
 */

// ─── Cache em memória ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutos

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function clearCache(): void {
  cache.clear();
}

export function clearCacheForCustomer(customerId: number): void {
  const prefix = `c${customerId}:`;
  const toDelete: string[] = [];
  cache.forEach((_, key) => { if (key.startsWith(prefix)) toDelete.push(key); });
  toDelete.forEach((key) => cache.delete(key));
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function r7Fetch<T>(
  baseUrl: string,
  path: string,
  apiKey: string,
  params?: Record<string, string | number | undefined>,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const url = new URL(`${baseUrl}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-Api-Key": apiKey,
      "Accept": "application/json",
      ...extraHeaders,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Rapid7 API error ${res.status}: ${body}`);
    (err as NodeJS.ErrnoException).code = String(res.status);
    throw err;
  }

  return res.json() as Promise<T>;
}

/** Base URL para as APIs InsightIDR e InsightConnect */
function idrBase(region: string) { return `https://${region}.api.insight.rapid7.com`; }

/** Base URL para as APIs de Log Search (REST) */
function logBase(region: string) { return `https://${region}.rest.logs.insight.rapid7.com`; }

// ─── InsightConnect — Jobs / Workflows ───────────────────────────────────────
// Documentação: https://docs.rapid7.com/insightconnect/api/
// Requer header R7-Organization-Id para identificar o tenant

export interface WorkflowJob {
  /** ID do job (campo jobId na API) */
  jobId?: string;
  /** Nome do job/workflow (campo name na API) — é o nome do workflow */
  name?: string;
  /** Status do job: succeeded | failed | canceled | running */
  status: string;
  /** Timestamp ISO de início */
  startedAt?: string;
  /** Timestamp ISO de fim */
  endedAt?: string;
  /** Duração em segundos */
  duration?: number;
  /** Número de erros nos steps */
  stepErrorCount?: number;
  /** Owner do job */
  owner?: string;
  /** ID da versão do workflow (não é o workflowId directo) */
  workflowVersionId?: string;
  /** Tags do job */
  tags?: string[];
}

export interface JobsApiResponse {
  data: {
    /** Array de objectos { job: WorkflowJob } */
    jobs?: Array<{ job: WorkflowJob }>;
    items?: Array<{ job: WorkflowJob }>;
    meta?: { total?: number; total_pages?: number; limit?: number; offset?: number };
  };
}

/**
 * Lista jobs do InsightConnect num intervalo de tempo.
 * Usa o endpoint /connect/v1/jobs com paginação por offset.
 * Requer R7-Organization-Id quando orgId está disponível.
 */
export async function getJobs(
  apiKey: string,
  region: string,
  orgId: string | null | undefined,
  opts: {
    startedFrom?: number;
    startedTo?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<JobsApiResponse> {
  // Incluir sufixo da apiKey para isolar cache por customer
  const keyId = apiKey.slice(-8);
  const cacheKey = `jobs_${region}_${keyId}_${orgId ?? ""}_${JSON.stringify(opts)}`;
  const cached = cacheGet<JobsApiResponse>(cacheKey);
  if (cached) return cached;

  const extraHeaders: Record<string, string> = {};
  if (orgId) extraHeaders["R7-Organization-Id"] = orgId;

  const result = await r7Fetch<JobsApiResponse>(
    idrBase(region),
    "/connect/v1/jobs",
    apiKey,
    {
      limit: opts.limit ?? 30,
      offset: opts.offset ?? 0,
      ...(opts.startedFrom !== undefined ? { startedFrom: opts.startedFrom } : {}),
      ...(opts.startedTo !== undefined ? { startedTo: opts.startedTo } : {}),
    },
    extraHeaders
  );
  cacheSet(cacheKey, result);
  return result;
}

export interface WorkflowDetail {
  id: string;
  name?: string;
  workflowName?: string;
  publishedVersion?: { name: string; description?: string };
  unpublishedVersion?: { name: string; description?: string };
  state?: string;
}

/**
 * Obtém detalhes de um workflow pelo ID.
 * Requer R7-Organization-Id quando orgId está disponível.
 */
export async function getWorkflow(
  apiKey: string,
  region: string,
  workflowId: string,
  orgId?: string | null
): Promise<{ data: WorkflowDetail }> {
  const keyId = apiKey.slice(-8);
  const cacheKey = `workflow_${region}_${keyId}_${orgId ?? ""}_${workflowId}`;
  const cached = cacheGet<{ data: WorkflowDetail }>(cacheKey);
  if (cached) return cached;

  const extraHeaders: Record<string, string> = {};
  if (orgId) extraHeaders["R7-Organization-Id"] = orgId;

  const result = await r7Fetch<{ data: WorkflowDetail }>(
    idrBase(region),
    `/connect/v2/workflows/${workflowId}`,
    apiKey,
    undefined,
    extraHeaders
  );
  cacheSet(cacheKey, result, 60_000); // 1 min para detalhes de workflow
  return result;
}

// ─── InsightIDR v1 — Investigations ──────────────────────────────────────────
// Documentação: https://docs.rapid7.com/insightidr/insightidr-rest-api/
// Endpoint: GET /idr/v1/investigations
// Paginação: index (0-based), size

export interface Investigation {
  id: string;
  rrn?: string;
  title: string;
  status: string;
  priority: string;
  created_time: string;
  last_accessed?: string;
  assignee?: { name: string; email: string };
  source?: string;
  alerts?: Array<{ type: string; type_description: string }>;
}

export interface InvestigationsResponse {
  data: Investigation[];
  metadata?: { total_data?: number; index?: number; size?: number; total_pages?: number };
}

/**
 * Lista investigations do InsightIDR v1.
 * Suporta paginação por index/size e filtro por statuses.
 */
export async function getInvestigations(
  apiKey: string,
  region: string,
  opts: {
    statuses?: string;
    size?: number;
    index?: number;
    start_time?: string;
    end_time?: string;
  } = {}
): Promise<InvestigationsResponse> {
  // Incluir sufixo da apiKey para isolar cache por customer
  const keyId = apiKey.slice(-8);
  const cacheKey = `investigations_${region}_${keyId}_${JSON.stringify(opts)}`;
  const cached = cacheGet<InvestigationsResponse>(cacheKey);
  if (cached) return cached;

  const result = await r7Fetch<InvestigationsResponse>(
    idrBase(region),
    "/idr/v1/investigations",
    apiKey,
    {
      statuses: opts.statuses ?? "OPEN,INVESTIGATING",
      size: opts.size ?? 100,
      index: opts.index ?? 0,
      sort: "created_time,DESC",
      ...(opts.start_time ? { start_time: opts.start_time } : {}),
      ...(opts.end_time ? { end_time: opts.end_time } : {}),
    }
  );
  cacheSet(cacheKey, result);
  return result;
}

// ─── InsightIDR v1 — Comments ─────────────────────────────────────────────────
// Documentação: https://docs.rapid7.com/insightidr/insightidr-rest-api/
// Endpoint: GET /idr/v1/comments?target={rrn}
// O target é o RRN (Rapid7 Resource Name) da investigation

export interface InvestigationComment {
  id: string;
  body?: string;
  content?: string;
  text?: string;
  comment?: string;
  created_time?: string;
  author?: { name: string };
}

export interface CommentsResponse {
  data: InvestigationComment[];
  metadata?: { total_pages?: number; index?: number; size?: number };
}

/**
 * Lista comentários de uma investigation usando o RRN como target.
 * Endpoint: GET /idr/v1/comments?target={rrn}&index={n}&size={n}
 */
export async function getInvestigationComments(
  apiKey: string,
  region: string,
  rrn: string,
  opts: { index?: number; size?: number } = {}
): Promise<CommentsResponse> {
  const keyId = apiKey.slice(-8);
  const cacheKey = `comments_${region}_${keyId}_${rrn}_${opts.index ?? 0}`;
  const cached = cacheGet<CommentsResponse>(cacheKey);
  if (cached) return cached;

  const result = await r7Fetch<CommentsResponse>(
    idrBase(region),
    "/idr/v1/comments",
    apiKey,
    {
      target: rrn,
      index: opts.index ?? 0,
      size: opts.size ?? 100,
    }
  );
  cacheSet(cacheKey, result, 60_000);
  return result;
}

// ─── Log Search — Log Sources ─────────────────────────────────────────────────
// Documentação: https://docs.rapid7.com/insightidr/insightidr-rest-api/
// Endpoint: GET /management/logs (base URL diferente: rest.logs.insight.rapid7.com)

export interface LogSource {
  id: string;
  name: string;
  token_seed?: string;
  tokens?: Array<{ token: string; name?: string }>;
  structures?: string[];
  user_data?: Record<string, string>;
  source_type?: string;
  retention_period?: string;
  logsets_info?: Array<{ id: string; name: string; rrn?: string }>;
  links?: Array<{ rel: string; href: string }>;
}

export interface LogsResponse {
  logs: LogSource[];
}

export async function getLogs(apiKey: string, region: string): Promise<LogsResponse> {
  // Incluir sufixo da apiKey para isolar cache por customer
  const keyId = apiKey.slice(-8);
  const cacheKey = `logs_${region}_${keyId}`;
  const cached = cacheGet<LogsResponse>(cacheKey);
  if (cached) return cached;

  const result = await r7Fetch<LogsResponse>(
    logBase(region),
    "/management/logs",
    apiKey
  );
  cacheSet(cacheKey, result);
  return result;
}

export interface LogSet {
  id: string;
  name: string;
  description?: string;
  logs_info?: Array<{ id: string; name: string }>;
}

export interface LogsetsResponse {
  logsets: LogSet[];
}

export async function getLogsets(apiKey: string, region: string): Promise<LogsetsResponse> {
  const keyId = apiKey.slice(-8);
  const cacheKey = `logsets_${region}_${keyId}`;
  const cached = cacheGet<LogsetsResponse>(cacheKey);
  if (cached) return cached;

  const result = await r7Fetch<LogsetsResponse>(
    logBase(region),
    "/management/logsets",
    apiKey
  );
  cacheSet(cacheKey, result);
  return result;
}

// ─── InsightIDR v1 — Assets ──────────────────────────────────────────────────
// Endpoint: POST /idr/v1/assets/_search
// Paginação: index (0-based), size
// Pesquisa: search[].field, search[].operator, search[].value

export interface Asset {
  rrn: string;
  name: string;
}

export interface AssetsResponse {
  data: Asset[];
  metadata?: { total_data?: number; index?: number; size?: number; total_pages?: number };
}

/**
 * Pesquisa assets do InsightIDR v1.
 * Usa POST /idr/v1/assets/_search com body JSON.
 */
export async function getAssets(
  apiKey: string,
  region: string,
  opts: {
    size?: number;
    index?: number;
    query?: string;
  } = {}
): Promise<AssetsResponse> {
  const keyId = apiKey.slice(-8);
  const cacheKey = `assets_${region}_${keyId}_${opts.query ?? ""}_${opts.index ?? 0}_${opts.size ?? 100}`;
  const cached = cacheGet<AssetsResponse>(cacheKey);
  if (cached) return cached;

  const body: Record<string, unknown> = {
    size: opts.size ?? 100,
    index: opts.index ?? 0,
  };

  if (opts.query) {
    body.search = [{ field: "name", operator: "CONTAINS", value: opts.query }];
  }

  const url = new URL(`${idrBase(region)}/idr/v1/assets/_search`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    const err = new Error(`Rapid7 API error ${res.status}: ${errBody}`);
    (err as NodeJS.ErrnoException).code = String(res.status);
    throw err;
  }

  const result = (await res.json()) as AssetsResponse;
  cacheSet(cacheKey, result);
  return result;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

/** Extrai lista de items de uma resposta paginada da API Rapid7 */
export function extractList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;

  // Formato: { data: [...] }
  if (Array.isArray(p["data"])) return p["data"] as T[];

  // Formato: { data: { jobs: [...] } }
  if (p["data"] && typeof p["data"] === "object") {
    const d = p["data"] as Record<string, unknown>;
    for (const key of ["jobs", "items", "investigations", "comments", "data"]) {
      if (Array.isArray(d[key])) return d[key] as T[];
    }
  }

  // Formato: { jobs: [...] } ou { investigations: [...] }
  for (const key of ["jobs", "items", "investigations", "comments"]) {
    if (Array.isArray(p[key])) return p[key] as T[];
  }

  return [];
}

/**
 * Extrai jobs da resposta da API InsightConnect.
 * A API devolve { data: { jobs: [{ job: {...} }] } } — cada item é um wrapper { job: WorkflowJob }.
 */
export function extractJobs(payload: unknown): WorkflowJob[] {
  const wrappers = extractList<{ job?: WorkflowJob } | WorkflowJob>(payload);
  return wrappers.map((item) => {
    // Desembrulhar { job: {...} } se necessário
    if (item && typeof item === "object" && "job" in item && (item as { job?: WorkflowJob }).job) {
      return (item as { job: WorkflowJob }).job;
    }
    return item as WorkflowJob;
  });
}

/** Normaliza o nome de um workflow a partir dos dados de detalhe */
export function extractWorkflowName(wf: WorkflowDetail | null | undefined, fallback: string): string {
  if (!wf) return fallback;
  return (
    wf.publishedVersion?.name ??
    wf.unpublishedVersion?.name ??
    wf.name ??
    wf.workflowName ??
    fallback
  );
}

/** Constrói padrões regex para detetar referências INC nos comentários */
export function buildIncPatterns(incPattern: string): RegExp[] {
  const prefix = (incPattern || "INC").toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    new RegExp(`\\b${prefix}\\d{4,}\\b`, "i"),
    new RegExp(`\\b${prefix}[-_]\\d+\\b`, "i"),
    /\bincident\s*#?\s*\d+\b/i,
    /\bSNOW[-_]?\d+\b/i,
    /\bticket\s*#?\s*\d+\b/i,
  ];
}

export function hasIncReference(text: string, incPattern: string): { found: boolean; ref?: string } {
  if (!text) return { found: false };
  const patterns = buildIncPatterns(incPattern);
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return { found: true, ref: m[0] };
  }
  return { found: false };
}
