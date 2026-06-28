import {
  createActor,
  type ActorOptions,
  type ActorRef,
  type StateGraphEvent,
  type StateGraphMachine,
  type StateGraphSnapshot,
} from "@stategraph/core";

export const STATEGRAPH_DOM_PACKAGE = "@stategraph/dom";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MountedActor<TContext, TEvent extends StateGraphEvent> {
  actor: ActorRef<TContext, TEvent>;
  /** Stop the actor and release adapter-owned resources. Idempotent. */
  cleanup: () => void;
}

/**
 * A StateGraph event value or a function that maps a DOM event to one.
 *
 * @example
 * // Static event
 * bindEvent(btn, "click", actor, { type: "SUBMIT" })
 *
 * // Mapping function — extract value from the DOM event
 * bindEvent(input, "input", actor, (e) => ({
 *   type: "SET_VALUE",
 *   value: (e.target as HTMLInputElement).value,
 * }))
 */
export type StateEventOrMapper<TEvent extends StateGraphEvent> =
  TEvent | ((domEvent: Event) => TEvent);

// ---------------------------------------------------------------------------
// mountActor
// ---------------------------------------------------------------------------

/**
 * Create and start a StateGraph actor. Returns a stable actor handle and an
 * idempotent `cleanup` function that stops the actor when called.
 *
 * @example
 * const { actor, cleanup } = mountActor(machine)
 * // later:
 * cleanup()
 */
export function mountActor<TContext, TEvent extends StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  options?: ActorOptions<TContext, TEvent>,
): MountedActor<TContext, TEvent> {
  const actor = createActor(machine, options);
  actor.start();

  let stopped = false;
  return {
    actor,
    cleanup: (): void => {
      if (stopped) return;
      stopped = true;
      actor.stop();
    },
  };
}

// ---------------------------------------------------------------------------
// bindEvent
// ---------------------------------------------------------------------------

/**
 * Register a DOM event listener that sends a StateGraph event to an actor.
 * The `stateEvent` argument may be a static event object or a mapping
 * function that receives the DOM event and returns the StateGraph event.
 *
 * Returns an idempotent unsubscribe function that removes the listener.
 *
 * @example
 * const unsub = bindEvent(btn, "click", actor, { type: "SUBMIT" })
 * // later:
 * unsub()
 */
export function bindEvent<TEvent extends StateGraphEvent>(
  element: EventTarget,
  domEventType: string,
  actor: { send(event: TEvent): void },
  stateEvent: StateEventOrMapper<TEvent>,
): () => void {
  const handler = (domEvent: Event): void => {
    const event = typeof stateEvent === "function" ? stateEvent(domEvent) : stateEvent;
    actor.send(event);
  };

  element.addEventListener(domEventType, handler);

  let removed = false;
  return (): void => {
    if (removed) return;
    removed = true;
    element.removeEventListener(domEventType, handler);
  };
}

// ---------------------------------------------------------------------------
// onSnapshot
// ---------------------------------------------------------------------------

/**
 * Subscribe to committed actor snapshots. The handler is called each time
 * a new snapshot is produced.
 *
 * Returns an unsubscribe function.
 *
 * @example
 * const unsub = onSnapshot(actor, (snapshot) => {
 *   el.textContent = snapshot.value as string
 * })
 * // later:
 * unsub()
 */
export function onSnapshot<TContext, TEvent extends StateGraphEvent>(
  actor: ActorRef<TContext, TEvent>,
  handler: (snapshot: StateGraphSnapshot<TContext, TEvent>) => void,
): () => void {
  return actor.subscribe(handler);
}
