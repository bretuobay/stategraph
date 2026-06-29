# @stategraph/angular

> **Post-MVP - not yet published.** This package is specified but not implemented.

Angular adapter for StateGraph actors. It provides DI-first actor services, RxJS observable interop, Angular signal interop, and provider helpers for standalone and NgModule applications while preserving the core actor contract.

This adapter must follow ADR-009 and pass the shared `@stategraph/testing` adapter conformance suite before publication.

## API Contract

### `provideActor(machine, options?)`

Registers a machine-backed actor with Angular DI.

```ts
import { provideActor } from "@stategraph/angular";

bootstrapApplication(AppComponent, {
  providers: [provideActor(counterMachine)],
});
```

Required behavior:

- Creates one actor per provider scope.
- Starts the actor when the provider is instantiated.
- Stops the actor when the provider scope is destroyed.
- Works in standalone bootstrap, standalone component providers, and NgModule providers.
- Cleanup is idempotent.

### `ActorService<TMachine>`

Injectable service exposing actor operations.

```ts
import { ActorService, selectObservable, toSignal } from "@stategraph/angular";
import { Component, inject } from "@angular/core";

@Component({
  selector: "counter-button",
  template: `
    <button type="button" (click)="inc()">
      Count: {{ count() }}
    </button>
  `,
})
export class CounterButton {
  private readonly actor = inject(ActorService<typeof counterMachine>);
  readonly count = this.actor.toSignal((snap) => snap.context.count);

  inc() {
    this.actor.send({ type: "INC" });
  }
}
```

Required service surface:

```ts
class ActorService<TMachine extends AnyMachine> {
  readonly actor: ActorRef<SnapshotOf<TMachine>, EventOf<TMachine>>;
  readonly snapshot$: Observable<SnapshotOf<TMachine>>;
  send(event: EventOf<TMachine>): void;
  getSnapshot(): SnapshotOf<TMachine>;
  selectObservable<T>(
    selector: (snapshot: SnapshotOf<TMachine>) => T,
    compare?: (a: T, b: T) => boolean,
  ): Observable<T>;
  toSignal<T = SnapshotOf<TMachine>>(
    selector?: (snapshot: SnapshotOf<TMachine>) => T,
    options?: ToSignalOptions<T>,
  ): Signal<T>;
  ngOnDestroy(): void;
}
```

### `toObservable(actor)`

Creates an RxJS observable from any StateGraph actor ref.

```ts
const snapshot$ = toObservable(actor);
```

Required behavior:

- Emits the current snapshot on subscription.
- Emits each committed snapshot in actor order.
- Unsubscribes from the actor when the RxJS subscription is closed.

### `selectObservable(actor, selector, compare?)`

Creates an RxJS observable for a selected snapshot value.

```ts
const count$ = selectObservable(actor, (snap) => snap.context.count);
```

Required behavior:

- Defaults equality to `Object.is`.
- Emits the selected current value on subscription.
- Suppresses emissions when the selected value is equal by the comparator.

### `toSignal(actor, selector?, options?)`

Creates an Angular `Signal` from an actor snapshot or selected value.

```ts
const count = toSignal(actor, (snap) => snap.context.count);
```

Required behavior:

- Requires Angular 16+ signal APIs.
- Uses the actor's current snapshot for the initial signal value.
- Cleans up through the Angular injection context when available.
- Supports explicit cleanup options for advanced callers outside injection context.

## Type Requirements

- Infer `SnapshotOf<TMachine>` and `EventOf<TMachine>` from the supplied machine.
- Preserve event type safety on `send`.
- Preserve selected value types for RxJS and signal helpers.
- Expose Angular and RxJS types as peer types, not bundled framework shims.

## SSR Requirements

- The adapter must be import-safe in Angular SSR builds.
- Provider creation and signal/observable setup must not read browser globals.
- Browser-only machine effects remain the user's responsibility.

## Conformance Tests

The package must include tests covering:

- Shared adapter conformance via `defineAdapterConformanceSuite`.
- DI provider lifecycle in standalone and NgModule-style setups.
- Initial snapshot availability through service, observable, and signal APIs.
- Event dispatch through `send`.
- Selector equality with default and custom comparators.
- Provider-scope cleanup and `ngOnDestroy`.
- SSR import and render safety.

## Status

Specified post-MVP package. It must remain private and clearly unpublished until implementation, tests, and peer dependency declarations are complete.
