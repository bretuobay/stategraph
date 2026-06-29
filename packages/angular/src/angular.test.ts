import {
  createEnvironmentInjector,
  inject,
  runInInjectionContext,
  type EnvironmentInjector,
} from "@angular/core";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createActor,
  createMachine,
  fromCallback,
  setup,
  type ActorRef,
  type StateGraphSnapshot,
} from "@stategraph/core";
import { defineAdapterConformanceSuite } from "@stategraph/testing";
import {
  ActorService,
  provideActor,
  selectObservable,
  toObservable,
  type EventOf,
  type SnapshotOf,
} from ".";

describe("@stategraph/angular", () => {
  it("adapts snapshots to observables", () => {
    const machine = createMachine<unknown, { type: "NEXT" }>({
      id: "angular-observable",
      initial: "idle",
      states: { idle: { on: { NEXT: { target: "done" } } }, done: { type: "final" } },
    });
    const actor = createActor(machine).start();
    const values: unknown[] = [];
    const unsubscribe = toObservable(actor).subscribe((snapshot) => values.push(snapshot.value));

    actor.send({ type: "NEXT" });

    expect(values).toEqual(["idle", "done"]);
    unsubscribe.unsubscribe();
    actor.stop();
  });

  it("selects observable values with equality", () => {
    const machine = createMachine<unknown, { type: "NEXT" } | { type: "NOOP" }>({
      id: "angular-select",
      initial: "idle",
      states: { idle: { on: { NEXT: { target: "done" }, NOOP: {} } }, done: { type: "final" } },
    });
    const actor = createActor(machine).start();
    const values: unknown[] = [];
    const subscription = selectObservable(actor, (snapshot) => snapshot.value).subscribe((value) =>
      values.push(value),
    );

    actor.send({ type: "NOOP" });
    actor.send({ type: "NEXT" });

    expect(values).toEqual(["idle", "done"]);
    subscription.unsubscribe();
    actor.stop();
  });

  it("stops DI-owned actors when the injector is destroyed", () => {
    const cleanup = vi.fn();
    const machine = setup({
      effects: { listen: fromCallback(() => cleanup) },
    }).createMachine({
      id: "angular-lifecycle",
      initial: "active",
      states: { active: { invoke: { src: "listen" } } },
    });
    const injector = createEnvironmentInjector(
      provideActor(machine),
      null as unknown as EnvironmentInjector,
    );
    runInInjectionContext(injector, () => {
      inject(ActorService);
    });

    expect(cleanup).not.toHaveBeenCalled();
    injector.destroy();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("preserves service helper types", () => {
    const machine = setup<{ count: number }, { type: "INC" }>({}).createMachine({
      id: "angular-types",
      context: { count: 0 },
      initial: "ready",
      states: { ready: {} },
    });
    expect(machine.id).toBe("angular-types");
    expectTypeOf<SnapshotOf<typeof machine>["context"]>().toEqualTypeOf<
      Readonly<{ count: number }>
    >();
    expectTypeOf<EventOf<typeof machine>>().toEqualTypeOf<{ type: "INC" }>();
  });

  type ConformanceEvent = { type: "NEXT" } | { type: "NOOP" };

  const conformanceSuite = defineAdapterConformanceSuite<unknown, ConformanceEvent, () => void>({
    name: "angular",
    createMachine: () =>
      createMachine<unknown, ConformanceEvent>({
        id: "angular-conformance",
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
      const injector = createEnvironmentInjector(
        provideActor(machine),
        null as unknown as EnvironmentInjector,
      );
      const service = runInInjectionContext(injector, () => inject(ActorService<typeof machine>));
      const actor = service.actor as ActorRef<unknown, ConformanceEvent>;
      let latest: StateGraphSnapshot<unknown, ConformanceEvent> | null = null;
      const subscriptions = [
        service.snapshot$.subscribe((snapshot) => {
          latest = snapshot as StateGraphSnapshot<unknown, ConformanceEvent>;
          onSnapshot?.(latest);
        }),
      ];
      let cleaned = false;
      if (selector) subscriptions.push(selectObservable(actor, selector).subscribe(onSelected));
      return {
        actor,
        handle: () => injector.destroy(),
        send(event) {
          service.send(event);
        },
        getSnapshot() {
          if (!latest) throw new Error("Angular conformance service did not emit.");
          return latest;
        },
        cleanup() {
          if (cleaned) return;
          cleaned = true;
          for (const subscription of subscriptions.splice(0)) subscription.unsubscribe();
          injector.destroy();
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
