import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useProject } from "@/lib/projects-store";
import { Copy, Download, FileWarning } from "lucide-react";
import { useMemo, useState } from "react";
import { generateCode, type CodeTarget } from "@/lib/petri";
import { toast } from "sonner";

export const Route = createFileRoute("/project/$projectId/output")({
  component: OutputTab,
});

const TARGETS: Record<
  CodeTarget,
  { label: string; stage: string; ext: string; part1: string; part2: string; description: string }
> = {
  iec: {
    label: "IEC 61131-3 (Texto Estruturado)",
    stage: "IEC 61131-3 Output",
    ext: "st",
    part1: "Declaração (cole na parte superior do PLC_PRG no CODESYS)",
    part2: "Implementação (cole na parte inferior do PLC_PRG)",
    description: "Programa PLC_PRG dividido em declaração de variáveis e implementação.",
  },
  arduino: {
    label: "Arduino (C++)",
    stage: "Arduino Output",
    ext: "ino",
    part1: "Declarações (pinos, lugares e variáveis)",
    part2: "Lógica (setup e loop)",
    description:
      "Sketch .ino: condições lidas de botões/sensores, um LED por lugar BOOL e marcação no Monitor Serial.",
  },
  python: {
    label: "Python",
    stage: "Python Output",
    ext: "py",
    part1: "Classe e marcação inicial",
    part2: "Ciclo de varredura e modo interativo",
    description: "Classe RedePetri com o ciclo de varredura, utilizável como módulo ou no terminal.",
  },
};

function OutputTab() {
  const { projectId } = useParams({ from: "/project/$projectId/output" });
  const project = useProject(projectId);

  const [target, setTarget] = useState<CodeTarget>("iec");
  const info = TARGETS[target];

  const code = useMemo(() => {
    if (!project?.npmlContent) return null;
    return generateCode(project.parameters, target);
  }, [project, target]);

  if (!project) return null;

  if (!code) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-full max-w-3xl">
          <div className="border-b border-border pb-4 mb-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Etapa 04 / Output
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Saída — Código gerado</h2>
          </div>
          <div className="rounded-sm bg-card milled-border p-12 text-center">
            <FileWarning className="size-8 mx-auto text-muted-foreground" />
            <h3 className="mt-3 font-semibold">Nenhum código gerado</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Execute a conversão na etapa de Input para gerar o código.
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

  const fullCode = code.full;
  const baseName = project.name.replace(/[^A-Za-z0-9_-]+/g, "_") || "rede";

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
              Etapa 04 / {info.stage}
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Saída — {info.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{info.description}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <label className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Linguagem
              </span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as CodeTarget)}
                className="h-8 rounded-sm border border-border bg-card px-2 font-mono text-[11px] font-semibold outline-none focus:border-foreground/40"
              >
                <option value="iec">IEC 61131-3 (ST)</option>
                <option value="arduino">Arduino (C++)</option>
                <option value="python">Python</option>
              </select>
            </label>
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-card font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-surface"
            >
              <Copy className="size-3" />
              Copiar tudo
            </button>
            <button
              onClick={() => download(`${baseName}.${info.ext}`, fullCode)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-primary text-primary-foreground font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90"
            >
              <Download className="size-3" strokeWidth={2.5} />
              Download .{info.ext}
            </button>
          </div>
        </div>

        <CodeBlock
          title={info.part1}
          subtitle={`${code.declaration.split("\n").length} linhas`}
          code={code.declaration}
          filename={`${baseName}_parte1.${info.ext}`}
          download={download}
        />
        <CodeBlock
          title={info.part2}
          subtitle={`${code.implementation.split("\n").length} linhas`}
          code={code.implementation}
          filename={`${baseName}_parte2.${info.ext}`}
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
