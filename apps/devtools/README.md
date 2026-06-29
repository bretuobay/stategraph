# StateGraph DevTools

Interactive playground and live demo for `@stategraph/react/devtools`. Shows the `DevtoolsOverlay` component running against real state machines so you can see what the embedded overlay looks like in a real app.

## Running

```sh
pnpm dev --filter @stategraph/devtools
```

Opens at `http://localhost:5173` (or the next available port).

## What you see

The app runs two machines side by side — a counter and a traffic light — both wired up with `useActor` from `@stategraph/react`. The `DevtoolsOverlay` from `@stategraph/react/devtools` is mounted at the bottom of the page and auto-discovers both actors without any extra wiring.

Interact with the machines (click the counter buttons, advance the traffic light) and watch trace events appear in real time in the overlay panel.

## How to add this to your own app

```tsx
// 1. Import from the dedicated subpath — tree-shaken in production
import { DevtoolsOverlay } from "@stategraph/react/devtools";

// 2. Mount once near your app root, guarded by a dev-only condition
export function App() {
  return (
    <>
      <YourRoutes />
      {import.meta.env.DEV && <DevtoolsOverlay />}
    </>
  );
}

// 3. That's it — every useActor / useActorRef call is auto-discovered.
```

Every actor created through `useActor` or `useActorRef` anywhere in the tree registers itself automatically. No manual instrumentation required.

## Architecture

```
apps/devtools/
  src/
    main.tsx              # React root
    ui/
      App.tsx             # Thin wrapper with branding header
      Playground.tsx      # Counter + traffic light machines + DevtoolsOverlay
```

The `DevtoolsOverlay` component lives in `packages/react/src/devtools/index.tsx` and is published under the `@stategraph/react/devtools` subpath export. This app is both its primary test harness and its reference usage example.

## Standalone inspector (Option B — planned Phase 2)

A browser extension is planned for cases where embedding the overlay is not possible (production-only pages, non-React apps, SSR-heavy flows). It would inject a small content script that forwards trace events from any app using `@stategraph/react` to the extension devtools panel — zero bundle cost, no app changes required. See `packages/react/README.md` for details.
