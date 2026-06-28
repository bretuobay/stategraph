import { STATEGRAPH_CORE_PACKAGE } from "@stategraph/core";

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

interface GuideSection {
  id: string;
  title: string;
  body: string;
}

const version = STATEGRAPH_CORE_PACKAGE; // "@stategraph/core"

function code(src: string, conceptual = false): string {
  const attr = conceptual ? ` data-conceptual="true"` : "";
  const label = conceptual
    ? `<span style="font-size:0.75rem;color:#888;margin-bottom:0.25rem;display:block">Illustrative only — not compiled</span>`
    : "";
  return `${label}<pre${attr} style="background:#f4f4f4;padding:1rem;border-radius:6px;overflow-x:auto"><code>${escHtml(src)}</code></pre>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const sections: GuideSection[] = [
  {
    id: "overview",
    title: "1. Package Overview",
    body: `
      <p>StateGraph TS is a TypeScript-first statechart runtime. Packages:</p>
      <ul>
        <li><strong>${version}</strong> — pure runtime, zero dependencies</li>
        <li><strong>@stategraph/react</strong> — React 18+ adapter</li>
        <li><strong>@stategraph/dom</strong> — headless DOM adapter</li>
        <li><strong>@stategraph/testing</strong> — test utilities and fixtures</li>
        <li><strong>@stategraph/inspect</strong> — trace recording and replay</li>
        <li><strong>@stategraph/model-check</strong> — structural analysis</li>
      </ul>
    `,
  },
  {
    id: "execution-model",
    title: "2. Runtime Execution Model",
    body: `
      <p>StateGraph TS follows SCXML run-to-completion semantics:</p>
      <ol>
        <li>One external event fully resolves (all internal events drained) before the next starts.</li>
        <li>Exit actions run before entry actions on any transition.</li>
        <li>Parallel regions update in definition order — deterministic.</li>
        <li>Effects are scheduled <em>after</em> the transition step commits — never inline.</li>
      </ol>
    `,
  },
  {
    id: "machine-definition",
    title: "3. Machine Definition &amp; setup()",
    body: `
      <p>Always use the <code>setup()</code> + <code>.createMachine()</code> dual-call pattern.
      Guards, actions, and effects are string references in the definition.</p>
      ${code(
        `const machine = setup({
  guards: { isValid: ({ context }) => context.value.length > 0 },
  actions: { clear: assign(() => ({ error: null })) },
  effects: { submit: fromPromise(({ input }) => fetch(input.url)) },
}).createMachine({
  id: "form",
  initial: "idle",
  context: { value: "", error: null },
  states: {
    idle: { on: { SUBMIT: { target: "submitting", guard: "isValid" } } },
    submitting: { invoke: { src: "submit", input: ({ context }) => ({ url: "/api" }), onDone: "done" } },
    done: { type: "final" },
  },
});`,
        true,
      )}
    `,
  },
  {
    id: "actions-effects",
    title: "4. Actions, assign, and Effects",
    body: `
      <p><strong>assign</strong> — the only way to update context. Produces a new partial object.</p>
      ${code(`assign<Ctx>(({ context }) => ({ count: context.count + 1 }))`, true)}
      <p><strong>fromPromise</strong> — async invocation with AbortSignal auto-cancel on exit.</p>
      ${code(
        `fromPromise<Output, Input>(({ input, signal }) =>
  fetch(input.url, { signal }).then(r => r.json()))`,
        true,
      )}
      <p><strong>fromCallback</strong> — subscribe-style effects with cleanup.</p>
      ${code(
        `fromCallback(({ sendBack, receive }) => {
  const id = setInterval(() => sendBack({ type: "TICK" }), 1000);
  return () => clearInterval(id);
})`,
        true,
      )}
      <p>Parameterised actions: <code>entry: [{ type: "toast", params: { message: "Saved!" } }]</code></p>
    `,
  },
  {
    id: "snapshots",
    title: "5. Snapshots and Selectors",
    body: `
      <p>Every committed actor state is a <code>StateGraphSnapshot</code>:</p>
      ${code(
        `interface StateGraphSnapshot<TContext, TEvent> {
  status: "idle" | "active" | "done" | "error" | "stopped";
  value: string | Record<string, StateValue>;  // nested for compound states
  context: Readonly<TContext>;
  changed: boolean;
  event: TEvent | { type: "@@INIT" } | null;
  transitions: ReadonlyArray<...>;
  children: Readonly<Record<string, ChildActorRef>>;
  error: unknown;
}`,
        true,
      )}
      <p>Use <code>useSelector</code> (React) or <code>onSnapshot</code> (DOM) to derive UI values.</p>
    `,
  },
  {
    id: "adapters",
    title: "6. React and DOM Adapters",
    body: `
      <p><strong>React</strong></p>
      ${code(
        `const { snapshot, send, actor } = useActor(machine);
const count = useSelector(actor, s => s.context.count);`,
        true,
      )}
      <p><strong>DOM</strong></p>
      ${code(
        `const { actor } = mountActor(machine);
bindEvent(btn, "click", actor, { type: "SUBMIT" });
onSnapshot(actor, snap => { el.textContent = String(snap.value); });`,
        true,
      )}
    `,
  },
  {
    id: "testing",
    title: "7. Testing and Model Checking",
    body: `
      <p>Use <code>@stategraph/testing</code> for deterministic fixture actors:</p>
      ${code(
        `import { createTestActor } from "@stategraph/testing";
const actor = createTestActor(machine);
actor.send({ type: "SUBMIT" });
expect(actor.getSnapshot().value).toBe("submitting");`,
        true,
      )}
      <p>Use <code>@stategraph/model-check</code> for structural validation:</p>
      ${code(
        `import { checkMachine } from "@stategraph/model-check";
const issues = checkMachine(machine.toIR());
// unreachableStates, deadStates, deadTransitions, invalidTargets, nondeterminism`,
        true,
      )}
    `,
  },
  {
    id: "trace-replay",
    title: "8. Trace and Replay",
    body: `
      <p>Record a live actor session and replay it deterministically:</p>
      ${code(
        `import { createTraceRecorder, replayTrace } from "@stategraph/inspect";
const recorder = createTraceRecorder(actor, { machineId: machine.id });
actor.send({ type: "SUBMIT" });
const result = replayTrace(machine, recorder.getEnvelope());
console.log(result.snapshots.length);`,
        true,
      )}
      <p>Trace envelopes are JSON-serializable with schema version <code>1.0</code>.
      Import via <code>deserializeEnvelope</code>; the parser validates on load and
      rejects unknown major versions.</p>
    `,
  },
  {
    id: "migration",
    title: "9. Migration from XState",
    body: `
      <p>Key conceptual differences from XState v4/v5:</p>
      <ul>
        <li><code>setup()</code> + <code>.createMachine()</code> replaces <code>createMachine()</code> with inline implementations.</li>
        <li>Effects are called <em>effects</em> (not <em>services</em>). Use <code>invoke: { src: "name" }</code>.</li>
        <li><code>assign</code> returns a partial — no explicit spread.</li>
        <li>Snapshots expose <code>value</code> as a nested object for compound states (<code>{dialog: {page2: "page2"}}</code>).</li>
        <li>No <code>interpret()</code> — use <code>createActor()</code> directly.</li>
      </ul>
      <p>The <code>@stategraph/migrate-xstate</code> package (post-MVP) will provide codemods.</p>
    `,
  },
  {
    id: "contribution",
    title: "10. Contribution and Package Boundaries",
    body: `
      <p>Hard rules for contributors:</p>
      <ul>
        <li><strong>@stategraph/core</strong> must have zero framework deps, zero browser globals, zero test-framework imports.</li>
        <li>Packages communicate only through public barrel exports (<code>src/index.ts</code>). No deep imports.</li>
        <li>Adapter packages may only depend on <code>@stategraph/core</code> and their framework peer dep.</li>
        <li>Apps may depend on packages. Packages must never import from apps.</li>
        <li>All MVP packages ship dual ESM + CJS via tsup with a full <code>exports</code> map.</li>
        <li>Every public API must emit <code>.d.ts</code> files without widening to <code>any</code>.</li>
      </ul>
      <p>Run <code>pnpm -r lint</code> and <code>pnpm -r check-types</code> before opening a PR.</p>
    `,
  },
];

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

app.style.cssText = "display:flex;font-family:sans-serif;min-height:100vh";

const nav = document.createElement("nav");
nav.style.cssText =
  "width:220px;flex-shrink:0;padding:2rem 1rem;border-right:1px solid #ddd;position:sticky;top:0;height:100vh;overflow-y:auto;box-sizing:border-box";

const navTitle = document.createElement("strong");
navTitle.textContent = "StateGraph TS";
navTitle.style.cssText = "display:block;margin-bottom:1rem";
nav.appendChild(navTitle);

const main = document.createElement("main");
main.style.cssText = "flex:1;padding:2rem;max-width:800px";

const pageTitle = document.createElement("h1");
pageTitle.textContent = "StateGraph TS — Reference Docs";
main.appendChild(pageTitle);

for (const s of sections) {
  // nav link
  const link = document.createElement("a");
  link.href = `#${s.id}`;
  link.textContent = s.title;
  link.style.cssText =
    "display:block;padding:0.3rem 0.5rem;color:#0070f3;text-decoration:none;font-size:0.9rem;margin-bottom:0.25rem;border-radius:4px";
  link.addEventListener("mouseenter", () => {
    link.style.background = "#f0f0f0";
  });
  link.addEventListener("mouseleave", () => {
    link.style.background = "";
  });
  nav.appendChild(link);

  // section
  const article = document.createElement("article");
  article.id = s.id;
  article.style.cssText = "margin-bottom:3rem";
  article.innerHTML = `<h2 style="border-bottom:1px solid #eee;padding-bottom:0.5rem">${s.title}</h2>${s.body}`;
  main.appendChild(article);
}

app.appendChild(nav);
app.appendChild(main);
