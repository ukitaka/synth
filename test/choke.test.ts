import { describe, expect, it } from "vitest";
import { chokeTargets } from "../src/engine/chokeGroups";

// FR-022: CH and OH are one choke group; other voices choke nothing.
describe("chokeTargets", () => {
  it("CH chokes OH", () => {
    expect(chokeTargets("CH")).toEqual(["OH"]);
  });

  it("OH chokes CH", () => {
    expect(chokeTargets("OH")).toEqual(["CH"]);
  });

  it("a voice never chokes itself", () => {
    expect(chokeTargets("CH")).not.toContain("CH");
  });

  it("non-hat voices choke nothing", () => {
    for (const id of ["BD", "SD", "CP", "LT"] as const) {
      expect(chokeTargets(id)).toEqual([]);
    }
  });
});
