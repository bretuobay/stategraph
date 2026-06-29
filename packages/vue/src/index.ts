import {
  getCurrentScope,
  inject,
  onMounted,
  onScopeDispose,
  provide,
  shallowRef,
  type InjectionKey,
  type Ref,
} from "vue";
import {
  createActor as createCoreActor,
  type ActorOptions,
  type ActorRef,
  type StateGraphEvent,
  type StateGraphMachine,
  type StateGraphSnapshot,
} from "@stategraph/core";

export const STATEGRAPH_VUE_PACKAGE = "@stategraph/vue";

export type SnapshotRef<TContext, TEvent extends StateGraphEvent> = Ref<
  StateGraphSnapshot<TContext, TEvent>
>;

export interface UseActorResult<TContext, TEvent extends StateGraphEvent> {
  snapshot: SnapshotRef<TContext, TEvent>;
  send: ActorRef<TContext, TEvent>["send"];
  actor: ActorRef<TContext, TEvent>;
}

export const StateGraphActorKey: InjectionKey<ActorRef<unknown, StateGraphEvent>> =
  Symbol("StateGraphActor");

export function useActor<TContext, TEvent extends StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  options?: ActorOptions<TContext, TEvent>,
): UseActorResult<TContext, TEvent> {
  const actor = useActorRef(machine, options);
  const snapshot = shallowRef(actor.getSnapshot()) as SnapshotRef<TContext, TEvent>;
  let unsubscribe: (() => void) | undefined;

  const subscribe = () => {
    unsubscribe?.();
    unsubscribe = actor.subscribe((nextSnapshot) => {
      snapshot.value = nextSnapshot;
    });
  };

  if (getCurrentScope()) {
    onMounted(subscribe);
    onScopeDispose(() => unsubscribe?.());
  } else {
    subscribe();
  }

  return {
    snapshot,
    send: (event) => actor.send(event),
    actor,
  };
}

export function useActorRef<TContext, TEvent extends StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  options?: ActorOptions<TContext, TEvent>,
): ActorRef<TContext, TEvent> {
  const actor = createCoreActor(machine, options);
  let stopped = false;

  const start = () => {
    actor.start();
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    actor.stop();
  };

  start();
  if (getCurrentScope()) onScopeDispose(stop);

  return actor;
}

export function useSelector<TContext, TEvent extends StateGraphEvent, TValue>(
  actor: ActorRef<TContext, TEvent>,
  selector: (snapshot: StateGraphSnapshot<TContext, TEvent>) => TValue,
  compare: (a: TValue, b: TValue) => boolean = Object.is,
): Ref<TValue> {
  const selected = shallowRef(selector(actor.getSnapshot())) as Ref<TValue>;
  const unsubscribe = actor.select(
    selector,
    (value) => {
      selected.value = value;
    },
    compare,
  );

  if (getCurrentScope()) onScopeDispose(unsubscribe);
  return selected;
}

export function provideActor<TContext, TEvent extends StateGraphEvent>(
  actor: ActorRef<TContext, TEvent>,
  key: InjectionKey<ActorRef<TContext, TEvent>> = StateGraphActorKey,
): void {
  provide(key, actor);
}

export function useActorContext<
  TContext = unknown,
  TEvent extends StateGraphEvent = StateGraphEvent,
>(key: InjectionKey<ActorRef<TContext, TEvent>> = StateGraphActorKey): ActorRef<TContext, TEvent> {
  const actor = inject(key, null);
  if (!actor) throw new Error("useActorContext must be used after provideActor.");
  return actor;
}
