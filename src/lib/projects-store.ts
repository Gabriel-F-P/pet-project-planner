import { useEffect, useState, useCallback } from "react";
import exampleXml from "../../exemplos/estacao-furacao.pnml?raw";
import { parsePnml, netToParameters } from "./petri";

export type Place = {
  id: string;
  label: string;
};

export type Transition = {
  id: string;
  name: string;
  inputs: string[]; // place ids
  outputs: string[]; // place ids
  inputWeights?: Record<string, number>; // place id -> peso do arco (padrão 1)
  outputWeights?: Record<string, number>;
  inhibitors?: string[]; // lugares ligados por arco inibidor
  guard?: string; // condição externa em Texto Estruturado (ex.: "Sensor_B0")
};

export type ProjectParameters = {
  places: Place[];
  transitions: Transition[];
  initialMarkings: Record<string, number>; // place id -> tokens
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  parameters: ProjectParameters;
  npmlFileName?: string;
  npmlContent?: string;
};

const STORAGE_KEY = "petri-iec.projects.v1";
const SEEDED_KEY = "petri-iec.example-seeded.v1";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Projeto de exemplo, criado na primeira abertura do app (armazenamento vazio). */
function exampleProject(): Project {
  const now = Date.now();
  const net = parsePnml(exampleXml);
  const parameters = netToParameters(net);
  const guards: Record<string, string> = {
    Carregar: "Sensor_Presenca",
    Iniciar_Furo: "Sensor_Posicao",
    Concluir_Furo: "Fim_Curso_Furadeira",
    Descarregar: "Botao_Descarga",
  };
  parameters.transitions.forEach((t) => (t.guard = guards[t.name] ?? ""));
  return {
    id: "exemplo-furacao",
    name: "Estação de Furação (exemplo)",
    description: "Esteira + furadeira com recurso compartilhado e arco inibidor",
    createdAt: now,
    updatedAt: now,
    parameters,
    npmlFileName: "estacao-furacao.pnml",
    npmlContent: exampleXml,
  };
}

function read(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as Project[]) : [];
    // o exemplo é inserido uma única vez por navegador, mesmo que já exista uma lista salva
    if (!localStorage.getItem(SEEDED_KEY)) {
      localStorage.setItem(SEEDED_KEY, "1");
      if (!list.some((p) => p.id === "exemplo-furacao")) {
        list.unshift(exampleProject());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
    }
    return list;
  } catch {
    return [];
  }
}

function write(projects: Project[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  window.dispatchEvent(new Event("projects:changed"));
}

export function emptyParameters(): ProjectParameters {
  return { places: [], transitions: [], initialMarkings: {} };
}

export function createProject(name: string, description?: string): Project {
  const now = Date.now();
  const project: Project = {
    id: uid(),
    name,
    description,
    createdAt: now,
    updatedAt: now,
    parameters: emptyParameters(),
  };
  const projects = read();
  projects.unshift(project);
  write(projects);
  return project;
}

export function deleteProject(id: string) {
  write(read().filter((p) => p.id !== id));
}

export function getProject(id: string): Project | undefined {
  return read().find((p) => p.id === id);
}

export function updateProject(id: string, patch: Partial<Project>) {
  const projects = read();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return;
  projects[idx] = { ...projects[idx], ...patch, updatedAt: Date.now() };
  write(projects);
}

export function updateParameters(id: string, parameters: ProjectParameters) {
  updateProject(id, { parameters });
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    setProjects(read());
    const handler = () => setProjects(read());
    window.addEventListener("projects:changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("projects:changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return projects;
}

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | undefined>(undefined);

  const refresh = useCallback(() => {
    if (!id) return;
    setProject(getProject(id));
  }, [id]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("projects:changed", handler);
    return () => window.removeEventListener("projects:changed", handler);
  }, [refresh]);

  return project;
}

export function newPlaceId() {
  return "p_" + uid();
}

export function newTransitionId() {
  return "t_" + uid();
}
