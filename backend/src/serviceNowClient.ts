/**
 * Cliente para a API ServiceNow Table API.
 * Cria incidentes regulares via POST /api/now/table/incident.
 *
 * Credenciais: SERVICENOW_INSTANCE_URL, SERVICENOW_USERNAME, SERVICENOW_PASSWORD
 * (configuradas como env vars / secrets).
 *
 * Mapeamento de prioridade Rapid7 → ServiceNow (baseado no workflow ICON):
 *   CRITICAL → impact: 1, urgency: 1
 *   HIGH     → impact: 1, urgency: 1
 *   MEDIUM   → impact: 2, urgency: 2
 *   LOW      → impact: 3, urgency: 3
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateIncidentInput {
  /** Título da investigation (short_description) */
  title: string;
  /** Prioridade R7 (CRITICAL, HIGH, MEDIUM, LOW) */
  priority: string;
  /** Hora de criação da investigation (ISO string) */
  createdTime: string;
  /** RRN da investigation */
  rrn: string;
  /** URL base do InsightIDR para link directo */
  idrBaseUrl?: string;
  /** sys_id do caller no ServiceNow (parametrizável por customer) */
  callerId?: string;
  /** Grupo de atribuição (default: SOC_N1) */
  assignmentGroup?: string;
}

export interface CreateIncidentResult {
  success: boolean;
  /** Número do incidente (ex: INC0012345) */
  number?: string;
  /** sys_id do incidente criado */
  sysId?: string;
  /** URL do incidente no ServiceNow */
  incidentUrl?: string;
  /** Mensagem de erro se falhar */
  error?: string;
}

// ─── Priority Mapping ───────────────────────────────────────────────────────

const PRIORITY_MAP: Record<string, { impact: string; urgency: string }> = {
  CRITICAL: { impact: "1", urgency: "1" },
  HIGH:     { impact: "1", urgency: "1" },
  MEDIUM:   { impact: "2", urgency: "2" },
  LOW:      { impact: "3", urgency: "3" },
};

function mapPriority(r7Priority: string): { impact: string; urgency: string } {
  return PRIORITY_MAP[r7Priority?.toUpperCase()] ?? PRIORITY_MAP.MEDIUM;
}

// ─── Description Builder ────────────────────────────────────────────────────

function buildDescription(input: CreateIncidentInput): string {
  const link = input.idrBaseUrl
    ? `${input.idrBaseUrl}${input.rrn}`
    : input.rrn;

  return [
    `🚨 Nova Investigação Aberta 🚨`,
    ``,
    `📌 Título: ${input.title}`,
    `📊 Prioridade: ${input.priority}`,
    `🔗 Hora da Criação: ${input.createdTime}`,
    `🔍 Investigation: ${link}`,
  ].join("\n");
}

// ─── ServiceNow API ─────────────────────────────────────────────────────────

function getConfig() {
  const instanceUrl = process.env.SERVICENOW_INSTANCE_URL;
  const username = process.env.SERVICENOW_USERNAME;
  const password = process.env.SERVICENOW_PASSWORD;

  if (!instanceUrl || !username || !password) {
    throw new Error("ServiceNow credentials not configured. Set SERVICENOW_INSTANCE_URL, SERVICENOW_USERNAME, SERVICENOW_PASSWORD.");
  }

  return { instanceUrl: instanceUrl.replace(/\/+$/, ""), username, password };
}

/**
 * Cria um incidente regular no ServiceNow via Table API.
 * POST /api/now/table/incident
 */
export async function createIncident(input: CreateIncidentInput): Promise<CreateIncidentResult> {
  const config = getConfig();
  const { impact, urgency } = mapPriority(input.priority);

  const body: Record<string, string> = {
    short_description: input.title,
    description: buildDescription(input),
    impact,
    urgency,
    contact_type: "web_services",
    assignment_group: input.assignmentGroup || "SOC_N1",
    u_extern_provider_ref: input.rrn,
  };

  if (input.callerId) {
    body.caller_id = input.callerId;
  }

  const url = `${config.instanceUrl}/api/now/table/incident`;
  const auth = Buffer.from(`${config.username}:${config.password}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(`[ServiceNow] Error ${res.status}: ${errorBody}`);
      return {
        success: false,
        error: `ServiceNow API error ${res.status}: ${errorBody.slice(0, 200)}`,
      };
    }

    const data = await res.json() as { result?: { number?: string; sys_id?: string } };
    const result = data.result;

    if (!result?.number) {
      return { success: false, error: "Resposta inesperada do ServiceNow (sem número de incidente)" };
    }

    return {
      success: true,
      number: result.number,
      sysId: result.sys_id,
      incidentUrl: `${config.instanceUrl}/incident.do?sys_id=${result.sys_id}`,
    };
  } catch (err) {
    const msg = (err as Error).message ?? "Erro desconhecido";
    console.error("[ServiceNow] Request failed:", msg);
    return { success: false, error: `Erro de conexão: ${msg}` };
  }
}

/**
 * Testa a conexão com o ServiceNow fazendo um GET simples.
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const config = getConfig();
    const auth = Buffer.from(`${config.username}:${config.password}`).toString("base64");

    const res = await fetch(`${config.instanceUrl}/api/now/table/incident?sysparm_limit=1`, {
      headers: {
        "Accept": "application/json",
        "Authorization": `Basic ${auth}`,
      },
    });

    if (res.ok) {
      return { success: true, message: "Conexão ServiceNow OK" };
    }
    return { success: false, message: `ServiceNow retornou ${res.status}` };
  } catch (err) {
    return { success: false, message: `Erro de conexão: ${(err as Error).message}` };
  }
}
