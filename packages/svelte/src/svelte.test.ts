import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  assign,
  createMachine,
  fromCallback,
  setup,
  type StateGraphSnapshot,
} from "@stategraph/core";
import { defineAdapterConformanceSuite } from "@stategraph/testing";
import { actorStore, selectorStore, type ActorStoreResult } from ".";

describe("@stategraph/svelte", () => {
  it("starts on subscribe and stops after unsubscribe", () => {
    const cleanup = vi.fn();
    const machine = setup({
      effects: { listen: fromCallback(() => cleanup) },
    }).createMachine({
      id: "svelte-lifecycle",
      initial: "active",
      states: { active: { invoke: { src: "listen" } } },
    });

    const { snapshot } = actorStore(machine);
    const unsubscribe = snapshot.subscribe(() => undefined);
    expect(cleanup).not.toHaveBeenCalled();
    unsubscribe();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("uses selector equality", () => {
    const machine = setup({
      actions: {
        inc: assign<{ count: number }>(({ context }) => ({ count: context.count + 1 })),
      },
    }).createMachine({
      id: "svelte-selector",
      context: { count: 0 },
      initial: "ready",
      states: { ready: { on: { INC: { actions: ["inc"] }, NOOP: {} } } },
    });
    const { actor, snapshot } = actorStore(machine);
    const selected: number[] = [];
    const unsubscribeSnapshot = snapshot.subscribe(() => undefined);
    const unsubscribeSelected = selectorStore(actor, (next) => next.context.count).subscribe(
      (value) => selected.push(value),
    );

    actor.send({ type: "NOOP" });
    actor.send({ type: "INC" });

    expect(selected).toEqual([0, 1]);
    unsubscribeSelected();
    unsubscribeSnapshot();
  });

  it("preserves store return type and event typing", () => {
    type Context = { value: string };
    type FormEvent = { type: "SUBMIT"; value: string } | { type: "RESET" };
    expectTypeOf(actorStore<Context, FormEvent>).toBeFunction();
    expectTypeOf<ActorStoreResult<Context, FormEvent>["send"]>().parameters.toEqualTypeOf<
      [FormEvent]
    >();
  });

  type ConformanceEvent = { type: "NEXT" } | { type: "NOOP" };

  const conformanceSuite = defineAdapterConformanceSuite<unknown, ConformanceEvent, (() => void)[]>(
    {
      name: "svelte",
      createMachine: () =>
        createMachine<unknown, ConformanceEvent>({
          id: "svelte-conformance",
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
        const result = actorStore(machine);
        let latest: StateGraphSnapshot<unknown, ConformanceEvent> | null = null;
        const cleanups = [
          result.snapshot.subscribe((snapshot) => {
            latest = snapshot;
            onSnapshot?.(snapshot);
          }),
        ];
        if (selector) {
          cleanups.push(
            selectorStore(result.actor, selector).subscribe((value) => onSelected?.(value)),
          );
        }
        return {
          actor: result.actor,
          handle: cleanups,
          send(event) {
            result.send(event);
          },
          getSnapshot() {
            if (!latest) throw new Error("Svelte conformance store did not emit.");
            return latest;
          },
          cleanup() {
            for (const cleanup of cleanups.splice(0)) cleanup();
          },
        };
      },
    },
  );

  for (const testCase of conformanceSuite.tests) {
    it(`passes shared conformance: ${testCase.name}`, async () => {
      await testCase.run();
    });
  }
});
