import { describe, expect, it } from "vitest";
import { fromSCXML, toSCXML, validateSCXML } from ".";

const xml = `
<scxml id="toggle" initial="off">
  <state id="off">
    <transition event="TOGGLE" target="on" />
  </state>
  <state id="on">
    <transition event="TOGGLE" target="off" />
  </state>
</scxml>`;

describe("@stategraph/scxml", () => {
  it("imports supported SCXML", () => {
    const result = fromSCXML(xml);
    expect(result.ok).toBe(true);
    expect(result.value?.id).toBe("toggle");
    expect(result.value?.initial).toBe("off");
    expect(result.value?.states?.off?.on?.TOGGLE).toEqual({ target: "on" });
  });

  it("exports deterministic SCXML", () => {
    const imported = fromSCXML(xml);
    const first = toSCXML(imported.value!, { pretty: true });
    const second = toSCXML(imported.value!, { pretty: true });
    expect(first.ok).toBe(true);
    expect(first.value).toBe(second.value);
    expect(first.value).toContain('<scxml version="1.0" id="toggle" initial="off">');
  });

  it("round-trips supported fixtures structurally", () => {
    const first = fromSCXML(xml);
    const exported = toSCXML(first.value!);
    const second = fromSCXML(exported.value!);

    expect(second.ok).toBe(true);
    expect(second.value).toEqual(first.value);
  });

  it("reports unsupported constructs", () => {
    const result = fromSCXML(
      `<scxml id="bad" initial="a"><state id="a"><script /></state></scxml>`,
      {
        strict: true,
      },
    );
    expect(result.ok).toBe(false);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.unsupportedConstruct === "script"),
    ).toBe(true);
  });

  it("reports invalid XML", () => {
    const result = validateSCXML("<scxml>");
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("SCXML_INVALID_XML");
  });
});
