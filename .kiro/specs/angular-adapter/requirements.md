# Angular Adapter Requirements

## Introduction

This spec defines `@stategraph/angular`, the Angular adapter for StateGraph actors. It provides DI-friendly actor services plus observable and signal interop while preserving core runtime semantics.

## Requirements

### Requirement 1: Dependency Injection and Services

**User story:** As an Angular developer, I want an injectable actor service so StateGraph works with DI and component lifecycle cleanup.

#### Acceptance Criteria

1. WHEN `provideActor(machine, options?)` is used THEN it SHALL make an actor available through Angular DI.
2. WHEN `ActorService` is injected THEN it SHALL expose the actor ref, a snapshot stream, and `send`.
3. WHEN the service is destroyed THEN adapter-owned subscriptions SHALL be cleaned up and actor-owned effects SHALL be stopped.

### Requirement 2: RxJS and Signal Interop

**User story:** As an Angular developer, I want observable and signal helpers so I can connect StateGraph state to Angular templates and reactive code.

#### Acceptance Criteria

1. WHEN `toObservable(actor)` is called THEN it SHALL expose a snapshot observable from the public actor contract.
2. WHEN `selectObservable(actor, selector)` is called THEN it SHALL emit only when the selected value changes.
3. WHEN `toSignal(actor, selector?)` is used THEN it SHALL expose a signal compatible with Angular 16+ signal usage.

### Requirement 3: Boundaries and Compatibility

**User story:** As a maintainer, I want the adapter thin and framework-native so it cannot diverge from core semantics.

#### Acceptance Criteria

1. WHEN the adapter imports core APIs THEN it SHALL import only from the public `@stategraph/core` barrel.
2. WHEN the adapter is used in standalone components or NgModule-based apps THEN it SHALL remain compatible with both integration styles.
3. WHEN SSR or server rendering is used THEN the adapter SHALL avoid side effects during render and keep actor lifecycle explicit.

### Requirement 4: Testing

**User story:** As an adapter maintainer, I want conformance and Angular-specific tests so the adapter remains compatible with core semantics.

#### Acceptance Criteria

1. WHEN adapter tests run THEN they SHALL include the shared adapter conformance suite.
2. WHEN framework-specific tests run THEN they SHALL cover DI setup, service cleanup, observable selection, signal interop, and SSR-safe behavior where applicable.
