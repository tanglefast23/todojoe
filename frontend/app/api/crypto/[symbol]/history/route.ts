import { NextRequest, NextResponse } from "next/server";

// Map common crypto symbols to CoinGecko IDs
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  SHIB: "shiba-inu",
  BNB: "binancecoin",
  TRX: "tron",
  XLM: "stellar",
  ALGO: "algorand",
  VET: "vechain",
  AERO: "aerodrome-finance",
};

// Search CoinGecko to find the correct ID for a symbol
async function searchCoinGeckoId(symbol: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${symbol}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 }, // Cache search results for 1 hour
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const coins = data.coins || [];

    // Find exact symbol match (case-insensitive)
    const exactMatch = coins.find(
      (coin: { symbol: string; id: string }) =>
        coin.symbol.toUpperCase() === symbol.toUpperCase()
    );

    if (exactMatch) {
      console.log(
        `[CoinGecko] Discovered mapping: ${symbol.toUpperCase()}: "${exactMatch.id}" - consider adding to SYMBOL_TO_ID`
      );
      return exactMatch.id;
    }

    return null;
  } catch (error) {
    console.error("[CoinGecko] Search error:", error);
    return null;
  }
}

// Map time ranges to CoinGecko parameters
function getRangeParams(range: string): { days: number; interval?: string } {
  switch (range) {
    case "1D":
      return { days: 1 }; // Hourly data for 1 day
    case "1W":
      return { days: 7 }; // Hourly data for 1 week
    case "1M":
      return { days: 30 }; // Daily data for 1 month
    case "3M":
      return { days: 90 }; // Daily data for 3 months
    case "6M":
      return { days: 180 }; // Daily data for 6 months
    case "1Y":
      return { days: 365 }; // Daily data for 1 year
    default:
      return { days: 30 };
  }
}

// Fetch history by coin ID
async function fetchHistoryById(coinId: string, days: number) {
  return await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "1M";

    const upperSymbol = symbol.toUpperCase();
    let coinId = SYMBOL_TO_ID[upperSymbol] || upperSymbol.toLowerCase();
    const { days } = getRangeParams(range);

    // Try fetching with the initial ID
    let response = await fetchHistoryById(coinId, days);

    // If not found and we don't have a hardcoded mapping, search for the correct ID
    if (response.status === 404 && !SYMBOL_TO_ID[upperSymbol]) {
      console.log(`[CoinGecko] ${coinId} not found, searching for ${upperSymbol}...`);
      const searchedId = await searchCoinGeckoId(upperSymbol);

      if (searchedId) {
        coinId = searchedId;
        response = await fetchHistoryById(coinId, days);
      }
    }

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Crypto not found" },
          { status: 404 }
        );
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform CoinGecko format to our format
    // CoinGecko returns: { prices: [[timestamp, price], ...], ... }
    const history = data.prices.map(([timestamp, price]: [number, number]) => ({
      timestamp: new Date(timestamp).toISOString(),
      price,
    }));

    return NextResponse.json(history);
  } catch (error) {
    console.error("Crypto history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch crypto history" },
      { status: 500 }
    );
  }
}
