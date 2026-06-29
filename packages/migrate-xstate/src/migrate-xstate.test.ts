import { describe, expect, it } from "vitest";
import { analyzeXState, createCodemodPlan, createMigrationReport, migrateXState } from ".";

const source = `
import { createMachine, interpret } from "xstate";

const machine = createMachine({
  id: "toggle",
  initial: "off",
  states: {
    off: { on: { TOGGLE: "on" } },
    on: { on: { TOGGLE: "off" } }
  }
});

const service = interpret(machine);
service.onTransition(console.log);
service.start();
`;

describe("@stategraph/migrate-xstate", () => {
  it("analyzes XState source", () => {
    const analysis = analyzeXState(source);
    expect(analysis.filesScanned).toBe(1);
    expect(analysis.machinesFound).toBe(1);
    expect(analysis.xstateVersion).toBe("v5");
  });

  it("performs best-effort conversion", () => {
    const result = migrateXState(source);
    expect(result.changed).toBe(true);
    expect(result.source).toContain('from "@stategraph/core"');
    expect(result.source).toContain("setup({}).createMachine");
    expect(result.source).toContain("createActor(machine)");
    expect(result.source).toContain(".subscribe(console.log)");
  });

  it("reports unsupported features", () => {
    const result = migrateXState(
      `import { createMachine } from "xstate"; createMachine({ after: {} })`,
    );
    expect(result.diagnostics.some((diagnostic) => diagnostic.feature === "after")).toBe(true);
  });

  it("creates deterministic reports and codemod plans", () => {
    const result = migrateXState(source);
    const first = createMigrationReport(result);
    const second = createMigrationReport(result);
    const plan = createCodemodPlan(source);

    expect(first).toEqual(second);
    expect(plan.changed).toBe(true);
    expect(plan.operations).toEqual(result.appliedMappings);
  });
});
