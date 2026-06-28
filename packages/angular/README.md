# @stategraph/angular

> **Post-MVP — not yet published.** This package is a stub. See the [roadmap](../../README.md).

Angular adapter for StateGraph actors. Will provide `provideActor`, `ActorService`, `selectObservable`, and `toSignal` helpers, matching the adapter API defined in ADR-009.

## Planned API

```ts
// Provide an actor in the component tree
providers: [provideActor(machine)]

// Inject and use
@Injectable()
class MyComponent {
  private readonly service = inject(ActorService<MyCtx, MyEvent>);
  readonly count$ = this.service.selectObservable((snap) => snap.context.count);
  send(event: MyEvent) { this.service.send(event); }
}
```

## Status

Stub package. Not installable from the registry. Watch the repository for the Angular adapter milestone.
