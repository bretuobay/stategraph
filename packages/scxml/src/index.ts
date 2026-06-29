import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import type { MachineDefinition, StateNodeDef, TransitionDef } from "@stategraph/core";

export const STATEGRAPH_SCXML_PACKAGE = "@stategraph/scxml";

export type SCXMLDiagnosticSeverity = "info" | "warning" | "error";

export interface SCXMLDiagnostic {
  code: string;
  severity: SCXMLDiagnosticSeverity;
  message: string;
  path?: string;
  location?: {
    line: number;
    column: number;
  };
  unsupportedConstruct?: string;
}

export interface FromSCXMLOptions {
  id?: string;
  strict?: boolean;
}

export interface ToSCXMLOptions {
  pretty?: boolean;
  strict?: boolean;
}

export interface SCXMLResult<T> {
  ok: boolean;
  value: T | null;
  diagnostics: SCXMLDiagnostic[];
}

export type FromSCXMLResult<TContext = unknown> = SCXMLResult<MachineDefinition<TContext>>;
export type ToSCXMLResult = SCXMLResult<string>;

type XMLRecord = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
  trimValues: true,
});

function createBuilder(pretty: boolean): XMLBuilder {
  return new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    format: pretty,
    suppressEmptyNode: true,
  });
}

export function fromSCXML<TContext = unknown>(
  xml: string,
  options: FromSCXMLOptions = {},
): FromSCXMLResult<TContext> {
  const diagnostics: SCXMLDiagnostic[] = [];
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    return {
      ok: false,
      value: null,
      diagnostics: [
        {
          code: "SCXML_INVALID_XML",
          severity: "error",
          message: validation.err.msg,
          location: { line: validation.err.line, column: validation.err.col },
        },
      ],
    };
  }

  const parsed = parser.parse(xml) as XMLRecord;
  const root = asRecord(parsed.scxml);
  if (!root) {
    return {
      ok: false,
      value: null,
      diagnostics: [
        {
          code: "SCXML_MISSING_ROOT",
          severity: "error",
          message: "SCXML document must contain a <scxml> root element.",
          path: "/",
        },
      ],
    };
  }

  collectUnsupported(root, "/scxml", diagnostics);

  const id = options.id ?? stringValue(root.id) ?? "scxml";
  const states = collectChildren(root, id, diagnostics);
  const initial = stringValue(root.initial) ?? Object.keys(states)[0];

  if (!initial) {
    diagnostics.push({
      code: "SCXML_MISSING_INITIAL",
      severity: "error",
      message: "SCXML root must define an initial state or contain at least one child state.",
      path: "/scxml",
    });
  }

  const meta = asRecord(root.meta);
  const machine = {
    id,
    type: "compound" as const,
    ...(initial ? { initial } : {}),
    states,
    ...(meta ? { meta } : {}),
  } satisfies MachineDefinition<TContext>;

  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const hasUnsupported = diagnostics.some((diagnostic) => diagnostic.unsupportedConstruct);
  return {
    ok: !hasErrors && !(options.strict && hasUnsupported),
    value: machine,
    diagnostics,
  };
}

export function toSCXML<TContext = unknown>(
  machine: MachineDefinition<TContext>,
  options: ToSCXMLOptions = {},
): ToSCXMLResult {
  const diagnostics: SCXMLDiagnostic[] = [];
  const root = {
    scxml: {
      version: "1.0",
      id: machine.id,
      ...(machine.initial ? { initial: machine.initial } : {}),
      ...buildChildren(machine.states ?? {}, machine.id, diagnostics),
    },
  };

  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  return {
    ok: !hasErrors && !(options.strict && diagnostics.length > 0),
    value: createBuilder(options.pretty ?? false).build(root),
    diagnostics,
  };
}

export function validateSCXML(xml: string, options: FromSCXMLOptions = {}): SCXMLResult<null> {
  const result = fromSCXML(xml, options);
  return {
    ok: result.ok,
    value: null,
    diagnostics: result.diagnostics,
  };
}

function collectChildren(
  node: XMLRecord,
  path: string,
  diagnostics: SCXMLDiagnostic[],
): Record<string, StateNodeDef> {
  const states: Record<string, StateNodeDef> = {};
  for (const child of childElements(node)) {
    const id = stringValue(child.node.id);
    if (!id) {
      diagnostics.push({
        code: "SCXML_STATE_MISSING_ID",
        severity: "error",
        message: "State-like SCXML elements must define an id.",
        path,
      });
      continue;
    }
    states[id] = convertState(child.kind, child.node, `${path}/${id}`, diagnostics);
  }
  return states;
}

function convertState(
  kind: "state" | "parallel" | "final" | "history",
  node: XMLRecord,
  path: string,
  diagnostics: SCXMLDiagnostic[],
): StateNodeDef {
  collectUnsupported(node, path, diagnostics);
  const children = collectChildren(node, path, diagnostics);
  const transitions = toArray(node.transition).map((transition) =>
    convertTransition(asRecord(transition) ?? {}, `${path}/transition`, diagnostics),
  );
  const on = groupTransitions(transitions);
  const entry = collectActionRefs(node.onentry);
  const exit = collectActionRefs(node.onexit);
  const meta = asRecord(node.meta);

  return {
    type:
      kind === "state" && Object.keys(children).length > 0
        ? ("compound" as const)
        : kind === "state"
          ? ("atomic" as const)
          : kind,
    ...(kind === "state" && Object.keys(children).length > 0
      ? { initial: stringValue(node.initial) ?? Object.keys(children)[0] }
      : {}),
    ...(kind === "history" && stringValue(node.type)
      ? { history: stringValue(node.type) === "deep" ? "deep" : "shallow" }
      : {}),
    ...(Object.keys(children).length > 0 ? { states: children } : {}),
    ...(Object.keys(on).length > 0 ? { on } : {}),
    ...(entry.length > 0 ? { entry } : {}),
    ...(exit.length > 0 ? { exit } : {}),
    ...(meta ? { meta } : {}),
  };
}

function convertTransition(
  node: XMLRecord,
  path: string,
  diagnostics: SCXMLDiagnostic[],
): TransitionDef & { event?: string } {
  collectUnsupported(node, path, diagnostics);
  const event = stringValue(node.event) ?? "";
  if (!event) {
    diagnostics.push({
      code: "SCXML_TRANSITION_MISSING_EVENT",
      severity: "warning",
      message: "Eventless SCXML transitions are imported as @always transitions.",
      path,
    });
  }
  const target = stringValue(node.target);
  const guard = stringValue(node.cond);
  return {
    event: event || "@always",
    ...(target ? { target } : {}),
    ...(guard ? { guard } : {}),
  };
}

function groupTransitions(
  transitions: Array<TransitionDef & { event?: string }>,
): Record<string, TransitionDef | TransitionDef[]> {
  const grouped: Record<string, TransitionDef | TransitionDef[]> = {};
  for (const transition of transitions) {
    const { event = "@always", ...definition } = transition;
    const current = grouped[event];
    if (!current) {
      grouped[event] = definition;
    } else if (Array.isArray(current)) {
      current.push(definition);
    } else {
      grouped[event] = [current, definition];
    }
  }
  return grouped;
}

function buildChildren(
  states: Record<string, StateNodeDef>,
  path: string,
  diagnostics: SCXMLDiagnostic[],
): XMLRecord {
  const state: unknown[] = [];
  const parallel: unknown[] = [];
  const final: unknown[] = [];
  const history: unknown[] = [];

  for (const [id, node] of Object.entries(states).sort(([a], [b]) => a.localeCompare(b))) {
    const built = buildState(id, node, `${path}.${id}`, diagnostics);
    if (node.type === "parallel") parallel.push(built);
    else if (node.type === "final") final.push(built);
    else if (node.type === "history") history.push(built);
    else state.push(built);
  }

  return {
    ...(state.length > 0 ? { state } : {}),
    ...(parallel.length > 0 ? { parallel } : {}),
    ...(final.length > 0 ? { final } : {}),
    ...(history.length > 0 ? { history } : {}),
  };
}

function buildState(
  id: string,
  node: StateNodeDef,
  path: string,
  diagnostics: SCXMLDiagnostic[],
): XMLRecord {
  if (node.after) {
    diagnostics.push({
      code: "SCXML_UNSUPPORTED_AFTER",
      severity: "warning",
      message:
        "Delayed StateGraph transitions cannot be exported losslessly to the supported SCXML subset.",
      path,
      unsupportedConstruct: "after",
    });
  }
  if (node.invoke) {
    diagnostics.push({
      code: "SCXML_UNSUPPORTED_INVOKE",
      severity: "warning",
      message: "StateGraph invokes cannot be exported losslessly to the supported SCXML subset.",
      path,
      unsupportedConstruct: "invoke",
    });
  }

  return {
    id,
    ...(node.initial ? { initial: node.initial } : {}),
    ...(node.type === "history" && node.history ? { type: node.history } : {}),
    ...buildChildren(node.states ?? {}, path, diagnostics),
    ...buildTransitions(node.on ?? {}),
  };
}

function buildTransitions(on: Record<string, TransitionDef | TransitionDef[]>): XMLRecord {
  const transition = Object.entries(on)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([event, transitions]) =>
      toArray(transitions).map((definition) => ({
        event,
        ...(definition.target ? { target: definition.target } : {}),
        ...(definition.guard
          ? {
              cond: typeof definition.guard === "string" ? definition.guard : definition.guard.type,
            }
          : {}),
      })),
    );
  return transition.length > 0 ? { transition } : {};
}

function childElements(node: XMLRecord): Array<{
  kind: "state" | "parallel" | "final" | "history";
  node: XMLRecord;
}> {
  return [
    ...toArray(node.state).flatMap((value) => recordChild("state", value)),
    ...toArray(node.parallel).flatMap((value) => recordChild("parallel", value)),
    ...toArray(node.final).flatMap((value) => recordChild("final", value)),
    ...toArray(node.history).flatMap((value) => recordChild("history", value)),
  ];
}

function recordChild(
  kind: "state" | "parallel" | "final" | "history",
  value: unknown,
): Array<{ kind: "state" | "parallel" | "final" | "history"; node: XMLRecord }> {
  const node = asRecord(value);
  return node ? [{ kind, node }] : [];
}

function collectUnsupported(node: XMLRecord, path: string, diagnostics: SCXMLDiagnostic[]): void {
  for (const key of ["script", "datamodel", "data", "invoke", "send", "cancel", "foreach"]) {
    if (node[key] !== undefined) {
      diagnostics.push({
        code: "SCXML_UNSUPPORTED_CONSTRUCT",
        severity: "warning",
        message: `Unsupported SCXML construct "${key}" was found.`,
        path,
        unsupportedConstruct: key,
      });
    }
  }
}

function collectActionRefs(value: unknown): string[] {
  const records = toArray(value).flatMap((entry) => {
    const record = asRecord(entry);
    return record ? [record] : [];
  });
  return records.flatMap((record) =>
    ["log", "raise", "assign"].flatMap((key) => {
      const child = asRecord(record[key]);
      const label = child ? (stringValue(child.label) ?? stringValue(child.event) ?? key) : null;
      return label ? [label] : [];
    }),
  );
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown): XMLRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as XMLRecord) : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
