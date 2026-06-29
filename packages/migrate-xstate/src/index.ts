import type { MachineDefinition } from "@stategraph/core";

export const STATEGRAPH_MIGRATE_XSTATE_PACKAGE = "@stategraph/migrate-xstate";

export type MigrationSeverity = "info" | "warning" | "error";
export type XStateVersion = "v4" | "v5" | "mixed" | "unknown";

export interface MigrationDiagnostic {
  code: string;
  severity: MigrationSeverity;
  message: string;
  file?: string;
  start?: number;
  end?: number;
  feature?: string;
  suggestedAction?: string;
}

export interface AnalysisInput {
  file?: string;
  source: string;
}

export interface XStateAnalysis {
  filesScanned: number;
  machinesFound: number;
  xstateVersion: XStateVersion;
  diagnostics: MigrationDiagnostic[];
  imports: string[];
}

export interface MigrationResult {
  source: string;
  changed: boolean;
  definition: MachineDefinition | null;
  diagnostics: MigrationDiagnostic[];
  appliedMappings: string[];
}

export interface MigrationReport {
  filesScanned: number;
  filesChanged: number;
  machinesFound: number;
  xstateVersion: XStateVersion;
  diagnostics: MigrationDiagnostic[];
  appliedMappings: string[];
}

export interface CodemodPlan {
  changed: boolean;
  output: string;
  diagnostics: MigrationDiagnostic[];
  operations: string[];
}

export function analyzeXState(input: string | string[] | AnalysisInput[]): XStateAnalysis {
  const files = normalizeInputs(input);
  const diagnostics: MigrationDiagnostic[] = [];
  const imports = new Set<string>();
  let machinesFound = 0;
  let sawV4 = false;
  let sawV5 = false;

  for (const file of files) {
    const source = file.source;
    for (const match of source.matchAll(/from\s+["']([^"']*xstate[^"']*)["']/g)) {
      const importPath = match[1] ?? "";
      imports.add(importPath);
      if (importPath === "xstate") sawV5 = true;
      if (importPath.includes("xstate/lib") || importPath.includes("@xstate")) sawV4 = true;
    }
    machinesFound += countMatches(source, /\bcreateMachine\s*\(/g);
    collectUnsupportedDiagnostics(source, diagnostics, file.file);
  }

  return {
    filesScanned: files.length,
    machinesFound,
    xstateVersion: sawV4 && sawV5 ? "mixed" : sawV5 ? "v5" : sawV4 ? "v4" : "unknown",
    diagnostics: sortDiagnostics(diagnostics),
    imports: [...imports].sort(),
  };
}

export function migrateXState(source: string): MigrationResult {
  const diagnostics: MigrationDiagnostic[] = [];
  const appliedMappings: string[] = [];
  collectUnsupportedDiagnostics(source, diagnostics);

  let output = source;
  output = output.replace(
    /import\s+\{([^}]+)\}\s+from\s+["']xstate["'];?/g,
    (_full, imports: string) => {
      const names = imports
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const keep = names.filter((name) => !["createMachine", "interpret"].includes(name));
      const stategraph = ["setup", "createActor"];
      appliedMappings.push("import:xstate-to-stategraph");
      const lines = [`import { ${stategraph.join(", ")} } from "@stategraph/core";`];
      if (keep.length > 0) lines.push(`import { ${keep.join(", ")} } from "xstate";`);
      return lines.join("\n");
    },
  );
  output = output.replace(/\binterpret\s*\(/g, () => {
    appliedMappings.push("interpret-to-createActor");
    return "createActor(";
  });
  output = output.replace(/\.onTransition\s*\(/g, () => {
    appliedMappings.push("onTransition-to-subscribe");
    return ".subscribe(";
  });
  output = output.replace(/\.state\b/g, () => {
    appliedMappings.push("state-to-getSnapshot");
    return ".getSnapshot()";
  });

  const machineCall = findCreateMachineCall(output);
  if (machineCall) {
    const converted = convertCreateMachineCall(machineCall.text, diagnostics, appliedMappings);
    output = output.slice(0, machineCall.start) + converted + output.slice(machineCall.end);
  }

  return {
    source: output,
    changed: output !== source,
    definition: null,
    diagnostics: sortDiagnostics(diagnostics),
    appliedMappings: [...new Set(appliedMappings)].sort(),
  };
}

export function createMigrationReport(
  result: MigrationResult | MigrationResult[] | XStateAnalysis,
): MigrationReport {
  if ("source" in result) return reportFromResults([result], analyzeXState(result.source));
  if (Array.isArray(result)) {
    const analysis = analyzeXState(result.map((item) => item.source));
    return reportFromResults(result, analysis);
  }
  return {
    filesScanned: result.filesScanned,
    filesChanged: 0,
    machinesFound: result.machinesFound,
    xstateVersion: result.xstateVersion,
    diagnostics: result.diagnostics,
    appliedMappings: [],
  };
}

export function createCodemodPlan(source: string): CodemodPlan {
  const result = migrateXState(source);
  return {
    changed: result.changed,
    output: result.source,
    diagnostics: result.diagnostics,
    operations: result.appliedMappings,
  };
}

function reportFromResults(results: MigrationResult[], analysis: XStateAnalysis): MigrationReport {
  return {
    filesScanned: analysis.filesScanned,
    filesChanged: results.filter((result) => result.changed).length,
    machinesFound: analysis.machinesFound,
    xstateVersion: analysis.xstateVersion,
    diagnostics: sortDiagnostics([
      ...analysis.diagnostics,
      ...results.flatMap((result) => result.diagnostics),
    ]),
    appliedMappings: [...new Set(results.flatMap((result) => result.appliedMappings))].sort(),
  };
}

function convertCreateMachineCall(
  call: string,
  diagnostics: MigrationDiagnostic[],
  appliedMappings: string[],
): string {
  const args = splitTopLevelArguments(call.slice("createMachine(".length, -1));
  if (args.length === 0) return call;
  const config = args[0] ?? "{}";
  const implementations = args[1] ?? "{}";
  if (args.length > 2) {
    diagnostics.push({
      code: "XSTATE_UNSUPPORTED_CREATE_MACHINE_ARITY",
      severity: "warning",
      message: "createMachine calls with more than two arguments require manual review.",
      feature: "createMachine",
    });
  }
  appliedMappings.push("createMachine-to-setup-createMachine");
  return `setup(${implementations}).createMachine(${config})`;
}

function findCreateMachineCall(
  source: string,
): { start: number; end: number; text: string } | null {
  const index = source.indexOf("createMachine(");
  if (index === -1) return null;
  let depth = 0;
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0)
        return { start: index, end: cursor + 1, text: source.slice(index, cursor + 1) };
    }
  }
  return null;
}

function splitTopLevelArguments(source: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if ("({[".includes(char ?? "")) depth += 1;
    if (")}]".includes(char ?? "")) depth -= 1;
    if (char === "," && depth === 0) {
      args.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  const tail = source.slice(start).trim();
  if (tail) args.push(tail);
  return args;
}

function collectUnsupportedDiagnostics(
  source: string,
  diagnostics: MigrationDiagnostic[],
  file?: string,
): void {
  const unsupported = [
    ["history", /\bhistory\s*:/g, "History states require manual migration."],
    ["activities", /\bactivities\s*:/g, "Activities are not directly supported."],
    ["spawn", /\bspawn\s*\(/g, "Actor spawning patterns require manual migration."],
    ["invoke", /\binvoke\s*:/g, "Invoke semantics require StateGraph effect review."],
    ["after", /\bafter\s*:/g, "Delayed transitions require semantic review."],
    ["delays", /\bdelays\s*:/g, "Delay implementations require manual migration."],
  ] as const;

  for (const [feature, pattern, message] of unsupported) {
    for (const match of source.matchAll(pattern)) {
      const diagnostic: MigrationDiagnostic = {
        code: `XSTATE_UNSUPPORTED_${feature.toUpperCase()}`,
        severity: "warning",
        message,
        feature,
        suggestedAction: "Review and migrate this behavior manually.",
      };
      if (file) diagnostic.file = file;
      if (match.index !== undefined) {
        diagnostic.start = match.index;
        diagnostic.end = match.index + match[0].length;
      }
      diagnostics.push({
        ...diagnostic,
      });
    }
  }
}

function normalizeInputs(input: string | string[] | AnalysisInput[]): AnalysisInput[] {
  if (typeof input === "string") return [{ source: input }];
  return input.map((item, index) =>
    typeof item === "string" ? { file: `input-${index + 1}.ts`, source: item } : item,
  );
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function sortDiagnostics(diagnostics: MigrationDiagnostic[]): MigrationDiagnostic[] {
  return [...diagnostics].sort(
    (a, b) =>
      (a.file ?? "").localeCompare(b.file ?? "") ||
      (a.start ?? 0) - (b.start ?? 0) ||
      a.code.localeCompare(b.code),
  );
}

export const convertXState = migrateXState;
export const runCodemod = createCodemodPlan;
