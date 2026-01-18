/**
 * Tests for decimal.js financial calculation utilities
 * These are critical for preventing floating-point errors in money calculations
 */

import {
  multiply,
  divide,
  add,
  subtract,
  sum,
  percentage,
  weightedAverage,
  calculateGain,
  calculateGainPercent,
  calculatePositionValue,
  round,
  roundForDisplay,
} from "../decimal";

describe("decimal utilities", () => {
  describe("multiply", () => {
    it("multiplies two numbers correctly", () => {
      expect(multiply(10, 5)).toBe(50);
    });

    it("handles floating-point precision", () => {
      // Classic floating-point issue: 0.1 * 0.2 = 0.020000000000000004 in JS
      expect(multiply(0.1, 0.2)).toBe(0.02);
    });

    it("handles negative numbers", () => {
      expect(multiply(-10, 5)).toBe(-50);
      expect(multiply(-10, -5)).toBe(50);
    });

    it("handles zero", () => {
      expect(multiply(0, 100)).toBe(0);
    });
  });

  describe("divide", () => {
    it("divides two numbers correctly", () => {
      expect(divide(100, 4)).toBe(25);
    });

    it("returns 0 when dividing by zero", () => {
      expect(divide(100, 0)).toBe(0);
    });

    it("handles floating-point precision", () => {
      expect(divide(1, 3)).toBeCloseTo(0.3333333333333333, 10);
    });
  });

  describe("add", () => {
    it("adds two numbers correctly", () => {
      expect(add(10, 20)).toBe(30);
    });

    it("handles floating-point precision", () => {
      // Classic issue: 0.1 + 0.2 = 0.30000000000000004 in JS
      expect(add(0.1, 0.2)).toBe(0.3);
    });
  });

  describe("subtract", () => {
    it("subtracts two numbers correctly", () => {
      expect(subtract(30, 10)).toBe(20);
    });

    it("handles floating-point precision", () => {
      expect(subtract(0.3, 0.1)).toBe(0.2);
    });

    it("handles negative results", () => {
      expect(subtract(10, 30)).toBe(-20);
    });
  });

  describe("sum", () => {
    it("sums an array of numbers", () => {
      expect(sum([1, 2, 3, 4, 5])).toBe(15);
    });

    it("handles empty array", () => {
      expect(sum([])).toBe(0);
    });

    it("handles floating-point precision across many additions", () => {
      // Adding 0.1 ten times should equal 1, not 0.9999999999999999
      const tenths = Array(10).fill(0.1);
      expect(sum(tenths)).toBe(1);
    });
  });

  describe("percentage", () => {
    it("calculates percentage correctly", () => {
      expect(percentage(25, 100)).toBe(25);
      expect(percentage(50, 200)).toBe(25);
    });

    it("returns 0 when whole is 0", () => {
      expect(percentage(50, 0)).toBe(0);
    });

    it("handles percentages over 100%", () => {
      expect(percentage(150, 100)).toBe(150);
    });
  });

  describe("weightedAverage", () => {
    it("calculates weighted average for new purchase", () => {
      // Own 10 shares at $100, buy 10 more at $120
      // New avg = (10*100 + 10*120) / 20 = 2200/20 = $110
      expect(weightedAverage(100, 10, 120, 10)).toBe(110);
    });

    it("handles first purchase (zero existing)", () => {
      expect(weightedAverage(0, 0, 100, 10)).toBe(100);
    });

    it("returns 0 when total quantity is 0", () => {
      expect(weightedAverage(100, 0, 0, 0)).toBe(0);
    });

    it("handles unequal quantities", () => {
      // Own 100 shares at $10, buy 50 more at $20
      // New avg = (100*10 + 50*20) / 150 = 2000/150 = $13.33...
      const result = weightedAverage(10, 100, 20, 50);
      expect(result).toBeCloseTo(13.333333, 5);
    });
  });

  describe("calculateGain", () => {
    it("calculates positive gain", () => {
      expect(calculateGain(1500, 1000)).toBe(500);
    });

    it("calculates negative gain (loss)", () => {
      expect(calculateGain(800, 1000)).toBe(-200);
    });

    it("calculates zero gain", () => {
      expect(calculateGain(1000, 1000)).toBe(0);
    });
  });

  describe("calculateGainPercent", () => {
    it("calculates positive gain percent", () => {
      expect(calculateGainPercent(500, 1000)).toBe(50);
    });

    it("calculates negative gain percent", () => {
      expect(calculateGainPercent(-200, 1000)).toBe(-20);
    });

    it("returns 0 when cost basis is 0", () => {
      expect(calculateGainPercent(100, 0)).toBe(0);
    });
  });

  describe("calculatePositionValue", () => {
    it("calculates position value correctly", () => {
      expect(calculatePositionValue(100, 25.50)).toBe(2550);
    });

    it("handles fractional shares", () => {
      expect(calculatePositionValue(0.5, 100)).toBe(50);
    });
  });

  describe("round", () => {
    it("rounds to 2 decimals by default", () => {
      expect(round(10.126)).toBe(10.13);
      expect(round(10.124)).toBe(10.12);
    });

    it("rounds to specified decimals", () => {
      expect(round(10.12345, 3)).toBe(10.123);
      expect(round(10.12345, 4)).toBe(10.1235);
    });

    it("uses half-up rounding", () => {
      expect(round(10.125, 2)).toBe(10.13);
      expect(round(10.135, 2)).toBe(10.14);
    });
  });

  describe("roundForDisplay", () => {
    it("rounds to 2 decimals for non-crypto", () => {
      expect(roundForDisplay(10.12345)).toBe(10.12);
    });

    it("rounds to 8 decimals for crypto", () => {
      expect(roundForDisplay(0.123456789, true)).toBe(0.12345679);
    });
  });
});
