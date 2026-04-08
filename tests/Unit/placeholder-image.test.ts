import { describe, expect, test } from "bun:test";
import {
  PLACEHOLDER_IMAGE_DEFAULT_HEIGHT,
  PLACEHOLDER_IMAGE_DEFAULT_WIDTH,
  PLACEHOLDER_IMAGE_MAX_DIMENSION,
  buildPlaceholderSvg,
  clampPlaceholderDimension,
  parsePlaceholderDimensions,
} from "../../server/controllers.js";

describe("clampPlaceholderDimension", () => {
  test("clamps high values", () => {
    expect(clampPlaceholderDimension(99999)).toBe(PLACEHOLDER_IMAGE_MAX_DIMENSION);
  });
  test("floors and enforces minimum 1", () => {
    expect(clampPlaceholderDimension(0)).toBe(1);
    expect(clampPlaceholderDimension(3.7)).toBe(3);
  });
});

describe("parsePlaceholderDimensions", () => {
  test("defaults for /placeholder-image", () => {
    expect(parsePlaceholderDimensions("/placeholder-image")).toEqual({
      width: PLACEHOLDER_IMAGE_DEFAULT_WIDTH,
      height: PLACEHOLDER_IMAGE_DEFAULT_HEIGHT,
    });
  });
  test("parses explicit dimensions", () => {
    expect(parsePlaceholderDimensions("/placeholder-image/100/200")).toEqual({ width: 100, height: 200 });
  });
  test("clamps dimensions", () => {
    expect(parsePlaceholderDimensions(`/placeholder-image/${PLACEHOLDER_IMAGE_MAX_DIMENSION + 1}/50`)).toEqual({
      width: PLACEHOLDER_IMAGE_MAX_DIMENSION,
      height: 50,
    });
  });
  test("invalid extra segments fall back to default", () => {
    expect(parsePlaceholderDimensions("/placeholder-image/xx/yy")).toEqual({
      width: PLACEHOLDER_IMAGE_DEFAULT_WIDTH,
      height: PLACEHOLDER_IMAGE_DEFAULT_HEIGHT,
    });
  });
});

describe("buildPlaceholderSvg", () => {
  test("includes dimensions and svg root", () => {
    const svg = buildPlaceholderSvg(100, 200);
    expect(svg).toContain('width="100"');
    expect(svg).toContain('height="200"');
    expect(svg).toContain("100 × 200");
    expect(svg).toContain("<svg ");
    expect(svg).toContain("#d4d4d4");
  });
});
