// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick, type Component } from "vue";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  assign,
  createActor,
  createMachine,
  fromCallback,
  setup,
  type ActorRef,
} from "@stategraph/core";
import { defineAdapterConformanceSuite } from "@stategraph/testing";
import {
  provideActor,
  useActor,
  useActorContext,
  useActorRef,
  useSelector,
  type UseActorResult,
} from ".";

interface MountedApp {
  unmount(): void;
}

const mounted: MountedApp[] = [];

function mount(component: Component): MountedApp {
  const element = document.createElement("div");
  document.body.append(element);
  const app = createApp(component);
  app.mount(element);
  const mountedApp = {
    unmount() {
      app.unmount();
      element.remove();
    },
  };
  mounted.push(mountedApp);
  return mountedApp;
}

afterEach(() => {
  for (const app of mounted.splice(0)) app.unmount();
});

describe("@stategraph/vue", () => {
  it("starts and stops adapter-owned actors", () => {
    const cleanup = vi.fn();
    const machine = setup({
      effects: { listen: fromCallback(() => cleanup) },
    }).createMachine({
      id: "vue-lifecycle",
      initial: "active",
      states: { active: { invoke: { src: "listen" } } },
    });

    const app = mount(
      defineComponent({
        setup() {
          const { snapshot } = useActor(machine);
          return () => h("output", snapshot.value.status);
        },
      }),
    );

    expect(cleanup).not.toHaveBeenCalled();
    app.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("uses selector equality", async () => {
    type SelectorEvent = { type: "INC" } | { type: "NOOP" };
    const machine = setup<{ count: number }, SelectorEvent>({
      actions: {
        inc: assign<{ count: number }>(({ context }) => ({ count: context.count + 1 })),
      },
    }).createMachine({
      id: "vue-selector",
      context: { count: 0 },
      initial: "ready",
      states: { ready: { on: { INC: { actions: ["inc"] }, NOOP: {} } } },
    });
    const selected: number[] = [];
    const holder: { send?: (event: SelectorEvent) => void } = {};

    mount(
      defineComponent({
        setup() {
          const actor = useActorRef(machine);
          holder.send = (event) => actor.send(event);
          const count = useSelector(actor, (snapshot) => snapshot.context.count);
          return () => {
            selected.push(count.value);
            return h("output", count.value);
          };
        },
      }),
    );

    holder.send?.({ type: "NOOP" });
    await nextTick();
    holder.send?.({ type: "INC" });
    await nextTick();

    expect(selected).toEqual([0, 1]);
  });

  it("shares an actor through provide/inject", () => {
    const machine = createMachine({
      id: "vue-context",
      initial: "idle",
      states: { idle: {} },
    });
    const actor = createActor(machine).start();
    let injected: typeof actor | null = null;

    const Child = defineComponent({
      setup() {
        injected = useActorContext();
        return () => h("output");
      },
    });

    mount(
      defineComponent({
        setup() {
          provideActor(actor);
          return () => h(Child);
        },
      }),
    );

    expect(injected).toBe(actor);
  });

  it("preserves composable return type and event typing", () => {
    type Context = { value: string };
    type FormEvent = { type: "SUBMIT"; value: string } | { type: "RESET" };
    expectTypeOf(useActor<Context, FormEvent>).toBeFunction();
    expectTypeOf<UseActorResult<Context, FormEvent>["send"]>().parameters.toEqualTypeOf<
      [FormEvent]
    >();
  });

  type ConformanceEvent = { type: "NEXT" } | { type: "NOOP" };

  const conformanceSuite = defineAdapterConformanceSuite<unknown, ConformanceEvent, MountedApp>({
    name: "vue",
    createMachine: () =>
      createMachine<unknown, ConformanceEvent>({
        id: "vue-conformance",
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
      let send: ((event: ConformanceEvent) => void) | null = null;
      const unsubscribes: Array<() => void> = [];
      const app = mount(
        defineComponent({
          setup() {
            const result = useActor(machine);
            if (selector) {
              const selected = useSelector(result.actor, selector);
              onSelected?.(selected.value);
              unsubscribes.push(result.actor.select(selector, (value) => onSelected?.(value)));
            }
            actor = result.actor;
            send = result.send;
            unsubscribes.push(result.actor.subscribe((snapshot) => onSnapshot?.(snapshot)));
            return () => {
              return h("output");
            };
          },
        }),
      );
      return {
        actor: actor!,
        handle: app,
        send(event) {
          send?.(event);
        },
        getSnapshot() {
          if (!actor) throw new Error("Vue conformance component did not render.");
          return actor.getSnapshot();
        },
        cleanup() {
          for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
          app.unmount();
        },
      };
    },
  });

  for (const testCase of conformanceSuite.tests) {
    it(`passes shared conformance: ${testCase.name}`, async () => {
      await testCase.run();
      await nextTick();
    });
  }
});
