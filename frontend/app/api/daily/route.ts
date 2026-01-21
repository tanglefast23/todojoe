import { NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

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
  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { error: "Groq API key not configured" },
      { status: 500 }
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prompt = `Today is ${today}. Give me a daily briefing in JSON format:

1. Crypto (BTC, ETH, HYPE, ZEC): current price USD & 24h % change
2. Stocks [COIN,META,AMD,AAPL,MSFT,AVGO,CRCL,HOOD,OKLO,SMR,ETHA,IBIT,BRK-B,GOOG,TSM,AMZN,TSLA,MU,NVDA,COPX,HBM,ERO,URA,IREN,MSTR,SIJL,NBIS,CRWV]: only top 3 gainers & top 3 losers with %
3. Ho Chi Minh City weather today (temp, condition, brief forecast)
4. Top 2 Vietnam/HCMC news headlines
5. Top 2 global news headlines
6. Top 2 pop culture news headlines

Return ONLY valid JSON, no markdown:
{"crypto":[{"symbol":"BTC","name":"Bitcoin","price":"$XX,XXX","change":"+X.X%","isPositive":true}],"stocks":{"gainers":[{"symbol":"XXX","change":"+X.X%"}],"losers":[{"symbol":"XXX","change":"-X.X%"}]},"weather":{"temp":"XX°C","condition":"Sunny","forecast":"Brief forecast"},"news":{"vietnam":["headline1","headline2"],"global":["headline1","headline2"],"popCulture":["headline1","headline2"]}}`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are a financial and news assistant. Provide realistic current market data and news. Return only valid JSON, no explanations.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to fetch daily data");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("No response from Groq");
    }

    // Parse JSON response
    const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
    const dailyData: DailyData = JSON.parse(jsonStr);
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
