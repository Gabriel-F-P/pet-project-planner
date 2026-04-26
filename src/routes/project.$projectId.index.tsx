import { createFileRoute, useParams } from "@tanstack/react-router";
import { useProject, updateParameters, newPlaceId, newTransitionId } from "@/lib/projects-store";
import type { Place, Transition, ProjectParameters } from "@/lib/projects-store";
import { ChevronDown, Plus, Trash2, Circle, Search, X, Check } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/project/$projectId/")({
  component: ParametersTab,
});

type SectionKey = "places" | "transitions" | "markings";

function ParametersTab() {
  const { projectId } = useParams({ from: "/project/$projectId/" });
  const project = useProject(projectId);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    places: true,
    transitions: true,
    markings: true,
  });

  if (!project) return null;
  const params = project.parameters;

  const update = (next: ProjectParameters) => updateParameters(projectId, next);

  const toggle = (k: SectionKey) => setOpen((s) => ({ ...s, [k]: !s[k] }));

  // Places
  const addPlace = () => {
    const id = newPlaceId();
    const num = params.places.length + 1;
    update({
      ...params,
      places: [...params.places, { id, label: `Place_${num}` }],
      initialMarkings: { ...params.initialMarkings, [id]: 0 },
    });
  };
  const updatePlace = (id: string, label: string) =>
    update({
      ...params,
      places: params.places.map((p) => (p.id === id ? { ...p, label } : p)),
    });
  const removePlace = (id: string) => {
    const { [id]: _removed, ...rest } = params.initialMarkings;
    update({
      ...params,
      places: params.places.filter((p) => p.id !== id),
      initialMarkings: rest,
      transitions: params.transitions.map((t) => ({
        ...t,
        inputs: t.inputs.filter((x) => x !== id),
        outputs: t.outputs.filter((x) => x !== id),
      })),
    });
  };

  // Transitions
  const addTransition = () => {
    const id = newTransitionId();
    const num = params.transitions.length + 1;
    update({
      ...params,
      transitions: [
        ...params.transitions,
        { id, name: `T${num}`, inputs: [], outputs: [] },
      ],
    });
  };
  const updateTransition = (id: string, patch: Partial<Transition>) =>
    update({
      ...params,
      transitions: params.transitions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  const removeTransition = (id: string) =>
    update({
      ...params,
      transitions: params.transitions.filter((t) => t.id !== id),
    });

  // Markings
  const setMark = (placeId: string, value: number) =>
    update({
      ...params,
      initialMarkings: { ...params.initialMarkings, [placeId]: Math.max(0, value || 0) },
    });
  const removeMark = (placeId: string) => {
    const { [placeId]: _removed, ...rest } = params.initialMarkings;
    update({ ...params, initialMarkings: rest });
  };
  const activateMark = (placeId: string) => {
    if (params.initialMarkings[placeId] !== undefined) return;
    update({
      ...params,
      initialMarkings: { ...params.initialMarkings, [placeId]: 1 },
    });
  };

  return (
    <div className="p-8 flex justify-center">
      <div className="w-full max-w-4xl space-y-6">
        {/* Section: Places */}
        <Section
          title="Entradas — Places"
          subtitle={`${params.places.length} ITEMS`}
          open={open.places}
          onToggle={() => toggle("places")}
          action={
            <button
              onClick={addPlace}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-primary text-primary-foreground font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90"
            >
              <Plus className="size-3" strokeWidth={2.5} />
              Place
            </button>
          }
        >
          {params.places.length === 0 ? (
            <EmptyHint label="Adicione um Place para começar" />
          ) : (
            <div className="space-y-1.5">
              {params.places.map((p, i) => (
                <PlaceRow
                  key={p.id}
                  index={i + 1}
                  place={p}
                  onChange={(label) => updatePlace(p.id, label)}
                  onRemove={() => removePlace(p.id)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Section: Transitions */}
        <Section
          title="Transitions"
          subtitle={`${params.transitions.length} ITEMS`}
          open={open.transitions}
          onToggle={() => toggle("transitions")}
          action={
            <button
              onClick={addTransition}
              disabled={params.places.length === 0}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-primary text-primary-foreground font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="size-3" strokeWidth={2.5} />
              Transição
            </button>
          }
        >
          {params.transitions.length === 0 ? (
            <EmptyHint
              label={
                params.places.length === 0
                  ? "Adicione Places antes de criar transições"
                  : "Crie uma transição para conectar Places"
              }
            />
          ) : (
            <div className="space-y-3">
              {params.transitions.map((t) => (
                <TransitionRow
                  key={t.id}
                  transition={t}
                  places={params.places}
                  onChange={(patch) => updateTransition(t.id, patch)}
                  onRemove={() => removeTransition(t.id)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Section: Initial Markings */}
        <Section
          title="M0 — Marcações iniciais"
          subtitle={`${Object.keys(params.initialMarkings).length} / ${params.places.length}`}
          open={open.markings}
          onToggle={() => toggle("markings")}
          action={
            <MarkingAdder
              places={params.places}
              activeIds={Object.keys(params.initialMarkings)}
              onAdd={activateMark}
              onRemove={removeMark}
            />
          }
        >
          {params.places.length === 0 ? (
            <EmptyHint label="Adicione Places para configurar marcações" />
          ) : Object.keys(params.initialMarkings).length === 0 ? (
            <EmptyHint label='Use "+ Place" para escolher onde colocar tokens' />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {params.places
                .filter((p) => params.initialMarkings[p.id] !== undefined)
                .map((p) => {
                  const value = params.initialMarkings[p.id] ?? 0;
                  return (
                    <div
                      key={p.id}
                      className={
                        "group rounded-sm border bg-card p-2.5 transition-colors relative " +
                        (value > 0
                          ? "border-gauge ring-1 ring-gauge/20"
                          : "border-border")
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={
                            "font-mono text-[10px] uppercase tracking-widest truncate " +
                            (value > 0 ? "text-gauge" : "text-muted-foreground")
                          }
                        >
                          {p.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Circle
                            className={
                              "size-2 " +
                              (value > 0
                                ? "fill-gauge text-gauge"
                                : "text-muted-foreground/40")
                            }
                          />
                          <button
                            onClick={() => removeMark(p.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                            aria-label={`Remover marcação de ${p.label}`}
                          >
                            <X className="size-3" strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <button
                          onClick={() => setMark(p.id, value - 1)}
                          className="size-6 rounded-sm border border-border bg-background hover:bg-surface font-mono text-xs font-bold"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={value}
                          onChange={(e) => setMark(p.id, parseInt(e.target.value, 10))}
                          className="flex-1 text-center font-mono text-sm font-medium tabular-nums bg-background border border-input rounded-sm py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button
                          onClick={() => setMark(p.id, value + 1)}
                          className="size-6 rounded-sm border border-border bg-background hover:bg-surface font-mono text-xs font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Section>

        {/* Status footer */}
        <div className="pt-4 flex items-center justify-between border-t border-border">
          <div className="flex items-center gap-4">
            <Indicator
              ok={params.places.length > 0}
              label={`Places: ${params.places.length}`}
            />
            <Indicator
              ok={params.transitions.length > 0}
              label={`Transições: ${params.transitions.length}`}
            />
            <Indicator
              ok={Object.values(params.initialMarkings).some((v) => v > 0)}
              label={`Tokens: ${Object.values(params.initialMarkings).reduce((a, b) => a + b, 0)}`}
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Auto-salvo
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm bg-card milled-border overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 group flex-1 text-left"
        >
          <ChevronDown
            className={
              "size-3.5 text-muted-foreground transition-transform " +
              (open ? "" : "-rotate-90")
            }
            strokeWidth={2.5}
          />
          <div className="size-1.5 rounded-full bg-primary" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider">{title}</h3>
        </button>
        <div className="flex items-center gap-3">
          {subtitle && (
            <span className="font-mono text-[10px] text-muted-foreground tracking-tighter uppercase">
              {subtitle}
            </span>
          )}
          {action}
        </div>
      </header>
      {open && <div className="p-4 bg-surface/30">{children}</div>}
    </section>
  );
}

function PlaceRow({
  index,
  place,
  onChange,
  onRemove,
}: {
  index: number;
  place: Place;
  onChange: (label: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-card border border-border rounded-sm group">
      <span className="font-mono text-[10px] text-muted-foreground tracking-widest w-10 tabular-nums shrink-0">
        P{index.toString().padStart(2, "0")}
      </span>
      <input
        value={place.label}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Label do Place"
        className="flex-1 font-mono text-xs bg-transparent outline-none focus:bg-background focus:border focus:border-input focus:rounded-sm focus:px-2 py-1"
      />
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function TransitionRow({
  transition,
  places,
  onChange,
  onRemove,
}: {
  transition: Transition;
  places: Place[];
  onChange: (patch: Partial<Transition>) => void;
  onRemove: () => void;
}) {
  const togglePlace = (key: "inputs" | "outputs", id: string) => {
    const list = transition[key];
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    onChange({ [key]: next } as Partial<Transition>);
  };

  return (
    <div className="rounded-sm border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface/50">
        <span className="font-mono text-[10px] text-muted-foreground tracking-widest shrink-0 uppercase">
          Trans
        </span>
        <input
          value={transition.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Nome da transição"
          className="flex-1 font-mono text-xs font-medium bg-transparent outline-none focus:bg-background focus:border focus:border-input focus:rounded-sm focus:px-2 py-1"
        />
        <button
          onClick={onRemove}
          className="p-1 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border">
        <PlaceSelector
          label="Entrada (•T)"
          places={places}
          selected={transition.inputs}
          onToggle={(id) => togglePlace("inputs", id)}
        />
        <PlaceSelector
          label="Saída (T•)"
          places={places}
          selected={transition.outputs}
          onToggle={(id) => togglePlace("outputs", id)}
        />
      </div>
    </div>
  );
}

function PlaceSelector({
  label,
  places,
  selected,
  onToggle,
}: {
  label: string;
  places: Place[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [openPop, setOpenPop] = useState(false);
  const [query, setQuery] = useState("");

  const selectedPlaces = selected
    .map((id) => places.find((p) => p.id === id))
    .filter((p): p is Place => Boolean(p));

  const filtered = places.filter((p) =>
    p.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
          <span className="ml-2 text-foreground tabular-nums">
            [{selected.length.toString().padStart(2, "0")}]
          </span>
        </div>
        <Popover open={openPop} onOpenChange={setOpenPop}>
          <PopoverTrigger asChild>
            <button
              disabled={places.length === 0}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-border bg-background hover:border-foreground/40 hover:text-foreground font-mono text-[10px] uppercase tracking-widest text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="size-2.5" strokeWidth={2.5} />
              Add
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={4}
            className="w-60 p-0 rounded-sm milled-border bg-card"
          >
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border">
              <Search className="size-3 text-muted-foreground shrink-0" strokeWidth={2.5} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar place..."
                className="flex-1 bg-transparent outline-none font-mono text-xs placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Nenhum place
                </div>
              ) : (
                filtered.map((p) => {
                  const active = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onToggle(p.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface/60 group"
                    >
                      <div
                        className={
                          "size-3.5 rounded-sm border flex items-center justify-center shrink-0 " +
                          (active
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-background")
                        }
                      >
                        {active && <Check className="size-2.5" strokeWidth={3} />}
                      </div>
                      <span className="font-mono text-xs flex-1 truncate">{p.label}</span>
                    </button>
                  );
                })
              )}
            </div>
            {selected.length > 0 && (
              <div className="px-2.5 py-1.5 border-t border-border flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
                  {selected.length} sel.
                </span>
                <button
                  onClick={() => selected.forEach((id) => onToggle(id))}
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive"
                >
                  Limpar
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {selectedPlaces.length === 0 ? (
        <div className="font-mono text-[10px] text-muted-foreground/70 italic py-1">
          {places.length === 0 ? "Sem places disponíveis" : "Nenhum selecionado"}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {selectedPlaces.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-sm bg-primary/10 border border-primary/30 text-primary font-mono text-[10px] uppercase tracking-wider"
            >
              {p.label}
              <button
                onClick={() => onToggle(p.id)}
                className="size-3.5 inline-flex items-center justify-center rounded-sm hover:bg-primary/20"
                aria-label={`Remover ${p.label}`}
              >
                <X className="size-2.5" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="py-6 text-center">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function Indicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={
          "size-2 rounded-full " + (ok ? "bg-success" : "bg-muted-foreground/30")
        }
      />
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
