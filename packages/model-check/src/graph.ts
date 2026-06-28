import type { MachineIR } from "@stategraph/core";

export type IrState = MachineIR["states"][number];
export type IrTransition = MachineIR["transitions"][number];

export interface ResolvedTransition extends IrTransition {
  // null  → targetless (intentional self); undefined → invalid (cannot resolve)
  resolvedTarget: string | null | undefined;
}

export interface IrGraph {
  ir: MachineIR;
  rootId: string;
  stateIds: Set<string>;
  stateById: Map<string, IrState>;
  children: Map<string, string[]>;
  // All transitions with resolved targets, preserving IR order
  resolved: ResolvedTransition[];
  // source → transitions (in IR order)
  bySource: Map<string, ResolvedTransition[]>;
  // `${source}\0${event}` → transitions (in IR order)
  bySourceEvent: Map<string, ResolvedTransition[]>;
}

export function buildGraph(ir: MachineIR): IrGraph {
  const stateIds = new Set(ir.states.map((s) => s.id));
  const stateById = new Map(ir.states.map((s) => [s.id, s]));

  const root = ir.states.find((s) => s.parent === null);
  const rootId = root?.id ?? ir.id;

  const children = new Map<string, string[]>();
  for (const s of ir.states) {
    if (s.parent !== null) {
      const list = children.get(s.parent) ?? [];
      list.push(s.id);
      children.set(s.parent, list);
    }
  }

  const resolved: ResolvedTransition[] = [];
  const bySource = new Map<string, ResolvedTransition[]>();
  const bySourceEvent = new Map<string, ResolvedTransition[]>();

  for (const t of ir.transitions) {
    const rt: ResolvedTransition = {
      ...t,
      resolvedTarget: resolveTarget(t.source, t.target, stateIds, rootId),
    };
    resolved.push(rt);

    const srcList = bySource.get(t.source) ?? [];
    srcList.push(rt);
    bySource.set(t.source, srcList);

    const seKey = `${t.source}\0${t.event}`;
    const seList = bySourceEvent.get(seKey) ?? [];
    seList.push(rt);
    bySourceEvent.set(seKey, seList);
  }

  return { ir, rootId, stateIds, stateById, children, resolved, bySource, bySourceEvent };
}

// ---------------------------------------------------------------------------
// Target resolution — mirrors machine.ts resolveTarget logic
// ---------------------------------------------------------------------------

export function resolveTarget(
  sourceId: string,
  rawTarget: string | null,
  stateIds: Set<string>,
  rootId: string,
): string | null | undefined {
  if (rawTarget === null) return null; // targetless transition

  if (stateIds.has(rawTarget)) return rawTarget;

  const lastDot = sourceId.lastIndexOf(".");
  if (lastDot > -1) {
    const sibling = `${sourceId.slice(0, lastDot)}.${rawTarget}`;
    if (stateIds.has(sibling)) return sibling;
  }

  const rootChild = `${rootId}.${rawTarget}`;
  if (stateIds.has(rootChild)) return rootChild;

  return undefined; // unresolvable
}

// ---------------------------------------------------------------------------
// Reachability helpers
// ---------------------------------------------------------------------------

export function computeInitialLeaves(graph: IrGraph): Set<string> {
  const leaves = new Set<string>();
  enterLeaves(graph.rootId, graph, leaves);
  return leaves;
}

export function enterLeaves(stateId: string, graph: IrGraph, out: Set<string>): void {
  const state = graph.stateById.get(stateId);
  if (!state) return;
  if (state.type === "atomic" || state.type === "final" || state.type === "history") {
    out.add(stateId);
    return;
  }
  if (state.type === "parallel") {
    for (const childId of graph.children.get(stateId) ?? []) {
      enterLeaves(childId, graph, out);
    }
    return;
  }
  if (state.type === "compound" && state.initial) {
    const initialChild = (graph.children.get(stateId) ?? []).find(
      (cId) => graph.stateById.get(cId)?.key === state.initial,
    );
    if (initialChild) enterLeaves(initialChild, graph, out);
  }
}

export function isDescendantOrSelf(stateId: string, ancestorId: string, graph: IrGraph): boolean {
  let cur: string | null = stateId;
  while (cur !== null) {
    if (cur === ancestorId) return true;
    cur = graph.stateById.get(cur)?.parent ?? null;
  }
  return false;
}

export function configKey(leaves: ReadonlySet<string>): string {
  return [...leaves].sort().join("|");
}
