export { assign, fromCallback, fromObservable, fromPromise } from "./actions";
export { createActor } from "./actor";
export { createMachine, setup } from "./machine";

export const STATEGRAPH_CORE_PACKAGE = "@stategraph/core";

export type {
  ActionImplementation,
  ActionRef,
  ActorOptions,
  ActorRef,
  AssignAction,
  ChildActorRef,
  EffectDefinition,
  EffectRef,
  GuardImplementation,
  GuardRef,
  InvokeDef,
  MachineDefinition,
  MachineIR,
  RuntimeArgs,
  SetupImplementations,
  SnapshotStatus,
  StateGraphEvent,
  StateGraphMachine,
  StateGraphSnapshot,
  StateNodeDef,
  StateValue,
  TraceEvent,
  TransitionDef,
} from "./types";
