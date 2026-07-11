import { describe, expect, it } from "vitest";

import { compareVersions } from "../src/update.js";

describe("compareVersions", () => {
  it.each([
    ["1.5.0", "1.5.0", 0],
    ["1.4.0", "1.5.0", -1],
    ["1.5.0", "1.4.9", 1],
    ["1.5.0", "1.5.1", -1],
    ["2.0.0", "1.9.9", 1],
    ["1.10.0", "1.9.0", 1], // numeric, not lexical
  ])("compares %s vs %s", (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });
});
