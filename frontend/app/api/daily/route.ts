import { NextResponse } from "next/server";
import {
  fetchCryptoPrices,
  fetchStockPrices,
  getTopMovers,
  formatCryptoPrice,
} from "@/lib/market-data";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Stock symbols to track
const STOCK_SYMBOLS = [
  "COIN", "META", "AMD", "AAPL", "MSFT", "AVGO", "CRCL", "HOOD", "OKLO", "SMR",
  "BRK-B", "GOOG", "TSM", "AMZN", "TSLA", "MU", "NVDA",
  "ERO", "IREN", "MSTR", "NBIS", "CRWV",
];

// Commodity ETF symbols to track (mining/resources ETFs)
const COMMODITY_SYMBOLS = ["SILJ", "URA", "COPX", "HBM"];

// Crypto symbols to track
const CRYPTO_SYMBOLS = ["BTC", "ETH", "HYPE", "ZEC"];

export interface NewsItem {
  headline: string;
  url: string;
  source?: string;
}

export interface CommodityItem {
  symbol: string;
  name: string;
  change: string;
  isPositive: boolean;
}

export interface DailyData {
  crypto: {
    symbol: string;
    name: string;
    price: string;
    change: string;
    isPositive: boolean;
  }[];
  stocks: {
    gainers: { symbol: string; change: string }[];
    losers: { symbol: string; change: string }[];
  };
  commodities: CommodityItem[];
  news: {
    vietnam: NewsItem[];
    global: NewsItem[];
    popCulture: NewsItem[];
  };
  generatedAt: string;
}

/**
 * Fetch news from Gemini with search grounding
 */
async function fetchNews(): Promise<DailyData["news"]> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prompt = `Today is ${today}. Search for and provide today's top news headlines.

For each news item, provide:
1. A detailed summary (2-3 sentences explaining the story, not just a headline)
2. The source URL where the story can be read
3. The source name (e.g., VnExpress, Reuters, BBC)

Categories needed:
- 2 Vietnam/Ho Chi Minh City news stories
- 2 Global/world news stories
- 2 Entertainment/pop culture news stories

Return ONLY valid JSON in this exact format, no other text:
{
  "vietnam": [
    {"headline": "Detailed 2-3 sentence summary of the news story explaining what happened and why it matters.", "url": "https://source-url.com/article", "source": "VnExpress"}
  ],
  "global": [
    {"headline": "Detailed 2-3 sentence summary of the news story explaining what happened and why it matters.", "url": "https://source-url.com/article", "source": "Reuters"}
  ],
  "popCulture": [
    {"headline": "Detailed 2-3 sentence summary of the news story explaining what happened and why it matters.", "url": "https://source-url.com/article", "source": "Entertainment Weekly"}
  ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("[Daily API] Gemini error:", error);
    throw new Error(error.error?.message || "Failed to fetch from Gemini");
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!content) {
    throw new Error("No response from Gemini");
  }

  // Parse JSON response (remove any markdown formatting)
  const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.error("[Daily API] JSON parse error. Raw content:", content);
    throw new Error("Failed to parse news response as JSON");
  }
}

// Commodity symbol to display name mapping
const COMMODITY_NAMES: Record<string, string> = {
  SILJ: "Silver Miners",
  URA: "Uranium",
  COPX: "Copper Miners",
  HBM: "Hudbay Minerals",
};

export async function GET() {
  try {
    // Fetch all data in parallel
    const [cryptoPrices, stockPrices, commodityPrices, news] = await Promise.all([
      fetchCryptoPrices(CRYPTO_SYMBOLS),
      fetchStockPrices(STOCK_SYMBOLS),
      fetchStockPrices(COMMODITY_SYMBOLS),
      fetchNews(),
    ]);

    // Format crypto data for response
    const crypto = cryptoPrices.map((coin) => ({
      symbol: coin.symbol,
      name: coin.name,
      price: formatCryptoPrice(coin.price),
      change: `${coin.changePercent24h >= 0 ? "+" : ""}${coin.changePercent24h.toFixed(2)}%`,
      isPositive: coin.changePercent24h >= 0,
    }));

    // Calculate top movers from stock data
    const stocks = getTopMovers(stockPrices);

    // Format commodity data for response
    const commodities: CommodityItem[] = commodityPrices.map((item) => ({
      symbol: item.symbol,
      name: COMMODITY_NAMES[item.symbol] || item.symbol,
      change: `${item.changePercent >= 0 ? "+" : ""}${item.changePercent.toFixed(2)}%`,
      isPositive: item.changePercent >= 0,
    }));

    const dailyData: DailyData = {
      crypto,
      stocks,
      commodities,
      news,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(dailyData);
  } catch (error) {
    console.error("[Daily API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch daily summary" },
      { status: 500 }
    );
  }
}
