import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
  weather: {
    temp: string;
    condition: string;
    forecast: string;
  };
  news: {
    vietnam: string[];
    global: string[];
    popCulture: string[];
  };
  generatedAt: string;
}

export async function GET() {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Concise prompt for Gemini with search grounding
  const prompt = `Today is ${today}. Search for current data and return a JSON daily briefing:

1. Current crypto prices & 24h change: Bitcoin (BTC), Ethereum (ETH), Hyperliquid (HYPE), Zcash (ZEC)
2. From these stocks, find only the top 3 gainers and top 3 losers today with their % change: COIN, META, AMD, AAPL, MSFT, AVGO, CRCL, HOOD, OKLO, SMR, ETHA, IBIT, BRK-B, GOOG, TSM, AMZN, TSLA, MU, NVDA, COPX, HBM, ERO, URA, IREN, MSTR, SOXL, NBIS, CRWV
3. Ho Chi Minh City weather right now (temp in Celsius, condition, brief forecast)
4. Top 2 Vietnam/Ho Chi Minh City news headlines today
5. Top 2 global/world news headlines today
6. Top 2 entertainment/pop culture news headlines today

Return ONLY valid JSON in this exact format, no other text:
{"crypto":[{"symbol":"BTC","name":"Bitcoin","price":"$XX,XXX","change":"+X.X%","isPositive":true}],"stocks":{"gainers":[{"symbol":"XXX","change":"+X.X%"}],"losers":[{"symbol":"XXX","change":"-X.X%"}]},"weather":{"temp":"XX°C","condition":"Sunny","forecast":"Brief forecast"},"news":{"vietnam":["headline1","headline2"],"global":["headline1","headline2"],"popCulture":["headline1","headline2"]}}`;

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
              google_search_retrieval: {},
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

    let dailyData: DailyData;
    try {
      dailyData = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("[Daily API] JSON parse error. Raw content:", content);
      throw new Error("Failed to parse response as JSON");
    }

    dailyData.generatedAt = new Date().toISOString();

    return NextResponse.json(dailyData);
  } catch (error) {
    console.error("[Daily API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch daily summary" },
      { status: 500 }
    );
  }
}
