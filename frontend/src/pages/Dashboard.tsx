import { useState, useCallback } from "react";
import {
  GitBranch, Search, Database, AlertTriangle, CheckCircle,
  Building2, FileDown, RefreshCw, Activity,
} from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { MetricCard } from "@/components/r7/MetricCard";
import { PageHeader, PageShell, ErrorState } from "@/components/r7/PageHeader";
import { PriorityBadge } from "@/components/r7/StatusBadge";
import { TimeRangeSelector, TimeRangeMinutes, timeRangeLabel } from "@/components/r7/TimeRangeSelector";
import { useCustomer } from "@/contexts/CustomerContext";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from "recharts";
import { MEO_LOGO_B64 } from "@/lib/meoLogoB64";

// ─── Cores ────────────────────────────────────────────────────────────────────

const C = {
  healthy:     "#22c55e",
  noEps:       "#ef4444",
  stale:       "#f59e0b",
  statusError: "#f97316",
  bar:         "#dc2626",
  grid:        "rgba(255,255,255,0.06)",
  axis:        "rgba(255,255,255,0.35)",
  tooltipBg:   "#0f172a",
  tooltipBorder: "#1e293b",
};

const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNSPECIFIED"];
const ISSUE_LABELS: Record<string, string> = {
  NO_EPS: "Sem EPS",
  STALE: "Inativo",
  INACTIVE: "Inativo (7d)",
};

// ─── PDF Export ───────────────────────────────────────────────────────────────

type RGB = [number, number, number];

async function exportPDF(
  customerName: string,
  rangeLabel: string,
  wf: {
    failedInRange: number;
    failed7d: number;
    topWorkflows: { name: string; count: number; lastFailed?: string }[];
    failedJobs: { workflowName: string; status: string; startedAt: string }[];
  },
  inv: {
    total: number;
    withoutInc: number;
    byPriority: { priority: string; total: number; withInc: number; withoutInc: number }[];
    withoutIncList: { title: string; priority: string; status: string; createdTime: string; source: string }[];
  },
  ls: {
    total: number;
    healthy: number;
    noEps: number;
    stale: number;
    inactive: number;
    issueRate: number;
    issues: { name: string; sourceType: string; issueType: string; issueReason: string }[];
  },
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 14, CW = W - M * 2;

  // ── Paleta ──────────────────────────────────────────────────────────────────
  const DARK:   RGB = [10,  14,  23];
  const DARK2:  RGB = [20,  30,  48];
  const RED:    RGB = [220, 38,  38];
  const RED2:   RGB = [254, 226, 226];
  const GREEN:  RGB = [34,  197, 94];
  const GREEN2: RGB = [220, 252, 231];
  const AMBER:  RGB = [245, 158, 11];
  const AMBER2: RGB = [254, 243, 199];
  const ORANGE: RGB = [249, 115, 22];
  const SLATE:  RGB = [100, 116, 139];
  const SLATE2: RGB = [241, 245, 249];
  const WHITE:  RGB = [255, 255, 255];
  const BLUE:   RGB = [59,  130, 246];
  const MUTED:  RGB = [148, 163, 184];

  const sf = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const sd = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const sc = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  let y = 0;

  // ── Utilitários ──────────────────────────────────────────────────────────────

  const checkPage = (needed = 20) => {
    if (y + needed > H - 14) {
      doc.addPage();
      drawHeader();
      y = 32;
    }
  };

  const sectionTitle = (title: string, icon?: string) => {
    checkPage(14);
    sf(DARK2); sd(DARK2);
    doc.roundedRect(M, y, CW, 9, 1.5, 1.5, "FD");
    sf(RED);
    doc.roundedRect(M, y, 3, 9, 1, 1, "F");
    sc(WHITE);
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text((icon ? icon + " " : "") + title.toUpperCase(), M + 7, y + 6);
    y += 13;
  };

  const metricCard = (
    x: number, cy: number, w: number, h: number,
    label: string, value: string | number, sub: string,
    accent: RGB, bg: RGB
  ) => {
    sf(bg); sd(bg); doc.roundedRect(x, cy, w, h, 2, 2, "FD");
    sf(accent); doc.roundedRect(x, cy, 3.5, h, 1, 1, "F");
    sc(accent);
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text(String(value), x + 7, cy + 12);
    sc(DARK);
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    const lines = doc.splitTextToSize(label.toUpperCase(), w - 10);
    doc.text(lines[0], x + 7, cy + 19);
    sc(SLATE);
    doc.setFontSize(6); doc.setFont("helvetica", "normal");
    doc.text(sub, x + 7, cy + 25);
  };

  const horizBar = (
    x: number, cy: number, w: number, h: number,
    label: string, value: number, maxVal: number, color: RGB
  ) => {
    const pct = maxVal > 0 ? value / maxVal : 0;
    const barW = pct * (w - 52);
    sf(SLATE2); sd(SLATE2);
    doc.roundedRect(x + 34, cy, w - 52, h, h / 2, h / 2, "FD");
    if (barW > 0) {
      sf(color);
      doc.roundedRect(x + 34, cy, barW, h, h / 2, h / 2, "F");
    }
    sc(DARK);
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    const lbl = label.length > 25 ? label.slice(0, 23) + "…" : label;
    doc.text(lbl, x, cy + h - 1.5);
    doc.setFont("helvetica", "bold");
    doc.text(String(value), x + w, cy + h - 1.5, { align: "right" });
  };

  const tableHeader = (cols: { label: string; x: number; align?: "left" | "right" | "center" }[]) => {
    sf(DARK); sd(DARK);
    doc.roundedRect(M, y, CW, 8, 1, 1, "FD");
    sc(MUTED);
    doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
    cols.forEach(col => {
      doc.text(col.label, col.x, y + 5.5, { align: col.align ?? "left" });
    });
    y += 9;
  };

  const tableRow = (
    cols: { text: string; x: number; color?: RGB; align?: "left" | "right" | "center" }[],
    rowIdx: number,
    rowH = 8
  ) => {
    checkPage(rowH + 2);
    if (rowIdx % 2 === 0) {
      sf([248, 250, 252] as RGB); sd([248, 250, 252] as RGB);
      doc.roundedRect(M, y, CW, rowH, 1, 1, "FD");
    }
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
    cols.forEach(col => {
      sc(col.color ?? DARK);
      doc.text(col.text, col.x, y + rowH / 2 + 1.5, { align: col.align ?? "left" });
    });
    y += rowH + 1;
  };

  // ── Cabeçalho de página ──────────────────────────────────────────────────────

  const drawHeader = () => {
    // Fundo escuro
    sf(DARK); doc.rect(0, 0, W, 26, "F");
    // Linha vermelha
    sf(RED); doc.rect(0, 26, W, 1.5, "F");
    // Logo MEO Empresas
    try {
      doc.addImage(MEO_LOGO_B64, "PNG", M, 3, 32, 0);
    } catch (_) {
      sc(WHITE);
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text("MEO Empresas", M, 12);
    }
    // Título e subtítulo
    sc(WHITE);
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("R7 Monitor", M + 36, 11);
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    sc(MUTED);
    doc.text("Rapid7 InsightIDR — Relatório de Monitorização", M + 36, 18);
    // Customer e data (direita)
    const dt = new Date().toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
    sc(WHITE);
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text(customerName, W - M, 11, { align: "right" });
    sc(MUTED);
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(dt, W - M, 18, { align: "right" });
  };

  const drawFooter = (page: number, total: number) => {
    sf(DARK); doc.rect(0, H - 10, W, 10, "F");
    sc(SLATE);
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
    doc.text("MEO Empresas — CWO  |  R7 Monitor  |  Documento Confidencial", M, H - 3.5);
    doc.text(`Página ${page} de ${total}`, W - M, H - 3.5, { align: "right" });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — Sumário Executivo
  // ═══════════════════════════════════════════════════════════════════════════

  drawHeader();
  y = 32;

  // Banda de período
  sf(DARK2); sd(DARK2);
  doc.roundedRect(M, y, CW, 10, 2, 2, "FD");
  sc(MUTED);
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text(
    `Período de análise: ${rangeLabel}  ·  Gerado em: ${new Date().toLocaleString("pt-PT")}`,
    M + 4, y + 7
  );
  y += 15;

  // ── Métricas principais ──────────────────────────────────────────────────────
  sectionTitle("Sumário Executivo");
  const cw4 = (CW - 9) / 4;
  const issueCount = ls.noEps + ls.stale + ls.inactive;

  metricCard(M,              y, cw4, 32, `Workflows Falhados (${rangeLabel})`,
    wf.failedInRange, `${wf.failed7d} nos últimos 7 dias`,
    wf.failedInRange > 0 ? RED : GREEN, wf.failedInRange > 0 ? RED2 : GREEN2);

  metricCard(M + cw4 + 3,   y, cw4, 32, "Investigations Sem INC",
    inv.withoutInc, `${inv.total} investigations abertas`,
    inv.withoutInc > 0 ? AMBER : GREEN, inv.withoutInc > 0 ? AMBER2 : GREEN2);

  metricCard(M + (cw4+3)*2, y, cw4, 32, "Log Sources c/ Problema",
    issueCount, `${ls.total} log sources no total`,
    issueCount > 0 ? RED : GREEN, issueCount > 0 ? RED2 : GREEN2);

  metricCard(M + (cw4+3)*3, y, cw4, 32, "Taxa de Problemas",
    `${ls.issueRate}%`, "Log sources com algum problema",
    ls.issueRate > 20 ? RED : ls.issueRate > 5 ? AMBER : GREEN,
    ls.issueRate > 20 ? RED2 : ls.issueRate > 5 ? AMBER2 : GREEN2);

  y += 40;

  // ── Distribuição de Log Sources ──────────────────────────────────────────────
  sectionTitle("Log Sources — Distribuição por Estado");
  const lsItems = [
    { label: "Saudáveis",   value: ls.healthy,     color: GREEN },
    { label: "Sem EPS",     value: ls.noEps,        color: RED },
    { label: "Inativos (7d)", value: ls.inactive,   color: AMBER },
  ].filter(d => d.value > 0);
  const lsMax = Math.max(...lsItems.map(d => d.value), 1);
  lsItems.forEach(item => {
    checkPage(10);
    horizBar(M, y, CW, 6, item.label, item.value, item.value === ls.healthy ? lsMax : lsMax, item.color);
    y += 9;
  });
  y += 6;

  // ── Investigations por prioridade ────────────────────────────────────────────
  if (inv.byPriority.length > 0) {
    checkPage(60);
    sectionTitle("Investigations — Cobertura INC por Prioridade");

    const cols = [M + 4, M + 48, M + 76, M + 104, M + 132, M + CW - 4];
    tableHeader([
      { label: "PRIORIDADE", x: cols[0] },
      { label: "TOTAL",      x: cols[1] },
      { label: "COM INC",    x: cols[2] },
      { label: "SEM INC",    x: cols[3] },
      { label: "COBERTURA",  x: cols[4] },
      { label: "%",          x: cols[5], align: "right" },
    ]);

    const priorityColor: Record<string, RGB> = {
      CRITICAL: RED, HIGH: ORANGE, MEDIUM: AMBER, LOW: BLUE, UNSPECIFIED: SLATE,
    };

    PRIORITY_ORDER.forEach((p, idx) => {
      const row = inv.byPriority.find(r => r.priority === p);
      if (!row) return;
      checkPage(10);
      if (idx % 2 === 0) { sf([248, 250, 252] as RGB); sd([248, 250, 252] as RGB); doc.roundedRect(M, y, CW, 8, 1, 1, "FD"); }
      const cov = row.total > 0 ? Math.round((row.withInc / row.total) * 100) : 0;
      const pc = priorityColor[p] ?? SLATE;
      sf(pc); doc.roundedRect(cols[0], y + 1.5, 22, 5, 1, 1, "F");
      sc(WHITE);
      doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
      doc.text(p, cols[0] + 11, y + 5.5, { align: "center" });
      sc(DARK); doc.setFont("helvetica", "normal");
      doc.text(String(row.total),      cols[1], y + 5.5);
      sc(GREEN); doc.text(String(row.withInc),    cols[2], y + 5.5);
      sc(RED);   doc.text(String(row.withoutInc), cols[3], y + 5.5);
      // Barra de cobertura
      sf(SLATE2); sd(SLATE2);
      doc.roundedRect(cols[4], y + 2, 28, 4, 2, 2, "FD");
      const covColor: RGB = cov >= 80 ? GREEN : cov >= 50 ? AMBER : RED;
      sf(covColor);
      doc.roundedRect(cols[4], y + 2, 28 * (cov / 100), 4, 2, 2, "F");
      sc(DARK);
      doc.text(`${cov}%`, cols[5], y + 5.5, { align: "right" });
      y += 9;
    });
    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECÇÃO — Log Sources Falhadas (detalhe individual)
  // ═══════════════════════════════════════════════════════════════════════════

  if (ls.issues.length > 0) {
    checkPage(50);
    sectionTitle(`Log Sources com Problemas (${ls.issues.length})`);

    const colsLS = [M + 4, M + 68, M + 110, M + CW - 4];
    tableHeader([
      { label: "NOME DA LOG SOURCE", x: colsLS[0] },
      { label: "TIPO",               x: colsLS[1] },
      { label: "PROBLEMA",           x: colsLS[2] },
      { label: "DETALHE",            x: colsLS[3], align: "right" },
    ]);

    const issueTypeColor: Record<string, RGB> = {
      NO_EPS: RED,
      STALE: AMBER,
      INACTIVE: AMBER,
    };

    ls.issues.forEach((issue, idx) => {
      checkPage(10);
      if (idx % 2 === 0) { sf([248, 250, 252] as RGB); sd([248, 250, 252] as RGB); doc.roundedRect(M, y, CW, 8, 1, 1, "FD"); }
      const ic = issueTypeColor[issue.issueType] ?? SLATE;
      const name = (issue.name ?? "—").length > 30 ? (issue.name ?? "—").slice(0, 28) + "…" : (issue.name ?? "—");
      const srcType = (issue.sourceType ?? "—").length > 18 ? (issue.sourceType ?? "—").slice(0, 16) + "…" : (issue.sourceType ?? "—");
      const reason = (issue.issueReason ?? "—").length > 28 ? (issue.issueReason ?? "—").slice(0, 26) + "…" : (issue.issueReason ?? "—");
      const issueLabel = ISSUE_LABELS[issue.issueType] ?? issue.issueType;

      doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
      sc(DARK);
      doc.text(name, colsLS[0], y + 5.5);
      sc(SLATE);
      doc.text(srcType, colsLS[1], y + 5.5);
      // Badge de tipo de problema
      sf(ic); sd(ic);
      doc.roundedRect(colsLS[2], y + 1.5, 22, 5, 1, 1, "FD");
      sc(WHITE); doc.setFont("helvetica", "bold");
      doc.text(issueLabel, colsLS[2] + 11, y + 5.5, { align: "center" });
      sc(SLATE); doc.setFont("helvetica", "normal");
      doc.text(reason, colsLS[3], y + 5.5, { align: "right" });
      y += 9;
    });
    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECÇÃO — Investigations sem INC (detalhe individual)
  // ═══════════════════════════════════════════════════════════════════════════

  if (inv.withoutIncList.length > 0) {
    checkPage(50);
    sectionTitle(`Investigations sem INC (${inv.withoutIncList.length})`);

    const colsINV = [M + 4, M + 90, M + 118, M + 148, M + CW - 4];
    tableHeader([
      { label: "TÍTULO",      x: colsINV[0] },
      { label: "PRIORIDADE",  x: colsINV[1] },
      { label: "ESTADO",      x: colsINV[2] },
      { label: "FONTE",       x: colsINV[3] },
      { label: "DATA",        x: colsINV[4], align: "right" },
    ]);

    const invPriorityColor: Record<string, RGB> = {
      CRITICAL: RED, HIGH: ORANGE, MEDIUM: AMBER, LOW: BLUE, UNSPECIFIED: SLATE,
    };

    inv.withoutIncList.slice(0, 80).forEach((item, idx) => {
      checkPage(10);
      if (idx % 2 === 0) { sf([248, 250, 252] as RGB); sd([248, 250, 252] as RGB); doc.roundedRect(M, y, CW, 8, 1, 1, "FD"); }
      const title = (item.title ?? "—").length > 38 ? (item.title ?? "—").slice(0, 36) + "…" : (item.title ?? "—");
      const dt = item.createdTime ? new Date(item.createdTime).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—";
      const source = (item.source ?? "—").length > 14 ? (item.source ?? "—").slice(0, 12) + "…" : (item.source ?? "—");

      doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
      sc(DARK); doc.text(title, colsINV[0], y + 5.5);
      const pc = invPriorityColor[item.priority] ?? SLATE;
      sf(pc); sd(pc);
      doc.roundedRect(colsINV[1], y + 1.5, 22, 5, 1, 1, "FD");
      sc(WHITE); doc.setFont("helvetica", "bold");
      doc.text(item.priority ?? "—", colsINV[1] + 11, y + 5.5, { align: "center" });
      sc(SLATE); doc.setFont("helvetica", "normal");
      doc.text((item.status ?? "—").toUpperCase(), colsINV[2], y + 5.5);
      doc.text(source, colsINV[3], y + 5.5);
      doc.text(dt, colsINV[4], y + 5.5, { align: "right" });
      y += 9;
    });

    if (inv.withoutIncList.length > 80) {
      checkPage(8);
      sc(SLATE);
      doc.setFontSize(6.5); doc.setFont("helvetica", "italic");
      doc.text(`… e mais ${inv.withoutIncList.length - 80} investigations sem INC não mostradas.`, M + 4, y + 4);
      y += 8;
    }
    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECÇÃO — Workflows Falhados (detalhe individual)
  // ═══════════════════════════════════════════════════════════════════════════

  if (wf.failedJobs.length > 0) {
    checkPage(50);
    sectionTitle(`Workflows Falhados — Detalhe (${wf.failedJobs.length} execuções)`);

    const colsWF = [M + 4, M + 100, M + 130, M + CW - 4];
    tableHeader([
      { label: "WORKFLOW",        x: colsWF[0] },
      { label: "ESTADO",          x: colsWF[1] },
      { label: "DATA/HORA",       x: colsWF[2] },
      { label: "DURAÇÃO",         x: colsWF[3], align: "right" },
    ]);

    wf.failedJobs.slice(0, 50).forEach((job, idx) => {
      checkPage(10);
      if (idx % 2 === 0) { sf([248, 250, 252] as RGB); sd([248, 250, 252] as RGB); doc.roundedRect(M, y, CW, 8, 1, 1, "FD"); }
      const name = (job.workflowName ?? "—").length > 42 ? (job.workflowName ?? "—").slice(0, 40) + "…" : (job.workflowName ?? "—");
      const status = (job.status ?? "failed").toUpperCase();
      const dt = job.startedAt ? new Date(job.startedAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—";

      doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
      sc(DARK); doc.text(name, colsWF[0], y + 5.5);
      // Badge de estado
      sf(RED); sd(RED);
      doc.roundedRect(colsWF[1], y + 1.5, 20, 5, 1, 1, "FD");
      sc(WHITE); doc.setFont("helvetica", "bold");
      doc.text(status.slice(0, 8), colsWF[1] + 10, y + 5.5, { align: "center" });
      sc(SLATE); doc.setFont("helvetica", "normal");
      doc.text(dt, colsWF[2], y + 5.5);
      y += 9;
    });

    if (wf.failedJobs.length > 50) {
      checkPage(8);
      sc(SLATE);
      doc.setFontSize(6.5); doc.setFont("helvetica", "italic");
      doc.text(`… e mais ${wf.failedJobs.length - 50} execuções falhadas não mostradas.`, M + 4, y + 4);
      y += 8;
    }
    y += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECÇÃO — Top Workflows por Falhas (resumo)
  // ═══════════════════════════════════════════════════════════════════════════

  if (wf.topWorkflows.length > 0) {
    checkPage(20);
    sectionTitle("Top Workflows por Número de Falhas (7 dias)");
    const wfMax = Math.max(...wf.topWorkflows.map(w => w.count), 1);
    wf.topWorkflows.slice(0, 10).forEach(wfItem => {
      checkPage(10);
      horizBar(M, y, CW, 6, wfItem.name ?? "—", wfItem.count, wfMax, RED);
      y += 9;
    });
    y += 4;
  }

  // ── Rodapés ──────────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(p, total);
  }

  doc.save(`r7monitor-${customerName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Donut chart personalizado ────────────────────────────────────────────────

function RingChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      Sem dados
    </div>
  );
  const pieData = data.map(d => ({ name: d.label, value: d.value, color: d.color }));
  return (
    <div className="flex items-center gap-6 h-full">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%" cy="50%"
            innerRadius={48} outerRadius={72}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
            itemStyle={{ color: "#fff" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2 flex-1">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-white/60 flex-1">{d.label}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: d.color }}>{d.value}</span>
            <span className="text-xs text-white/30 w-10 text-right tabular-nums">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
        <div className="pt-1 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">Total</span>
            <span className="text-xs font-bold text-white/70">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mini bar (CSS, sem Recharts) ─────────────────────────────────────────────

function MiniBar({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-white/50 w-32 flex-shrink-0 truncate" title={d.label}>{d.label}</span>
          <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }} />
          </div>
          <span className="text-xs font-bold text-white/70 w-6 text-right tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [minutesAgo, setMinutesAgo] = useState<TimeRangeMinutes>(1440);
  const [exporting, setExporting] = useState(false);
  const utils = trpc.useUtils();
  const { selectedCustomerId, selectedCustomer, customers, isLoading: customersLoading } = useCustomer();

  const queryInput = selectedCustomerId !== null
    ? { customerId: selectedCustomerId, minutesAgo }
    : skipToken;

  const failedJobsInput = selectedCustomerId !== null
    ? { customerId: selectedCustomerId, minutesAgo, limit: 200 }
    : skipToken;

  const lsIssuesInput = selectedCustomerId !== null
    ? { customerId: selectedCustomerId, minutesAgo }
    : skipToken;

  const wfStats    = trpc.workflows.stats.useQuery(queryInput,       { retry: 0 });
  const wfJobs     = trpc.workflows.failedJobs.useQuery(failedJobsInput, { retry: 0, enabled: false }); // lazy — só no export
  const invStats   = trpc.investigations.stats.useQuery(queryInput,  { retry: 0 });
  const lsStats    = trpc.logSources.stats.useQuery(queryInput,      { retry: 0 });
  const lsIssues   = trpc.logSources.issues.useQuery(lsIssuesInput,  { retry: 0, enabled: false }); // lazy

  const isLoading = wfStats.isLoading || invStats.isLoading || lsStats.isLoading;
  const hasError  = wfStats.isError   || invStats.isError   || lsStats.isError;
  const errorMsg  = (wfStats.error || invStats.error || lsStats.error)?.message ?? "Erro ao carregar dados";

  const handleRefresh = useCallback(() => {
    if (selectedCustomerId === null) return;
    const input = { customerId: selectedCustomerId, minutesAgo };
    utils.workflows.stats.invalidate(input);
    utils.investigations.stats.invalidate(input);
    utils.logSources.stats.invalidate(input);
  }, [utils, selectedCustomerId, minutesAgo]);

  const handleExportPDF = useCallback(async () => {
    if (!wfStats.data || !invStats.data || !lsStats.data) return;
    setExporting(true);
    try {
      // Buscar dados detalhados para o PDF (lazy fetch)
      const [jobsResult, issuesResult, invListResult] = await Promise.all([
        utils.workflows.failedJobs.fetch({ customerId: selectedCustomerId!, minutesAgo, limit: 200 }),
        utils.logSources.issues.fetch({ customerId: selectedCustomerId!, minutesAgo }),
        utils.investigations.withoutInc.fetch({ customerId: selectedCustomerId!, minutesAgo }),
      ]);

      await exportPDF(
        selectedCustomer?.name ?? "—",
        timeRangeLabel(minutesAgo),
        {
          failedInRange: wfStats.data.failedInRange ?? 0,
          failed7d:      wfStats.data.failed7d ?? 0,
          topWorkflows:  (wfStats.data.topWorkflows ?? []) as { name: string; count: number }[],
          failedJobs:    (jobsResult?.jobs ?? []) as { workflowName: string; status: string; startedAt: string }[],
        },
        {
          total:       invStats.data.total ?? 0,
          withoutInc:  invStats.data.withoutInc ?? 0,
          byPriority:  (invStats.data.byPriority ?? []) as { priority: string; total: number; withInc: number; withoutInc: number }[],
          withoutIncList: (invListResult?.investigations ?? []).map((inv: any) => ({
            title: inv.title ?? "—",
            priority: inv.priority ?? "UNSPECIFIED",
            status: inv.status ?? "—",
            createdTime: inv.created_time ?? inv.createdTime ?? "",
            source: inv.source ?? "—",
          })),
        },
        {
          total:       lsStats.data.total ?? 0,
          healthy:     lsStats.data.healthy ?? 0,
          noEps:       lsStats.data.noEps ?? 0,
          stale:       lsStats.data.stale ?? 0,
          inactive:    lsStats.data.stale ?? (lsStats.data as any).statusError ?? 0,
          issueRate:   lsStats.data.issueRate ?? 0,
          issues:      (issuesResult?.issues ?? []) as { name: string; sourceType: string; issueType: string; issueReason: string }[],
        },
      );
    } finally {
      setExporting(false);
    }
  }, [wfStats.data, invStats.data, lsStats.data, selectedCustomer, minutesAgo, selectedCustomerId, utils]);

  // ── Estados especiais ────────────────────────────────────────────────────────

  if (!customersLoading && customers.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Dashboard" description="Visão geral do Rapid7 InsightIDR" />
        <div className="rounded-xl border border-white/10 bg-card p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-foreground font-medium mb-1">Nenhum customer configurado</p>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione um customer com a sua API Key do Rapid7 para começar a monitorizar.
          </p>
          <Link href="/customers">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
              <Building2 className="w-4 h-4" />Gerir Customers
            </span>
          </Link>
        </div>
      </PageShell>
    );
  }

  if (!customersLoading && selectedCustomerId === null) {
    return (
      <PageShell>
        <PageHeader title="Dashboard" description="Visão geral do Rapid7 InsightIDR" />
        <ErrorState message="Selecione um customer na sidebar para ver os dados." />
      </PageShell>
    );
  }

  if (hasError) {
    return (
      <PageShell>
        <PageHeader title="Dashboard" description="Visão geral do Rapid7 InsightIDR" onRefresh={handleRefresh} refreshing={false} inline />
        <ErrorState message={`Erro ao comunicar com a API Rapid7: ${errorMsg}. Verifique a API Key nas Definições.`} />
      </PageShell>
    );
  }

  // ── Dados ────────────────────────────────────────────────────────────────────

  const rangeLabel = timeRangeLabel(minutesAgo);

  const workflowChartData = (wfStats.data?.topWorkflows ?? []).slice(0, 8).map((wf) => ({
    name: (wf.name ?? "").length > 24 ? (wf.name ?? "").slice(0, 22) + "…" : (wf.name ?? ""),
    falhas: wf.count ?? 0,
  }));

  const lsData = lsStats.data;
  const pieData = lsData ? [
    { label: "Saudáveis", value: lsData.healthy,     color: C.healthy },
    { label: "Sem EPS",   value: lsData.noEps,        color: C.noEps },
    { label: "Inativos (7d)", value: (lsData as any).inactive ?? lsData.stale ?? 0, color: C.stale },
  ].filter(d => d.value > 0) : [];

  const byPriority = (invStats.data?.byPriority ?? []) as Array<{ priority: string; total: number; withInc: number; withoutInc: number }>;
  const priorityRows = PRIORITY_ORDER
    .map(p => byPriority.find(r => r.priority === p))
    .filter(Boolean) as typeof byPriority;

  const hasData = !!(wfStats.data || invStats.data || lsStats.data);
  const issueCount = (lsData?.noEps ?? 0) + (lsData?.stale ?? 0) + ((lsData as any)?.inactive ?? 0);

  return (
    <PageShell>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Dashboard"
          description={selectedCustomer ? `${selectedCustomer.name} — Rapid7 InsightIDR` : "Visão geral do Rapid7 InsightIDR"}
          onRefresh={handleRefresh}
          refreshing={isLoading}
          inline
          noMargin
        />
        <div className="flex items-center gap-3 flex-wrap">
          <TimeRangeSelector value={minutesAgo} onChange={setMinutesAgo} />
          <button
            onClick={handleExportPDF}
            disabled={exporting || !hasData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {exporting ? "A gerar PDF…" : "Exportar PDF"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title={`Workflows Falhados (${rangeLabel})`}
          value={isLoading ? "…" : String(wfStats.data?.failedInRange ?? 0)}
          subtitle={`${wfStats.data?.failed7d ?? 0} nos últimos 7 dias`}
          icon={GitBranch}
          variant={!isLoading && (wfStats.data?.failedInRange ?? 0) > 0 ? "danger" : "success"}
          loading={isLoading}
        />
        <MetricCard
          title="Investigations Sem INC"
          value={isLoading ? "…" : String(invStats.data?.withoutInc ?? 0)}
          subtitle={`${invStats.data?.total ?? 0} investigations abertas`}
          icon={Search}
          variant={!isLoading && (invStats.data?.withoutInc ?? 0) > 0 ? "warning" : "success"}
          loading={isLoading}
        />
        <MetricCard
          title="Log Sources c/ Problema"
          value={isLoading ? "…" : String(issueCount)}
          subtitle={`${lsData?.total ?? 0} log sources no total`}
          icon={Database}
          variant={!isLoading && issueCount > 0 ? "danger" : "success"}
          loading={isLoading}
        />
        <MetricCard
          title="Taxa de Problemas"
          value={isLoading ? "…" : `${lsData?.issueRate ?? 0}%`}
          subtitle="Log sources com algum problema"
          icon={issueCount > 0 ? AlertTriangle : CheckCircle}
          variant={!isLoading && (lsData?.issueRate ?? 0) > 20 ? "danger" : !isLoading && (lsData?.issueRate ?? 0) > 5 ? "warning" : "success"}
          loading={isLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Workflows chart */}
        <div className="rounded-xl border border-white/10 bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Top Workflows com Falhas (7 dias)</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Workflows com mais execuções falhadas</p>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">A carregar…</div>
          ) : workflowChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <div className="text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum workflow falhado</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workflowChartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={C.grid} />
                <XAxis type="number" tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category" dataKey="name" width={130}
                  tick={{ fill: C.axis, fontSize: 10 }} axisLine={false} tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{ background: C.tooltipBg, border: `1px solid ${C.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(v: number) => [`${v} falha${v !== 1 ? "s" : ""}`, "Falhas"]}
                />
                <Bar dataKey="falhas" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {workflowChartData.map((_, i) => (
                    <Cell key={i} fill={`hsl(${0 + i * 4}, ${80 - i * 3}%, ${45 + i * 2}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Log Sources donut */}
        <div className="rounded-xl border border-white/10 bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-foreground">Distribuição de Log Sources</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Estado actual de todos os log sources</p>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">A carregar…</div>
          ) : (
            <div className="h-48">
              <RingChart data={pieData.length > 0 ? pieData : [{ label: "Saudáveis", value: lsData?.total ?? 0, color: C.healthy }]} />
            </div>
          )}
        </div>
      </div>

      {/* Investigations table */}
      {!isLoading && priorityRows.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-foreground">Investigations por Prioridade</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs text-muted-foreground font-medium pb-2">Prioridade</th>
                  <th className="text-right text-xs text-muted-foreground font-medium pb-2">Total</th>
                  <th className="text-right text-xs text-muted-foreground font-medium pb-2">Com INC</th>
                  <th className="text-right text-xs text-muted-foreground font-medium pb-2">Sem INC</th>
                  <th className="text-right text-xs text-muted-foreground font-medium pb-2">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {priorityRows.map((row) => {
                  const cov = row.total > 0 ? Math.round((row.withInc / row.total) * 100) : 0;
                  return (
                    <tr key={row.priority} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5"><PriorityBadge priority={row.priority} /></td>
                      <td className="py-2.5 text-right tabular-nums text-foreground">{row.total}</td>
                      <td className="py-2.5 text-right tabular-nums text-green-400">{row.withInc}</td>
                      <td className="py-2.5 text-right tabular-nums text-red-400">{row.withoutInc}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${cov}%`,
                                background: cov >= 80 ? C.healthy : cov >= 50 ? C.stale : C.noEps,
                              }}
                            />
                          </div>
                          <span className="tabular-nums text-xs text-muted-foreground w-8 text-right">{cov}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}
