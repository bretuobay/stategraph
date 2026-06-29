import { createRoot } from "solid-js";
import { createComponent } from "solid-js/web";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  assign,
  createActor as createCoreActor,
  createMachine,
  fromCallback,
  setup,
  type ActorRef,
  type StateGraphSnapshot,
} from "@stategraph/core";
import { defineAdapterConformanceSuite } from "@stategraph/testing";
import {
  StateGraphProvider,
  createActor,
  createSelector,
  useActorContext,
  type CreateActorResult,
} from ".";

describe("@stategraph/solid", () => {
  it("starts and stops adapter-owned actors", () => {
    const cleanup = vi.fn();
    const machine = setup({
      effects: { listen: fromCallback(() => cleanup) },
    }).createMachine({
      id: "solid-lifecycle",
      initial: "active",
      states: { active: { invoke: { src: "listen" } } },
    });

    const dispose = createRoot((disposeRoot) => {
      createActor(machine);
      return disposeRoot;
    });

    expect(cleanup).not.toHaveBeenCalled();
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("uses selector equality", () => {
    type SelectorEvent = { type: "INC" } | { type: "NOOP" };
    const machine = setup<{ count: number }, SelectorEvent>({
      actions: {
        inc: assign<{ count: number }>(({ context }) => ({ count: context.count + 1 })),
      },
    }).createMachine({
      id: "solid-selector",
      context: { count: 0 },
      initial: "ready",
      states: { ready: { on: { INC: { actions: ["inc"] }, NOOP: {} } } },
    });
    const selected: number[] = [];
    const holder: { send?: (event: SelectorEvent) => void } = {};

    const dispose = createRoot((disposeRoot) => {
      const [, , actorRef] = createActor(machine);
      holder.send = (event) => actorRef.send(event);
      const count = createSelector(actorRef, (snapshot) => snapshot.context.count);
      expect(count()).toBe(0);
      actorRef.select(
        (snapshot) => snapshot.context.count,
        (value) => selected.push(value),
      );
      return disposeRoot;
    });

    holder.send?.({ type: "NOOP" });
    holder.send?.({ type: "INC" });
    expect(selected).toEqual([0, 1]);
    dispose();
  });

  it("shares an actor through context", () => {
    const machine = createMachine({
      id: "solid-context",
      initial: "idle",
      states: { idle: {} },
    });
    const actor = createCoreActor(machine).start();
    let injected: typeof actor | null = null;

    createRoot((dispose) => {
      function Child() {
        injected = useActorContext();
        return null;
      }
      createComponent(StateGraphProvider, {
        actor,
        get children() {
          return createComponent(Child, {});
        },
      });
      dispose();
    });

    expect(injected).toBe(actor);
  });

  it("preserves tuple return type and event typing", () => {
    type Context = { value: string };
    type FormEvent = { type: "SUBMIT"; value: string } | { type: "RESET" };
    expectTypeOf(createActor<Context, FormEvent>).toBeFunction();
    expectTypeOf<CreateActorResult<Context, FormEvent>[1]>().parameters.toEqualTypeOf<
      [FormEvent]
    >();
  });

  type ConformanceEvent = { type: "NEXT" } | { type: "NOOP" };

  const conformanceSuite = defineAdapterConformanceSuite<unknown, ConformanceEvent, () => void>({
    name: "solid",
    createMachine: () =>
      createMachine<unknown, ConformanceEvent>({
        id: "solid-conformance",
        initial: "idle",
        states: {
          idle: { on: { NEXT: { target: "done" }, NOOP: {} } },
          done: { type: "final" },
        },
      }),
    dispatchEvent: { type: "NEXT" },
    noopEvent: { type: "NOOP" },
    expectInitial: (snapshot) => expect(snapshot.value).toBe("idle"),
    expectAfterDispatch: (snapshot) => expect(snapshot.value).toBe("done"),
    mount: ({ machine, onSnapshot, selector, onSelected }) => {
      let actor: ActorRef<unknown, ConformanceEvent> | null = null;
      let snapshot: StateGraphSnapshot<unknown, ConformanceEvent> | null = null;
      let send: ((event: ConformanceEvent) => void) | null = null;
      const dispose = createRoot((disposeRoot) => {
        const [snapshotAccessor, sendEvent, actorRef] = createActor(machine);
        actor = actorRef;
        send = sendEvent;
        snapshot = snapshotAccessor();
        onSnapshot?.(snapshot);
        actorRef.subscribe((nextSnapshot) => {
          snapshot = nextSnapshot;
          onSnapshot?.(nextSnapshot);
        });
        if (selector) {
          const selected = createSelector(actorRef, selector);
          onSelected?.(selected());
          actorRef.select(selector, (value) => onSelected?.(value));
        }
        return disposeRoot;
      });
      return {
        actor: actor!,
        handle: dispose,
        send(event) {
          send?.(event);
        },
        getSnapshot() {
          if (!snapshot) throw new Error("Solid conformance root did not run.");
          return snapshot;
        },
        cleanup() {
          dispose();
        },
      };
    },
  });

  for (const testCase of conformanceSuite.tests) {
    it(`passes shared conformance: ${testCase.name}`, async () => {
      await testCase.run();
    });
  }
});
