import type { InvokeDef, StateNodeDef } from "@stategraph/core";
import {
  buildGraph,
  computeInitialLeaves,
  configKey,
  enterLeaves,
  isDescendantOrSelf,
  type IrGraph,
  type ResolvedTransition,
} from "./graph";
import type {
  ModelCheckConfig,
  ModelCheckDiagnostic,
  ModelCheckInput,
  ModelCheckResult,
} from "./types";

// ---------------------------------------------------------------------------
// Default config (ADR-006)
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Readonly<ModelCheckConfig> = {
  checks: {
    unreachableStates: true,
    deadStates: true,
    deadTransitions: true,
    invalidTargets: true,
    nondeterminism: true,
    missingInitial: true,
    effectsWithoutCancel: false,
  },
};

const DEFAULT_BOUNDED = {
  enabled: false,
  maxPathDepth: 100,
  maxStatesExplored: 10_000,
  maxTransitions: 100_000,
  maxCycleLength: 20,
  timeoutMs: 5_000,
} as const;

export function mergeConfig(partial?: Partial<ModelCheckConfig>): ModelCheckConfig {
  if (!partial) return DEFAULT_CONFIG;
  return {
    checks: { ...DEFAULT_CONFIG.checks, ...partial.checks },
    ...(partial.bounded ? { bounded: { ...DEFAULT_BOUNDED, ...partial.bounded } } : {}),
  };
}

// ---------------------------------------------------------------------------
// Input normalization
// ---------------------------------------------------------------------------

// Minimal structural type — matches StateGraphMachine.registry without importing MachineRegistry
type NodeRecord = { def: StateNodeDef };
type RegistryLike = { nodes: Map<string, NodeRecord> };

function normalizeInput(input: ModelCheckInput): {
  graph: IrGraph;
  registry: RegistryLike | null;
} {
  const ir = "toIR" in input ? input.toIR() : input;

  let registry: RegistryLike | null = null;
  if ("registry" in input && input.registry != null) {
    const candidate = input.registry as Record<string, unknown>;
    if (candidate["nodes"] instanceof Map) {
      registry = candidate as unknown as RegistryLike;
    }
  }

  return { graph: buildGraph(ir), registry };
}

// ---------------------------------------------------------------------------
// Tier 1 — Structural checks
// ---------------------------------------------------------------------------

function checkInvalidTargets(graph: IrGraph): ModelCheckDiagnostic[] {
  const diagnostics: ModelCheckDiagnostic[] = [];
  for (const t of graph.resolved) {
    if (t.resolvedTarget === undefined) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_TARGET",
        message: `Transition from "${t.source}" on "${t.event}" has an unresolvable target "${t.target ?? ""}".`,
        transitionSource: t.source,
        transitionEvent: t.event,
      });
    }
  }
  return diagnostics;
}

function checkMissingInitial(graph: IrGraph): ModelCheckDiagnostic[] {
  const diagnostics: ModelCheckDiagnostic[] = [];
  for (const state of graph.ir.states) {
    if (state.type !== "compound") continue;
    if (!state.initial) {
      diagnostics.push({
        severity: "error",
        code: "MISSING_INITIAL",
        message: `Compound state "${state.id}" has no "initial" declaration.`,
        stateId: state.id,
      });
      continue;
    }
    const childIds = graph.children.get(state.id) ?? [];
    const hasInitialChild = childIds.some(
      (cId) => graph.stateById.get(cId)?.key === state.initial,
    );
    if (!hasInitialChild) {
      diagnostics.push({
        severity: "error",
        code: "MISSING_INITIAL",
        message: `Compound state "${state.id}" declares initial "${state.initial}" but no such child exists.`,
        stateId: state.id,
      });
    }
  }
  return diagnostics;
}

function checkUnreachableStates(graph: IrGraph): ModelCheckDiagnostic[] {
  const reachable = new Set<string>();
  const queue: string[] = [];

  function enter(stateId: string): void {
    if (reachable.has(stateId)) return;
    reachable.add(stateId);
    const state = graph.stateById.get(stateId);
    if (!state) return;
    if (state.type === "parallel") {
      for (const childId of graph.children.get(stateId) ?? []) enter(childId);
    } else if (state.type === "compound" && state.initial) {
      const initialChild = (graph.children.get(stateId) ?? []).find(
        (cId) => graph.stateById.get(cId)?.key === state.initial,
      );
      if (initialChild) enter(initialChild);
    }
    queue.push(stateId);
  }

  enter(graph.rootId);

  while (queue.length > 0) {
    const stateId = queue.shift()!;
    for (const t of graph.bySource.get(stateId) ?? []) {
      if (t.resolvedTarget != null) enter(t.resolvedTarget);
    }
  }

  const diagnostics: ModelCheckDiagnostic[] = [];
  for (const state of graph.ir.states) {
    if (state.parent === null) continue;
    if (!reachable.has(state.id)) {
      diagnostics.push({
        severity: "error",
        code: "UNREACHABLE_STATE",
        message: `State "${state.id}" is unreachable from the initial configuration.`,
        stateId: state.id,
      });
    }
  }
  return diagnostics;
}

function checkDeadStates(graph: IrGraph): ModelCheckDiagnostic[] {
  const diagnostics: ModelCheckDiagnostic[] = [];
  for (const state of graph.ir.states) {
    if (state.type !== "atomic") continue;
    // "final" type is not "atomic" (normalizeType in machine.ts distinguishes them),
    // so only genuinely atomic (non-final) states pass the check above.
    const outgoing = graph.bySource.get(state.id) ?? [];
    if (outgoing.length === 0) {
      diagnostics.push({
        severity: "error",
        code: "DEAD_STATE",
        message: `Non-final state "${state.id}" has no outgoing transitions and cannot be exited.`,
        stateId: state.id,
      });
    }
  }
  return diagnostics;
}

function checkDeadTransitions(graph: IrGraph): ModelCheckDiagnostic[] {
  const diagnostics: ModelCheckDiagnostic[] = [];
  for (const [, transitions] of graph.bySourceEvent) {
    let foundUnguarded = false;
    for (const t of transitions) {
      if (foundUnguarded) {
        diagnostics.push({
          severity: "error",
          code: "DEAD_TRANSITION",
          message: `Transition from "${t.source}" on "${t.event}" is dead — superseded by a prior unguarded transition.`,
          transitionSource: t.source,
          transitionEvent: t.event,
        });
      }
      if (t.guard === null) foundUnguarded = true;
    }
  }
  return diagnostics;
}

function checkNondeterminism(graph: IrGraph): ModelCheckDiagnostic[] {
  const diagnostics: ModelCheckDiagnostic[] = [];
  for (const [key, transitions] of graph.bySourceEvent) {
    const unguardedCount = transitions.filter((t) => t.guard === null).length;
    if (unguardedCount >= 2) {
      const sep = key.indexOf("\0");
      const source = key.slice(0, sep);
      const event = key.slice(sep + 1);
      diagnostics.push({
        severity: "error",
        code: "NONDETERMINISTIC_TRANSITION",
        message: `${unguardedCount} unguarded transitions from "${source}" on "${event}" — only the first can ever fire.`,
        transitionSource: source,
        transitionEvent: event,
      });
    }
  }
  return diagnostics;
}

function checkEffectsWithoutCancel(registry: RegistryLike | null): ModelCheckDiagnostic[] {
  if (!registry) return [];
  const diagnostics: ModelCheckDiagnostic[] = [];
  for (const [stateId, record] of registry.nodes) {
    const raw = record.def.invoke;
    const invokes: InvokeDef[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const invoke of invokes) {
      if (!invoke.onDone && !invoke.onError) {
        diagnostics.push({
          severity: "warning",
          code: "EFFECT_WITHOUT_CANCEL",
          message: `State "${stateId}" invokes "${invoke.src}" with no onDone or onError — the result is silently ignored.`,
          stateId,
        });
      }
    }
  }
  return diagnostics;
}

// ---------------------------------------------------------------------------
// Tier 2 — Bounded BFS
// ---------------------------------------------------------------------------

interface BoundedOpts {
  maxPathDepth: number;
  maxStatesExplored: number;
  maxTransitions: number;
  timeoutMs: number;
}

interface BoundedResult {
  hitLimit: boolean;
  statesExplored: number;
  transitionsExplored: number;
}

function runBoundedBFS(graph: IrGraph, opts: BoundedOpts): BoundedResult {
  const start = Date.now();
  let hitLimit = false;
  let transitionsExplored = 0;

  const initialLeaves = computeInitialLeaves(graph);
  const initialKey = configKey(initialLeaves);

  const visited = new Map<string, number>(); // key → depth
  visited.set(initialKey, 0);

  interface BfsNode {
    leaves: ReadonlySet<string>;
    depth: number;
  }

  const queue: BfsNode[] = [{ leaves: initialLeaves, depth: 0 }];

  outer: while (queue.length > 0) {
    if (Date.now() - start >= opts.timeoutMs) {
      hitLimit = true;
      break;
    }

    const node = queue.shift()!;

    if (node.depth >= opts.maxPathDepth) {
      hitLimit = true;
      continue;
    }

    for (const t of getEnabledTransitions(node.leaves, graph)) {
      transitionsExplored++;
      if (transitionsExplored >= opts.maxTransitions) {
        hitLimit = true;
        break outer;
      }

      if (t.resolvedTarget == null) continue;

      const newLeaves = applyTransition(node.leaves, t.source, t.resolvedTarget, graph);
      const newKey = configKey(newLeaves);

      if (!visited.has(newKey)) {
        if (visited.size >= opts.maxStatesExplored) {
          hitLimit = true;
          break outer;
        }
        visited.set(newKey, node.depth + 1);
        queue.push({ leaves: newLeaves, depth: node.depth + 1 });
      }
    }
  }

  return { hitLimit, statesExplored: visited.size, transitionsExplored };
}

function getEnabledTransitions(
  leaves: ReadonlySet<string>,
  graph: IrGraph,
): ResolvedTransition[] {
  const active = new Set<string>(leaves);
  for (const leaf of leaves) {
    let cur = graph.stateById.get(leaf)?.parent ?? null;
    while (cur !== null) {
      active.add(cur);
      cur = graph.stateById.get(cur)?.parent ?? null;
    }
  }
  const enabled: ResolvedTransition[] = [];
  for (const stateId of active) {
    for (const t of graph.bySource.get(stateId) ?? []) {
      enabled.push(t);
    }
  }
  return enabled;
}

function applyTransition(
  leaves: ReadonlySet<string>,
  sourceId: string,
  targetId: string,
  graph: IrGraph,
): Set<string> {
  const newLeaves = new Set<string>(leaves);
  for (const leaf of leaves) {
    if (isDescendantOrSelf(leaf, sourceId, graph)) {
      newLeaves.delete(leaf);
    }
  }
  enterLeaves(targetId, graph, newLeaves);
  return newLeaves;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function check(
  input: ModelCheckInput,
  partialConfig?: Partial<ModelCheckConfig>,
): ModelCheckResult {
  const config = mergeConfig(partialConfig);
  const startMs = Date.now();

  const { graph, registry } = normalizeInput(input);

  const diagnostics: ModelCheckDiagnostic[] = [];

  if (config.checks.invalidTargets) diagnostics.push(...checkInvalidTargets(graph));
  if (config.checks.missingInitial) diagnostics.push(...checkMissingInitial(graph));
  if (config.checks.unreachableStates) diagnostics.push(...checkUnreachableStates(graph));
  if (config.checks.deadStates) diagnostics.push(...checkDeadStates(graph));
  if (config.checks.deadTransitions) diagnostics.push(...checkDeadTransitions(graph));
  if (config.checks.nondeterminism) diagnostics.push(...checkNondeterminism(graph));
  if (config.checks.effectsWithoutCancel) diagnostics.push(...checkEffectsWithoutCancel(registry));

  let bounded = false;
  let hitLimit = false;
  let boundedStates = 0;
  let boundedTransitions = 0;

  const boundedCfg = config.bounded;
  if (boundedCfg?.enabled) {
    bounded = true;
    const result = runBoundedBFS(graph, boundedCfg);
    hitLimit = result.hitLimit;
    boundedStates = result.statesExplored;
    boundedTransitions = result.transitionsExplored;
  }

  return {
    passed: diagnostics.every((d) => d.severity !== "error"),
    diagnostics,
    stats: {
      statesAnalyzed: bounded ? boundedStates : graph.ir.states.length,
      transitionsAnalyzed: bounded ? boundedTransitions : graph.ir.transitions.length,
      durationMs: Date.now() - startMs,
      bounded,
      hitLimit,
    },
  };
}
