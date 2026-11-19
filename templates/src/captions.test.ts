import { describe, expect, it } from "vitest";
import { paginate } from "./Captions";
import { countUp } from "./templates/BigNumber";

describe("caption pages", () => {
  const words = "Since twenty ten, the price of a solar module has fallen by more than ninety percent.".split(" ");

  it("keeps every word, in order", () => {
    expect(paginate(words, 40).flat()).toEqual(words);
  });

  it("uses at most 12 words per page and balances the pages", () => {
    const pages = paginate(words, 40);
    expect(pages.every((p) => p.length <= 12)).toBe(true);
    expect(Math.min(...pages.map((p) => p.length))).toBeGreaterThanOrEqual(6);
  });
});

describe("countUp", () => {
  it("keeps prefix, suffix, separators and decimals", () => {
    expect(countUp("173,000 TW", 1)).toBe("173,000 TW");
    expect(countUp("173,000 TW", 0.5)).toBe("86,500 TW");
    expect(countUp("$1.5M", 1)).toBe("$1.5M");
    expect(countUp("42%", 0)).toBe("0%");
    expect(countUp("Half", 0.3)).toBe("Half");
  });
});
