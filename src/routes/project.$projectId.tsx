import { createFileRoute, Link, Outlet, useParams, useLocation } from "@tanstack/react-router";
import { useProject, useProjects } from "@/lib/projects-store";
import { ArrowLeft, Cpu, Plus } from "lucide-react";
import { useState } from "react";
import { createProject } from "@/lib/projects-store";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/project/$projectId")({
  head: ({ params }) => ({
    meta: [
      { title: `Projeto ${params.projectId} — Petri-IEC` },
      { name: "description", content: "Workspace do projeto de conversão Petri → IEC." },
    ],
  }),
  component: ProjectLayout,
});

const TABS = [
  { to: "/project/$projectId", label: "Parâmetros", code: "01" },
  { to: "/project/$projectId/input", label: "Input", code: "02" },
  { to: "/project/$projectId/analysis", label: "Análise", code: "03" },
  { to: "/project/$projectId/output", label: "Saída", code: "04" },
] as const;

function ProjectLayout() {
  const { projectId } = useParams({ from: "/project/$projectId" });
  const project = useProject(projectId);
  const projects = useProjects();
  const location = useLocation();
  const navigate = useNavigate();
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");

  if (!project) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            ERR / Project not found
          </div>
          <h1 className="mt-3 text-xl font-semibold">Projeto não encontrado</h1>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-primary text-primary-foreground font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-primary/90"
          >
            <ArrowLeft className="size-3.5" />
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  // Determine active tab via current pathname
  const path = location.pathname;
  const activeTab =
    TABS.slice()
      .reverse()
      .find((t) => {
        const resolved = t.to.replace("$projectId", projectId);
        return path === resolved || path.startsWith(resolved + "/");
      }) ?? TABS[0];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const p = createProject(newName.trim());
    setNewName("");
    setCreatingNew(false);
    toast.success("Projeto criado");
    navigate({ to: "/project/$projectId", params: { projectId: p.id } });
  };

  return (
    <div className="flex h-dvh bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-72 flex flex-col border-r border-border bg-sidebar shrink-0">
        <div className="h-14 flex items-center px-5 border-b border-border">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="size-7 rounded-sm bg-primary flex items-center justify-center group-hover:bg-primary/90 transition-colors">
              <Cpu className="size-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-mono text-[13px] font-semibold tracking-tighter uppercase">
                Petri-IEC.v1
              </span>
              <span className="font-mono text-[9px] text-muted-foreground tracking-widest uppercase mt-0.5">
                Workspace
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <header className="px-2 mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Projetos ativos
            </span>
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
              {projects.length.toString().padStart(2, "0")} unidades
            </span>
          </header>
          <div className="space-y-1">
            {projects.map((p) => {
              const isActive = p.id === projectId;
              return (
                <Link
                  key={p.id}
                  to="/project/$projectId"
                  params={{ projectId: p.id }}
                  className={
                    "block px-2 py-2 rounded-sm transition-colors " +
                    (isActive
                      ? "bg-card milled-border"
                      : "hover:bg-sidebar-accent text-muted-foreground hover:text-foreground")
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col min-w-0">
                      <span
                        className={
                          "font-mono text-xs font-medium uppercase truncate " +
                          (isActive ? "text-foreground" : "")
                        }
                      >
                        {p.name}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground tracking-wider mt-0.5">
                        Mod {new Date(p.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {isActive && <div className="size-1.5 rounded-full bg-gauge shrink-0" />}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          {creatingNew ? (
            <form onSubmit={handleCreate} className="space-y-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Identificador..."
                className="w-full font-mono text-xs px-2 py-1.5 bg-card border border-input rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex gap-1">
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded-sm bg-primary text-primary-foreground font-mono text-[10px] font-bold uppercase tracking-widest"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingNew(false)}
                  className="px-2 py-1.5 rounded-sm border border-border font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-sidebar-accent"
                >
                  ✕
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setCreatingNew(true)}
              className="w-full py-2 px-4 rounded-sm bg-primary text-primary-foreground font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="size-3" strokeWidth={2.5} />
              Nova Assembly
            </button>
          )}
          <Link
            to="/"
            className="w-full py-1.5 rounded-sm border border-border bg-card font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-sidebar-accent flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="size-3" />
            Diretório
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Context bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card/50 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="font-mono text-sm font-semibold uppercase tracking-tight truncate">
              {project.name}
              <span className="text-muted-foreground">.npml</span>
            </h1>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span
                className={
                  "size-2 rounded-full " +
                  (project.npmlContent ? "bg-success" : "border border-muted-foreground")
                }
              />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {project.npmlContent ? "Pronto para conversão" : "Aguardando arquivo"}
              </span>
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hidden md:block">
            ID: {project.id.toUpperCase()}
          </div>
        </header>

        {/* Tabs */}
        <nav className="flex px-6 border-b border-border bg-surface shrink-0 overflow-x-auto">
          <div className="flex h-10">
            {TABS.map((tab) => {
              const isActive = tab.to === activeTab.to;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  params={{ projectId }}
                  className={
                    "px-5 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest border-x border-border whitespace-nowrap transition-colors " +
                    (isActive
                      ? "bg-background text-foreground -mb-px relative"
                      : "text-muted-foreground hover:text-foreground hover:bg-card -ml-px")
                  }
                  style={
                    isActive
                      ? { boxShadow: "inset 0 2px 0 0 var(--color-gauge)" }
                      : undefined
                  }
                >
                  <span className="text-muted-foreground tabular-nums">{tab.code}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto bg-background">
          <Outlet />
        </div>

        {/* Status bar */}
        <footer className="h-7 flex items-center justify-between px-6 border-t border-border bg-surface font-mono text-[10px] text-muted-foreground shrink-0">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/60">PLACES</span>
              <span className="text-foreground tabular-nums">
                {project.parameters.places.length.toString().padStart(3, "0")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/60">TRANS</span>
              <span className="text-foreground tabular-nums">
                {project.parameters.transitions.length.toString().padStart(3, "0")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/60">M0</span>
              <span className="text-foreground tabular-nums">
                {Object.values(project.parameters.initialMarkings)
                  .reduce((a, b) => a + b, 0)
                  .toString()
                  .padStart(3, "0")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-foreground uppercase">{activeTab.label}</span>
            <span className="text-muted-foreground/60 uppercase">Rev 1.0.0</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
