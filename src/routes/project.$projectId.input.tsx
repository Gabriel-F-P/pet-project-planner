import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useProject, updateProject, updateParameters } from "@/lib/projects-store";
import { parsePnml, netToParameters, type PnmlNet } from "@/lib/petri";
import { Upload, FileCode, X, ArrowRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/project/$projectId/input")({
  component: InputTab,
});

function InputTab() {
  const { projectId } = useParams({ from: "/project/$projectId/input" });
  const project = useProject(projectId);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [converting, setConverting] = useState(false);
  const parsed = useMemo<{ net?: PnmlNet; error?: string }>(() => {
    if (!project?.npmlContent) return {};
    try {
      return { net: parsePnml(project.npmlContent) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [project?.npmlContent]);

  if (!project) return null;

  const handleFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (![".pnml", ".npml", ".xml"].some((ext) => lower.endsWith(ext))) {
      toast.error("Use um arquivo .pnml ou o .xml salvo pelo PIPE");
      return;
    }
    // o PIPE salva em ISO-8859-1; respeita a codificação declarada no XML
    const buffer = await file.arrayBuffer();
    const head = new TextDecoder("ascii").decode(buffer.slice(0, 120));
    const encoding = /encoding=["']ISO-8859-1["']/i.test(head) ? "iso-8859-1" : "utf-8";
    const content = new TextDecoder(encoding).decode(buffer);
    updateProject(projectId, { npmlFileName: file.name, npmlContent: content });
    try {
      const net = parsePnml(content);
      toast.success(`Arquivo lido: ${net.places.length} lugares, ${net.transitions.length} transições`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const clearFile = () => {
    updateProject(projectId, { npmlFileName: undefined, npmlContent: undefined });
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleConvert = () => {
    if (!project.npmlContent) {
      toast.error("Carregue um arquivo .pnml antes de converter");
      return;
    }
    if (!parsed.net) {
      toast.error(parsed.error ?? "Não foi possível ler o arquivo");
      return;
    }
    updateParameters(projectId, netToParameters(parsed.net, project.parameters));
    setConverting(true);
    setTimeout(() => {
      setConverting(false);
      toast.success("Conversão concluída");
      navigate({ to: "/project/$projectId/analysis", params: { projectId } });
    }, 800);
  };

  return (
    <div className="p-8 flex justify-center">
      <div className="w-full max-w-3xl space-y-6">
        <div className="border-b border-border pb-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Etapa 02 / Source Input
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Carregar arquivo .pnml</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Forneça o arquivo de descrição da rede de Petri para iniciar a conversão.
          </p>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={
            "rounded-sm border-2 border-dashed p-12 text-center transition-colors " +
            (dragOver
              ? "border-gauge bg-gauge/5"
              : project.npmlContent
              ? "border-success/40 bg-success/5"
              : "border-border bg-card")
          }
        >
          {project.npmlContent ? (
            <div className="space-y-4">
              <div className="mx-auto size-12 rounded-sm bg-success/10 border border-success/30 flex items-center justify-center">
                <FileCode className="size-6 text-success" />
              </div>
              <div>
                <div className="font-mono text-sm font-semibold">{project.npmlFileName}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                  {(project.npmlContent.length / 1024).toFixed(2)} KB · Carregado
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="px-3 py-1.5 rounded-sm border border-border bg-card font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-surface"
                >
                  Substituir
                </button>
                <button
                  onClick={clearFile}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-sm border border-border bg-card font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                >
                  <X className="size-3" />
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto size-12 rounded-sm bg-surface border border-border flex items-center justify-center">
                <Upload className="size-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">Arraste o arquivo .pnml (ou o .xml do PIPE) aqui</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
                  ou clique para selecionar
                </div>
              </div>
              <button
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-primary text-primary-foreground font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-primary/90"
              >
                <Upload className="size-3.5" strokeWidth={2.5} />
                Selecionar arquivo
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pnml,.npml,.xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {/* Resumo da leitura */}
        {project.npmlContent && (
          <div
            className={
              "rounded-sm border px-4 py-3 font-mono text-[11px] " +
              (parsed.net
                ? "border-success/40 bg-success/5"
                : "border-destructive/40 bg-destructive/5 text-destructive")
            }
          >
            {parsed.net ? (
              <>
                <div className="font-bold uppercase tracking-widest text-[10px]">
                  Leitura do arquivo · formato {parsed.net.format}
                </div>
                <div className="mt-1">
                  {parsed.net.places.length} lugares · {parsed.net.transitions.length} transições ·{" "}
                  {parsed.net.arcs.length} arcos · marcação inicial:{" "}
                  {parsed.net.places
                    .filter((p) => p.marking > 0)
                    .map((p) => `${p.name}=${p.marking}`)
                    .join(", ") || "vazia"}
                </div>
                {parsed.net.warnings.map((w, i) => (
                  <div key={i} className="mt-1 text-warning">
                    ⚠ {w}
                  </div>
                ))}
                <div className="mt-1 text-muted-foreground">
                  Ao converter, os lugares, transições, arcos e a marcação inicial do arquivo substituem os
                  parâmetros; as condições já digitadas são mantidas.
                </div>
              </>
            ) : (
              <>Erro de leitura: {parsed.error}</>
            )}
          </div>
        )}

        {/* Preview */}
        {project.npmlContent && (
          <div className="rounded-sm bg-card milled-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="size-1.5 rounded-full bg-primary" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                  Pré-visualização
                </h3>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground tracking-tighter uppercase">
                {project.npmlContent.split("\n").length} linhas
              </span>
            </div>
            <pre className="p-4 max-h-72 overflow-auto font-mono text-[11px] leading-relaxed text-foreground bg-background">
              {project.npmlContent.slice(0, 4000)}
              {project.npmlContent.length > 4000 && "\n…"}
            </pre>
          </div>
        )}

        {/* Convert action */}
        <div className="pt-4 flex items-center justify-between border-t border-border">
          <div className="flex items-center gap-2">
            <span
              className={
                "size-2 rounded-full " +
                (project.npmlContent ? "bg-success" : "bg-muted-foreground/30")
              }
            />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {project.npmlContent ? "Pronto para converter" : "Aguardando arquivo"}
            </span>
          </div>
          <button
            onClick={handleConvert}
            disabled={!project.npmlContent || converting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-sm bg-gauge text-gauge-foreground font-mono text-[11px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {converting ? (
              <>
                <span className="size-2 rounded-full bg-gauge-foreground animate-pulse" />
                Convertendo...
              </>
            ) : (
              <>
                Converter
                <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
