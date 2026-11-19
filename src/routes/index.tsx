import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useProjects, createProject, deleteProject } from "@/lib/projects-store";
import { Plus, FolderOpen, Trash2, Cpu } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Projetos — Petri-IEC" },
      {
        name: "description",
        content: "Gerencie seus projetos de conversão Petri → IEC 61131-3.",
      },
    ],
  }),
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const projects = useProjects();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Informe um nome para o projeto");
      return;
    }
    const proj = createProject(trimmed, description.trim() || undefined);
    toast.success(`Projeto criado: ${proj.name}`);
    setName("");
    setDescription("");
    setCreating(false);
    navigate({ to: "/project/$projectId", params: { projectId: proj.id } });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-sm bg-primary flex items-center justify-center">
            <Cpu className="size-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[13px] font-semibold tracking-tighter uppercase">
              Petri-IEC.v1
            </span>
            <span className="font-mono text-[9px] text-muted-foreground tracking-widest uppercase mt-0.5">
              Conversor / IEC 61131-3
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Sistema operacional
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between border-b border-border pb-5 mb-8">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Diretório / Projetos
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Projetos ativos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesse um projeto existente ou inicie uma nova conversão.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {projects.length.toString().padStart(2, "0")} unidades
            </div>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-primary text-primary-foreground font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
              Nova Assembly
            </button>
          </div>
        </div>

        {creating && (
          <form
            onSubmit={handleCreate}
            className="mb-8 rounded-sm bg-card milled-border p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider">
                Nova assembly / configuração
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                CFG-NEW
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Identificador *
                </span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="CONV_UNIT_42A"
                  className="w-full font-mono text-sm px-3 py-2 bg-background border border-input rounded-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Descrição
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Lógica de controle elevador"
                  className="w-full text-sm px-3 py-2 bg-background border border-input rounded-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="px-4 py-2 rounded-sm border border-border bg-card font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-sm bg-primary text-primary-foreground font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-primary/90"
              >
                Criar projeto
              </button>
            </div>
          </form>
        )}

        {projects.length === 0 && !creating ? (
          <div className="rounded-sm bg-card milled-border p-16 text-center">
            <div className="mx-auto size-12 rounded-sm bg-surface border border-border flex items-center justify-center">
              <FolderOpen className="size-5 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-semibold">Nenhum projeto registrado</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Comece criando uma nova assembly para configurar parâmetros e converter arquivos
              .pnml.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-primary text-primary-foreground font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-primary/90"
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
              Iniciar primeira assembly
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-sm bg-card milled-border p-4 hover:bg-surface transition-colors"
              >
                <Link
                  to="/project/$projectId"
                  params={{ projectId: p.id }}
                  className="absolute inset-0 z-0"
                  aria-label={`Abrir ${p.name}`}
                />
                <div className="relative z-10 pointer-events-none">
                  <div className="flex items-start justify-between">
                    <div className="size-1.5 rounded-full bg-gauge mt-1.5" />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm(`Excluir "${p.name}"?`)) {
                          deleteProject(p.id);
                          toast.success("Projeto excluído");
                        }
                      }}
                      className="pointer-events-auto opacity-0 group-hover:opacity-100 p-1 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      aria-label="Excluir projeto"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <h3 className="mt-3 font-mono text-sm font-semibold uppercase tracking-tight truncate">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2">
                    <Stat label="Places" value={p.parameters.places.length} />
                    <Stat label="Trans." value={p.parameters.transitions.length} />
                    <Stat
                      label="Status"
                      value={p.npmlContent ? "RDY" : "CFG"}
                      accent={p.npmlContent ? "success" : "muted"}
                    />
                  </div>
                  <div className="mt-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    Mod. {new Date(p.updatedAt).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-surface mt-12">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Petri-IEC / Rev 1.0.0
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Persistência local
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number | string;
  accent?: "default" | "success" | "muted";
}) {
  const colors = {
    default: "text-foreground",
    success: "text-success",
    muted: "text-muted-foreground",
  };
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-xs font-medium tabular-nums ${colors[accent]}`}>
        {value}
      </span>
    </div>
  );
}
