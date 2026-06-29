import {
  createContext,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";
import { createComponent } from "solid-js/web";
import {
  createActor as createCoreActor,
  type ActorOptions,
  type ActorRef,
  type StateGraphEvent,
  type StateGraphMachine,
  type StateGraphSnapshot,
} from "@stategraph/core";

export const STATEGRAPH_SOLID_PACKAGE = "@stategraph/solid";

export type CreateActorResult<TContext, TEvent extends StateGraphEvent> = [
  snapshot: Accessor<StateGraphSnapshot<TContext, TEvent>>,
  send: ActorRef<TContext, TEvent>["send"],
  actor: ActorRef<TContext, TEvent>,
];

export interface StateGraphProviderProps<TContext, TEvent extends StateGraphEvent> {
  actor: ActorRef<TContext, TEvent>;
  children?: JSX.Element;
}

const ActorContext = createContext<ActorRef<unknown, StateGraphEvent>>();

export function createActor<TContext, TEvent extends StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  options?: ActorOptions<TContext, TEvent>,
): CreateActorResult<TContext, TEvent> {
  const actor = createCoreActor(machine, options);
  const [snapshot, setSnapshot] = createSignal(actor.getSnapshot(), { equals: false });
  actor.start();
  const unsubscribe = actor.subscribe(setSnapshot);
  let stopped = false;

  onCleanup(() => {
    unsubscribe();
    if (stopped) return;
    stopped = true;
    actor.stop();
  });

  return [snapshot, (event) => actor.send(event), actor];
}

export function createSelector<TContext, TEvent extends StateGraphEvent, TValue>(
  actor: ActorRef<TContext, TEvent>,
  selector: (snapshot: StateGraphSnapshot<TContext, TEvent>) => TValue,
  compare: (a: TValue, b: TValue) => boolean = Object.is,
): Accessor<TValue> {
  const [selected, setSelected] = createSignal(selector(actor.getSnapshot()), { equals: false });
  const unsubscribe = actor.select(selector, setSelected, compare);
  onCleanup(unsubscribe);
  return selected;
}

export function StateGraphProvider<TContext, TEvent extends StateGraphEvent>(
  props: StateGraphProviderProps<TContext, TEvent>,
): JSX.Element {
  return createComponent(ActorContext.Provider, {
    value: props.actor,
    get children() {
      return props.children;
    },
  });
}

export function useActorContext<
  TContext = unknown,
  TEvent extends StateGraphEvent = StateGraphEvent,
>(): ActorRef<TContext, TEvent> {
  const actor = useContext(ActorContext);
  if (!actor) throw new Error("useActorContext must be used within a StateGraphProvider.");
  return actor as ActorRef<TContext, TEvent>;
}
