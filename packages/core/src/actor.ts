import { refType, resolveTarget, toArray } from "./machine";
import type {
  ActionRef,
  ActorOptions,
  ActorRef,
  AssignAction,
  ChildActorRef,
  GuardRef,
  InvokeDef,
  RuntimeArgs,
  SetupImplementations,
  StateGraphEvent,
  StateGraphMachine,
  StateGraphSnapshot,
  StateValue,
  TraceEvent,
  TransitionDef,
} from "./types";

interface ActiveEffect {
  id: string;
  stateId: string;
  src: string;
  invoke?: InvokeDef;
  abort: AbortController;
  cleanup?: () => void;
  receiveListeners: Set<(event: StateGraphEvent) => void>;
}

interface SelectorSubscription<TContext, TEvent extends StateGraphEvent, TValue> {
  selector: (snapshot: StateGraphSnapshot<TContext, TEvent>) => TValue;
  listener: (value: TValue) => void;
  compare: (a: TValue, b: TValue) => boolean;
  value: TValue;
}

export function createActor<TContext = unknown, TEvent extends StateGraphEvent = StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  options: ActorOptions<TContext, TEvent> = {},
): ActorRef<TContext, TEvent> {
  validateImplementations(machine, options.provide);
  return new StateGraphActor(machine, options);
}

class StateGraphActor<TContext, TEvent extends StateGraphEvent> implements ActorRef<
  TContext,
  TEvent
> {
  private readonly actorId: string;
  private readonly implementations: SetupImplementations<TContext, TEvent>;
  private status: StateGraphSnapshot<TContext, TEvent>["status"] = "idle";
  private context: TContext;
  private active = new Set<string>();
  private snapshot: StateGraphSnapshot<TContext, TEvent>;
  private queue: TEvent[] = [];
  private processing = false;
  private subscribers = new Set<(snapshot: StateGraphSnapshot<TContext, TEvent>) => void>();
  private selectors = new Set<SelectorSubscription<TContext, TEvent, unknown>>();
  private inspectors = new Set<(event: TraceEvent) => void>();
  private seq = 0;
  private readonly startedAt = Date.now();
  private effectSeq = 0;
  private effects = new Map<string, ActiveEffect>();
  private readonly history = new Map<string, Set<string>>();
  private forcedTransition: {
    sourceId: string;
    transition: TransitionDef;
    guardResults: Record<string, boolean>;
  } | null = null;

  constructor(
    private readonly machine: StateGraphMachine<TContext, TEvent>,
    options: ActorOptions<TContext, TEvent>,
  ) {
    this.actorId = options.id ?? `${machine.id}:actor`;
    this.implementations = mergeImplementations(machine.implementations, options.provide);
    if (options.inspect) this.inspectors.add(options.inspect);
    this.context = cloneContext(machine.definition.context as TContext);
    this.snapshot = this.createSnapshot({ type: "@@INIT" }, [], [], false, undefined);
  }

  start(): ActorRef<TContext, TEvent> {
    if (this.status === "active") return this;
    this.status = "active";
    const initEvent = { type: "@@INIT" } as TEvent;
    // Run entry for the root machine node, then descend running entry for initial children.
    const rootEntry = this.machine.registry.nodes.get(this.machine.registry.rootId)?.def.entry;
    this.runActions(rootEntry, initEvent);
    this.active = this.enterDescendants(this.machine.registry.rootId, initEvent);
    const pending = this.startRuntimeWorkForConfiguration(this.active, initEvent);
    this.snapshot = this.createSnapshot(initEvent, [], pending, true, undefined);
    this.emit({ type: "@actor.started", snapshot: this.snapshot });
    this.notify();
    this.processAlways(initEvent);
    return this;
  }

  stop(): void {
    if (this.status === "stopped") return;
    for (const effect of [...this.effects.values()]) this.cancelEffect(effect.id);
    this.status = "stopped";
    this.snapshot = this.createSnapshot(null, [], [], true, undefined);
    this.emit({ type: "@actor.stopped" });
    this.notify();
  }

  send(event: TEvent): void {
    if (this.status === "stopped") return;
    if (event.type.startsWith("@"))
      throw new Error(`User event type "${event.type}" cannot start with "@".`);
    if (this.status === "idle") this.start();
    this.emit({ type: "@event.received", event });
    this.queue.push(event);
    this.flush();
  }

  getSnapshot(): StateGraphSnapshot<TContext, TEvent> {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: StateGraphSnapshot<TContext, TEvent>) => void): () => void {
    this.subscribers.add(listener);
    listener(this.snapshot);
    return () => this.subscribers.delete(listener);
  }

  select<T>(
    selector: (snapshot: StateGraphSnapshot<TContext, TEvent>) => T,
    listener: (value: T) => void,
    compare: (a: T, b: T) => boolean = Object.is,
  ): () => void {
    const value = selector(this.snapshot);
    const subscription: SelectorSubscription<TContext, TEvent, T> = {
      selector,
      listener,
      compare,
      value,
    };
    this.selectors.add(subscription as SelectorSubscription<TContext, TEvent, unknown>);
    listener(value);
    return () =>
      this.selectors.delete(subscription as SelectorSubscription<TContext, TEvent, unknown>);
  }

  inspect(listener: (event: TraceEvent) => void): () => void {
    this.inspectors.add(listener);
    return () => this.inspectors.delete(listener);
  }

  private flush(): void {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const event = this.queue.shift();
        if (event) this.step(event);
      }
    } finally {
      this.processing = false;
    }
  }

  private step(event: TEvent): void {
    const plans = this.selectTransitions(event);
    if (plans.length === 0) {
      this.snapshot = this.createSnapshot(event, [], [], false, undefined);
      this.notify();
      return;
    }

    const fired: Array<{
      readonly source: string;
      readonly target: string | null;
      readonly eventType: string;
    }> = [];
    const enteredLeaves = new Set<string>(this.active);
    const exitedStates = new Set<string>();
    let changed = false;

    for (const plan of plans) {
      const source = this.machine.registry.nodes.get(plan.sourceId);
      if (!source) continue;
      const targetId = plan.transition.target
        ? this.resolveHistoryTarget(
            resolveTarget(this.machine.registry, source.id, plan.transition.target),
          )
        : null;
      const exitIds = targetId
        ? this.exitSet(source.id, targetId, plan.transition.reenter === true)
        : [];
      for (const exitId of exitIds) {
        this.rememberHistory(exitId);
        this.runActions(this.machine.registry.nodes.get(exitId)?.def.exit, event);
        this.cancelEffectsForState(exitId);
        exitedStates.add(exitId);
      }
      for (const leaf of [...enteredLeaves]) {
        if ([...exitedStates].some((id) => leaf === id || leaf.startsWith(`${id}.`)))
          enteredLeaves.delete(leaf);
      }
      this.runActions(plan.transition.actions, event);
      if (targetId) {
        const entryPath = this.entryPath(source.id, targetId, plan.transition.reenter === true);
        for (const entryId of entryPath)
          this.runActions(this.machine.registry.nodes.get(entryId)?.def.entry, event);
        // When target is newly entered (entryPath is non-empty), also run entry for its
        // initial descendants. For self-transitions and ancestor-targets entryPath is
        // empty, so we fall back to enterInitial (no extra entry actions).
        const leaves =
          entryPath.length > 0
            ? this.enterDescendants(targetId, event)
            : this.enterInitial(targetId);
        for (const leaf of leaves) enteredLeaves.add(leaf);
      }
      fired.push({ source: source.id, target: targetId, eventType: event.type });
      this.emit({
        type: "@transition.fired",
        source: source.id,
        target: targetId,
        eventType: event.type,
        guardResults: plan.guardResults,
      });
      changed = true;
    }

    this.active = enteredLeaves;
    const pending = this.runTransitionEffects(plans, event);
    pending.push(...this.startRuntimeWorkForConfiguration(this.active, event));
    const final = this.isDone();
    if (final) this.status = "done";
    this.snapshot = this.createSnapshot(event, fired, pending, changed, undefined);
    this.notify();
    this.processAlways(event);
  }

  private processAlways(event: TEvent): void {
    let guard = 0;
    while (guard < 100) {
      guard += 1;
      const plans = this.selectTransitions({ type: "@always" } as TEvent);
      if (plans.length === 0) return;
      this.step({ ...event, type: "@always" });
    }
    throw new Error("Possible infinite always-transition loop.");
  }

  private selectTransitions(event: TEvent): Array<{
    sourceId: string;
    transition: TransitionDef;
    guardResults: Record<string, boolean>;
  }> {
    const plans: Array<{
      sourceId: string;
      transition: TransitionDef;
      guardResults: Record<string, boolean>;
    }> = [];
    const claimed = new Set<string>();
    for (const leafId of [...this.active].sort()) {
      const candidate = this.findTransitionFromLeaf(leafId, event);
      if (!candidate) continue;
      const region = candidate.sourceId;
      if (claimed.has(region)) continue;
      claimed.add(region);
      plans.push(candidate);
    }
    return plans;
  }

  private findTransitionFromLeaf(
    leafId: string,
    event: TEvent,
  ): { sourceId: string; transition: TransitionDef; guardResults: Record<string, boolean> } | null {
    if (this.forcedTransition) return this.forcedTransition;
    let current: string | null = leafId;
    while (current) {
      const node = this.machine.registry.nodes.get(current);
      if (!node) return null;
      const transitions =
        event.type === "@always" ? toArray(node.def.always) : toArray(node.def.on?.[event.type]);
      const guardResults: Record<string, boolean> = {};
      for (const transition of transitions) {
        if (this.guardPasses(transition.guard, event, guardResults)) {
          return { sourceId: current, transition, guardResults };
        }
      }
      current = node.parent;
    }
    return null;
  }

  private guardPasses(
    guard: GuardRef | undefined,
    event: TEvent,
    guardResults: Record<string, boolean>,
  ): boolean {
    if (!guard) return true;
    const type = refType(guard);
    const implementation = this.implementations.guards?.[type];
    if (!implementation) throw new Error(`Missing guard implementation "${type}".`);
    const result = implementation(
      this.runtimeArgs(event),
      typeof guard === "string" ? undefined : guard.params,
    );
    guardResults[type] = result;
    return result;
  }

  private runActions(actions: ActionRef | ActionRef[] | undefined, event: TEvent): void {
    for (const action of toArray(actions)) {
      const type = refType(action);
      const implementation = this.implementations.actions?.[type];
      if (!implementation) throw new Error(`Missing action implementation "${type}".`);
      const result = isAssignAction<TContext, TEvent>(implementation)
        ? implementation.resolve(this.runtimeArgs(event))
        : implementation(
            this.runtimeArgs(event),
            typeof action === "string" ? undefined : action.params,
          );
      if (isAssignAction<TContext, TEvent>(result))
        this.applyPatch(result.resolve(this.runtimeArgs(event)));
      else if (result && typeof result === "object") this.applyPatch(result);
      this.emit({
        type: "@action.executed",
        actionType: type,
        params: typeof action === "string" ? undefined : action.params,
      });
    }
  }

  private applyPatch(patch: Partial<TContext>): void {
    this.context = { ...(this.context as object), ...(patch as object) } as TContext;
    this.emit({ type: "@context.updated", patch });
  }

  private runTransitionEffects(
    plans: Array<{ transition: TransitionDef }>,
    event: TEvent,
  ): Array<{ readonly id: string; readonly src: string; readonly input: unknown }> {
    const pending: Array<{ readonly id: string; readonly src: string; readonly input: unknown }> =
      [];
    for (const plan of plans) {
      for (const effect of toArray(plan.transition.effects)) {
        pending.push(this.startEffect(refType(effect), undefined, event, "transition"));
      }
    }
    return pending;
  }

  private startRuntimeWorkForConfiguration(
    configuration: Set<string>,
    event: TEvent,
  ): Array<{ readonly id: string; readonly src: string; readonly input: unknown }> {
    const pending: Array<{ readonly id: string; readonly src: string; readonly input: unknown }> =
      [];
    for (const stateId of [...configuration]) {
      let current: string | null = stateId;
      while (current) {
        const node = this.machine.registry.nodes.get(current);
        if (!node) break;
        for (const invoke of toArray(node.def.invoke)) {
          const id = invoke.id ?? `${node.id}:${invoke.src}`;
          if ([...this.effects.values()].some((effect) => effect.id === id)) continue;
          const input =
            typeof invoke.input === "function"
              ? invoke.input(this.runtimeArgs(event))
              : invoke.input;
          pending.push(this.startEffect(invoke.src, input, event, node.id, invoke, id));
        }
        for (const [delay, transition] of Object.entries(node.def.after ?? {})) {
          const id = `${node.id}:after:${delay}`;
          if ([...this.effects.values()].some((effect) => effect.id === id)) continue;
          const timeout = Number(delay);
          if (!Number.isFinite(timeout)) continue;
          const handle = setTimeout(() => {
            this.effects.delete(id);
            this.stepWithTransition({ type: `@after.${delay}` } as TEvent, transition, node.id);
          }, timeout);
          this.effects.set(id, {
            id,
            stateId: node.id,
            src: `@after.${delay}`,
            abort: new AbortController(),
            receiveListeners: new Set(),
            cleanup: () => clearTimeout(handle),
          });
          pending.push({ id, src: `@after.${delay}`, input: null });
        }
        current = node.parent;
      }
    }
    return pending;
  }

  private startEffect(
    src: string,
    input: unknown,
    _event: TEvent,
    stateId: string,
    invoke?: InvokeDef,
    fixedId?: string,
  ): { id: string; src: string; input: unknown } {
    const effect = this.implementations.effects?.[src];
    if (!effect) throw new Error(`Missing effect implementation "${src}".`);
    const id = fixedId ?? `${src}:${++this.effectSeq}`;
    const abort = new AbortController();
    const receiveListeners = new Set<(event: StateGraphEvent) => void>();
    // Register in effects map before run() so synchronous receive() calls from inside
    // the effect body can find the active entry.
    const active: ActiveEffect = {
      id,
      stateId,
      src,
      ...(invoke ? { invoke } : {}),
      abort,
      receiveListeners,
    };
    this.effects.set(id, active);
    const controls = {
      signal: abort.signal,
      sendBack: (sendBackEvent: StateGraphEvent): void => this.send(sendBackEvent as TEvent),
      receive: (listener: (received: StateGraphEvent) => void): (() => void) => {
        receiveListeners.add(listener);
        return () => {
          receiveListeners.delete(listener);
        };
      },
      resolve: (output: unknown) => this.completeInvoke(id, output, invoke, true),
      reject: (error: unknown) => this.completeInvoke(id, error, invoke, false),
    };
    this.emit({ type: "@effect.started", effectId: id, src, input });
    try {
      const result = effect.run(input, controls);
      if (typeof result === "function") active.cleanup = result;
      if (result instanceof Promise) {
        result
          .then((output) => this.completeInvoke(id, output, invoke, true))
          .catch((error) => this.completeInvoke(id, error, invoke, false));
      }
    } catch (error) {
      this.completeInvoke(id, error, invoke, false);
    }
    return { id, src, input };
  }

  private buildChildren(): Readonly<Record<string, ChildActorRef>> {
    const children: Record<string, ChildActorRef> = {};
    for (const active of this.effects.values()) {
      if (!active.invoke) continue;
      const effectId = active.id;
      children[effectId] = {
        id: effectId,
        send: (childEvent: StateGraphEvent): void => {
          for (const listener of active.receiveListeners) listener(childEvent);
        },
        stop: (): void => {
          this.cancelEffect(effectId);
        },
      };
    }
    return children;
  }

  private completeInvoke(
    id: string,
    payload: unknown,
    invoke: InvokeDef | undefined,
    ok: boolean,
  ): void {
    const active = this.effects.get(id);
    if (!active) return;
    this.effects.delete(id);
    this.emit({
      type: ok ? "@effect.done" : "@effect.error",
      effectId: id,
      [ok ? "output" : "error"]: payload,
    });
    const invokeDef = invoke ?? active.invoke;
    if (!invokeDef) return;
    const transition = ok ? invokeDef.onDone : invokeDef.onError;
    if (!transition) return;
    const eventType = ok ? `done.invoke.${id}` : `error.invoke.${id}`;
    const event = {
      type: eventType,
      output: ok ? payload : undefined,
      error: ok ? undefined : payload,
    } as unknown as TEvent;
    this.stepWithTransition(
      event,
      typeof transition === "string" ? { target: transition } : transition,
      active.stateId,
    );
    this.flush();
  }

  private stepWithTransition(event: TEvent, transition: TransitionDef, sourceId: string): void {
    this.forcedTransition = { sourceId, transition, guardResults: {} };
    try {
      this.step(event);
    } finally {
      this.forcedTransition = null;
    }
  }

  private cancelEffectsForState(stateId: string): void {
    for (const effect of [...this.effects.values()]) {
      if (effect.stateId === stateId || effect.stateId.startsWith(`${stateId}.`))
        this.cancelEffect(effect.id);
    }
  }

  private cancelEffect(id: string): void {
    const effect = this.effects.get(id);
    if (!effect) return;
    effect.abort.abort();
    effect.cleanup?.();
    this.effects.delete(id);
    this.emit({ type: "@effect.cancelled", effectId: id });
  }

  private enterInitial(stateId: string): Set<string> {
    const node = this.machine.registry.nodes.get(stateId);
    if (!node) throw new Error(`Unknown state "${stateId}".`);
    if (node.type === "history") return this.history.get(node.parent ?? "") ?? new Set();
    if (node.type === "atomic" || node.type === "final") return new Set([stateId]);
    if (node.type === "compound") {
      if (!node.initial) throw new Error(`Compound state "${stateId}" requires initial.`);
      return this.enterInitial(`${stateId}.${node.initial}`);
    }
    const leaves = new Set<string>();
    for (const childId of this.machine.registry.children.get(stateId) ?? []) {
      for (const leaf of this.enterInitial(childId)) leaves.add(leaf);
    }
    return leaves;
  }

  // Like enterInitial but also runs entry actions for each initial child as it descends.
  // Does NOT run entry for stateId itself — callers are responsible for that.
  private enterDescendants(stateId: string, event: TEvent): Set<string> {
    const node = this.machine.registry.nodes.get(stateId);
    if (!node) throw new Error(`Unknown state "${stateId}".`);
    if (node.type === "history") return this.history.get(node.parent ?? "") ?? new Set();
    if (node.type === "atomic" || node.type === "final") return new Set([stateId]);
    if (node.type === "compound") {
      if (!node.initial) throw new Error(`Compound state "${stateId}" requires initial.`);
      const initialId = `${stateId}.${node.initial}`;
      this.runActions(this.machine.registry.nodes.get(initialId)?.def.entry, event);
      return this.enterDescendants(initialId, event);
    }
    const leaves = new Set<string>();
    for (const childId of this.machine.registry.children.get(stateId) ?? []) {
      this.runActions(this.machine.registry.nodes.get(childId)?.def.entry, event);
      for (const leaf of this.enterDescendants(childId, event)) leaves.add(leaf);
    }
    return leaves;
  }

  private exitSet(sourceId: string, targetId: string, reenter: boolean): string[] {
    const lca = reenter ? null : this.lowestCommonAncestor(sourceId, targetId);
    const ids: string[] = [];
    let current: string | null = sourceId;
    while (current && current !== lca) {
      ids.push(current);
      current = this.machine.registry.nodes.get(current)?.parent ?? null;
    }
    return ids;
  }

  private entryPath(sourceId: string, targetId: string, reenter: boolean): string[] {
    const lca = reenter ? null : this.lowestCommonAncestor(sourceId, targetId);
    const ids: string[] = [];
    let current: string | null = targetId;
    while (current && current !== lca) {
      ids.push(current);
      current = this.machine.registry.nodes.get(current)?.parent ?? null;
    }
    return ids.reverse();
  }

  private lowestCommonAncestor(a: string, b: string): string | null {
    const aAncestors = new Set(this.ancestors(a));
    for (const id of this.ancestors(b)) if (aAncestors.has(id)) return id;
    return null;
  }

  private ancestors(id: string): string[] {
    const ids: string[] = [];
    let current: string | null = id;
    while (current) {
      ids.push(current);
      current = this.machine.registry.nodes.get(current)?.parent ?? null;
    }
    return ids;
  }

  private rememberHistory(exitId: string): void {
    const node = this.machine.registry.nodes.get(exitId);
    if (!node || (node.type !== "compound" && node.type !== "parallel")) return;
    const leaves = new Set([...this.active].filter((leaf) => leaf.startsWith(`${exitId}.`)));
    if (leaves.size) this.history.set(exitId, leaves);
  }

  private resolveHistoryTarget(targetId: string): string {
    const target = this.machine.registry.nodes.get(targetId);
    if (target?.type === "history") {
      const remembered = this.history.get(target.parent ?? "");
      return remembered ? ([...remembered][0] ?? targetId) : targetId;
    }
    return targetId;
  }

  private isDone(): boolean {
    return [...this.active].every((id) => this.machine.registry.nodes.get(id)?.type === "final");
  }

  private createSnapshot(
    event: TEvent | { type: "@@INIT" } | null,
    transitions: StateGraphSnapshot<TContext, TEvent>["transitions"],
    pendingEffects: StateGraphSnapshot<TContext, TEvent>["pendingEffects"],
    changed: boolean,
    error: unknown,
  ): StateGraphSnapshot<TContext, TEvent> {
    return {
      status: this.status,
      value: this.stateValue(),
      configuration: new Set(this.active),
      context: this.context,
      changed,
      event,
      transitions,
      pendingEffects,
      children: this.buildChildren(),
      error,
      _traceId: this.inspectors.size > 0 ? `${this.actorId}:${this.seq}` : undefined,
    };
  }

  private stateValue(): StateValue {
    const root = this.machine.registry.nodes.get(this.machine.registry.rootId);
    if (!root) return "";
    const stripRoot = [...this.active].map((id) => id.replace(`${root.id}.`, ""));
    if (stripRoot.length === 0) return "";
    if (stripRoot.length === 1 && !stripRoot[0]?.includes(".")) return stripRoot[0] ?? "";
    const value: Record<string, StateValue> = {};
    for (const path of stripRoot) {
      const parts = path.split(".");
      let cursor: Record<string, StateValue> = value;
      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        if (!part) continue;
        if (i === parts.length - 1) cursor[part] = part;
        else {
          const next = cursor[part];
          if (typeof next === "object" && next !== null) {
            cursor = next;
          } else {
            const child: Record<string, StateValue> = {};
            cursor[part] = child;
            cursor = child;
          }
        }
      }
    }
    return value;
  }

  private notify(): void {
    for (const subscriber of this.subscribers) subscriber(this.snapshot);
    for (const subscription of this.selectors) {
      const next = subscription.selector(this.snapshot);
      if (!subscription.compare(subscription.value, next)) {
        subscription.value = next;
        subscription.listener(next);
      }
    }
  }

  private runtimeArgs(event: TEvent): RuntimeArgs<TContext, TEvent> {
    const context =
      this.context && typeof this.context === "object"
        ? (Object.freeze({ ...(this.context as object) }) as Readonly<TContext>)
        : (this.context as Readonly<TContext>);
    return { context, event };
  }

  private emit(event: { type: string; [key: string]: unknown }): void {
    const trace: TraceEvent = {
      seq: ++this.seq,
      ts: Date.now() - this.startedAt,
      actorId: this.actorId,
      ...event,
    };
    for (const inspector of this.inspectors) inspector(trace);
  }
}

function mergeImplementations<TContext, TEvent extends StateGraphEvent>(
  base: SetupImplementations<TContext, TEvent>,
  override: Partial<SetupImplementations<TContext, TEvent>> | undefined,
): SetupImplementations<TContext, TEvent> {
  return {
    guards: { ...base.guards, ...override?.guards },
    actions: { ...base.actions, ...override?.actions },
    effects: { ...base.effects, ...override?.effects },
  };
}

function validateImplementations<TContext, TEvent extends StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  provide: Partial<SetupImplementations<TContext, TEvent>> | undefined,
): void {
  const implementations = mergeImplementations(machine.implementations, provide);
  const ir = machine.toIR();
  for (const guard of ir.guards)
    if (!implementations.guards?.[guard])
      throw new Error(`Missing guard implementation "${guard}".`);
  for (const action of ir.actions) {
    if (!implementations.actions?.[action])
      throw new Error(`Missing action implementation "${action}".`);
  }
  for (const effect of ir.effects) {
    if (!implementations.effects?.[effect])
      throw new Error(`Missing effect implementation "${effect}".`);
  }
}

function cloneContext<TContext>(context: TContext): TContext {
  if (context && typeof context === "object") return { ...(context as object) } as TContext;
  return context;
}

function isAssignAction<TContext, TEvent extends StateGraphEvent>(
  value: unknown,
): value is AssignAction<TContext, TEvent> {
  return Boolean(
    value && typeof value === "object" && (value as { kind?: unknown }).kind === "assign",
  );
}
