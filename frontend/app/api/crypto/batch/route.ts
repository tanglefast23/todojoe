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

// Reverse mapping for looking up symbols from IDs
const ID_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_TO_ID).map(([k, v]) => [v, k])
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbolsParam = searchParams.get("symbols");

    if (!symbolsParam) {
      return NextResponse.json(
        { error: "symbols parameter is required" },
        { status: 400 }
      );
    }

    const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase());
    const coinIds = symbols.map((s) => SYMBOL_TO_ID[s] || s.toLowerCase());

    // Use CoinGecko's markets endpoint for batch fetching
    // price_change_percentage accepts: 1h, 24h, 7d, 14d, 30d, 200d, 1y
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds.join(",")}&order=market_cap_desc&sparkline=false&price_change_percentage=1h,24h,7d,30d,1y`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 30 }, // Cache for 30 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    const results = data.map((coin: {
      id: string;
      symbol: string;
      name: string;
      image: string;
      current_price: number;
      price_change_24h: number;
      price_change_percentage_24h: number;
      price_change_percentage_1h_in_currency?: number;
      total_volume: number;
      market_cap: number;
      market_cap_rank: number;
      price_change_percentage_7d_in_currency?: number;
      price_change_percentage_30d_in_currency?: number;
      price_change_percentage_1y_in_currency?: number;
      ath: number;
      ath_change_percentage: number;
    }) => ({
      symbol: ID_TO_SYMBOL[coin.id] || coin.symbol.toUpperCase(),
      name: coin.name,
      logo_url: coin.image || null,
      price: coin.current_price || 0,
      change_24h: coin.price_change_24h || 0,
      change_percent_1h: coin.price_change_percentage_1h_in_currency || null,
      change_percent_24h: coin.price_change_percentage_24h || 0,
      volume_24h: coin.total_volume || 0,
      market_cap: coin.market_cap || 0,
      rank: coin.market_cap_rank || null,
      change_percent_7d: coin.price_change_percentage_7d_in_currency || null,
      change_percent_30d: coin.price_change_percentage_30d_in_currency || null,
      change_percent_1y: coin.price_change_percentage_1y_in_currency || null,
      ath: coin.ath || null,
      ath_change_percent: coin.ath_change_percentage || null,
      source: "coingecko",
      updated_at: new Date().toISOString(),
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Batch crypto quotes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch crypto quotes" },
      { status: 500 }
    );
  }
}
