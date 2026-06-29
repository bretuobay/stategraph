export type StateGraphEvent = { type: string; [key: string]: unknown };

export type SnapshotStatus = "idle" | "active" | "done" | "error" | "stopped";

export type StateValue = string | { [key: string]: StateValue };

export type MaybeArray<T> = T | T[];

export type GuardRef =
  | string
  | {
      type: string;
      params?: unknown;
    };

export type ActionRef =
  | string
  | {
      type: string;
      params?: unknown;
    };

export type EffectRef =
  | string
  | {
      type: string;
      params?: unknown;
    };

export interface TransitionDef {
  target?: string;
  guard?: GuardRef;
  actions?: MaybeArray<ActionRef>;
  effects?: MaybeArray<EffectRef>;
  reenter?: boolean;
  meta?: Record<string, unknown>;
}

export type InvokeInput =
  | null
  | string
  | number
  | boolean
  | Record<string, unknown>
  | unknown[]
  | ((args: RuntimeArgs<unknown, StateGraphEvent>) => unknown);

export interface InvokeDef {
  src: string;
  id?: string;
  input?: InvokeInput;
  onDone?: string | TransitionDef;
  onError?: string | TransitionDef;
}

export interface StateNodeDef {
  type?: "atomic" | "compound" | "parallel" | "final" | "history";
  initial?: string;
  states?: Record<string, StateNodeDef>;
  history?: "shallow" | "deep";
  on?: Record<string, MaybeArray<TransitionDef>>;
  always?: MaybeArray<TransitionDef>;
  after?: Record<string, TransitionDef>;
  entry?: MaybeArray<ActionRef>;
  exit?: MaybeArray<ActionRef>;
  invoke?: MaybeArray<InvokeDef>;
  meta?: Record<string, unknown>;
}

export interface MachineDefinition<TContext = unknown> extends StateNodeDef {
  id: string;
  context?: TContext;
}

export interface RuntimeArgs<TContext, TEvent extends StateGraphEvent> {
  context: Readonly<TContext>;
  event: TEvent;
}

export type GuardImplementation<TContext, TEvent extends StateGraphEvent> = (
  args: RuntimeArgs<TContext, TEvent>,
  params?: unknown,
) => boolean;

export type ActionImplementation<TContext, TEvent extends StateGraphEvent> = (
  args: RuntimeArgs<TContext, TEvent>,
  params?: unknown,
) => void | Partial<TContext> | AssignAction<TContext, TEvent>;

export interface AssignAction<TContext, TEvent extends StateGraphEvent> {
  kind: "assign";
  resolve(args: RuntimeArgs<TContext, TEvent>): Partial<TContext>;
}

export interface EffectDefinition<TInput = unknown, TOutput = unknown> {
  kind: "promise" | "callback" | "observable";
  run(input: TInput, controls: EffectControls<TOutput>): EffectCleanup | Promise<TOutput> | void;
}

export interface EffectControls<TOutput = unknown> {
  signal: AbortSignal;
  sendBack(event: StateGraphEvent): void;
  receive(listener: (event: StateGraphEvent) => void): () => void;
  resolve(output: TOutput): void;
  reject(error: unknown): void;
}

export type EffectCleanup = void | (() => void);

export interface SetupImplementations<TContext, TEvent extends StateGraphEvent> {
  guards?: Record<string, GuardImplementation<TContext, TEvent>>;
  actions?: Record<string, ActionImplementation<TContext, TEvent> | AssignAction<TContext, TEvent>>;
  effects?: Record<string, EffectDefinition<unknown, unknown>>;
}

export interface ActorOptions<TContext, TEvent extends StateGraphEvent> {
  id?: string;
  provide?: Partial<SetupImplementations<TContext, TEvent>>;
  inspect?: (event: TraceEvent) => void;
}

export interface ChildActorRef {
  id: string;
  send(event: StateGraphEvent): void;
  stop(): void;
}

export interface StateGraphSnapshot<TContext, TEvent extends StateGraphEvent = StateGraphEvent> {
  status: SnapshotStatus;
  value: StateValue;
  configuration: ReadonlySet<string>;
  context: Readonly<TContext>;
  changed: boolean;
  event: TEvent | { type: "@@INIT" } | null;
  nextEvents: ReadonlyArray<string>;
  firedTransitions: ReadonlyArray<{
    readonly source: string;
    readonly target: string | null;
    readonly eventType: string;
  }>;
  pendingEffects: ReadonlyArray<{
    readonly id: string;
    readonly src: string;
    readonly input: unknown;
  }>;
  children: Readonly<Record<string, ChildActorRef>>;
  error: unknown;
  _traceId: string | undefined;
}

export interface ActorRef<TContext = unknown, TEvent extends StateGraphEvent = StateGraphEvent> {
  start(): ActorRef<TContext, TEvent>;
  stop(): void;
  send(event: TEvent): void;
  getSnapshot(): StateGraphSnapshot<TContext, TEvent>;
  subscribe(listener: (snapshot: StateGraphSnapshot<TContext, TEvent>) => void): () => void;
  select<T>(
    selector: (snapshot: StateGraphSnapshot<TContext, TEvent>) => T,
    listener: (value: T) => void,
    compare?: (a: T, b: T) => boolean,
  ): () => void;
  inspect(listener: (event: TraceEvent) => void): () => void;
}

export interface TraceEvent {
  seq: number;
  ts: number;
  actorId: string;
  type: string;
  [key: string]: unknown;
}

export interface StateGraphMachine<
  TContext = unknown,
  TEvent extends StateGraphEvent = StateGraphEvent,
> {
  id: string;
  definition: MachineDefinition<TContext>;
  implementations: SetupImplementations<TContext, TEvent>;
  registry: MachineRegistry;
  toIR(): MachineIR;
}

export interface StateNodeRecord {
  id: string;
  key: string;
  parent: string | null;
  path: string[];
  type: "atomic" | "compound" | "parallel" | "final" | "history";
  initial: string | undefined;
  history: "shallow" | "deep" | undefined;
  def: StateNodeDef;
}

export interface MachineRegistry {
  rootId: string;
  nodes: Map<string, StateNodeRecord>;
  children: Map<string, string[]>;
}

export interface MachineIR {
  id: string;
  states: Array<{
    id: string;
    key: string;
    parent: string | null;
    type: StateNodeRecord["type"];
    initial?: string;
    history?: "shallow" | "deep";
    meta?: Record<string, unknown>;
  }>;
  transitions: Array<{
    source: string;
    event: string;
    target: string | null;
    guard: string | null;
    actions: string[];
    effects: string[];
    meta?: Record<string, unknown>;
  }>;
  events: string[];
  guards: string[];
  actions: string[];
  effects: string[];
  protocols: Record<string, unknown>;
}
