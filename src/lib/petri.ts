// Núcleo do conversor: leitura do PNML, análise da rede e geração de código
// (IEC 61131-3 Texto Estruturado, Arduino e Python).
import type { ProjectParameters, Transition } from "./projects-store";

/* ------------------------------------------------------------------ */
/* Leitura do arquivo PNML (padrão ou salvo pelo PIPE)                 */
/* ------------------------------------------------------------------ */

export type PnmlPlace = { id: string; name: string; marking: number };
export type PnmlTransition = { id: string; name: string };
export type PnmlArc = { source: string; target: string; weight: number; inhibitor: boolean };
export type PnmlNet = {
  format: "PIPE" | "PNML";
  netId: string;
  places: PnmlPlace[];
  transitions: PnmlTransition[];
  arcs: PnmlArc[];
  warnings: string[];
};

export type XmlParser = (xml: string) => Document;
const defaultParser: XmlParser = (xml) => new DOMParser().parseFromString(xml, "application/xml");

const localName = (el: Element) => el.localName || el.nodeName;

function childrenByName(el: Element, name: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i];
    if (n.nodeType === 1 && localName(n as Element) === name) out.push(n as Element);
  }
  return out;
}
const child = (el: Element, name: string): Element | undefined => childrenByName(el, name)[0];
const descendants = (el: Element | Document, name: string): Element[] =>
  Array.from(el.getElementsByTagName(name));

/** Rótulo PNML: <text> no padrão, <value> no PIPE. */
function labelText(el: Element | undefined): string | undefined {
  if (!el) return undefined;
  return (child(el, "text") ?? child(el, "value"))?.textContent?.trim() ?? undefined;
}

/** Marcação/peso: "3" no padrão, "Default,3" no PIPE. */
function parseCount(text: string | undefined): number {
  if (!text) return 0;
  const parts = text.split(",").map((s) => s.trim());
  const n = parseInt(parts[parts.length - 1], 10);
  return Number.isFinite(n) ? n : 0;
}

export function parsePnml(xml: string, parser: XmlParser = defaultParser): PnmlNet {
  const doc = parser(xml);
  const err = descendants(doc, "parsererror")[0];
  if (err) throw new Error("Arquivo XML inválido: " + (err.textContent ?? "").slice(0, 160));
  const root = doc.documentElement;
  if (!root || localName(root) !== "pnml")
    throw new Error("O arquivo não é PNML (elemento raiz <pnml> não encontrado).");
  const net = descendants(root, "net")[0];
  if (!net) throw new Error("Nenhum elemento <net> encontrado no arquivo.");

  const isPipe = descendants(net, "value").length > 0 && descendants(net, "text").length === 0;
  const warnings: string[] = [];

  const places = descendants(net, "place").map((p) => ({
    id: p.getAttribute("id") ?? "",
    name: labelText(child(p, "name")) ?? p.getAttribute("id") ?? "",
    marking: parseCount(labelText(child(p, "initialMarking"))),
  }));
  const transitions = descendants(net, "transition").map((t) => ({
    id: t.getAttribute("id") ?? "",
    name: labelText(child(t, "name")) ?? t.getAttribute("id") ?? "",
  }));
  const placeIds = new Set(places.map((p) => p.id));
  const transIds = new Set(transitions.map((t) => t.id));

  const arcs: PnmlArc[] = [];
  for (const a of descendants(net, "arc")) {
    const source = a.getAttribute("source") ?? "";
    const target = a.getAttribute("target") ?? "";
    const typeEl = child(a, "type");
    const inhibitor =
      (typeEl?.getAttribute("value") ?? labelText(typeEl) ?? "normal").toLowerCase() === "inhibitor";
    const weight = Math.max(1, parseCount(labelText(child(a, "inscription"))) || 1);
    if (!((placeIds.has(source) && transIds.has(target)) || (transIds.has(source) && placeIds.has(target)))) {
      warnings.push(
        `Arco ${a.getAttribute("id") ?? `${source}→${target}`} ignorado: deve ligar um lugar a uma transição.`,
      );
      continue;
    }
    if (inhibitor && !placeIds.has(source)) {
      warnings.push(`Arco inibidor ${source}→${target} ignorado: arcos inibidores devem sair de um lugar.`);
      continue;
    }
    arcs.push({ source, target, weight, inhibitor });
  }
  if (places.length === 0) warnings.push("Nenhum lugar encontrado no arquivo.");
  if (transitions.length === 0) warnings.push("Nenhuma transição encontrada no arquivo.");

  return {
    format: isPipe ? "PIPE" : "PNML",
    netId: net.getAttribute("id") ?? "",
    places,
    transitions,
    arcs,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Identificadores e parâmetros                                        */
/* ------------------------------------------------------------------ */

const ST_KEYWORDS = new Set(
  "AND OR XOR NOT MOD TRUE FALSE IF THEN ELSE ELSIF END_IF CASE OF END_CASE FOR TO BY DO END_FOR WHILE END_WHILE REPEAT UNTIL END_REPEAT EXIT RETURN VAR END_VAR PROGRAM END_PROGRAM FUNCTION FUNCTION_BLOCK INT BOOL REAL TIME".split(
    " ",
  ),
);

/** Converte um nome em identificador válido (IEC 61131-3, C++ e Python). */
export function toIdentifier(name: string): string {
  let id = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!id) id = "X";
  if (/^[0-9]/.test(id)) id = "P_" + id;
  if (ST_KEYWORDS.has(id.toUpperCase())) id = id + "_";
  return id;
}

/** Transforma a rede lida em parâmetros do projeto, preservando as condições já digitadas. */
export function netToParameters(net: PnmlNet, previous?: ProjectParameters): ProjectParameters {
  const guards = new Map((previous?.transitions ?? []).map((t) => [t.name, t.guard ?? ""]));
  const pid = new Map(net.places.map((p, i) => [p.id, `p${i + 1}`]));
  const places = net.places.map((p, i) => ({ id: `p${i + 1}`, label: toIdentifier(p.name) }));
  const transitions: Transition[] = net.transitions.map((t, i) => {
    const ins = net.arcs.filter((a) => a.target === t.id && !a.inhibitor);
    const outs = net.arcs.filter((a) => a.source === t.id);
    const inh = net.arcs.filter((a) => a.target === t.id && a.inhibitor);
    const name = toIdentifier(t.name);
    return {
      id: `t${i + 1}`,
      name,
      inputs: ins.map((a) => pid.get(a.source)!),
      outputs: outs.map((a) => pid.get(a.target)!),
      inputWeights: Object.fromEntries(ins.map((a) => [pid.get(a.source)!, a.weight])),
      outputWeights: Object.fromEntries(outs.map((a) => [pid.get(a.target)!, a.weight])),
      inhibitors: inh.map((a) => pid.get(a.source)!),
      guard: guards.get(name) ?? "",
    };
  });
  const initialMarkings: Record<string, number> = {};
  net.places.forEach((p, i) => {
    if (p.marking > 0) initialMarkings[`p${i + 1}`] = p.marking;
  });
  return { places, transitions, initialMarkings };
}

/* ------------------------------------------------------------------ */
/* Análise do espaço de estados                                        */
/* ------------------------------------------------------------------ */

const weight = (w: Record<string, number> | undefined, id: string) => w?.[id] ?? 1;

export type PlaceBound = {
  id: string;
  label: string;
  max: number;
  unbounded: boolean;
  type: "BOOL" | "INT";
};
export type NetAnalysis = {
  bounds: PlaceBound[];
  states: number;
  complete: boolean;
  deadlocks: Record<string, number>[];
  conflicts: { place: string; transitions: string[] }[];
};

export function analyzeNet(params: ProjectParameters, maxStates = 20000): NetAnalysis {
  const ids = params.places.map((p) => p.id);
  const trans = params.transitions;
  const m0 = ids.map((id) => params.initialMarkings[id] ?? 0);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const enabled = (m: number[], t: Transition) =>
    t.inputs.every((p) => m[idx.get(p)!] >= weight(t.inputWeights, p)) &&
    (t.inhibitors ?? []).every((p) => m[idx.get(p)!] === 0);
  const fire = (m: number[], t: Transition) => {
    const n = m.slice();
    t.inputs.forEach((p) => (n[idx.get(p)!] -= weight(t.inputWeights, p)));
    t.outputs.forEach((p) => (n[idx.get(p)!] += weight(t.outputWeights, p)));
    return n;
  };

  const unbounded = new Set<number>();
  const max = m0.slice();
  const seen = new Map<string, number[][]>();
  const queue: { m: number[]; anc: number[][] }[] = [{ m: m0, anc: [] }];
  seen.set(m0.join(","), []);
  const dead: number[][] = [];
  let complete = true;

  while (queue.length) {
    if (seen.size > maxStates) {
      complete = false;
      break;
    }
    const { m, anc } = queue.shift()!;
    const en = trans.filter((t) => enabled(m, t));
    if (en.length === 0) dead.push(m);
    for (const t of en) {
      const n = fire(m, t);
      const path = [...anc, m];
      let covers = false;
      // cobertura: n ≥ ancestral e maior em algum lugar → lugar cresce sem limite
      for (const a of path) {
        if (n.every((v, i) => v >= a[i]) && n.some((v, i) => v > a[i])) {
          n.forEach((v, i) => v > a[i] && unbounded.add(i));
          covers = true;
        }
      }
      n.forEach((v, i) => (max[i] = Math.max(max[i], v)));
      const key = n.join(",");
      if (!covers && !seen.has(key)) {
        seen.set(key, path);
        queue.push({ m: n, anc: path.length > 60 ? path.slice(-60) : path });
      }
    }
  }

  const bounds: PlaceBound[] = params.places.map((p, i) => {
    const unb = unbounded.has(i);
    const isInt =
      unb ||
      max[i] > 1 ||
      trans.some((t) => weight(t.inputWeights, p.id) > 1 && t.inputs.includes(p.id)) ||
      trans.some((t) => weight(t.outputWeights, p.id) > 1 && t.outputs.includes(p.id));
    return { id: p.id, label: p.label, max: max[i], unbounded: unb, type: isInt ? "INT" : "BOOL" };
  });
  const conflicts = params.places
    .map((p) => ({
      place: p.label,
      transitions: trans.filter((t) => t.inputs.includes(p.id)).map((t) => t.name),
    }))
    .filter((c) => c.transitions.length > 1);

  return {
    bounds,
    states: seen.size,
    complete,
    deadlocks: dead
      .slice(0, 5)
      .map((m) => Object.fromEntries(ids.map((_, i) => [params.places[i].label, m[i]]).filter(([, v]) => v))),
    conflicts,
  };
}

/* ------------------------------------------------------------------ */
/* Relatório da etapa de análise                                       */
/* ------------------------------------------------------------------ */

export type LogLevel = "info" | "warn" | "ok" | "error";
export type LogEntry = { level: LogLevel; code: string; message: string };

export function buildReport(
  params: ProjectParameters,
  fileName: string | undefined,
  content: string | undefined,
  parser?: XmlParser,
): LogEntry[] {
  const log: LogEntry[] = [];
  const add = (level: LogLevel, code: string, message: string) => log.push({ level, code, message });

  if (content) {
    add("info", "INIT", `Arquivo: ${fileName ?? "sem nome"} (${(content.length / 1024).toFixed(2)} KB)`);
    try {
      const net = parsePnml(content, parser);
      add(
        "ok",
        "PARSE",
        `Arquivo lido (formato ${net.format}): ${net.places.length} lugares, ${net.transitions.length} transições, ${net.arcs.length} arcos.`,
      );
      net.warnings.forEach((w) => add("warn", "PARSE", w));

      const fromFile = netToParameters(net);
      const pl = (p: ProjectParameters) => new Set(p.places.map((x) => x.label));
      const tr = (p: ProjectParameters) => new Set(p.transitions.map((x) => x.name));
      const missP = [...pl(fromFile)].filter((x) => !pl(params).has(x));
      const extraP = [...pl(params)].filter((x) => !pl(fromFile).has(x));
      const missT = [...tr(fromFile)].filter((x) => !tr(params).has(x));
      const extraT = [...tr(params)].filter((x) => !tr(fromFile).has(x));
      if (missP.length) add("warn", "CONSIST", `Lugares do arquivo ausentes nos parâmetros: ${missP.join(", ")}.`);
      if (extraP.length) add("warn", "CONSIST", `Lugares nos parâmetros que não estão no arquivo: ${extraP.join(", ")}.`);
      if (missT.length) add("warn", "CONSIST", `Transições do arquivo ausentes nos parâmetros: ${missT.join(", ")}.`);
      if (extraT.length)
        add("warn", "CONSIST", `Transições nos parâmetros que não estão no arquivo: ${extraT.join(", ")}.`);

      const labelOf = (p: ProjectParameters, id: string) => p.places.find((x) => x.id === id)?.label;
      const arcSet = (p: ProjectParameters) =>
        new Set(
          p.transitions.flatMap((t) => [
            ...t.inputs.map((i) => `${labelOf(p, i)}>${t.name}`),
            ...t.outputs.map((o) => `${t.name}>${labelOf(p, o)}`),
          ]),
        );
      const a1 = arcSet(fromFile);
      const a2 = arcSet(params);
      const diff = [...a1].filter((x) => !a2.has(x)).length + [...a2].filter((x) => !a1.has(x)).length;
      if (!missP.length && !extraP.length && !missT.length && !extraT.length) {
        if (diff === 0) add("ok", "CONSIST", "Parâmetros coerentes com o arquivo (lugares, transições e arcos).");
        else add("warn", "CONSIST", `${diff} arco(s) diferem entre o arquivo e os parâmetros.`);
      }
      const markDiff = fromFile.places.filter(
        (p) =>
          (fromFile.initialMarkings[p.id] ?? 0) !==
          (params.initialMarkings[params.places.find((q) => q.label === p.label)?.id ?? ""] ?? 0),
      );
      if (markDiff.length)
        add("warn", "CONSIST", `Marcação inicial diferente do arquivo em: ${markDiff.map((p) => p.label).join(", ")}.`);
    } catch (e) {
      add("error", "PARSE", (e as Error).message);
    }
  } else {
    add("info", "INIT", "Nenhum arquivo carregado: usando apenas os parâmetros digitados.");
  }

  add("info", "VALIDATE", `${params.places.length} lugares e ${params.transitions.length} transições nos parâmetros.`);
  const orphan = params.places.filter(
    (p) => !params.transitions.some((t) => t.inputs.includes(p.id) || t.outputs.includes(p.id)),
  );
  if (orphan.length) add("warn", "VALIDATE", `Lugares sem conexão: ${orphan.map((p) => p.label).join(", ")}.`);
  const noIn = params.transitions.filter((t) => t.inputs.length === 0);
  if (noIn.length)
    add(
      "warn",
      "VALIDATE",
      `Transições sem lugar de entrada (dispararão sempre que a condição for verdadeira): ${noIn.map((t) => t.name).join(", ")}.`,
    );
  const noOut = params.transitions.filter((t) => t.outputs.length === 0);
  if (noOut.length)
    add("info", "VALIDATE", `Transições sem lugar de saída (consomem tokens): ${noOut.map((t) => t.name).join(", ")}.`);

  const names = [...params.places.map((p) => p.label), ...params.transitions.map((t) => t.name)];
  const adjusted = names.filter((n) => toIdentifier(n) !== n);
  if (adjusted.length)
    add(
      "warn",
      "IDENT",
      `Nomes ajustados para identificadores válidos: ${adjusted.map((n) => `${n} → ${toIdentifier(n)}`).join(", ")}.`,
    );
  const dup = names.map(toIdentifier).filter((n, i, a) => a.indexOf(n) !== i);
  if (dup.length)
    add("error", "IDENT", `Nomes repetidos: ${[...new Set(dup)].join(", ")}. Renomeie para gerar o código.`);

  const noGuard = params.transitions.filter((t) => !(t.guard ?? "").trim());
  if (noGuard.length === 0) add("ok", "GUARD", "Todas as transições têm condição externa (rede interpretada).");
  else
    add(
      "warn",
      "GUARD",
      `${noGuard.length} transição(ões) sem condição externa — disparam assim que habilitadas: ${noGuard.map((t) => t.name).join(", ")}.`,
    );

  if (params.places.length && params.transitions.length) {
    const a = analyzeNet(params);
    add(
      a.complete ? "ok" : "warn",
      "STATES",
      `${a.states} marcações exploradas${a.complete ? " (espaço de estados completo)" : " (limite atingido; resultado parcial)"}.`,
    );
    for (const c of a.conflicts) {
      const guarded = params.transitions
        .filter((t) => c.transitions.includes(t.name))
        .every((t) => (t.guard ?? "").trim());
      add(
        guarded ? "info" : "warn",
        "CONFLICT",
        `Conflito em ${c.place}: ${c.transitions.join(" / ")}${guarded ? " — resolvido pelas condições externas (devem ser mutuamente exclusivas)." : " — sem condições, prevalece a ordem do código."}`,
      );
    }
    const unb = a.bounds.filter((b) => b.unbounded);
    if (unb.length)
      add(
        "warn",
        "BOUND",
        `Lugares que crescem sem limite: ${unb.map((b) => b.label).join(", ")} (declarados como INT).`,
      );
    else if (a.complete) add("ok", "BOUND", "Rede limitada.");
    const ints = a.bounds.filter((b) => b.type === "INT");
    add(
      "info",
      "TYPES",
      `${a.bounds.length - ints.length} lugar(es) BOOL; ${ints.length} INT${ints.length ? `: ${ints.map((b) => `${b.label} (máx. ${b.unbounded ? "ilimitado" : b.max})`).join(", ")}` : ""}.`,
    );
    if (a.deadlocks.length)
      add(
        "warn",
        "DEADLOCK",
        `${a.deadlocks.length} marcação(ões) sem transição habilitada. Ex.: ${Object.entries(a.deadlocks[0])
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")}.`,
      );
    else if (a.complete) add("ok", "DEADLOCK", "Nenhum bloqueio (deadlock) encontrado.");
  }

  const hasError = log.some((l) => l.level === "error");
  add(
    hasError ? "error" : "ok",
    "DONE",
    hasError ? "Corrija os erros acima antes de gerar o código." : "Código gerado (veja a etapa Output).",
  );
  return log;
}

/* ------------------------------------------------------------------ */
/* Modelo comum aos geradores                                          */
/* ------------------------------------------------------------------ */

/** Variáveis usadas nas condições que não são lugares → entradas BOOL. */
export function guardInputs(params: ProjectParameters): string[] {
  const placeNames = new Set(params.places.map((p) => toIdentifier(p.label)));
  const out = new Set<string>();
  for (const t of params.transitions) {
    for (const m of (t.guard ?? "").matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
      const w = m[0];
      if (!ST_KEYWORDS.has(w.toUpperCase()) && !placeNames.has(w)) out.add(w);
    }
  }
  return [...out];
}

type Model = {
  analysis: NetAnalysis;
  name: (placeId: string) => string;
  isBool: (placeId: string) => boolean;
  inputs: string[];
  places: { id: string; name: string; bool: boolean; initial: number; note: string; index: number }[];
  transitions: { t: Transition; index: number; flag: string; guard: string }[];
};

function buildModel(params: ProjectParameters): Model {
  const analysis = analyzeNet(params);
  const types = new Map(analysis.bounds.map((b) => [b.id, b.type]));
  const names = new Map(params.places.map((p) => [p.id, toIdentifier(p.label)]));
  return {
    analysis,
    name: (id) => names.get(id)!,
    isBool: (id) => types.get(id) === "BOOL",
    inputs: guardInputs(params),
    places: params.places.map((p, i) => {
      const b = analysis.bounds[i];
      return {
        id: p.id,
        name: names.get(p.id)!,
        bool: types.get(p.id) === "BOOL",
        initial: params.initialMarkings[p.id] ?? 0,
        note: b.unbounded ? "ilimitado" : `máx. ${b.max}`,
        index: i + 1,
      };
    }),
    transitions: params.transitions.map((t, i) => ({
      t,
      index: i + 1,
      flag: `T_${toIdentifier(t.name)}`,
      guard: (t.guard ?? "").trim(),
    })),
  };
}

export type CodeTarget = "iec" | "arduino" | "python";
export type GeneratedCode = {
  target: CodeTarget;
  /** Primeira parte (declarações) — exibida separadamente na etapa Output. */
  declaration: string;
  /** Segunda parte (lógica do ciclo). */
  implementation: string;
  /** Arquivo completo para download. */
  full: string;
  inputs: string[];
};

/* ------------------------------------------------------------------ */
/* IEC 61131-3 — Texto Estruturado                                     */
/* ------------------------------------------------------------------ */

export function generateST(params: ProjectParameters, programName = "PLC_PRG"): GeneratedCode {
  const M = buildModel(params);
  const cond = (t: Transition, id: string) =>
    M.isBool(id) ? M.name(id) : `${M.name(id)} >= ${weight(t.inputWeights, id)}`;
  const enabling = (t: Transition) => {
    const parts = [
      ...t.inputs.map((id) => cond(t, id)),
      ...(t.inhibitors ?? []).map((id) => (M.isBool(id) ? `NOT ${M.name(id)}` : `${M.name(id)} = 0`)),
    ];
    return parts.length ? parts.join(" AND ") : "TRUE";
  };

  const decl = [`PROGRAM ${programName}`, "VAR", "    (* Lugares da Rede de Petri *)"];
  M.places.forEach((p) =>
    decl.push(
      p.bool
        ? `    ${p.name} : BOOL := ${p.initial > 0 ? "TRUE" : "FALSE"}; (* P${p.index} *)`
        : `    ${p.name} : INT := ${p.initial}; (* P${p.index} - ${p.note} *)`,
    ),
  );
  if (M.inputs.length) {
    decl.push("    (* Condições externas: sensores e eventos *)");
    M.inputs.forEach((n) => decl.push(`    ${n} : BOOL := FALSE;`));
  }
  decl.push("    (* Habilitação das transições no ciclo atual *)");
  M.transitions.forEach((x) => decl.push(`    ${x.flag} : BOOL := FALSE; (* T${x.index} *)`));
  decl.push("END_VAR");

  const impl = [
    "(* Código gerado automaticamente a partir da Rede de Petri — IEC 61131-3 Texto Estruturado *)",
    "(* 1) Habilitação: avaliada com a marcação do início do ciclo *)",
  ];
  M.transitions.forEach((x) =>
    impl.push(
      `${x.flag} := ${enabling(x.t)}${x.guard ? ` AND (${x.guard})` : ""}; (* T${x.index} - ${x.t.name} *)`,
    ),
  );
  impl.push("", "(* 2) Disparo: uma vez por ciclo, conferindo se os tokens ainda estão disponíveis *)");
  M.transitions.forEach(({ t, index, flag }) => {
    // reconfere entradas e arcos inibidores: transições anteriores do mesmo ciclo podem ter mudado a marcação
    const recheck = t.inputs.length || t.inhibitors?.length ? ` AND ${enabling(t)}` : "";
    impl.push(`(* T${index} - ${t.name} *)`, `IF ${flag}${recheck} THEN`);
    t.inputs.forEach((id) =>
      impl.push(
        M.isBool(id)
          ? `    ${M.name(id)} := FALSE;`
          : `    ${M.name(id)} := ${M.name(id)} - ${weight(t.inputWeights, id)};`,
      ),
    );
    t.outputs.forEach((id) =>
      impl.push(
        M.isBool(id)
          ? `    ${M.name(id)} := TRUE;`
          : `    ${M.name(id)} := ${M.name(id)} + ${weight(t.outputWeights, id)};`,
      ),
    );
    impl.push("END_IF;", "");
  });

  const declaration = decl.join("\n");
  const implementation = impl.join("\n").trimEnd();
  return {
    target: "iec",
    declaration,
    implementation,
    full: `${declaration}\n\n${implementation}\n\nEND_PROGRAM\n`,
    inputs: M.inputs,
  };
}

/* ------------------------------------------------------------------ */
/* Tradução das condições (escritas em ST) para C++ e Python           */
/* ------------------------------------------------------------------ */

function translateGuard(guard: string, lang: "cpp" | "python", placeRef: (name: string) => string | undefined) {
  const ops: Record<string, { cpp: string; python: string }> = {
    AND: { cpp: "&&", python: "and" },
    OR: { cpp: "||", python: "or" },
    XOR: { cpp: "!=", python: "!=" },
    NOT: { cpp: "!", python: "not" },
    TRUE: { cpp: "true", python: "True" },
    FALSE: { cpp: "false", python: "False" },
    MOD: { cpp: "%", python: "%" },
  };
  return guard
    .replace(/<>/g, " \u0001 ")
    .replace(/>=|<=/g, (m) => ` ${m} `)
    .replace(/(?<![<>!=])=(?!=)/g, " == ")
    .replace(/\u0001/g, "!=")
    .replace(/[A-Za-z_][A-Za-z0-9_]*/g, (w) => {
      const op = ops[w.toUpperCase()];
      if (op) return lang === "cpp" && w.toUpperCase() === "NOT" ? op.cpp : ` ${op[lang]} `;
      return placeRef(w) ?? w;
    })
    .replace(/!\s+/g, "!")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Arduino (C++)                                                       */
/* ------------------------------------------------------------------ */

// 0/1 ficam livres para a Serial e o 13 (LED da placa) não é usado como entrada
const UNO_PINS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "A0", "A1", "A2", "A3", "A4", "A5"];
const MEGA_PINS = [
  ...Array.from({ length: 11 }, (_, i) => String(i + 2)),
  ...Array.from({ length: 32 }, (_, i) => String(i + 22)),
  ...Array.from({ length: 16 }, (_, i) => `A${i}`),
];

export function generateArduino(params: ProjectParameters): GeneratedCode {
  const M = buildModel(params);
  const boolPlaces = M.places.filter((p) => p.bool);
  const needed = M.inputs.length + boolPlaces.length;
  const board = needed <= UNO_PINS.length ? "Arduino Uno/Nano" : "Arduino Mega";
  const pool = needed <= UNO_PINS.length ? UNO_PINS : MEGA_PINS;
  const pinOf = new Map<string, string>();
  [...M.inputs, ...boolPlaces.map((p) => `LED_${p.name}`)].forEach((n, i) => pinOf.set(n, pool[i] ?? "/* sem pino */ 0"));
  const placeNames = new Set(M.places.map((p) => p.name));
  const guardCpp = (g: string) => translateGuard(g, "cpp", (w) => (placeNames.has(w) ? w : undefined));

  const cond = (t: Transition, id: string) =>
    M.isBool(id) ? M.name(id) : `${M.name(id)} >= ${weight(t.inputWeights, id)}`;
  const enabling = (t: Transition) => {
    const parts = [
      ...t.inputs.map((id) => cond(t, id)),
      ...(t.inhibitors ?? []).map((id) => (M.isBool(id) ? `!${M.name(id)}` : `${M.name(id)} == 0`)),
    ];
    return parts.length ? parts.join(" && ") : "true";
  };

  const d: string[] = [
    "// Código gerado automaticamente a partir da Rede de Petri — Arduino (C++)",
    `// Placa sugerida: ${board} (${needed} pinos digitais usados).`,
    "// Entradas: um botão/sensor por condição externa, ligado entre o pino e o GND (INPUT_PULLUP).",
    "// Saídas: um LED por lugar BOOL (com resistor de ~220 Ω). Lugares INT aparecem no Monitor Serial.",
    "// Pelo Monitor Serial (9600 baud) também é possível acionar uma condição digitando o nome dela.",
    "",
    "// true: a condição vale apenas no ciclo em que o botão é pressionado (pulso de um ciclo,",
    "// como no teste do CODESYS). false: vale enquanto o botão estiver pressionado.",
    "const bool USAR_BORDA = true;",
    "",
  ];
  if (M.inputs.length) {
    d.push("// Pinos das condições externas (entradas)");
    M.inputs.forEach((n) => d.push(`const uint8_t PIN_${n} = ${pinOf.get(n)};`));
    d.push("");
  }
  if (boolPlaces.length) {
    d.push("// Pinos dos LEDs dos lugares BOOL (saídas)");
    boolPlaces.forEach((p) => d.push(`const uint8_t LED_${p.name} = ${pinOf.get(`LED_${p.name}`)};`));
    d.push("");
  }
  d.push("// Lugares da Rede de Petri");
  M.places.forEach((p) =>
    d.push(
      p.bool
        ? `bool ${p.name} = ${p.initial > 0 ? "true" : "false"}; // P${p.index}`
        : `int ${p.name} = ${p.initial}; // P${p.index} - ${p.note}`,
    ),
  );
  if (M.inputs.length) {
    d.push("", "// Condições externas: valor no ciclo atual e leitura anterior (para a borda)");
    M.inputs.forEach((n) => d.push(`bool ${n} = false;\nbool ${n}_ant = false;`));
  }
  d.push("", "// Habilitação das transições no ciclo atual");
  M.transitions.forEach((x) => d.push(`bool ${x.flag} = false; // T${x.index}`));

  const s: string[] = [];
  s.push("", "void imprimirMarcacao() {");
  M.places.forEach((p, i) =>
    s.push(
      `  Serial.print(F("${i === 0 ? "" : " "}${p.name}=")); Serial.print(${p.bool ? `${p.name} ? 1 : 0` : p.name});`,
    ),
  );
  s.push("  Serial.println();", "}");

  s.push("", "void lerEntradas() {");
  if (M.inputs.length) {
    s.push("  String comando = \"\";", "  if (Serial.available()) { comando = Serial.readStringUntil('\\n'); comando.trim(); }");
    M.inputs.forEach((n) =>
      s.push(
        `  { bool v = digitalRead(PIN_${n}) == LOW; ${n} = (USAR_BORDA ? (v && !${n}_ant) : v) || comando == "${n}"; ${n}_ant = v; }`,
      ),
    );
  }
  s.push("}");

  s.push("", "void atualizarLeds() {");
  boolPlaces.forEach((p) => s.push(`  digitalWrite(LED_${p.name}, ${p.name} ? HIGH : LOW);`));
  s.push("}");

  s.push("", "void setup() {", "  Serial.begin(9600);");
  M.inputs.forEach((n) => s.push(`  pinMode(PIN_${n}, INPUT_PULLUP);`));
  boolPlaces.forEach((p) => s.push(`  pinMode(LED_${p.name}, OUTPUT);`));
  s.push("  atualizarLeds();", "  imprimirMarcacao();", "}");

  s.push("", "void loop() {", "  lerEntradas();", "", "  // 1) Habilitação: avaliada com a marcação do início do ciclo");
  M.transitions.forEach((x) =>
    s.push(
      `  ${x.flag} = ${enabling(x.t)}${x.guard ? ` && (${guardCpp(x.guard)})` : ""}; // T${x.index} - ${x.t.name}`,
    ),
  );
  s.push("", "  // 2) Disparo: uma vez por ciclo, conferindo se os tokens ainda estão disponíveis", "  bool mudou = false;");
  M.transitions.forEach(({ t, index, flag }) => {
    const recheck = t.inputs.length || t.inhibitors?.length ? ` && ${enabling(t)}` : "";
    s.push(`  // T${index} - ${t.name}`, `  if (${flag}${recheck}) {`);
    t.inputs.forEach((id) =>
      s.push(M.isBool(id) ? `    ${M.name(id)} = false;` : `    ${M.name(id)} -= ${weight(t.inputWeights, id)};`),
    );
    t.outputs.forEach((id) =>
      s.push(M.isBool(id) ? `    ${M.name(id)} = true;` : `    ${M.name(id)} += ${weight(t.outputWeights, id)};`),
    );
    s.push(`    Serial.println(F("Disparou T${index} - ${t.name}"));`, "    mudou = true;", "  }");
  });
  s.push("", "  if (mudou) imprimirMarcacao();", "  atualizarLeds();", "}");

  const declaration = d.join("\n");
  const implementation = s.join("\n").trim();
  return {
    target: "arduino",
    declaration,
    implementation,
    full: `${declaration}\n\n${implementation}\n`,
    inputs: M.inputs,
  };
}

/* ------------------------------------------------------------------ */
/* Python                                                              */
/* ------------------------------------------------------------------ */

export function generatePython(params: ProjectParameters): GeneratedCode {
  const M = buildModel(params);
  const placeNames = new Set(M.places.map((p) => p.name));
  const ref = (id: string) => `self.${M.name(id)}`;
  const guardPy = (g: string) => translateGuard(g, "python", (w) => (placeNames.has(w) ? `self.${w}` : undefined));
  const cond = (t: Transition, id: string) =>
    M.isBool(id) ? ref(id) : `${ref(id)} >= ${weight(t.inputWeights, id)}`;
  const enabling = (t: Transition) => {
    const parts = [
      ...t.inputs.map((id) => cond(t, id)),
      ...(t.inhibitors ?? []).map((id) => (M.isBool(id) ? `not ${ref(id)}` : `${ref(id)} == 0`)),
    ];
    return parts.length ? parts.join(" and ") : "True";
  };
  const tuple = (xs: string[]) => (xs.length ? `(${xs.map((x) => `"${x}"`).join(", ")}${xs.length === 1 ? "," : ""})` : "()");

  const d: string[] = [
    '"""Código gerado automaticamente a partir da Rede de Petri — Python 3.',
    "",
    "Uso como módulo:",
    "    rede = RedePetri()",
    `    rede.ciclo(${M.inputs[0] ? `${M.inputs[0]}=True` : ""})   # um ciclo de varredura; condições omitidas valem False`,
    "    print(rede.marcacao())",
    "",
    "Uso interativo: python <arquivo>.py e digite o nome das condições a acionar em cada ciclo.",
    '"""',
    "",
    "",
    "class RedePetri:",
    `    LUGARES = ${tuple(M.places.map((p) => p.name))}`,
    `    ENTRADAS = ${tuple(M.inputs)}`,
    "",
    "    def __init__(self):",
    "        self.reiniciar()",
    "",
    "    def reiniciar(self):",
    '        """Restaura a marcação inicial."""',
  ];
  M.places.forEach((p) =>
    d.push(
      p.bool
        ? `        self.${p.name} = ${p.initial > 0 ? "True" : "False"}  # P${p.index}`
        : `        self.${p.name} = ${p.initial}  # P${p.index} - ${p.note}`,
    ),
  );
  if (!M.places.length) d.push("        pass");
  d.push("", "    def marcacao(self):", "        return {nome: getattr(self, nome) for nome in self.LUGARES}");

  const s: string[] = [
    "    def ciclo(self, **entradas):",
    '        """Executa um ciclo de varredura e devolve as transições disparadas."""',
    "        desconhecidas = set(entradas) - set(self.ENTRADAS)",
    "        if desconhecidas:",
    '            raise ValueError(f"Condições desconhecidas: {sorted(desconhecidas)}")',
  ];
  M.inputs.forEach((n) => s.push(`        ${n} = bool(entradas.get("${n}", False))`));
  s.push("", "        # 1) Habilitação: avaliada com a marcação do início do ciclo");
  M.transitions.forEach((x) =>
    s.push(
      `        ${x.flag} = ${enabling(x.t)}${x.guard ? ` and (${guardPy(x.guard)})` : ""}  # T${x.index} - ${x.t.name}`,
    ),
  );
  s.push("", "        # 2) Disparo: uma vez por ciclo, conferindo se os tokens ainda estão disponíveis", "        disparadas = []");
  M.transitions.forEach(({ t, index, flag }) => {
    const recheck = t.inputs.length || t.inhibitors?.length ? ` and ${enabling(t)}` : "";
    s.push(`        # T${index} - ${t.name}`, `        if ${flag}${recheck}:`);
    t.inputs.forEach((id) =>
      s.push(M.isBool(id) ? `            ${ref(id)} = False` : `            ${ref(id)} -= ${weight(t.inputWeights, id)}`),
    );
    t.outputs.forEach((id) =>
      s.push(M.isBool(id) ? `            ${ref(id)} = True` : `            ${ref(id)} += ${weight(t.outputWeights, id)}`),
    );
    s.push(`            disparadas.append("T${index} ${t.name}")`);
  });
  s.push(
    "        return disparadas",
    "",
    "",
    "def _formatar(marcacao):",
    '    return " ".join(f"{k}={int(v) if isinstance(v, bool) else v}" for k, v in marcacao.items())',
    "",
    "",
    'if __name__ == "__main__":',
    "    rede = RedePetri()",
    '    print("Marcação inicial:", _formatar(rede.marcacao()))',
    '    print("Condições:", ", ".join(rede.ENTRADAS) or "(nenhuma)")',
    '    print("Digite as condições do ciclo separadas por espaço "',
    "          \"(ENTER = ciclo sem condições, 'reset' = marcação inicial, 'sair' = encerrar).\")",
    "    while True:",
    "        try:",
    '            linha = input("> ").strip()',
    "        except EOFError:",
    "            break",
    '        if linha == "sair":',
    "            break",
    '        if linha == "reset":',
    "            rede.reiniciar()",
    '            print("Marcação:", _formatar(rede.marcacao()))',
    "            continue",
    "        try:",
    "            disparadas = rede.ciclo(**{nome: True for nome in linha.split()})",
    "        except ValueError as erro:",
    "            print(erro)",
    "            continue",
    '        print("Disparadas:", ", ".join(disparadas) or "nenhuma")',
    '        print("Marcação:", _formatar(rede.marcacao()))',
  );

  const declaration = d.join("\n");
  const implementation = s.join("\n");
  return {
    target: "python",
    declaration,
    implementation,
    full: `${declaration}\n\n${implementation}\n`,
    inputs: M.inputs,
  };
}

export function generateCode(params: ProjectParameters, target: CodeTarget): GeneratedCode {
  if (target === "arduino") return generateArduino(params);
  if (target === "python") return generatePython(params);
  return generateST(params);
}
