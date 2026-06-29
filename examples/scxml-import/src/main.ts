import { createActor, createMachine } from "@stategraph/core";
import type { ActorRef, StateGraphEvent, StateGraphSnapshot, StateValue } from "@stategraph/core";
import { fromSCXML, toSCXML } from "@stategraph/scxml";
import type { SCXMLDiagnostic } from "@stategraph/scxml";

// A realistic checkout workflow as you might receive from a legacy BPM tool or visual SCXML editor.
const CHECKOUT_SCXML = `<scxml id="checkout" initial="cart">
  <state id="cart">
    <transition event="PROCEED" target="shipping" />
  </state>
  <state id="shipping">
    <transition event="PROCEED" target="payment" />
    <transition event="BACK" target="cart" />
  </state>
  <state id="payment">
    <transition event="SUBMIT" target="processing" />
    <transition event="BACK" target="shipping" />
  </state>
  <state id="processing">
    <transition event="ORDER_CONFIRMED" target="confirmed" />
    <transition event="ORDER_FAILED" target="failed" />
  </state>
  <state id="failed">
    <transition event="RETRY" target="payment" />
  </state>
  <final id="confirmed" />
</scxml>`;

// ── DOM shell ───────────────────────────────────────────────────────────────

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

app.innerHTML = `
<div style="font-family:sans-serif;padding:2rem;max-width:700px">
  <h1 style="margin-bottom:0.25rem">SCXML Import</h1>
  <p style="margin-top:0;color:#555">
    Paste any SCXML document, click <strong>Parse &amp; Run</strong>, then
    send events to walk the machine. The export panel shows the round-tripped
    SCXML produced by <code>toSCXML()</code>.
  </p>

  <section>
    <label for="scxml-input" style="font-weight:600">SCXML source</label>
    <textarea id="scxml-input" spellcheck="false"
      style="display:block;width:100%;height:200px;margin-top:0.5rem;
             font-family:monospace;font-size:0.85rem;padding:0.5rem;
             box-sizing:border-box;border:1px solid #ccc;border-radius:4px">
    </textarea>
    <button id="parse-btn"
      style="margin-top:0.75rem;padding:0.5rem 1.25rem;cursor:pointer;font-size:1rem">
      Parse &amp; Run
    </button>
  </section>

  <hr style="margin:1.5rem 0;border:none;border-top:1px solid #ddd" />

  <section id="error-section" style="display:none">
    <h2 style="color:#c00;margin-bottom:0.5rem">Parse error</h2>
    <pre id="error-text"
      style="background:#fff5f5;border:1px solid #fcc;padding:0.75rem;
             border-radius:4px;font-size:0.85rem;overflow-x:auto">
    </pre>
  </section>

  <section id="runner-section">
    <h2 style="margin-bottom:0.75rem">Runner</h2>
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem">
      <span style="font-weight:600">State:</span>
      <code id="state-value"
        style="background:#e8f4fd;padding:0.25rem 0.6rem;border-radius:4px;font-size:1rem">
        —
      </code>
      <span style="color:#777;font-size:0.85rem">status: <code id="status-value">—</code></span>
    </div>
    <div id="events-panel" style="min-height:2rem;color:#888">
      Load a machine to see available events.
    </div>
  </section>

  <hr style="margin:1.5rem 0;border:none;border-top:1px solid #ddd" />

  <section id="diagnostics-section">
    <h2 style="margin-bottom:0.5rem">Diagnostics</h2>
    <div id="diagnostics-panel" style="color:#888;font-size:0.9rem">None</div>
  </section>

  <hr style="margin:1.5rem 0;border:none;border-top:1px solid #ddd" />

  <section>
    <h2 style="margin-bottom:0.5rem">SCXML export <span style="font-weight:400;font-size:0.9rem;color:#777">(round-tripped via <code>toSCXML()</code>)</span></h2>
    <pre id="export-panel"
      style="background:#f6f8fa;border:1px solid #ddd;padding:0.75rem;
             border-radius:4px;font-size:0.82rem;overflow-x:auto;color:#555">
      —
    </pre>
  </section>
</div>
`;

// ── Element refs ─────────────────────────────────────────────────────────────

const textarea = document.getElementById("scxml-input") as HTMLTextAreaElement;
const parseBtn = document.getElementById("parse-btn") as HTMLButtonElement;
const errorSection = document.getElementById("error-section") as HTMLElement;
const errorText = document.getElementById("error-text") as HTMLPreElement;
const runnerSection = document.getElementById("runner-section") as HTMLElement;
const stateValue = document.getElementById("state-value") as HTMLElement;
const statusValue = document.getElementById("status-value") as HTMLElement;
const eventsPanel = document.getElementById("events-panel") as HTMLElement;
const diagnosticsPanel = document.getElementById("diagnostics-panel") as HTMLElement;
const exportPanel = document.getElementById("export-panel") as HTMLPreElement;

// ── State ────────────────────────────────────────────────────────────────────

let currentActor: ActorRef | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function stateValueToString(value: StateValue): string {
  if (typeof value === "string") return value;
  return Object.entries(value)
    .map(([region, nested]) => `${region}(${stateValueToString(nested)})`)
    .join(" | ");
}

function renderDiagnostics(diagnostics: SCXMLDiagnostic[]): void {
  if (diagnostics.length === 0) {
    diagnosticsPanel.textContent = "None";
    return;
  }
  diagnosticsPanel.innerHTML = "";
  for (const d of diagnostics) {
    const row = document.createElement("div");
    row.style.cssText = "margin-bottom:0.4rem;font-size:0.88rem";
    const badge = document.createElement("span");
    badge.textContent = d.severity.toUpperCase();
    badge.style.cssText = `
      display:inline-block;padding:0 0.4rem;border-radius:3px;font-size:0.75rem;
      font-weight:600;margin-right:0.5rem;
      background:${d.severity === "error" ? "#fce8e8" : d.severity === "warning" ? "#fff3cd" : "#e8f4fd"};
      color:${d.severity === "error" ? "#c00" : d.severity === "warning" ? "#856404" : "#0c5460"};
    `;
    const msg = document.createElement("span");
    msg.textContent = `[${d.code}] ${d.message}${d.path ? ` (at ${d.path})` : ""}`;
    row.appendChild(badge);
    row.appendChild(msg);
    diagnosticsPanel.appendChild(row);
  }
}

function renderSnapshot(snapshot: StateGraphSnapshot<unknown, StateGraphEvent>): void {
  stateValue.textContent = stateValueToString(snapshot.value);
  statusValue.textContent = snapshot.status;

  eventsPanel.innerHTML = "";

  const isDone = snapshot.status === "done" || snapshot.status === "stopped";
  const events = snapshot.nextEvents;

  if (isDone || events.length === 0) {
    const msg = document.createElement("span");
    msg.style.color = isDone ? "#2d7a2d" : "#888";
    msg.textContent = isDone
      ? `Machine reached final state "${stateValueToString(snapshot.value)}". Click Parse & Run to restart.`
      : "No outgoing transitions from current state.";
    eventsPanel.appendChild(msg);
    return;
  }

  for (const eventType of events) {
    const btn = document.createElement("button");
    btn.textContent = eventType;
    btn.style.cssText =
      "margin:0.25rem;padding:0.35rem 0.9rem;cursor:pointer;font-size:0.9rem;border-radius:4px";
    btn.addEventListener("click", () => {
      currentActor?.send({ type: eventType });
    });
    eventsPanel.appendChild(btn);
  }
}

// ── Core workflow ─────────────────────────────────────────────────────────────
//
//  fromSCXML(xml)            → MachineDefinition  (SCXML → StateGraph DSL)
//  createMachine(definition) → StateGraphMachine  (compile + validate)
//  createActor(machine)      → ActorRef            (running instance)
//  toSCXML(definition)       → XML string          (round-trip export)

function parseAndRun(xml: string): void {
  if (currentActor) {
    currentActor.stop();
    currentActor = null;
  }
  errorSection.style.display = "none";
  runnerSection.style.display = "";

  const { ok, value: definition, diagnostics } = fromSCXML(xml.trim());
  renderDiagnostics(diagnostics);

  if (!ok || !definition) {
    const errors = diagnostics.filter((d) => d.severity === "error");
    errorText.textContent = errors.map((d) => `[${d.code}] ${d.message}`).join("\n");
    errorSection.style.display = "";
    runnerSection.style.display = "none";
    exportPanel.textContent = "—";
    return;
  }

  let machine;
  try {
    machine = createMachine(definition);
  } catch (err) {
    errorText.textContent = String(err);
    errorSection.style.display = "";
    runnerSection.style.display = "none";
    exportPanel.textContent = "—";
    return;
  }

  const exportResult = toSCXML(definition, { pretty: true });
  exportPanel.textContent = exportResult.value ?? "—";

  const actor = createActor(machine);
  currentActor = actor;
  actor.subscribe(renderSnapshot);
  actor.start();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

textarea.value = CHECKOUT_SCXML.trim();
parseBtn.addEventListener("click", () => parseAndRun(textarea.value));

parseAndRun(CHECKOUT_SCXML);
