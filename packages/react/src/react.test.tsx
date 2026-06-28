// @vitest-environment happy-dom

import { createElement, act, useEffect, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  assign,
  createActor,
  createMachine,
  fromCallback,
  setup,
  type ActorRef,
  type StateGraphSnapshot,
} from "@stategraph/core";
import { defineAdapterConformanceSuite } from "@stategraph/testing";
import {
  StateGraphProvider,
  useActor,
  useActorContext,
  useActorRef,
  useSelector,
  useSend,
  type UseActorResult,
} from ".";

interface MountedRoot {
  root: Root;
  element: HTMLDivElement;
}

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const mountedRoots: MountedRoot[] = [];

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(element: ReactElement): MountedRoot {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push({ root, element: container });
  act(() => {
    root.render(element);
  });
  return { root, element: container };
}

function stringifyStateValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

afterEach(() => {
  for (const { root, element } of mountedRoots.splice(0)) {
    act(() => root.unmount());
    element.remove();
  }
});

describe("@stategraph/react", () => {
  it("starts and stops adapter-owned actors through useActor", () => {
    const cleanup = vi.fn();
    const machine = setup({
      effects: {
        listen: fromCallback(() => cleanup),
      },
    }).createMachine({
      id: "adapter-lifecycle",
      initial: "active",
      states: {
        active: { invoke: { src: "listen" } },
      },
    });

    let status = "";
    function Component() {
      const { snapshot } = useActor(machine);
      status = snapshot.status;
      return createElement("output", null, snapshot.status);
    }

    const { root } = mount(createElement(Component));
    expect(status).toBe("active");
    expect(cleanup).not.toHaveBeenCalled();

    act(() => root.unmount());
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("keeps useActorRef stable without subscribing renders to snapshots", () => {
    const machine = createMachine({
      id: "stable-ref",
      initial: "idle",
      states: {
        idle: { on: { NEXT: { target: "done" } } },
        done: { type: "final" },
      },
    });

    let renders = 0;
    let send: ((event: { type: "NEXT" }) => void) | null = null;

    function Component() {
      renders += 1;
      const actor = useActorRef(machine);
      send = useSend(actor);
      return createElement("output", null, actor.getSnapshot().status);
    }

    mount(createElement(Component));
    expect(renders).toBe(1);

    act(() => send?.({ type: "NEXT" }));
    expect(renders).toBe(1);
  });

  it("uses selector equality to avoid unrelated rerenders", () => {
    const machine = setup({
      actions: {
        increment: assign<{ count: number }>(({ context }) => ({ count: context.count + 1 })),
      },
    }).createMachine({
      id: "selector",
      context: { count: 0 },
      initial: "ready",
      states: {
        ready: {
          on: {
            INC: { actions: ["increment"] },
            NOOP: {},
          },
        },
      },
    });

    let renders = 0;
    let send: ((event: { type: "INC" } | { type: "NOOP" }) => void) | null = null;

    function Component() {
      renders += 1;
      const actor = useActorRef(machine);
      send = useSend(actor);
      const count = useSelector(actor, (snapshot) => snapshot.context.count);
      return createElement("output", null, count);
    }

    mount(createElement(Component));
    const baseline = renders;

    act(() => send?.({ type: "NOOP" }));
    expect(renders).toBe(baseline);

    act(() => send?.({ type: "INC" }));
    expect(renders).toBe(baseline + 1);
  });

  it("shares an existing actor through StateGraphProvider", () => {
    const machine = createMachine({
      id: "context",
      initial: "idle",
      states: {
        idle: { on: { NEXT: { target: "done" } } },
        done: { type: "final" },
      },
    });
    const actor = createActor(machine).start();
    let contextActor: typeof actor | null = null;

    function Child() {
      contextActor = useActorContext();
      const value = contextActor.getSnapshot().value;
      return createElement(
        "output",
        null,
        typeof value === "string" ? value : JSON.stringify(value),
      );
    }

    mount(createElement(StateGraphProvider, { actor }, createElement(Child)));

    expect(contextActor).toBe(actor);
  });

  it("throws a descriptive error when actor context is missing", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    function MissingProvider() {
      useActorContext();
      return null;
    }

    expect(() => mount(createElement(MissingProvider))).toThrow(
      "useActorContext must be used within a StateGraphProvider.",
    );
    errorSpy.mockRestore();
  });

  it("renders safely in SSR without starting adapter-owned actors", () => {
    const machine = createMachine({
      id: "ssr",
      initial: "idle",
      states: {
        idle: {},
      },
    });

    function Component() {
      const { snapshot } = useActor(machine);
      return createElement("output", null, snapshot.status);
    }

    expect(renderToString(createElement(Component))).toContain("idle");
  });

  it("preserves hook return type and event typing", () => {
    type Context = { value: string };
    type FormEvent = { type: "SUBMIT"; value: string } | { type: "RESET" };
    expectTypeOf(useActor<Context, FormEvent>).toBeFunction();
    expectTypeOf<UseActorResult<Context, FormEvent>["send"]>().parameters.toEqualTypeOf<
      [FormEvent]
    >();
  });

  type ConformanceEvent = { type: "NEXT" } | { type: "NOOP" };

  const conformanceSuite = defineAdapterConformanceSuite<unknown, ConformanceEvent, Root>({
    name: "react",
    createMachine: () =>
      createMachine<unknown, ConformanceEvent>({
        id: "react-conformance",
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
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      let actor: ActorRef<unknown, ConformanceEvent> | null = null;
      let latestSnapshot: StateGraphSnapshot<unknown, ConformanceEvent> | null = null;
      let send: ((event: { type: "NEXT" } | { type: "NOOP" }) => void) | null = null;

      function Component() {
        const result = useActor(machine);
        const selected = selector ? useSelector(result.actor, selector) : undefined;
        actor = result.actor;
        latestSnapshot = result.snapshot;
        send = result.send;

        useEffect(() => {
          onSnapshot?.(result.snapshot);
        }, [result.snapshot]);

        useEffect(() => {
          if (selector) onSelected?.(selected);
        }, [selected]);

        return createElement("output", null, stringifyStateValue(result.snapshot.value));
      }

      act(() => root.render(createElement(Component)));

      let cleaned = false;
      return {
        actor: actor!,
        handle: root,
        send(event) {
          act(() => send?.(event));
        },
        getSnapshot() {
          if (!latestSnapshot) throw new Error("React conformance component did not render.");
          return latestSnapshot;
        },
        cleanup() {
          if (cleaned) return;
          cleaned = true;
          act(() => root.unmount());
          container.remove();
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
