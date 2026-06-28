import { describe, expect, it, vi } from "vitest";
import {
  assign,
  createActor,
  createMachine,
  fromCallback,
  fromObservable,
  fromPromise,
  setup,
} from ".";

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
    expect(actor.getSnapshot().transitions).toEqual([
      { source: "form.idle", target: "form.done", eventType: "SUBMIT" },
    ]);
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
