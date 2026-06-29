import { getContext, setContext } from "svelte";
import { readable, type Readable } from "svelte/store";
import {
  createActor,
  type ActorOptions,
  type ActorRef,
  type StateGraphEvent,
  type StateGraphMachine,
  type StateGraphSnapshot,
} from "@stategraph/core";

export const STATEGRAPH_SVELTE_PACKAGE = "@stategraph/svelte";

export interface ActorStoreResult<TContext, TEvent extends StateGraphEvent> {
  snapshot: Readable<StateGraphSnapshot<TContext, TEvent>>;
  send: ActorRef<TContext, TEvent>["send"];
  actor: ActorRef<TContext, TEvent>;
}

export const StateGraphActorContextKey = Symbol("StateGraphActor");

export function actorStore<TContext, TEvent extends StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  options?: ActorOptions<TContext, TEvent>,
): ActorStoreResult<TContext, TEvent> {
  const actor = createActor(machine, options);
  let subscribers = 0;

  const snapshot = readable(actor.getSnapshot(), (set) => {
    subscribers += 1;
    if (subscribers === 1) actor.start();
    const unsubscribe = actor.subscribe(set);

    return () => {
      unsubscribe();
      subscribers -= 1;
      if (subscribers === 0) actor.stop();
    };
  });

  return {
    snapshot,
    send: (event) => actor.send(event),
    actor,
  };
}

export function selectorStore<TContext, TEvent extends StateGraphEvent, TValue>(
  actor: ActorRef<TContext, TEvent>,
  selector: (snapshot: StateGraphSnapshot<TContext, TEvent>) => TValue,
  compare: (a: TValue, b: TValue) => boolean = Object.is,
): Readable<TValue> {
  return readable(selector(actor.getSnapshot()), (set) => actor.select(selector, set, compare));
}

export function setActorContext<TContext, TEvent extends StateGraphEvent>(
  actor: ActorRef<TContext, TEvent>,
  key: unknown = StateGraphActorContextKey,
): ActorRef<TContext, TEvent> {
  setContext(key, actor);
  return actor;
}

export function getActorContext<
  TContext = unknown,
  TEvent extends StateGraphEvent = StateGraphEvent,
>(key: unknown = StateGraphActorContextKey): ActorRef<TContext, TEvent> {
  const actor = getContext<ActorRef<TContext, TEvent> | undefined>(key);
  if (!actor) throw new Error("getActorContext must be used after setActorContext.");
  return actor;
}
