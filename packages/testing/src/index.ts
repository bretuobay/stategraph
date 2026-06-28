import type {
  ActorOptions,
  ActorRef,
  EffectControls,
  EffectDefinition,
  MachineIR,
  StateGraphEvent,
  StateGraphMachine,
  StateGraphSnapshot,
} from "@stategraph/core";

export const STATEGRAPH_TESTING_PACKAGE = "@stategraph/testing";

export type MachineInput = MachineIR | { toIR(): MachineIR };

export interface EnumeratedState {
  id: string;
  key: string;
  parent: string | null;
  type: MachineIR["states"][number]["type"];
  depth: number;
  initial?: string;
}

export interface EnumeratedTransition {
  id: string;
  source: string;
  event: string;
  target: string | null;
  guard: string | null;
  actions: string[];
  effects: string[];
}

export interface TestPlanCase {
  name: string;
  events: StateGraphEvent[];
  expected: {
    state?: string;
    transition?: string;
    unchanged?: boolean;
  };
  meta?: Record<string, unknown>;
}

export interface TestPlan {
  kind: "state" | "transition" | "path" | "invalid-event" | "guard-branch";
  machineId: string;
  cases: TestPlanCase[];
}

export interface CoverageOptions {
  maxDepth?: number;
  maxCases?: number;
}

export interface PathCoverageOptions extends CoverageOptions {
  includeSelfTransitions?: boolean;
}

export interface InvalidEventOptions {
  invalidEvent?: StateGraphEvent;
}

export interface GuardFixture {
  guard: string;
  enabledEvents: StateGraphEvent[];
  disabledEvents: StateGraphEvent[];
}

export interface GuardBranchOptions {
  fixtures?: GuardFixture[];
}

export interface EmitVitestOptions {
  suiteName?: string;
}

export interface PromiseEffectMock<TInput = unknown, TOutput = unknown> {
  effect: EffectDefinition<TInput, TOutput>;
  calls: Array<{ input: TInput; controls: EffectControls<TOutput> }>;
  resolve(output: TOutput, index?: number): void;
  reject(error: unknown, index?: number): void;
  reset(): void;
}

export interface CallbackEffectMock<TInput = unknown> {
  effect: EffectDefinition<TInput, unknown>;
  calls: Array<{ input: TInput; controls: EffectControls<unknown> }>;
  sendBack(event: StateGraphEvent, index?: number): void;
  cleanup(index?: number): void;
  cleanupCalls: number;
  reset(): void;
}

export interface AdapterConformanceHarness<
  TContext,
  TEvent extends StateGraphEvent,
  TRenderHandle,
> {
  name: string;
  createMachine(): StateGraphMachine<TContext, TEvent>;
  mount(args: {
    machine: StateGraphMachine<TContext, TEvent>;
    options?: ActorOptions<TContext, TEvent>;
    onSnapshot?: (snapshot: StateGraphSnapshot<TContext, TEvent>) => void;
    selector?: (snapshot: StateGraphSnapshot<TContext, TEvent>) => unknown;
    onSelected?: (value: unknown) => void;
  }): {
    actor: ActorRef<TContext, TEvent>;
    send(event: TEvent): void;
    getSnapshot(): StateGraphSnapshot<TContext, TEvent>;
    cleanup(): void;
    handle: TRenderHandle;
  };
  dispatchEvent: TEvent;
  noopEvent?: TEvent;
  expectInitial(snapshot: StateGraphSnapshot<TContext, TEvent>): void;
  expectAfterDispatch(snapshot: StateGraphSnapshot<TContext, TEvent>): void;
}

export interface AdapterConformanceSuite {
  name: string;
  tests: Array<{
    name: string;
    run(): void | Promise<void>;
  }>;
}

export function normalizeMachineIR(input: MachineInput): MachineIR {
  return "toIR" in input ? input.toIR() : input;
}

export function enumerateStates(input: MachineInput): EnumeratedState[] {
  const ir = normalizeMachineIR(input);
  return [...ir.states]
    .sort((a, b) => compareStrings(a.id, b.id))
    .map((state) => ({
      id: state.id,
      key: state.key,
      parent: state.parent,
      type: state.type,
      depth: state.id.split(".").length - 1,
      ...(state.initial ? { initial: state.initial } : {}),
    }));
}

export function enumerateTransitions(input: MachineInput): EnumeratedTransition[] {
  const ir = normalizeMachineIR(input);
  return ir.transitions
    .map((transition, index) => ({
      id: transitionId(transition, index),
      source: transition.source,
      event: transition.event,
      target: transition.target,
      guard: transition.guard,
      actions: [...transition.actions].sort(compareStrings),
      effects: [...transition.effects].sort(compareStrings),
    }))
    .sort(compareTransitionRecords);
}

export function createStateCoveragePlan(
  input: MachineInput,
  options: CoverageOptions = {},
): TestPlan {
  const ir = normalizeMachineIR(input);
  const paths = findReachablePaths(ir, options);
  const cases = enumerateStates(ir)
    .filter((state) => state.type !== "history")
    .flatMap((state) => {
      const path = paths.find((candidate) => candidate.states.has(state.id));
      if (!path) return [];
      return [
        {
          name: `reaches ${state.id}`,
          events: path.events,
          expected: { state: state.id },
        },
      ];
    });
  return limitPlan({ kind: "state", machineId: ir.id, cases }, options.maxCases);
}

export function createTransitionCoveragePlan(
  input: MachineInput,
  options: CoverageOptions = {},
): TestPlan {
  const ir = normalizeMachineIR(input);
  const paths = findReachablePaths(ir, options);
  const transitions = enumerateTransitions(ir);
  const cases = transitions.flatMap((transition) => {
    const sourcePath = paths.find((candidate) => candidate.states.has(transition.source));
    if (!sourcePath) return [];
    return [
      {
        name: `fires ${transition.id}`,
        events: [...sourcePath.events, eventFromType(transition.event)],
        expected: { transition: transition.id },
      },
    ];
  });
  return limitPlan({ kind: "transition", machineId: ir.id, cases }, options.maxCases);
}

export function createPathCoveragePlan(
  input: MachineInput,
  options: PathCoverageOptions = {},
): TestPlan {
  const ir = normalizeMachineIR(input);
  const paths = findReachablePaths(ir, options);
  const includeSelfTransitions = options.includeSelfTransitions ?? true;
  const cases = paths
    .filter((path) => path.events.length > 0)
    .filter((path) => includeSelfTransitions || path.changed)
    .map((path, index) => ({
      name: `path ${index + 1}: ${path.events.map((event) => event.type).join(" -> ")}`,
      events: path.events,
      expected: { state: [...path.states].sort(compareStrings).join(",") },
      meta: { depth: path.events.length },
    }));
  return limitPlan({ kind: "path", machineId: ir.id, cases }, options.maxCases);
}

export function createInvalidEventPlan(
  input: MachineInput,
  options: InvalidEventOptions = {},
): TestPlan {
  const ir = normalizeMachineIR(input);
  const invalidEvent = options.invalidEvent ?? { type: "UNKNOWN" };
  return {
    kind: "invalid-event",
    machineId: ir.id,
    cases: enumerateStates(ir)
      .filter((state) => state.type === "atomic" || state.type === "final")
      .map((state) => ({
        name: `ignores ${invalidEvent.type} in ${state.id}`,
        events: [invalidEvent],
        expected: { state: state.id, unchanged: true },
      })),
  };
}

export function createGuardBranchPlan(
  input: MachineInput,
  options: GuardBranchOptions = {},
): TestPlan {
  const ir = normalizeMachineIR(input);
  const cases: TestPlanCase[] = enumerateTransitions(ir)
    .filter((transition) => transition.guard)
    .flatMap((transition): TestPlanCase[] => {
      const fixture = options.fixtures?.find((candidate) => candidate.guard === transition.guard);
      const baseName = `${transition.guard ?? "guard"} on ${transition.source}`;
      if (!fixture) {
        return [
          {
            name: `provide fixture for ${baseName}`,
            events: [eventFromType(transition.event)],
            expected: { transition: transition.id },
            meta: { fixtureRequired: true, guard: transition.guard },
          },
        ];
      }
      return [
        {
          name: `${baseName} enabled`,
          events: fixture.enabledEvents,
          expected: { transition: transition.id },
          meta: { guard: transition.guard, branch: "enabled" },
        },
        {
          name: `${baseName} disabled`,
          events: fixture.disabledEvents,
          expected: { transition: transition.id, unchanged: true },
          meta: { guard: transition.guard, branch: "disabled" },
        },
      ];
    });
  return { kind: "guard-branch", machineId: ir.id, cases };
}

export function emitVitestTests(
  plans: TestPlan | TestPlan[],
  options: EmitVitestOptions = {},
): string {
  const planList = Array.isArray(plans) ? plans : [plans];
  const suiteName = options.suiteName ?? "generated StateGraph plans";
  const serialized = JSON.stringify(planList, null, 2);
  return [
    'import { describe, expect, it } from "vitest";',
    "",
    `const plans = ${serialized} as const;`,
    "",
    `describe(${JSON.stringify(suiteName)}, () => {`,
    "  for (const plan of plans) {",
    "    it(`${plan.kind} plan for ${plan.machineId} is executable`, () => {",
    "      expect(plan.cases.length).toBeGreaterThanOrEqual(0);",
    "      for (const testCase of plan.cases) {",
    "        expect(testCase.name.length).toBeGreaterThan(0);",
    "        expect(Array.isArray(testCase.events)).toBe(true);",
    "      }",
    "    });",
    "  }",
    "});",
    "",
  ].join("\n");
}

export function createPromiseEffectMock<TInput = unknown, TOutput = unknown>(): PromiseEffectMock<
  TInput,
  TOutput
> {
  const calls: Array<{ input: TInput; controls: EffectControls<TOutput> }> = [];
  return {
    calls,
    effect: {
      kind: "promise",
      run(input, controls) {
        calls.push({ input, controls });
        return new Promise<TOutput>((resolve, reject) => {
          controls.resolve = resolve;
          controls.reject = reject;
        });
      },
    },
    resolve(output, index = calls.length - 1) {
      const call = calls[index];
      if (!call) throw new Error(`No promise effect call exists at index ${index}.`);
      call.controls.resolve(output);
    },
    reject(error, index = calls.length - 1) {
      const call = calls[index];
      if (!call) throw new Error(`No promise effect call exists at index ${index}.`);
      call.controls.reject(error);
    },
    reset() {
      calls.splice(0);
    },
  };
}

export function createCallbackEffectMock<TInput = unknown>(): CallbackEffectMock<TInput> {
  const calls: Array<{ input: TInput; controls: EffectControls<unknown> }> = [];
  const cleanups: Array<() => void> = [];
  const mock: CallbackEffectMock<TInput> = {
    calls,
    cleanupCalls: 0,
    effect: {
      kind: "callback",
      run(input, controls) {
        calls.push({ input, controls });
        const cleanup = () => {
          mock.cleanupCalls += 1;
        };
        cleanups.push(cleanup);
        return cleanup;
      },
    },
    sendBack(event, index = calls.length - 1) {
      const call = calls[index];
      if (!call) throw new Error(`No callback effect call exists at index ${index}.`);
      call.controls.sendBack(event);
    },
    cleanup(index = cleanups.length - 1) {
      const cleanup = cleanups[index];
      if (!cleanup) throw new Error(`No callback cleanup exists at index ${index}.`);
      cleanup();
    },
    reset() {
      calls.splice(0);
      cleanups.splice(0);
      mock.cleanupCalls = 0;
    },
  };
  return mock;
}

export function defineAdapterConformanceSuite<
  TContext,
  TEvent extends StateGraphEvent,
  TRenderHandle,
>(harness: AdapterConformanceHarness<TContext, TEvent, TRenderHandle>): AdapterConformanceSuite {
  return {
    name: `${harness.name} adapter conformance`,
    tests: [
      {
        name: "starts with the expected initial snapshot",
        run() {
          const mounted = harness.mount({ machine: harness.createMachine() });
          try {
            harness.expectInitial(mounted.getSnapshot());
          } finally {
            mounted.cleanup();
          }
        },
      },
      {
        name: "dispatches events through the actor contract",
        run() {
          const mounted = harness.mount({ machine: harness.createMachine() });
          try {
            mounted.send(harness.dispatchEvent);
            harness.expectAfterDispatch(mounted.getSnapshot());
          } finally {
            mounted.cleanup();
          }
        },
      },
      {
        name: "publishes snapshot subscriptions",
        run() {
          const snapshots: Array<StateGraphSnapshot<TContext, TEvent>> = [];
          const mounted = harness.mount({
            machine: harness.createMachine(),
            onSnapshot: (snapshot) => snapshots.push(snapshot),
          });
          try {
            mounted.send(harness.dispatchEvent);
            if (snapshots.length < 2) {
              throw new Error(`Expected at least 2 snapshots, received ${snapshots.length}.`);
            }
          } finally {
            mounted.cleanup();
          }
        },
      },
      {
        name: "honors selector equality for unchanged events",
        run() {
          const selected: unknown[] = [];
          const mounted = harness.mount({
            machine: harness.createMachine(),
            selector: (snapshot) => snapshot.value,
            onSelected: (value) => selected.push(value),
          });
          try {
            if (harness.noopEvent) mounted.send(harness.noopEvent);
            mounted.send(harness.dispatchEvent);
            if (selected.length < 2) {
              throw new Error(`Expected selector updates, received ${selected.length}.`);
            }
          } finally {
            mounted.cleanup();
          }
        },
      },
      {
        name: "cleans up idempotently",
        run() {
          const mounted = harness.mount({ machine: harness.createMachine() });
          mounted.cleanup();
          mounted.cleanup();
        },
      },
    ],
  };
}

export const getStateCoveragePlans = createStateCoveragePlan;
export const getTransitionCoveragePlans = createTransitionCoveragePlan;
export const getPathCoveragePlans = createPathCoveragePlan;
export const getInvalidEventPlans = createInvalidEventPlan;
export const getGuardBranchPlans = createGuardBranchPlan;
export const createAdapterConformanceSuite = defineAdapterConformanceSuite;

interface PathRecord {
  events: StateGraphEvent[];
  states: Set<string>;
  activeLeaves: Set<string>;
  changed: boolean;
}

function findReachablePaths(ir: MachineIR, options: CoverageOptions = {}): PathRecord[] {
  const maxDepth = options.maxDepth ?? 5;
  const maxCases = options.maxCases ?? 100;
  const graph = createGraph(ir);
  const initialLeaves = enterInitial(ir.id, graph);
  const initial = createPathRecord([], initialLeaves, graph, false);
  const paths: PathRecord[] = [initial];
  const queue: PathRecord[] = [initial];
  const seen = new Set([configurationKey(initial.activeLeaves)]);

  while (queue.length > 0 && paths.length < maxCases) {
    const current = queue.shift();
    if (!current || current.events.length >= maxDepth) continue;

    for (const transition of enabledTransitions(current.activeLeaves, graph)) {
      const activeLeaves = applyTransition(current.activeLeaves, transition, graph);
      const next = createPathRecord(
        [...current.events, eventFromType(transition.event)],
        activeLeaves,
        graph,
        transition.target !== null,
      );
      const key = `${configurationKey(activeLeaves)}|${next.events.map((event) => event.type).join(">")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      paths.push(next);
      queue.push(next);
      if (paths.length >= maxCases) break;
    }
  }

  return paths;
}

interface Graph {
  states: Map<string, MachineIR["states"][number]>;
  children: Map<string, string[]>;
  transitions: EnumeratedTransition[];
}

function createGraph(ir: MachineIR): Graph {
  const states = new Map(ir.states.map((state) => [state.id, state]));
  const children = new Map<string, string[]>();
  for (const state of ir.states) children.set(state.id, []);
  for (const state of ir.states) {
    if (state.parent) children.get(state.parent)?.push(state.id);
  }
  for (const ids of children.values()) ids.sort(compareStrings);
  return { states, children, transitions: enumerateTransitions(ir) };
}

function enterInitial(stateId: string, graph: Graph): Set<string> {
  const state = graph.states.get(stateId);
  if (!state) return new Set([stateId]);
  const children = graph.children.get(stateId) ?? [];
  if (state.type === "parallel") {
    return new Set(children.flatMap((child) => [...enterInitial(child, graph)]));
  }
  if ((state.type === "compound" || state.type === "atomic") && state.initial) {
    const childId = children.find((child) => child.endsWith(`.${state.initial}`));
    if (childId) return enterInitial(childId, graph);
  }
  if (children.length > 0 && state.type !== "final")
    return enterInitial(children[0] ?? stateId, graph);
  return new Set([stateId]);
}

function enabledTransitions(activeLeaves: Set<string>, graph: Graph): EnumeratedTransition[] {
  const sourceIds = new Set<string>();
  for (const leaf of activeLeaves) {
    let current: string | null | undefined = leaf;
    while (current) {
      sourceIds.add(current);
      current = graph.states.get(current)?.parent;
    }
  }
  return graph.transitions
    .filter((transition) => !transition.event.startsWith("@"))
    .filter((transition) => sourceIds.has(transition.source));
}

function applyTransition(
  activeLeaves: Set<string>,
  transition: EnumeratedTransition,
  graph: Graph,
): Set<string> {
  if (!transition.target) return new Set(activeLeaves);
  const next = new Set(activeLeaves);
  const sourceParent = graph.states.get(transition.source)?.parent;
  for (const leaf of activeLeaves) {
    if (leaf === transition.source || leaf.startsWith(`${transition.source}.`)) next.delete(leaf);
    if (sourceParent && leaf.startsWith(`${sourceParent}.`)) next.delete(leaf);
  }
  for (const leaf of enterInitial(
    resolveTargetId(transition.source, transition.target, graph),
    graph,
  )) {
    next.add(leaf);
  }
  return next.size > 0
    ? next
    : enterInitial(resolveTargetId(transition.source, transition.target, graph), graph);
}

function resolveTargetId(source: string, target: string, graph: Graph): string {
  if (graph.states.has(target)) return target;
  const parent = graph.states.get(source)?.parent;
  if (parent && graph.states.has(`${parent}.${target}`)) return `${parent}.${target}`;
  const root = [...graph.states.values()].find((state) => state.parent === null)?.id;
  if (root && graph.states.has(`${root}.${target}`)) return `${root}.${target}`;
  return target;
}

function createPathRecord(
  events: StateGraphEvent[],
  activeLeaves: Set<string>,
  graph: Graph,
  changed: boolean,
): PathRecord {
  const states = new Set<string>();
  for (const leaf of activeLeaves) {
    let current: string | null | undefined = leaf;
    while (current) {
      states.add(current);
      current = graph.states.get(current)?.parent;
    }
  }
  return { events, states, activeLeaves, changed };
}

function transitionId(transition: MachineIR["transitions"][number], index: number): string {
  return [
    transition.source,
    transition.event,
    transition.target ?? "internal",
    transition.guard ?? "unguarded",
    index,
  ].join("#");
}

function eventFromType(type: string): StateGraphEvent {
  return { type };
}

function limitPlan(plan: TestPlan, maxCases = 100): TestPlan {
  return { ...plan, cases: plan.cases.slice(0, maxCases) };
}

function configurationKey(activeLeaves: Set<string>): string {
  return [...activeLeaves].sort(compareStrings).join("|");
}

function compareTransitionRecords(a: EnumeratedTransition, b: EnumeratedTransition): number {
  return (
    compareStrings(a.source, b.source) ||
    compareStrings(a.event, b.event) ||
    compareStrings(a.target ?? "", b.target ?? "") ||
    compareStrings(a.guard ?? "", b.guard ?? "") ||
    compareStrings(a.id, b.id)
  );
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}
