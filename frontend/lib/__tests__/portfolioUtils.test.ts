/**
 * Tests for portfolio utility functions
 */

import {
  generateId,
  isValidUUID,
  calculateHoldings,
  createDefaultAccounts,
} from "../portfolioUtils";
import type { Transaction } from "@/types/portfolio";

describe("portfolioUtils", () => {
  describe("generateId", () => {
    it("generates a valid UUID", () => {
      const id = generateId();
      expect(isValidUUID(id)).toBe(true);
    });

    it("generates unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("isValidUUID", () => {
    it("returns true for valid UUIDs", () => {
      expect(isValidUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
      expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });

    it("returns false for invalid formats", () => {
      expect(isValidUUID("not-a-uuid")).toBe(false);
      expect(isValidUUID("123")).toBe(false);
      expect(isValidUUID("")).toBe(false);
      expect(isValidUUID("tag-stocks")).toBe(false); // Old legacy format
    });

    it("is case-insensitive", () => {
      expect(isValidUUID("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
    });
  });

  describe("calculateHoldings", () => {
    it("calculates holdings from buy transactions", () => {
      const transactions: Transaction[] = [
        {
          id: "1",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "AAPL",
          assetType: "stock",
          type: "buy",
          quantity: 10,
          price: 150,
          date: "2024-01-01",
        },
      ];

      const holdings = calculateHoldings(transactions);
      expect(holdings).toHaveLength(1);
      expect(holdings[0].symbol).toBe("AAPL");
      expect(holdings[0].quantity).toBe(10);
      expect(holdings[0].avgCost).toBe(150);
    });

    it("calculates weighted average cost for multiple buys", () => {
      const transactions: Transaction[] = [
        {
          id: "1",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "AAPL",
          assetType: "stock",
          type: "buy",
          quantity: 10,
          price: 100,
          date: "2024-01-01",
        },
        {
          id: "2",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "AAPL",
          assetType: "stock",
          type: "buy",
          quantity: 10,
          price: 120,
          date: "2024-01-02",
        },
      ];

      const holdings = calculateHoldings(transactions);
      expect(holdings).toHaveLength(1);
      expect(holdings[0].quantity).toBe(20);
      expect(holdings[0].avgCost).toBe(110); // (10*100 + 10*120) / 20
    });

    it("reduces quantity on sell transactions", () => {
      const transactions: Transaction[] = [
        {
          id: "1",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "AAPL",
          assetType: "stock",
          type: "buy",
          quantity: 100,
          price: 150,
          date: "2024-01-01",
        },
        {
          id: "2",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "AAPL",
          assetType: "stock",
          type: "sell",
          quantity: 30,
          price: 180,
          date: "2024-01-02",
        },
      ];

      const holdings = calculateHoldings(transactions);
      expect(holdings).toHaveLength(1);
      expect(holdings[0].quantity).toBe(70);
      expect(holdings[0].avgCost).toBe(150); // Avg cost unchanged on sell
    });

    it("removes holding when all shares sold", () => {
      const transactions: Transaction[] = [
        {
          id: "1",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "AAPL",
          assetType: "stock",
          type: "buy",
          quantity: 10,
          price: 150,
          date: "2024-01-01",
        },
        {
          id: "2",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "AAPL",
          assetType: "stock",
          type: "sell",
          quantity: 10,
          price: 180,
          date: "2024-01-02",
        },
      ];

      const holdings = calculateHoldings(transactions);
      expect(holdings).toHaveLength(0);
    });

    it("keeps stock and crypto separate even with same symbol", () => {
      const transactions: Transaction[] = [
        {
          id: "1",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "BTC",
          assetType: "stock", // BTC stock ETF
          type: "buy",
          quantity: 10,
          price: 50,
          date: "2024-01-01",
        },
        {
          id: "2",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "BTC",
          assetType: "crypto", // Actual Bitcoin
          type: "buy",
          quantity: 0.5,
          price: 60000,
          date: "2024-01-01",
        },
      ];

      const holdings = calculateHoldings(transactions);
      expect(holdings).toHaveLength(2);

      const stockHolding = holdings.find((h) => h.assetType === "stock");
      const cryptoHolding = holdings.find((h) => h.assetType === "crypto");

      expect(stockHolding?.quantity).toBe(10);
      expect(stockHolding?.avgCost).toBe(50);
      expect(cryptoHolding?.quantity).toBe(0.5);
      expect(cryptoHolding?.avgCost).toBe(60000);
    });

    it("processes transactions in date order", () => {
      const transactions: Transaction[] = [
        {
          id: "2",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "AAPL",
          assetType: "stock",
          type: "buy",
          quantity: 10,
          price: 120,
          date: "2024-01-02", // Later date but first in array
        },
        {
          id: "1",
          portfolioId: "p1",
          accountId: "a1",
          symbol: "AAPL",
          assetType: "stock",
          type: "buy",
          quantity: 10,
          price: 100,
          date: "2024-01-01", // Earlier date
        },
      ];

      const holdings = calculateHoldings(transactions);
      expect(holdings[0].avgCost).toBe(110);
    });

    it("returns empty array for empty transactions", () => {
      expect(calculateHoldings([])).toEqual([]);
    });
  });

  describe("createDefaultAccounts", () => {
    it("creates 3 default accounts", () => {
      const accounts = createDefaultAccounts("portfolio-1");
      expect(accounts).toHaveLength(3);
    });

    it("creates accounts with correct names", () => {
      const accounts = createDefaultAccounts("portfolio-1");
      const names = accounts.map((a) => a.name);
      expect(names).toContain("TFSA");
      expect(names).toContain("RRSP");
      expect(names).toContain("Other");
    });

    it("assigns correct portfolioId to all accounts", () => {
      const accounts = createDefaultAccounts("my-portfolio");
      accounts.forEach((account) => {
        expect(account.portfolioId).toBe("my-portfolio");
      });
    });

    it("generates unique IDs for each account", () => {
      const accounts = createDefaultAccounts("portfolio-1");
      const ids = accounts.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });
});
