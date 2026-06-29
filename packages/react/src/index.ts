import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import {
  createActor,
  type ActorOptions,
  type ActorRef,
  type StateGraphEvent,
  type StateGraphMachine,
  type StateGraphSnapshot,
} from "@stategraph/core";
import { registerWithDevtools } from "./devtoolsStore";

export const STATEGRAPH_REACT_PACKAGE = "@stategraph/react";

export interface UseActorResult<TContext, TEvent extends StateGraphEvent> {
  snapshot: StateGraphSnapshot<TContext, TEvent>;
  send: ActorRef<TContext, TEvent>["send"];
  actor: ActorRef<TContext, TEvent>;
}

export interface StateGraphProviderProps<
  TContext,
  TEvent extends StateGraphEvent,
> extends PropsWithChildren {
  actor: ActorRef<TContext, TEvent>;
}

const ActorContext = createContext<ActorRef<unknown, StateGraphEvent> | null>(null);

export function useActor<TContext, TEvent extends StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  options?: ActorOptions<TContext, TEvent>,
): UseActorResult<TContext, TEvent> {
  const actor = useActorRef(machine, options);
  const snapshot = useSelector(actor, (nextSnapshot) => nextSnapshot);
  const send = useSend(actor);
  return useMemo(() => ({ snapshot, send, actor }), [actor, send, snapshot]);
}

export function useActorRef<TContext, TEvent extends StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  options?: ActorOptions<TContext, TEvent>,
): ActorRef<TContext, TEvent> {
  const actorRef = useRef<ActorRef<TContext, TEvent> | null>(null);
  if (!actorRef.current) actorRef.current = createActor(machine, options);

  useEffect(() => {
    const actor = actorRef.current;
    if (!actor) return undefined;
    // Guard lets bundlers DCE this entire block in production when they replace
    // process.env.NODE_ENV with "production" (Vite, webpack, esbuild all do this).
    if (process.env.NODE_ENV !== "production") {
      registerWithDevtools(actor as ActorRef<unknown, StateGraphEvent>, machine.id);
    }
    actor.start();
    return () => actor.stop();
  }, []);

  return actorRef.current;
}

export function useSelector<TContext, TEvent extends StateGraphEvent, TValue>(
  actor: ActorRef<TContext, TEvent>,
  selector: (snapshot: StateGraphSnapshot<TContext, TEvent>) => TValue,
  compare: (a: TValue, b: TValue) => boolean = Object.is,
): TValue {
  const selectorRef = useRef(selector);
  const compareRef = useRef(compare);
  selectorRef.current = selector;
  compareRef.current = compare;

  const cacheRef = useRef<{
    snapshot: StateGraphSnapshot<TContext, TEvent>;
    value: TValue;
  } | null>(null);

  const getSelectedSnapshot = useCallback(() => {
    const snapshot = actor.getSnapshot();
    const cached = cacheRef.current;
    if (cached?.snapshot === snapshot) return cached.value;

    const value = selectorRef.current(snapshot);
    if (cached && compareRef.current(cached.value, value)) {
      cacheRef.current = { snapshot, value: cached.value };
      return cached.value;
    }

    cacheRef.current = { snapshot, value };
    return value;
  }, [actor]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => actor.subscribe(() => onStoreChange()),
    [actor],
  );

  return useSyncExternalStore(subscribe, getSelectedSnapshot, getSelectedSnapshot);
}

export function useSend<TContext, TEvent extends StateGraphEvent>(
  actor: ActorRef<TContext, TEvent>,
): ActorRef<TContext, TEvent>["send"] {
  const actorRef = useRef(actor);
  actorRef.current = actor;

  return useCallback((event: TEvent) => actorRef.current.send(event), []);
}

export function StateGraphProvider<TContext, TEvent extends StateGraphEvent>({
  actor,
  children,
}: StateGraphProviderProps<TContext, TEvent>): ReactElement {
  return createElement(ActorContext.Provider, { value: actor }, children);
}

export function useActorContext<
  TContext = unknown,
  TEvent extends StateGraphEvent = StateGraphEvent,
>(): ActorRef<TContext, TEvent> {
  const actor = useContext(ActorContext);
  if (!actor) throw new Error("useActorContext must be used within a StateGraphProvider.");
  return actor as ActorRef<TContext, TEvent>;
}
