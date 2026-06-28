import { assign, setup } from "@stategraph/core";
import { bindEvent, mountActor, onSnapshot } from "@stategraph/dom";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function section(title: string, content: string): HTMLElement {
  const el = document.createElement("section");
  el.style.cssText = "margin-bottom:2rem;padding:1rem;border:1px solid #ddd;border-radius:8px";
  el.innerHTML = `<h2 style="margin:0 0 1rem">${title}</h2>${content}`;
  return el;
}

function btn(id: string, label: string): string {
  return `<button id="${id}" style="margin-right:0.5rem;padding:0.4rem 0.8rem">${label}</button>`;
}

function stateString(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// 1. Counter — assign + INC / DEC / RESET
// ---------------------------------------------------------------------------

interface CounterCtx {
  count: number;
}

type CounterEvent = { type: "INC" } | { type: "DEC" } | { type: "RESET" };

const counterMachine = setup<CounterCtx, CounterEvent>({}).createMachine({
  id: "counter",
  initial: "active",
  context: { count: 0 },
  states: {
    active: {
      on: {
        INC: { actions: ["inc"] },
        DEC: { actions: ["dec"] },
        RESET: { actions: ["reset"] },
      },
    },
  },
});

// ---------------------------------------------------------------------------
// 2. Toggle — TOGGLE event flips on ↔ off
// ---------------------------------------------------------------------------

type ToggleEvent = { type: "TOGGLE" };

const toggleMachine = setup<object, ToggleEvent>({}).createMachine({
  id: "toggle",
  initial: "off",
  context: {},
  states: {
    off: { on: { TOGGLE: { target: "on" } } },
    on: { on: { TOGGLE: { target: "off" } } },
  },
});

// ---------------------------------------------------------------------------
// 3. Timer — WAITING → (after 3 s) → DONE, RESET restarts
// ---------------------------------------------------------------------------

type TimerEvent = { type: "RESET" };

const timerMachine = setup<object, TimerEvent>({}).createMachine({
  id: "timer",
  initial: "waiting",
  context: {},
  states: {
    waiting: {
      after: { 3000: { target: "done" } },
      on: { RESET: { target: "waiting" } },
    },
    done: {
      on: { RESET: { target: "waiting" } },
    },
  },
});

// ---------------------------------------------------------------------------
// Mount DOM
// ---------------------------------------------------------------------------

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

app.style.cssText = "font-family:sans-serif;padding:2rem;max-width:600px";
const heading = document.createElement("h1");
heading.textContent = "StateGraph Playground";
app.appendChild(heading);

// --- Counter section ---

const counterSec = section(
  "Counter",
  `${btn("inc", "INC")}${btn("dec", "DEC")}${btn("reset-counter", "RESET")}` +
    `<p id="count-display" style="font-size:2rem;margin:1rem 0 0">0</p>`,
);
app.appendChild(counterSec);

const { actor: counterActor } = mountActor(counterMachine, {
  provide: {
    actions: {
      inc: assign<CounterCtx>(({ context }) => ({ count: context.count + 1 })),
      dec: assign<CounterCtx>(({ context }) => ({ count: context.count - 1 })),
      reset: assign<CounterCtx>(() => ({ count: 0 })),
    },
  },
});

bindEvent(counterSec.querySelector("#inc")!, "click", counterActor, { type: "INC" });
bindEvent(counterSec.querySelector("#dec")!, "click", counterActor, { type: "DEC" });
bindEvent(counterSec.querySelector("#reset-counter")!, "click", counterActor, { type: "RESET" });

const countDisplay = counterSec.querySelector<HTMLParagraphElement>("#count-display")!;
onSnapshot(counterActor, (snap) => {
  countDisplay.textContent = String(snap.context.count);
});

// --- Toggle section ---

const toggleSec = section(
  "Toggle",
  `${btn("toggle-btn", "Toggle")}<p id="toggle-display" style="margin:1rem 0 0">State: off</p>`,
);
app.appendChild(toggleSec);

const { actor: toggleActor } = mountActor(toggleMachine);

bindEvent(toggleSec.querySelector("#toggle-btn")!, "click", toggleActor, { type: "TOGGLE" });

const toggleDisplay = toggleSec.querySelector<HTMLParagraphElement>("#toggle-display")!;
onSnapshot(toggleActor, (snap) => {
  toggleDisplay.textContent = `State: ${stateString(snap.value)}`;
});

// --- Timer section ---

const timerSec = section(
  "Timer (3 s auto-transition)",
  `${btn("timer-reset", "RESET")}<p id="timer-display" style="margin:1rem 0 0">State: waiting</p>`,
);
app.appendChild(timerSec);

const { actor: timerActor } = mountActor(timerMachine);

bindEvent(timerSec.querySelector("#timer-reset")!, "click", timerActor, { type: "RESET" });

const timerDisplay = timerSec.querySelector<HTMLParagraphElement>("#timer-display")!;
onSnapshot(timerActor, (snap) => {
  timerDisplay.textContent = `State: ${stateString(snap.value)}`;
});
