import type {
  AssignAction,
  EffectControls,
  EffectDefinition,
  RuntimeArgs,
  StateGraphEvent,
} from "./types";

export function assign<TContext, TEvent extends StateGraphEvent = StateGraphEvent>(
  mapper:
    | ((args: RuntimeArgs<TContext, TEvent>) => Partial<TContext>)
    | {
        [K in keyof TContext]?: (args: RuntimeArgs<TContext, TEvent>) => TContext[K];
      },
): AssignAction<TContext, TEvent> {
  return {
    kind: "assign",
    resolve(args) {
      if (typeof mapper === "function") return mapper(args);

      const patch: Partial<TContext> = {};
      for (const [key, valueMapper] of Object.entries(mapper) as Array<
        [keyof TContext, (args: RuntimeArgs<TContext, TEvent>) => TContext[keyof TContext]]
      >) {
        patch[key] = valueMapper(args);
      }
      return patch;
    },
  };
}

export function fromPromise<TInput, TOutput>(
  fn: (args: { input: TInput; signal: AbortSignal }) => Promise<TOutput>,
): EffectDefinition<TInput, TOutput> {
  return {
    kind: "promise",
    run(input, controls) {
      return fn({ input, signal: controls.signal });
    },
  };
}

export function fromCallback<TInput>(
  fn: (args: {
    input: TInput;
    sendBack: (event: StateGraphEvent) => void;
    receive: (listener: (event: StateGraphEvent) => void) => () => void;
    signal: AbortSignal;
  }) => void | (() => void),
): EffectDefinition<TInput, unknown> {
  return {
    kind: "callback",
    run(input, controls: EffectControls<unknown>) {
      return fn({
        input,
        sendBack: (event) => controls.sendBack(event),
        receive: (listener) => controls.receive(listener),
        signal: controls.signal,
      });
    },
  };
}

export function fromObservable<TInput, TOutput>(
  fn: (args: { input: TInput }) => unknown,
): EffectDefinition<TInput, TOutput> {
  void fn;
  return {
    kind: "observable",
    run() {
      throw new Error("fromObservable is a post-MVP stub and is not executable yet.");
    },
  };
}
