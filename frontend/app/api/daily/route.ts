import { NextResponse } from "next/server";
import {
  fetchCryptoPrices,
  fetchStockPrices,
  getTopMovers,
  formatCryptoPrice,
} from "@/lib/market-data";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Stock symbols loaded from env — keeps specific holdings out of the public repo
// Set STOCK_TRACK_SYMBOLS=AAPL,MSFT,NVDA,... in .env.local
const STOCK_SYMBOLS: string[] = process.env.STOCK_TRACK_SYMBOLS
  ? process.env.STOCK_TRACK_SYMBOLS.split(",").map((s) => s.trim()).filter(Boolean)
  : ["AAPL", "MSFT", "NVDA", "TSLA", "META", "AMZN", "GOOG", "TSM"]; // minimal generic default

// Investment symbols loaded from env — keeps positions out of the public repo
// Set INVESTMENT_WATCH_SYMBOLS=GOOGL,MU,TSLA,... in .env.local
const INVESTMENT_WATCH_SYMBOLS: string[] = process.env.INVESTMENT_WATCH_SYMBOLS
  ? process.env.INVESTMENT_WATCH_SYMBOLS.split(",").map((s) => s.trim()).filter(Boolean)
  : []; // empty default — no symbols committed to repo

// Crypto symbols loaded from env — keeps specific holdings out of the public repo
// Set CRYPTO_TRACK_SYMBOLS=BTC,ETH,... in .env.local
const CRYPTO_SYMBOLS: string[] = process.env.CRYPTO_TRACK_SYMBOLS
  ? process.env.CRYPTO_TRACK_SYMBOLS.split(",").map((s) => s.trim()).filter(Boolean)
  : ["BTC", "ETH"]; // minimal safe default

export interface NewsItem {
  headline: string;
  url: string;
  source?: string;
}

export interface InvestmentNewsItem {
  symbol: string;
  headline: string;
  url: string;
  source?: string;
  significance: "high" | "medium";
}

export interface MarketMoverItem {
  headline: string;
  impactChain: string;
  affectedSymbols: string[];
  direction: "positive" | "negative" | "uncertain";
  url: string | null;
  source: string;
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
  investmentNews: InvestmentNewsItem[];
  marketMovers: MarketMoverItem[];
  news: {
    vietnam: NewsItem[];
    global: NewsItem[];
    popCulture: NewsItem[];
    tech: NewsItem[];
    vibeCoding: NewsItem[];
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
- 2 Tech news stories (major technology companies, AI developments, hardware, software)
- 4 Vibe Coding news stories (2 about vibe coding/AI-assisted coding in general, 2 specifically about Claude Code or Anthropic's Claude)

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
  ],
  "tech": [
    {"headline": "Detailed 2-3 sentence summary of the tech news story.", "url": "https://source-url.com/article", "source": "TechCrunch"}
  ],
  "vibeCoding": [
    {"headline": "Detailed 2-3 sentence summary about vibe coding or Claude Code news.", "url": "https://source-url.com/article", "source": "Source Name"}
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
          maxOutputTokens: 4000,
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

/**
 * Fetch significant investment news from Gemini with search grounding
 * Only returns news if there's something noteworthy for the watched symbols
 */
async function fetchInvestmentNews(): Promise<InvestmentNewsItem[]> {
  if (!GEMINI_API_KEY) {
    console.warn("[Daily API] Gemini API key not configured, skipping investment news");
    return [];
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Symbols passed at runtime — not embedded in source
  const symbolsList = INVESTMENT_WATCH_SYMBOLS.join(", ");

  const prompt = `Today is ${today}. Search for SIGNIFICANT news about these investment tickers: ${symbolsList}

IMPORTANT: Only return news that is SIGNIFICANT - meaning:
- Major earnings surprises (beat/miss by significant margin)
- Important product announcements or launches
- Regulatory actions or legal developments
- Major partnership or acquisition news
- Significant analyst upgrades/downgrades
- Leadership changes (CEO, CFO, etc.)
- Notable price movements with clear catalyst (not just normal volatility)

If there is NO significant news for a ticker, DO NOT include it. It's perfectly fine to return an empty array if nothing noteworthy happened today.

For each significant news item, provide:
1. The stock symbol
2. A concise but informative summary (1-2 sentences)
3. The source URL
4. The source name
5. Significance level: "high" for major market-moving news, "medium" for notable but less impactful news

Return ONLY valid JSON in this exact format, no other text:
{
  "items": [
    {"symbol": "TSLA", "headline": "Tesla announces record quarterly deliveries of 500K vehicles, beating analyst expectations by 15%.", "url": "https://source-url.com/article", "source": "Reuters", "significance": "high"}
  ]
}

If no significant news is found for any of the tickers, return: {"items": []}`;

  try {
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
            temperature: 0.1, // Lower temperature for more factual responses
            maxOutputTokens: 3000,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("[Daily API] Gemini investment news error:", error);
      return [];
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!content) {
      console.warn("[Daily API] No investment news response from Gemini");
      return [];
    }

    // Parse JSON response (remove any markdown formatting)
    const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return parsed.items || [];
    } catch {
      console.error("[Daily API] Investment news JSON parse error. Raw content:", content);
      return [];
    }
  } catch (error) {
    console.error("[Daily API] Failed to fetch investment news:", error);
    return [];
  }
}

/**
 * Fetch portfolio-impacting geopolitical/macro events from Gemini.
 * Full analyst autonomy — Gemini decides what's significant enough to flag.
 * Returns 0-3 items; empty array if nothing noteworthy happened.
 */
async function fetchMarketMovers(): Promise<MarketMoverItem[]> {
  if (!GEMINI_API_KEY || INVESTMENT_WATCH_SYMBOLS.length === 0) {
    return [];
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const symbolsList = INVESTMENT_WATCH_SYMBOLS.join(", ");

  const prompt = `Today is ${today}. You are a financial analyst monitoring a client's portfolio. Their positions include: ${symbolsList}.

Search for any global event from the last 24 hours that would meaningfully impact one or more of these holdings. Think broadly:

- Geopolitical: wars, sanctions, trade agreements, diplomatic shifts, military actions
- Monetary: central bank decisions, rate changes, currency crises
- Commodities: oil price moves, rare earth supply, semiconductor supply chains
- Regulatory: antitrust actions, tariffs, export controls, new legislation
- Macro: GDP data, employment reports, consumer confidence, sovereign debt

For each event you find, explain the chain of impact so the client understands WHY it matters to their portfolio. For example: "OPEC announces production cut → oil prices rise → energy costs increase → TSLA manufacturing margins pressured"

Only return events that a professional analyst would flag as portfolio-relevant. Maximum 3 items. If nothing significant happened in the last 24 hours, return an empty array.

Return ONLY valid JSON in this exact format, no other text:
{
  "items": [
    {
      "headline": "1-2 sentence summary of the event and its significance.",
      "impactChain": "Event → sector/supply chain affected → which client symbols → expected direction",
      "affectedSymbols": ["NVDA", "TSM"],
      "direction": "negative",
      "url": "https://source-url.com/article",
      "source": "Reuters"
    }
  ]
}

If no significant macro events were found, return: {"items": []}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 3000,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("[Daily API] Market movers Gemini error:", error);
      return [];
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!content) {
      console.warn("[Daily API] No market movers response from Gemini");
      return [];
    }

    const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();

    try {
      const parsed = JSON.parse(jsonStr);
      const items: MarketMoverItem[] = (parsed.items || []).map((item: Record<string, unknown>) => ({
        headline: String(item.headline || ""),
        impactChain: String(item.impactChain || ""),
        affectedSymbols: Array.isArray(item.affectedSymbols) ? item.affectedSymbols.map(String) : [],
        direction: ["positive", "negative", "uncertain"].includes(item.direction as string)
          ? item.direction as MarketMoverItem["direction"]
          : "uncertain",
        url: typeof item.url === "string" ? item.url : null,
        source: String(item.source || "Unknown"),
      }));
      return items.slice(0, 3);
    } catch {
      console.error("[Daily API] Market movers JSON parse error. Raw:", content);
      return [];
    }
  } catch (error) {
    console.error("[Daily API] Failed to fetch market movers:", error);
    return [];
  }
}

export async function GET() {
  try {
    // Fetch all data in parallel
    const [cryptoPrices, stockPrices, news, investmentNews, marketMovers] = await Promise.all([
      fetchCryptoPrices(CRYPTO_SYMBOLS),
      fetchStockPrices(STOCK_SYMBOLS),
      fetchNews(),
      fetchInvestmentNews(),
      fetchMarketMovers(),
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

    const dailyData: DailyData = {
      crypto,
      stocks,
      investmentNews,
      marketMovers,
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
