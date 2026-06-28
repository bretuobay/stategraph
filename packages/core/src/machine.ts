import type {
  MachineDefinition,
  MachineIR,
  MachineRegistry,
  MaybeArray,
  SetupImplementations,
  StateGraphEvent,
  StateGraphMachine,
  StateNodeDef,
  StateNodeRecord,
  TransitionDef,
} from "./types";

export function setup<TContext = unknown, TEvent extends StateGraphEvent = StateGraphEvent>(
  implementations: SetupImplementations<TContext, TEvent> = {},
): {
  createMachine(definition: MachineDefinition<TContext>): StateGraphMachine<TContext, TEvent>;
} {
  return {
    createMachine(definition) {
      return createMachine(definition, implementations);
    },
  };
}

export function createMachine<TContext = unknown, TEvent extends StateGraphEvent = StateGraphEvent>(
  definition: MachineDefinition<TContext>,
  implementations: SetupImplementations<TContext, TEvent> = {},
): StateGraphMachine<TContext, TEvent> {
  validateDefinition(definition);
  const registry = buildRegistry(definition);
  validateTargets(definition, registry);

  return {
    id: definition.id,
    definition,
    implementations,
    registry,
    toIR() {
      return toIR(definition, registry);
    },
  };
}

function validateDefinition(definition: MachineDefinition<unknown>): void {
  if (!definition.id) throw new Error("Machine definition requires an id.");
  if (!definition.states || Object.keys(definition.states).length === 0) {
    throw new Error(`Machine "${definition.id}" requires at least one state.`);
  }
  validateStateNode(definition.id, definition);
}

function validateStateNode(id: string, def: StateNodeDef): void {
  const type = normalizeType(def);
  if (type === "atomic" && def.states)
    throw new Error(`Atomic state "${id}" cannot define states.`);
  if (type === "compound" && !def.initial)
    throw new Error(`Compound state "${id}" requires initial.`);
  if (type === "compound" && !def.states?.[def.initial ?? ""]) {
    throw new Error(`Compound state "${id}" initial target does not exist.`);
  }
  if (type === "parallel" && def.initial)
    throw new Error(`Parallel state "${id}" cannot define initial.`);
  if (type === "final" && def.states) throw new Error(`Final state "${id}" cannot define states.`);
  if (type === "history" && def.states)
    throw new Error(`History state "${id}" cannot define states.`);

  for (const [key, child] of Object.entries(def.states ?? {})) {
    validateStateNode(`${id}.${key}`, child);
  }
}

export function buildRegistry(definition: MachineDefinition<unknown>): MachineRegistry {
  const nodes = new Map<string, StateNodeRecord>();
  const children = new Map<string, string[]>();

  const visit = (
    key: string,
    id: string,
    parent: string | null,
    path: string[],
    def: StateNodeDef,
  ) => {
    const record: StateNodeRecord = {
      id,
      key,
      parent,
      path,
      type: normalizeType(def),
      initial: def.initial,
      history: def.history,
      def,
    };
    nodes.set(id, record);
    children.set(id, []);
    if (parent) children.get(parent)?.push(id);
    for (const [childKey, childDef] of Object.entries(def.states ?? {})) {
      visit(childKey, `${id}.${childKey}`, id, [...path, childKey], childDef);
    }
  };

  visit(definition.id, definition.id, null, [], definition);
  return { rootId: definition.id, nodes, children };
}

export function normalizeType(def: StateNodeDef): StateNodeRecord["type"] {
  if (def.type) return def.type;
  if (def.states) return "compound";
  return "atomic";
}

function validateTargets(definition: MachineDefinition<unknown>, registry: MachineRegistry): void {
  for (const node of registry.nodes.values()) {
    for (const transition of getAllTransitions(node.def)) {
      if (!transition.target) continue;
      resolveTarget(registry, node.id, transition.target);
    }
  }
}

export function resolveTarget(registry: MachineRegistry, sourceId: string, target: string): string {
  if (registry.nodes.has(target)) return target;

  const source = registry.nodes.get(sourceId);
  if (!source) throw new Error(`Unknown source state "${sourceId}".`);
  const parent = source.parent;
  const sibling = parent ? `${parent}.${target}` : target;
  if (registry.nodes.has(sibling)) return sibling;

  const rootTarget = `${registry.rootId}.${target}`;
  if (registry.nodes.has(rootTarget)) return rootTarget;

  throw new Error(`Invalid transition target "${target}" from "${sourceId}".`);
}

export function toArray<T>(value: MaybeArray<T> | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function refType(ref: string | { type: string }): string {
  return typeof ref === "string" ? ref : ref.type;
}

function getAllTransitions(def: StateNodeDef): TransitionDef[] {
  const transitions: TransitionDef[] = [];
  for (const value of Object.values(def.on ?? {})) transitions.push(...toArray(value));
  transitions.push(...toArray(def.always));
  for (const value of Object.values(def.after ?? {})) transitions.push(value);
  for (const invoke of toArray(def.invoke)) {
    if (invoke.onDone)
      transitions.push(
        typeof invoke.onDone === "string" ? { target: invoke.onDone } : invoke.onDone,
      );
    if (invoke.onError) {
      transitions.push(
        typeof invoke.onError === "string" ? { target: invoke.onError } : invoke.onError,
      );
    }
  }
  return transitions;
}

function toIR(definition: MachineDefinition<unknown>, registry: MachineRegistry): MachineIR {
  const transitions: MachineIR["transitions"] = [];
  const events = new Set<string>();
  const guards = new Set<string>();
  const actions = new Set<string>();
  const effects = new Set<string>();

  for (const node of registry.nodes.values()) {
    for (const [event, value] of Object.entries(node.def.on ?? {})) {
      events.add(event);
      for (const transition of toArray(value)) {
        collectTransition(node.id, event, transition, transitions, guards, actions, effects);
      }
    }
    for (const transition of toArray(node.def.always)) {
      collectTransition(node.id, "@always", transition, transitions, guards, actions, effects);
    }
    for (const [delay, transition] of Object.entries(node.def.after ?? {})) {
      collectTransition(
        node.id,
        `@after.${delay}`,
        transition,
        transitions,
        guards,
        actions,
        effects,
      );
    }
    for (const action of [...toArray(node.def.entry), ...toArray(node.def.exit)])
      actions.add(refType(action));
    for (const invoke of toArray(node.def.invoke)) effects.add(invoke.src);
  }

  return {
    id: definition.id,
    states: [...registry.nodes.values()].map((node) => ({
      id: node.id,
      key: node.key,
      parent: node.parent,
      type: node.type,
      ...(node.initial ? { initial: node.initial } : {}),
      ...(node.history ? { history: node.history } : {}),
      ...(node.def.meta ? { meta: node.def.meta } : {}),
    })),
    transitions,
    events: [...events].sort(),
    guards: [...guards].sort(),
    actions: [...actions].sort(),
    effects: [...effects].sort(),
    protocols: {},
  };
}

function collectTransition(
  source: string,
  event: string,
  transition: TransitionDef,
  transitions: MachineIR["transitions"],
  guards: Set<string>,
  actions: Set<string>,
  effects: Set<string>,
): void {
  if (transition.guard) guards.add(refType(transition.guard));
  for (const action of toArray(transition.actions)) actions.add(refType(action));
  for (const effect of toArray(transition.effects)) effects.add(refType(effect));
  transitions.push({
    source,
    event,
    target: transition.target ?? null,
    guard: transition.guard ? refType(transition.guard) : null,
    actions: toArray(transition.actions).map(refType),
    effects: toArray(transition.effects).map(refType),
    ...(transition.meta ? { meta: transition.meta } : {}),
  });
}
