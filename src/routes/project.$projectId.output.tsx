import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useProject } from "@/lib/projects-store";
import { Copy, Download, FileWarning } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/project/$projectId/output")({
  component: OutputTab,
});

function OutputTab() {
  const { projectId } = useParams({ from: "/project/$projectId/output" });
  const project = useProject(projectId);

  const code = useMemo(() => {
    if (!project?.npmlContent) return null;
    const params = project.parameters;

    const variables = [
      "VAR",
      ...params.places.map((p, i) => {
        const initial = params.initialMarkings[p.id] ?? 0;
        return `    ${p.label.replace(/\s+/g, "_")} : INT := ${initial}; (* P${i + 1} *)`;
      }),
      ...params.transitions.map((t) => `    ${t.name}_fire : BOOL := FALSE;`),
      "END_VAR",
    ].join("\n");

    const actions = [
      "(* === Auto-generated IEC 61131-3 Structured Text === *)",
      "PROGRAM PetriNet_Main",
      "",
      "(* Transition firing logic *)",
      ...params.transitions.flatMap((t) => {
        const inputNames = t.inputs
          .map((id) => params.places.find((p) => p.id === id)?.label.replace(/\s+/g, "_"))
          .filter(Boolean);
        const outputNames = t.outputs
          .map((id) => params.places.find((p) => p.id === id)?.label.replace(/\s+/g, "_"))
          .filter(Boolean);

        const guard =
          inputNames.length > 0
            ? inputNames.map((n) => `${n} > 0`).join(" AND ")
            : "TRUE";

        return [
          `(* Transition: ${t.name} *)`,
          `${t.name}_fire := ${guard};`,
          `IF ${t.name}_fire THEN`,
          ...inputNames.map((n) => `    ${n} := ${n} - 1;`),
          ...outputNames.map((n) => `    ${n} := ${n} + 1;`),
          `END_IF;`,
          "",
        ];
      }),
      "END_PROGRAM",
    ].join("\n");

    return { variables, actions };
  }, [project]);

  if (!project) return null;

  if (!code) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-full max-w-3xl">
          <div className="border-b border-border pb-4 mb-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Etapa 04 / IEC 61131-3 Output
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Saída — Código IEC</h2>
          </div>
          <div className="rounded-sm bg-card milled-border p-12 text-center">
            <FileWarning className="size-8 mx-auto text-muted-foreground" />
            <h3 className="mt-3 font-semibold">Nenhum código gerado</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Execute a conversão na etapa de Input para gerar o código estruturado.
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

  const fullCode = `${code.variables}\n\n${code.actions}`;

  const copyAll = () => {
    navigator.clipboard.writeText(fullCode);
    toast.success("Código completo copiado");
  };

  const download = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Download: ${filename}`);
  };

  return (
    <div className="p-8 flex justify-center">
      <div className="w-full max-w-5xl space-y-6">
        <div className="border-b border-border pb-4 flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Etapa 04 / IEC 61131-3 Output
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Saída — Código IEC</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Código estruturado dividido em variáveis e ações.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-card font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-surface"
            >
              <Copy className="size-3" />
              Copiar tudo
            </button>
            <button
              onClick={() => download(`${project.name}.st`, fullCode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-primary text-primary-foreground font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90"
            >
              <Download className="size-3" strokeWidth={2.5} />
              Download .st
            </button>
          </div>
        </div>

        <CodeBlock
          title="Área de Variáveis"
          subtitle={`VAR / ${code.variables.split("\n").length} linhas`}
          code={code.variables}
          filename={`${project.name}_vars.st`}
          download={download}
        />
        <CodeBlock
          title="Área de Ações"
          subtitle={`ST / ${code.actions.split("\n").length} linhas`}
          code={code.actions}
          filename={`${project.name}_actions.st`}
          download={download}
        />
      </div>
    </div>
  );
}

function CodeBlock({
  title,
  subtitle,
  code,
  filename,
  download,
}: {
  title: string;
  subtitle: string;
  code: string;
  filename: string;
  download: (filename: string, content: string) => void;
}) {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast.success(`Copiado: ${title}`);
  };
  return (
    <section className="rounded-sm bg-card milled-border overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface/50">
        <div className="flex items-center gap-3">
          <div className="size-1.5 rounded-full bg-gauge" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider">{title}</h3>
          <span className="font-mono text-[10px] text-muted-foreground tracking-tighter uppercase">
            {subtitle}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-border bg-card font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-surface"
          >
            <Copy className="size-3" />
            Copiar
          </button>
          <button
            onClick={() => download(filename, code)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-border bg-card font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-surface"
          >
            <Download className="size-3" />
            Baixar
          </button>
        </div>
      </header>
      <pre className="p-4 max-h-[420px] overflow-auto font-mono text-[12px] leading-relaxed text-foreground bg-background">
        {code}
      </pre>
    </section>
  );
}
