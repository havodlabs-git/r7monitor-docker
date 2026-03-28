/**
 * Cliente para as APIs do Rapid7 Insight Platform.
 * Implementa cache em memória com TTL de 2 minutos para evitar rate limiting.
 *
 * APIs utilizadas:
 *   InsightConnect: /connect/v1/jobs, /connect/v2/workflows/{id}
 *   InsightIDR v2:  /idr/v2/investigations, /idr/v2/investigations/{id}/comments
 *   Log Search:     /management/logs, /management/logsets
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
      "Content-Type": "application/json",
      "Accept-version": "investigations-preview",
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

function idrBase(region: string) { return `https://${region}.api.insight.rapid7.com`; }
function logBase(region: string) { return `https://${region}.rest.logs.insight.rapid7.com`; }

// ─── InsightConnect — Jobs / Workflows ───────────────────────────────────────

export interface WorkflowJob {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  stepErrors?: Array<{ step: string; message: string }>;
}

export interface WorkflowJobsResponse {
  data: { jobs: WorkflowJob[]; meta?: { total?: number } };
}

export async function getFailedJobs(
  apiKey: string,
  region: string,
  opts: { startedFrom?: number; startedTo?: number; limit?: number; offset?: number } = {}
): Promise<WorkflowJobsResponse> {
  const key = `failed_jobs_${region}_${JSON.stringify(opts)}`;
  const cached = cacheGet<WorkflowJobsResponse>(key);
  if (cached) return cached;

  const result = await r7Fetch<WorkflowJobsResponse>(
    idrBase(region),
    "/connect/v1/jobs",
    apiKey,
    {
      status: "failed",
      limit: opts.limit ?? 100,
      offset: opts.offset ?? 0,
      ...(opts.startedFrom ? { startedFrom: opts.startedFrom } : {}),
      ...(opts.startedTo ? { startedTo: opts.startedTo } : {}),
    }
  );
  cacheSet(key, result);
  return result;
}

export interface WorkflowDetail {
  id: string;
  publishedVersion?: { name: string; description?: string };
  unpublishedVersion?: { name: string; description?: string };
  state?: string;
}

export async function getWorkflow(apiKey: string, region: string, workflowId: string): Promise<{ data: WorkflowDetail }> {
  const key = `workflow_${region}_${workflowId}`;
  const cached = cacheGet<{ data: WorkflowDetail }>(key);
  if (cached) return cached;

  const result = await r7Fetch<{ data: WorkflowDetail }>(
    idrBase(region),
    `/connect/v2/workflows/${workflowId}`,
    apiKey
  );
  cacheSet(key, result, 60_000); // 1 min para detalhes
  return result;
}

// ─── InsightIDR v2 — Investigations ──────────────────────────────────────────

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
  metadata?: { total_data?: number; index?: number; size?: number };
}

export async function getInvestigations(
  apiKey: string,
  region: string,
  opts: { statuses?: string; size?: number; index?: number; start_time?: string; end_time?: string } = {}
): Promise<InvestigationsResponse> {
  const key = `investigations_${region}_${JSON.stringify(opts)}`;
  const cached = cacheGet<InvestigationsResponse>(key);
  if (cached) return cached;

  const result = await r7Fetch<InvestigationsResponse>(
    idrBase(region),
    "/idr/v2/investigations",
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
  cacheSet(key, result);
  return result;
}

export interface InvestigationComment {
  id: string;
  body?: string;
  content?: string;
  text?: string;
  created_time?: string;
  author?: { name: string };
}

export interface CommentsResponse {
  data: InvestigationComment[];
}

export async function getInvestigationComments(
  apiKey: string,
  region: string,
  investigationId: string
): Promise<CommentsResponse> {
  const key = `comments_${region}_${investigationId}`;
  const cached = cacheGet<CommentsResponse>(key);
  if (cached) return cached;

  const result = await r7Fetch<CommentsResponse>(
    idrBase(region),
    `/idr/v2/investigations/${investigationId}/comments`,
    apiKey
  );
  cacheSet(key, result, 60_000);
  return result;
}

// ─── Log Search — Log Sources ─────────────────────────────────────────────────

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
  const key = `logs_${region}`;
  const cached = cacheGet<LogsResponse>(key);
  if (cached) return cached;

  const result = await r7Fetch<LogsResponse>(
    logBase(region),
    "/management/logs",
    apiKey,
    undefined,
    { "x-api-key": apiKey, "X-Api-Key": apiKey }
  );
  cacheSet(key, result);
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
  const key = `logsets_${region}`;
  const cached = cacheGet<LogsetsResponse>(key);
  if (cached) return cached;

  const result = await r7Fetch<LogsetsResponse>(
    logBase(region),
    "/management/logsets",
    apiKey,
    undefined,
    { "x-api-key": apiKey, "X-Api-Key": apiKey }
  );
  cacheSet(key, result);
  return result;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

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
