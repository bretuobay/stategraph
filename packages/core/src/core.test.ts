import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  assign,
  createActor,
  createMachine,
  fromCallback,
  fromObservable,
  fromPromise,
  setup,
} from ".";
import type { ActorRef, StateGraphEvent, StateGraphSnapshot } from ".";

describe("@stategraph/core", () => {
  it("creates a typed setup machine and serializable IR", () => {
    const machine = setup({
      guards: {
        canStart: ({ context }: { context: { allowed: boolean } }) => context.allowed,
      },
    }).createMachine({
      id: "flow",
      context: { allowed: true },
      initial: "idle",
      states: {
        idle: {
          on: { START: { target: "active", guard: "canStart" } },
        },
        active: { type: "final" },
      },
    });

    expect(machine.toIR()).toMatchObject({
      id: "flow",
      events: ["START"],
      guards: ["canStart"],
    });
    expect(JSON.stringify(machine.definition)).toContain('"START"');
  });

  it("starts actors deterministically and processes guarded transitions", () => {
    const machine = setup({
      guards: {
        isValid: ({ context }: { context: { valid: boolean } }) => context.valid,
      },
      actions: {
        markSubmitted: assign<{ valid: boolean; submitted: boolean }>(() => ({ submitted: true })),
      },
    }).createMachine({
      id: "form",
      context: { valid: true, submitted: false },
      initial: "idle",
      states: {
        idle: {
          on: {
            SUBMIT: { target: "done", guard: "isValid", actions: ["markSubmitted"] },
          },
        },
        done: { type: "final" },
      },
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().event).toEqual({ type: "@@INIT" });
    expect(actor.getSnapshot().value).toBe("idle");

    actor.send({ type: "SUBMIT" });

    expect(actor.getSnapshot().status).toBe("done");
    expect(actor.getSnapshot().value).toBe("done");
    expect(actor.getSnapshot().context).toEqual({ valid: true, submitted: true });
    expect(actor.getSnapshot().firedTransitions).toEqual([
      { source: "form.idle", target: "form.done", eventType: "SUBMIT" },
    ]);
  });

  it("nextEvents lists event types available from the current state", () => {
    const machine = createMachine({
      id: "nav",
      initial: "idle",
      states: {
        idle: { on: { START: { target: "running" }, RESET: {} } },
        running: { on: { STOP: { target: "idle" } } },
      },
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().nextEvents).toEqual(["RESET", "START"]);

    actor.send({ type: "START" });
    expect(actor.getSnapshot().nextEvents).toEqual(["STOP"]);
  });

  it("nextEvents includes events inherited from ancestor states", () => {
    const machine = createMachine({
      id: "bubbling",
      initial: "outer",
      states: {
        outer: {
          initial: "inner",
          on: { CANCEL: { target: "cancelled" } },
          states: {
            inner: { on: { PROCEED: { target: "done" } } },
            done: { type: "final" },
          },
        },
        cancelled: { type: "final" },
      },
    });

    const actor = createActor(machine).start();
    // inner contributes PROCEED; outer contributes CANCEL
    expect(actor.getSnapshot().nextEvents).toEqual(["CANCEL", "PROCEED"]);
  });

  it("nextEvents covers all active regions in a parallel machine", () => {
    const machine = createMachine({
      id: "parallel",
      type: "parallel",
      states: {
        playback: {
          initial: "paused",
          states: {
            paused: { on: { PLAY: { target: "playing" } } },
            playing: { on: { PAUSE: { target: "paused" } } },
          },
        },
        volume: {
          initial: "unmuted",
          states: {
            unmuted: { on: { MUTE: { target: "muted" } } },
            muted: { on: { UNMUTE: { target: "unmuted" } } },
          },
        },
      },
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().nextEvents).toEqual(["MUTE", "PLAY"]);
  });

  it("nextEvents is empty on a final state", () => {
    const machine = createMachine({
      id: "done",
      initial: "active",
      states: {
        active: { on: { FINISH: { target: "final" } } },
        final: { type: "final" },
      },
    });

    const actor = createActor(machine).start();
    actor.send({ type: "FINISH" });
    expect(actor.getSnapshot().status).toBe("done");
    expect(actor.getSnapshot().nextEvents).toEqual([]);
  });

  it("supports targetless transitions and selector equality", () => {
    const machine = setup({
      actions: {
        increment: assign<{ count: number }>(({ context }) => ({ count: context.count + 1 })),
      },
    }).createMachine({
      id: "counter",
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

    const actor = createActor(machine).start();
    const selected: number[] = [];
    actor.select(
      (snapshot) => snapshot.context.count,
      (count) => selected.push(count),
    );

    actor.send({ type: "INC" });
    actor.send({ type: "NOOP" });

    expect(actor.getSnapshot().value).toBe("ready");
    expect(actor.getSnapshot().context.count).toBe(1);
    expect(selected).toEqual([0, 1]);
  });

  it("supports parallel regions with independent transitions", () => {
    const machine = createMachine({
      id: "player",
      type: "parallel",
      states: {
        playback: {
          initial: "paused",
          states: {
            paused: { on: { PLAY: { target: "playing" } } },
            playing: { on: { PAUSE: { target: "paused" } } },
          },
        },
        panel: {
          initial: "closed",
          states: {
            closed: { on: { TOGGLE: { target: "open" } } },
            open: { on: { TOGGLE: { target: "closed" } } },
          },
        },
      },
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().configuration).toEqual(
      new Set(["player.playback.paused", "player.panel.closed"]),
    );

    actor.send({ type: "PLAY" });
    actor.send({ type: "TOGGLE" });

    expect(actor.getSnapshot().configuration).toEqual(
      new Set(["player.playback.playing", "player.panel.open"]),
    );
  });

  it("runs promise effects and follows invoke completion transitions", async () => {
    const machine = setup({
      effects: {
        load: fromPromise(() => Promise.resolve("ok")),
      },
    }).createMachine({
      id: "loader",
      initial: "loading",
      states: {
        loading: {
          invoke: {
            src: "load",
            onDone: { target: "success" },
            onError: { target: "failure" },
          },
        },
        success: { type: "final" },
        failure: { type: "final" },
      },
    });

    const actor = createActor(machine).start();
    expect(actor.getSnapshot().pendingEffects[0]?.src).toBe("load");
    await vi.waitFor(() => expect(actor.getSnapshot().value).toBe("success"));
  });

  it("cancels callback effects on state exit", () => {
    const cleanup = vi.fn();
    const machine = setup({
      effects: {
        listen: fromCallback(() => cleanup),
      },
    }).createMachine({
      id: "socket",
      initial: "connected",
      states: {
        connected: {
          invoke: { src: "listen" },
          on: { CLOSE: { target: "closed" } },
        },
        closed: { type: "final" },
      },
    });

    const actor = createActor(machine).start();
    actor.send({ type: "CLOSE" });
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("runs delayed transitions and cancels timers on exit", () => {
    vi.useFakeTimers();
    try {
      const machine = createMachine({
        id: "timer",
        initial: "waiting",
        states: {
          waiting: {
            after: { 100: { target: "done" } },
            on: { CANCEL: { target: "cancelled" } },
          },
          done: { type: "final" },
          cancelled: { type: "final" },
        },
      });

      const actor = createActor(machine).start();
      actor.send({ type: "CANCEL" });
      vi.advanceTimersByTime(100);

      expect(actor.getSnapshot().value).toBe("cancelled");
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws when actions mutate runtime context in dev mode", () => {
    const machine = setup({
      actions: {
        mutate: ({ context }: { context: Readonly<{ count: number }> }) => {
          (context as { count: number }).count += 1;
        },
      },
    }).createMachine({
      id: "mutation",
      context: { count: 0 },
      initial: "idle",
      states: {
        idle: { on: { MUTATE: { actions: ["mutate"] } } },
      },
    });

    const actor = createActor(machine).start();
    expect(() => actor.send({ type: "MUTATE" })).toThrow();
    expect(actor.getSnapshot().context.count).toBe(0);
  });

  it("emits trace events through inspect", () => {
    const machine = createMachine({
      id: "trace",
      initial: "idle",
      states: {
        idle: { on: { GO: { target: "done" } } },
        done: { type: "final" },
      },
    });
    const events: string[] = [];
    const actor = createActor(machine, { inspect: (event) => events.push(event.type) }).start();
    actor.send({ type: "GO" });

    expect(events).toContain("@actor.started");
    expect(events).toContain("@event.received");
    expect(events).toContain("@transition.fired");
  });

  it("throws from the MVP observable stub", () => {
    const effect = fromObservable(() => undefined);
    expect(() =>
      effect.run(undefined, {
        signal: new AbortController().signal,
        sendBack: () => undefined,
        receive: () => () => undefined,
        resolve: () => undefined,
        reject: () => undefined,
      }),
    ).toThrow("post-MVP stub");
  });
});

// ---------------------------------------------------------------------------
// TRD §10.1 runtime conformance suite
// ---------------------------------------------------------------------------

describe("@stategraph/core — transition priority and event bubbling", () => {
  it("leaf transition wins over ancestor for the same event", () => {
    // Both outer and inner handle "GO"; inner's transition should fire because
    // findTransitionFromLeaf walks leaf-first.
    const machine = createMachine({
      id: "priority",
      initial: "outer",
      states: {
        outer: {
          initial: "inner",
          on: { GO: { target: "fallback" } },
          states: {
            inner: { on: { GO: { target: "inner_done" } } },
            inner_done: { type: "final" },
          },
        },
        fallback: { type: "final" },
      },
    });

    const actor = createActor(machine).start();
    actor.send({ type: "GO" });
    // inner_done is nested inside outer → stateValue produces a nested object
    expect(actor.getSnapshot().value).toEqual({ outer: { inner_done: "inner_done" } });
  });

  it("event bubbles to ancestor when leaf has no matching handler", () => {
    const machine = createMachine({
      id: "bubbling",
      initial: "outer",
      states: {
        outer: {
          initial: "inner",
          on: { ESCAPE: { target: "escaped" } },
          states: { inner: {} },
        },
        escaped: { type: "final" },
      },
    });

    const actor = createActor(machine).start();
    actor.send({ type: "ESCAPE" });
    expect(actor.getSnapshot().value).toBe("escaped");
  });
});

describe("@stategraph/core — entry/exit ordering", () => {
  it("parent entry fires before child entry on initial entry", () => {
    const log: string[] = [];
    const machine = setup({
      actions: {
        logOuter: () => {
          log.push("outer");
        },
        logInner: () => {
          log.push("inner");
        },
      },
    }).createMachine({
      id: "entry-order",
      initial: "outer",
      states: {
        outer: {
          entry: ["logOuter"],
          initial: "inner",
          states: { inner: { entry: ["logInner"] } },
        },
      },
    });

    createActor(machine).start();
    expect(log).toEqual(["outer", "inner"]);
  });

  it("exit fires before entry on cross-state transition", () => {
    const log: string[] = [];
    const machine = setup({
      actions: {
        onExit: () => {
          log.push("exit");
        },
        onEntry: () => {
          log.push("entry");
        },
      },
    }).createMachine({
      id: "exit-entry-order",
      initial: "a",
      states: {
        a: { exit: ["onExit"], on: { NEXT: { target: "b" } } },
        b: { entry: ["onEntry"] },
      },
    });

    const actor = createActor(machine).start();
    actor.send({ type: "NEXT" });
    expect(log).toEqual(["exit", "entry"]);
  });

  it("transition actions run between exit and entry", () => {
    const log: string[] = [];
    const machine = setup({
      actions: {
        onExit: () => {
          log.push("exit");
        },
        onTransition: () => {
          log.push("transition");
        },
        onEntry: () => {
          log.push("entry");
        },
      },
    }).createMachine({
      id: "tx-action-order",
      initial: "a",
      states: {
        a: {
          exit: ["onExit"],
          on: { NEXT: { target: "b", actions: ["onTransition"] } },
        },
        b: { entry: ["onEntry"] },
      },
    });

    const actor = createActor(machine).start();
    actor.send({ type: "NEXT" });
    expect(log).toEqual(["exit", "transition", "entry"]);
  });
});

describe("@stategraph/core — self-transitions", () => {
  it("default self-transition is internal — exit/entry do NOT fire", () => {
    const log: string[] = [];
    const machine = setup({
      actions: {
        onExit: () => {
          log.push("exit");
        },
        onEntry: () => {
          log.push("entry");
        },
      },
    }).createMachine({
      id: "self-internal",
      initial: "a",
      states: {
        a: {
          entry: ["onEntry"],
          exit: ["onExit"],
          on: { SELF: { target: "a" } },
        },
      },
    });

    const actor = createActor(machine).start();
    log.length = 0; // clear the startup entry log
    actor.send({ type: "SELF" });
    // LCA(a, a) = a → nothing exits; nothing enters
    expect(log).toEqual([]);
  });

  it("self-transition with reenter: true exits then re-enters the state", () => {
    const log: string[] = [];
    const machine = setup({
      actions: {
        onExit: () => {
          log.push("exit");
        },
        onEntry: () => {
          log.push("entry");
        },
      },
    }).createMachine({
      id: "self-reenter",
      initial: "a",
      states: {
        a: {
          entry: ["onEntry"],
          exit: ["onExit"],
          on: { SELF: { target: "a", reenter: true } },
        },
      },
    });

    const actor = createActor(machine).start();
    log.length = 0;
    actor.send({ type: "SELF" });
    expect(log).toEqual(["exit", "entry"]);
  });
});

describe("@stategraph/core — history state restoration", () => {
  it("shallow history restores the last active leaf inside a compound state", () => {
    const machine = createMachine({
      id: "hist",
      initial: "idle",
      states: {
        idle: { on: { OPEN: { target: "dialog.page1" }, REOPEN: { target: "dialog.hist" } } },
        dialog: {
          initial: "page1",
          on: { CLOSE: { target: "idle" } },
          states: {
            page1: { on: { NEXT: { target: "page2" } } },
            page2: {},
            hist: { type: "history" },
          },
        },
      },
    });

    const actor = createActor(machine).start();
    actor.send({ type: "OPEN" }); // → dialog.page1
    actor.send({ type: "NEXT" }); // → dialog.page2
    actor.send({ type: "CLOSE" }); // → idle  (history saves dialog.page2)
    expect(actor.getSnapshot().value).toBe("idle");

    actor.send({ type: "REOPEN" }); // → dialog.hist → should restore dialog.page2
    // page2 is nested inside dialog → stateValue produces a nested object
    expect(actor.getSnapshot().value).toEqual({ dialog: { page2: "page2" } });
  });

  it("history with no prior record leaves configuration empty (known gap: no default fallback)", () => {
    // When no history has been recorded and a machine transitions to a history pseudostate,
    // the runtime currently leaves the configuration empty (value = ""). A proper SCXML
    // implementation would fall back to the compound parent's initial child. Tracked as a
    // post-MVP fix; this test documents the current behaviour so regressions are caught.
    const machine = createMachine({
      id: "hist-fallback",
      initial: "idle",
      states: {
        idle: { on: { OPEN: { target: "dialog.hist" } } },
        dialog: {
          initial: "page1",
          states: {
            page1: {},
            hist: { type: "history" },
          },
        },
      },
    });

    const actor = createActor(machine).start();
    actor.send({ type: "OPEN" }); // no prior history → hist node has no stored leaves
    // Configuration becomes empty; stateValue returns "".
    expect(actor.getSnapshot().value).toBe("");
  });
});

describe("@stategraph/core — child actor lifecycle", () => {
  it("snapshot.children contains ChildActorRef for each active invoke", () => {
    const machine = setup({
      effects: { channel: fromCallback(() => undefined) },
    }).createMachine({
      id: "child-test",
      initial: "active",
      states: { active: { invoke: { src: "channel", id: "ch1" } } },
    });

    const actor = createActor(machine).start();
    const children = actor.getSnapshot().children;
    expect(Object.keys(children)).toContain("ch1");
    expect(children["ch1"]).toMatchObject({ id: "ch1" });
  });

  it("send on ChildActorRef dispatches to receive listeners inside the effect", () => {
    const received: StateGraphEvent[] = [];

    const machine = setup({
      effects: {
        channel: fromCallback(({ receive }) => {
          receive((event) => {
            received.push(event);
          });
        }),
      },
    }).createMachine({
      id: "receive-test",
      initial: "active",
      states: { active: { invoke: { src: "channel", id: "ch1" } } },
    });

    const actor = createActor(machine).start();
    const child = actor.getSnapshot().children["ch1"];
    expect(child).toBeDefined();
    child?.send({ type: "PING" });
    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe("PING");
  });

  it("stop on ChildActorRef cancels the effect", () => {
    const cleanup = vi.fn();

    const machine = setup({
      effects: { channel: fromCallback(() => cleanup) },
    }).createMachine({
      id: "stop-test",
      initial: "active",
      states: { active: { invoke: { src: "channel", id: "ch1" } } },
    });

    const actor = createActor(machine).start();
    expect(cleanup).not.toHaveBeenCalled();
    const child = actor.getSnapshot().children["ch1"];
    child?.stop();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("snapshot.children is empty after the invoking state is exited", () => {
    const machine = setup({
      effects: { channel: fromCallback(() => undefined) },
    }).createMachine({
      id: "exit-children",
      initial: "active",
      states: {
        active: {
          invoke: { src: "channel", id: "ch1" },
          on: { STOP: { target: "done" } },
        },
        done: { type: "final" },
      },
    });

    const actor = createActor(machine).start();
    expect(Object.keys(actor.getSnapshot().children)).toContain("ch1");

    actor.send({ type: "STOP" });
    expect(Object.keys(actor.getSnapshot().children)).not.toContain("ch1");
  });
});

// ---------------------------------------------------------------------------
// Compile-time type tests (run at build time; assertions are type-level only)
// ---------------------------------------------------------------------------

describe("@stategraph/core — compile-time type tests", () => {
  it("setup() infers context and event types through createMachine", () => {
    type Ctx = { count: number };
    type Evt = { type: "INC" } | { type: "RESET" };

    const machine = setup<Ctx, Evt>({
      actions: {
        increment: assign<Ctx, Evt>(({ context }) => ({ count: context.count + 1 })),
      },
    }).createMachine({
      id: "typed",
      context: { count: 0 },
      initial: "idle",
      states: { idle: { on: { INC: { actions: ["increment"] } } } },
    });

    type SnapshotCtx = ReturnType<typeof machine.toIR>["id"];
    expectTypeOf<SnapshotCtx>().toEqualTypeOf<string>();

    const actor = createActor(machine).start();
    // snapshot.context is Readonly<Ctx>
    expectTypeOf(actor.getSnapshot().context).toEqualTypeOf<Readonly<Ctx>>();
  });

  it("createActor returns ActorRef typed to the machine's context and event", () => {
    type Ctx = { value: string };
    type Evt = { type: "SET"; value: string };

    const machine = setup<Ctx, Evt>({}).createMachine({
      id: "typed-actor",
      context: { value: "" },
      initial: "idle",
      states: { idle: {} },
    });

    const actor = createActor(machine);
    expectTypeOf(actor).toMatchTypeOf<ActorRef<Ctx, Evt>>();
    expectTypeOf<(typeof actor)["getSnapshot"]>().toBeFunction();
  });

  it("snapshot is StateGraphSnapshot typed to context and event", () => {
    type Ctx = { active: boolean };
    type Evt = { type: "TOGGLE" };

    const machine = setup<Ctx, Evt>({}).createMachine({
      id: "typed-snap",
      context: { active: false },
      initial: "idle",
      states: { idle: {} },
    });

    const snapshot = createActor(machine).start().getSnapshot();
    expectTypeOf(snapshot).toMatchTypeOf<StateGraphSnapshot<Ctx, Evt>>();
    expectTypeOf(snapshot.context).toEqualTypeOf<Readonly<Ctx>>();
  });

  it("select() infers the selector return type", () => {
    type Ctx = { count: number };
    const machine = setup<Ctx, StateGraphEvent>({}).createMachine({
      id: "selector",
      context: { count: 0 },
      initial: "idle",
      states: { idle: {} },
    });

    const actor = createActor(machine).start();
    actor.select(
      (s) => s.context.count,
      (count) => {
        expectTypeOf(count).toEqualTypeOf<number>();
      },
    );
  });

  it("assign() narrows the partial context patch type", () => {
    type Ctx = { x: number; y: string };
    type AssignResult = ReturnType<typeof assign<Ctx>>;
    expectTypeOf<AssignResult["resolve"]>().toBeFunction();
  });
});
