import { NextRequest, NextResponse } from "next/server";

// Map common crypto symbols to CoinGecko IDs
const SYMBOL_TO_ID: Record<string, string> = {
  // Major cryptocurrencies
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
  // Additional popular crypto
  SUI: "sui",
  PEPE: "pepe",
  ENA: "ethena",
  ZEC: "zcash",
  AAVE: "aave",
  ARB: "arbitrum",
  OP: "optimism",
  APT: "aptos",
  SEI: "sei-network",
  INJ: "injective-protocol",
  TIA: "celestia",
  NEAR: "near",
  FTM: "fantom",
  HBAR: "hedera-hashgraph",
  ICP: "internet-computer",
  FIL: "filecoin",
  MKR: "maker",
  SNX: "synthetix-network-token",
  CRV: "curve-dao-token",
  COMP: "compound-governance-token",
  YFI: "yearn-finance",
  SUSHI: "sushi",
  CAKE: "pancakeswap-token",
  "1INCH": "1inch",
  BAL: "balancer",
  LDO: "lido-dao",
  RPL: "rocket-pool",
  GMX: "gmx",
  WIF: "dogwifcoin",
  BONK: "bonk",
  FLOKI: "floki",
  WLD: "worldcoin-wld",
  RENDER: "render-token",
  FET: "fetch-ai",
  RNDR: "render-token",
  GRT: "the-graph",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AXS: "axie-infinity",
  ENS: "ethereum-name-service",
  // Stablecoins
  USDT: "tether",
  USDC: "usd-coin",
  DAI: "dai",
  BUSD: "binance-usd",
  TUSD: "true-usd",
  FRAX: "frax",
  PYUSD: "paypal-usd",
  FDUSD: "first-digital-usd",
  USDP: "paxos-standard",
  GUSD: "gemini-dollar",
  USDD: "usdd",
  LUSD: "liquity-usd",
  CUSD: "celo-dollar",
  SUSD: "susd",
  RLUSD: "ripple-usd",
  EURC: "euro-coin",
  EURS: "stasis-eurs",
  // xStocks - Tokenized Stocks (BackedFi)
  TSLAX: "tesla-xstock",
  NVDAX: "nvidia-xstock",
  GOOGLX: "alphabet-xstock",
  AAPLX: "apple-xstock",
  AMZNX: "amazon-xstock",
  MSFTX: "microsoft-xstock",
  METAX: "meta-xstock",
  NFLXX: "netflix-xstock",
  COINX: "coinbase-xstock",
  MSTRX: "microstrategy-xstock",
  INTCX: "intel-xstock",
  AMDX: "amd-xstock",
  ORCLX: "oracle-xstock",
  PLTRX: "palantir-xstock",
  CRWDX: "crowdstrike-xstock",
  CRMX: "salesforce-xstock",
  PANWX: "palo-alto-networks-xstock",
  ASMLX: "asml-xstock",
  MUX: "micron-technology-xstock",
  AVGOX: "broadcom-xstock",
  // xStocks - ETFs & Indices
  SPYX: "sp500-xstock",
  QQQX: "nasdaq-xstock",
  TQQQX: "tqqq-xstock",
  VTIX: "vanguard-xstock",
  IWMX: "russell-2000-xstock",
  GLDX: "gold-xstock",
  // xStocks - Finance & Banking
  JPMX: "jpmorgan-chase-xstock",
  GSX: "goldman-sachs-xstock",
  BACX: "bank-of-america-xstock",
  VX: "visa-xstock",
  MAX: "mastercard-xstock",
  AXPX: "american-express-xstock",
  PYPLX: "paypal-xstock",
  HOODX: "robinhood-xstock",
  BLKX: "blackrock-xstock",
  // xStocks - Healthcare & Pharma
  PFEX: "pfizer-xstock",
  UNHX: "unitedhealth-xstock",
  JNJX: "johnson-johnson-xstock",
  ABBVX: "abbvie-xstock",
  MRKX: "merck-xstock",
  LLYX: "eli-lilly-xstock",
  NVOX: "novo-nordisk-xstock",
  AZNX: "astrazeneca-xstock",
  ABTX: "abbott-xstock",
  TMOX: "thermo-fisher-xstock",
  DHRX: "danaher-xstock",
  MDTX: "medtronic-xstock",
  // xStocks - Consumer & Retail
  COSTX: "costco-xstock",
  MCDX: "mcdonald-s-xstock",
  KOX: "coca-cola-xstock",
  PEPX: "pepsico-xstock",
  PGX: "procter-gamble-xstock",
  HDX: "home-depot-xstock",
  LULUX: "lululemon-xstock",
  WENX: "wendy-s-xstock",
  BKNGX: "booking-xstock",
  EBAYX: "ebay-xstock",
  // xStocks - Energy & Industrial
  XOMX: "exxon-mobil-xstock",
  CVXX: "chevron-xstock",
  HONX: "honeywell-xstock",
  LINX: "linde-xstock",
  // xStocks - Other Notable
  "BRK.BX": "berkshire-hathaway-xstock",
  IBMX: "international-business-machines-xstock",
  CSCOX: "cisco-xstock",
  ACNX: "accenture-xstock",
  TX: "at-t-xstock",
  PMX: "philip-morris-xstock",
  CMCSAX: "comcast-xstock",
  SPGIX: "s-p-global-xstock",
  GMEX: "gamestop-xstock",
  APPX: "applovin-xstock",
  RBLXX: "roblox-xstock",
  ADBEX: "adobe-xstock",
  DUOLX: "duolingo-xstock",
  EXPEX: "expedia-xstock",
  MRVLX: "marvell-xstock",
  // xStocks - Crypto-related
  CRCLX: "circle-xstock",
  DFDVX: "dfdv-xstock",
  GLXYX: "galaxy-digital-xstock",
  RIOTX: "riot-platforms-xstock",
  CLSKX: "cleanspark-xstock",
  CORZX: "core-scientific-xstock",
  HUTX: "hut-8-xstock",
  BTBTX: "bit-digital-xstock",
  FUFUX: "bitfufu-xstock",
  BMNRX: "bitmine-xstock",
  // xStocks - Space & Energy
  RKLBX: "rocket-lab-xstock",
  OKLOX: "oklo-xstock",
  ASTSX: "ast-spacemobile-xstock",
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
      // Log the mapping so we can add it to SYMBOL_TO_ID later
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

// Fetch coin data by ID
async function fetchCoinById(coinId: string) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
    }
  );
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const upperSymbol = symbol.toUpperCase();
    let coinId = SYMBOL_TO_ID[upperSymbol] || upperSymbol.toLowerCase();

    // Try fetching with the initial ID
    let response = await fetchCoinById(coinId);

    // If not found and we don't have a hardcoded mapping, search for the correct ID
    if (response.status === 404 && !SYMBOL_TO_ID[upperSymbol]) {
      console.log(`[CoinGecko] ${coinId} not found, searching for ${upperSymbol}...`);
      const searchedId = await searchCoinGeckoId(upperSymbol);

      if (searchedId) {
        coinId = searchedId;
        response = await fetchCoinById(coinId);
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
    const market = data.market_data;

    const result = {
      symbol: upperSymbol,
      name: data.name,
      logo_url: data.image?.small || null,
      price: market.current_price?.usd || 0,
      change_24h: market.price_change_24h || 0,
      change_percent_24h: market.price_change_percentage_24h || 0,
      volume_24h: market.total_volume?.usd || 0,
      market_cap: market.market_cap?.usd || 0,
      rank: data.market_cap_rank || null,
      change_percent_7d: market.price_change_percentage_7d || null,
      change_percent_30d: market.price_change_percentage_30d || null,
      change_percent_1y: market.price_change_percentage_1y || null,
      ath: market.ath?.usd || null,
      ath_change_percent: market.ath_change_percentage?.usd || null,
      source: "coingecko",
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Crypto quote error:", error);
    return NextResponse.json(
      { error: "Failed to fetch crypto quote" },
      { status: 500 }
    );
  }
}
