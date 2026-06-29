import { DestroyRef, InjectionToken, inject, type Provider, type Signal } from "@angular/core";
import { toSignal as observableToSignal, type ToSignalOptions } from "@angular/core/rxjs-interop";
import { Observable, distinctUntilChanged, map } from "rxjs";
import {
  createActor,
  type ActorOptions,
  type ActorRef,
  type StateGraphEvent,
  type StateGraphMachine,
  type StateGraphSnapshot,
} from "@stategraph/core";

export const STATEGRAPH_ANGULAR_PACKAGE = "@stategraph/angular";

export const STATEGRAPH_ACTOR = new InjectionToken<ActorRef<unknown, StateGraphEvent>>(
  "STATEGRAPH_ACTOR",
);

export type SnapshotOf<TMachine> =
  TMachine extends StateGraphMachine<infer TContext, infer TEvent>
    ? StateGraphSnapshot<TContext, TEvent>
    : never;

export type EventOf<TMachine> =
  TMachine extends StateGraphMachine<infer TContext, infer TEvent>
    ? TContext extends unknown
      ? TEvent
      : never
    : never;

export type ActorOf<TMachine> =
  TMachine extends StateGraphMachine<infer TContext, infer TEvent>
    ? ActorRef<TContext, TEvent>
    : ActorRef<unknown, StateGraphEvent>;

export type StateGraphToSignalOptions<TValue> = Omit<
  ToSignalOptions<TValue>,
  "initialValue" | "requireSync"
>;

export class ActorService<TMachine = StateGraphMachine<unknown, StateGraphEvent>> {
  readonly snapshot$: Observable<SnapshotOf<TMachine>>;

  constructor(readonly actor: ActorOf<TMachine>) {
    this.snapshot$ = toObservable(this.actor) as Observable<SnapshotOf<TMachine>>;
  }

  send(event: EventOf<TMachine>): void {
    this.actor.send(event);
  }

  getSnapshot(): SnapshotOf<TMachine> {
    return this.actor.getSnapshot() as SnapshotOf<TMachine>;
  }

  selectObservable<TValue>(
    selector: (snapshot: SnapshotOf<TMachine>) => TValue,
    compare: (a: TValue, b: TValue) => boolean = Object.is,
  ): Observable<TValue> {
    return selectObservable(
      this.actor,
      selector as (snapshot: StateGraphSnapshot<unknown, StateGraphEvent>) => TValue,
      compare,
    );
  }

  toSignal<TValue = SnapshotOf<TMachine>>(
    selector?: (snapshot: SnapshotOf<TMachine>) => TValue,
    options?: StateGraphToSignalOptions<TValue>,
  ): Signal<TValue> {
    return toSignal(
      this.actor,
      selector as ((snapshot: StateGraphSnapshot<unknown, StateGraphEvent>) => TValue) | undefined,
      options,
    );
  }

  ngOnDestroy(): void {
    this.actor.stop();
  }
}

export function provideActor<TContext, TEvent extends StateGraphEvent>(
  machine: StateGraphMachine<TContext, TEvent>,
  options?: ActorOptions<TContext, TEvent>,
): Provider[] {
  return [
    {
      provide: STATEGRAPH_ACTOR,
      useFactory: () => {
        const actor = createActor(machine, options);
        actor.start();
        const destroyRef = inject(DestroyRef, { optional: true });
        destroyRef?.onDestroy(() => actor.stop());
        return actor;
      },
    },
    {
      provide: ActorService,
      useFactory: () => new ActorService(inject(STATEGRAPH_ACTOR)),
    },
  ];
}

export function toObservable<TContext, TEvent extends StateGraphEvent>(
  actor: ActorRef<TContext, TEvent>,
): Observable<StateGraphSnapshot<TContext, TEvent>> {
  return new Observable((subscriber) => {
    const unsubscribe = actor.subscribe((snapshot) => subscriber.next(snapshot));
    return unsubscribe;
  });
}

export function selectObservable<TContext, TEvent extends StateGraphEvent, TValue>(
  actor: ActorRef<TContext, TEvent>,
  selector: (snapshot: StateGraphSnapshot<TContext, TEvent>) => TValue,
  compare: (a: TValue, b: TValue) => boolean = Object.is,
): Observable<TValue> {
  return toObservable(actor).pipe(map(selector), distinctUntilChanged(compare));
}

export function toSignal<
  TContext,
  TEvent extends StateGraphEvent,
  TValue = StateGraphSnapshot<TContext, TEvent>,
>(
  actor: ActorRef<TContext, TEvent>,
  selector?: (snapshot: StateGraphSnapshot<TContext, TEvent>) => TValue,
  options?: StateGraphToSignalOptions<TValue>,
): Signal<TValue> {
  const initialSnapshot = actor.getSnapshot();
  const source = selector
    ? selectObservable(actor, selector)
    : (toObservable(actor) as Observable<TValue>);
  const initialValue = selector
    ? selector(initialSnapshot)
    : (initialSnapshot as unknown as TValue);
  const signalOptions = { ...options, initialValue } as {
    initialValue: TValue;
    requireSync?: false;
  };
  return observableToSignal(source, signalOptions);
}
