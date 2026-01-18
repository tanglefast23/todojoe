/**
 * Decimal.js utilities for precise financial calculations
 * Prevents floating-point errors in money/quantity calculations
 */

import Decimal from "decimal.js";

// Configure Decimal.js for financial calculations
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Multiply two numbers with decimal precision
 */
export function multiply(a: number, b: number): number {
  return new Decimal(a).times(b).toNumber();
}

/**
 * Divide two numbers with decimal precision
 */
export function divide(a: number, b: number): number {
  if (b === 0) return 0;
  return new Decimal(a).dividedBy(b).toNumber();
}

/**
 * Add two numbers with decimal precision
 */
export function add(a: number, b: number): number {
  return new Decimal(a).plus(b).toNumber();
}

/**
 * Subtract two numbers with decimal precision
 */
export function subtract(a: number, b: number): number {
  return new Decimal(a).minus(b).toNumber();
}

/**
 * Sum an array of numbers with decimal precision
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => new Decimal(acc).plus(n), new Decimal(0)).toNumber();
}

/**
 * Calculate percentage with decimal precision
 * Returns (part / whole) * 100
 */
export function percentage(part: number, whole: number): number {
  if (whole === 0) return 0;
  return new Decimal(part).dividedBy(whole).times(100).toNumber();
}

/**
 * Calculate weighted average cost
 * Formula: (existingCost * existingQty + newPrice * newQty) / totalQty
 */
export function weightedAverage(
  existingCost: number,
  existingQty: number,
  newPrice: number,
  newQty: number
): number {
  const totalQty = add(existingQty, newQty);
  if (totalQty === 0) return 0;

  const existingValue = multiply(existingCost, existingQty);
  const newValue = multiply(newPrice, newQty);
  const totalValue = add(existingValue, newValue);

  return divide(totalValue, totalQty);
}

/**
 * Calculate gain/loss amount
 */
export function calculateGain(currentValue: number, costBasis: number): number {
  return subtract(currentValue, costBasis);
}

/**
 * Calculate gain/loss percentage
 */
export function calculateGainPercent(gain: number, costBasis: number): number {
  return percentage(gain, costBasis);
}

/**
 * Calculate current value of a position
 */
export function calculatePositionValue(quantity: number, price: number): number {
  return multiply(quantity, price);
}

/**
 * Round to specified decimal places (default 2 for currency)
 */
export function round(value: number, decimals: number = 2): number {
  return new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Round for display (2 decimals for currency, 8 for crypto quantities)
 */
export function roundForDisplay(value: number, isCrypto: boolean = false): number {
  return round(value, isCrypto ? 8 : 2);
}
