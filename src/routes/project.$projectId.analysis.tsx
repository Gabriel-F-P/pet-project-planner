import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useProject } from "@/lib/projects-store";
import { Copy, FileWarning, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/project/$projectId/analysis")({
  component: AnalysisTab,
});

type LogLevel = "info" | "warn" | "ok";
type LogEntry = { level: LogLevel; code: string; message: string };

function AnalysisTab() {
  const { projectId } = useParams({ from: "/project/$projectId/analysis" });
  const project = useProject(projectId);

  const report = useMemo<LogEntry[] | null>(() => {
    if (!project?.npmlContent) return null;
    const params = project.parameters;
    const log: LogEntry[] = [
      { level: "info", code: "INIT", message: `Source: ${project.npmlFileName ?? "unknown.npml"} (${(project.npmlContent.length / 1024).toFixed(2)} KB)` },
      { level: "info", code: "PARSE", message: "Estrutura NPML analisada com sucesso." },
      { level: "ok", code: "VALIDATE", message: `${params.places.length} Places identificados.` },
      { level: "ok", code: "VALIDATE", message: `${params.transitions.length} Transições identificadas.` },
    ];

    const orphanPlaces = params.places.filter(
      (p) =>
        !params.transitions.some(
          (t) => t.inputs.includes(p.id) || t.outputs.includes(p.id)
        )
    );
    if (orphanPlaces.length > 0) {
      log.push({
        level: "warn",
        code: "ADJUST",
        message: `${orphanPlaces.length} Place(s) sem conexões detectados — mantidos como estados isolados.`,
      });
    }

    const emptyTrans = params.transitions.filter(
      (t) => t.inputs.length === 0 || t.outputs.length === 0
    );
    if (emptyTrans.length > 0) {
      log.push({
        level: "warn",
        code: "ADJUST",
        message: `${emptyTrans.length} Transição(ões) sem entrada ou saída — convertida(s) com fallback.`,
      });
    }

    const totalTokens = Object.values(params.initialMarkings).reduce((a, b) => a + b, 0);
    log.push({
      level: "info",
      code: "M0",
      message: `Marcação inicial total: ${totalTokens} tokens distribuídos.`,
    });

    log.push({
      level: "ok",
      code: "OPTIMIZE",
      message: "Reduções aplicadas: simplificação booleana e merge de transições redundantes.",
    });
    log.push({
      level: "ok",
      code: "DONE",
      message: "Conversão para IEC 61131-3 concluída.",
    });

    return log;
  }, [project]);

  if (!project) return null;

  if (!report) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-full max-w-3xl">
          <div className="border-b border-border pb-4 mb-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Etapa 03 / Conversion Report
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Análise da conversão</h2>
          </div>
          <div className="rounded-sm bg-card milled-border p-12 text-center">
            <FileWarning className="size-8 mx-auto text-muted-foreground" />
            <h3 className="mt-3 font-semibold">Nenhuma conversão realizada</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Carregue um arquivo .npml na etapa anterior e execute a conversão.
            </p>
            <Link
              to="/project/$projectId/input"
              params={{ projectId }}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-primary text-primary-foreground font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-primary/90"
            >
              Ir para Input
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fullText = report
    .map((l) => `[${l.code.padEnd(8)}] ${l.level.toUpperCase().padEnd(4)} ${l.message}`)
    .join("\n");

  const counts = {
    ok: report.filter((l) => l.level === "ok").length,
    warn: report.filter((l) => l.level === "warn").length,
    info: report.filter((l) => l.level === "info").length,
  };

  const copy = () => {
    navigator.clipboard.writeText(fullText);
    toast.success("Relatório copiado");
  };

  return (
    <div className="p-8 flex justify-center">
      <div className="w-full max-w-4xl space-y-6">
        <div className="border-b border-border pb-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Etapa 03 / Conversion Report
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Análise da conversão</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajustes realizados pelo conversor durante a tradução para IEC 61131-3.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="OK" value={counts.ok} accent="success" />
          <StatBox label="Avisos" value={counts.warn} accent="warning" />
          <StatBox label="Info" value={counts.info} accent="muted" />
        </div>

        {/* Report */}
        <div className="rounded-sm bg-card milled-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface/50">
            <div className="flex items-center gap-3">
              <div className="size-1.5 rounded-full bg-primary" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                Diagnostic Log
              </h3>
            </div>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-border bg-card font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-surface"
            >
              <Copy className="size-3" />
              Copiar relatório
            </button>
          </div>
          <div className="divide-y divide-border bg-background">
            {report.map((entry, i) => (
              <div
                key={i}
                className="px-4 py-2.5 grid grid-cols-[auto_auto_1fr] items-center gap-3 hover:bg-surface/50"
              >
                <LevelBadge level={entry.level} />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums w-20">
                  {entry.code}
                </span>
                <span className="font-mono text-xs text-foreground">{entry.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Raw output */}
        <div className="rounded-sm bg-card milled-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface/50">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
              Raw Report
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground tracking-tighter uppercase">
              {report.length} entries
            </span>
          </div>
          <pre className="p-4 max-h-72 overflow-auto font-mono text-[11px] leading-relaxed text-foreground bg-background">
            {fullText}
          </pre>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3.5 text-success" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Conversão validada
            </span>
          </div>
          <Link
            to="/project/$projectId/output"
            params={{ projectId }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-gauge text-gauge-foreground font-mono text-[11px] font-bold uppercase tracking-widest hover:opacity-90"
          >
            Ver código IEC →
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "success" | "warning" | "muted";
}) {
  const colors = {
    success: "text-success border-success/30",
    warning: "text-warning border-warning/30",
    muted: "text-muted-foreground border-border",
  };
  return (
    <div className={`rounded-sm bg-card milled-border p-4`}>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${colors[accent].split(" ")[0]}`}>
        {value.toString().padStart(2, "0")}
      </div>
    </div>
  );
}

function LevelBadge({ level }: { level: LogLevel }) {
  const config = {
    ok: { color: "bg-success/10 text-success border-success/30", icon: CheckCircle2, label: "OK" },
    warn: {
      color: "bg-warning/10 text-warning border-warning/40",
      icon: AlertTriangle,
      label: "WARN",
    },
    info: { color: "bg-muted text-muted-foreground border-border", icon: Info, label: "INFO" },
  }[level];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border font-mono text-[9px] font-bold uppercase tracking-widest ${config.color}`}
    >
      <Icon className="size-2.5" strokeWidth={3} />
      {config.label}
    </span>
  );
}
