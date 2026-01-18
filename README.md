# Investment Tracker

A personal investment portfolio tracker with real-time market data, allocation planning, and multi-account support.

## Features

### Portfolio Management
- **Multi-Account Support** - Track investments across TFSA, RRSP, margin, and other account types
- **Multi-Portfolio** - Create and switch between different portfolios
- **Transaction History** - Record buys, sells, and track your investment journey

### Real-Time Market Data
- **Live Stock Quotes** - Real-time prices via Yahoo Finance API
- **Cryptocurrency Support** - Track BTC, ETH, SOL, and other major cryptocurrencies
- **Price Charts** - Interactive charts powered by TradingView's Lightweight Charts

### Allocation Overview
- **Holdings Grid** - See all holdings across all accounts in one view
- **Allocation Breakdown** - Current portfolio allocation percentages
- **Historical Tracking** - Compare allocations to 5 and 15 sessions ago
- **Account Values** - Total value per account with profit/loss

### Sell Planning
- **Percentage-Based Sells** - Plan sells as a percentage of your portfolio
- **Per-Account Allocation** - Specify how many shares to sell from each account
- **Buy Allocation** - Plan what to buy with proceeds, per account
- **Order Tracking** - "Upcoming Orders" section to track planned sells and buys
- **Completion Tracking** - Mark orders as done and track progress

### User Experience
- **Dark Theme** - Easy on the eyes for market watching
- **Keyboard Shortcuts** - Press "S" to start a new sell plan
- **Local Storage** - All data stored locally in your browser
- **Responsive Design** - Works on desktop and mobile

## Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **Zustand** - Lightweight state management with persistence
- **TanStack Query** - Server state management and caching
- **Radix UI** - Accessible component primitives
- **Recharts** - Data visualization
- **Lightweight Charts** - TradingView charting library

### Backend
- **FastAPI** - Python web framework
- **Yahoo Finance API** - Market data provider

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The app will be available at `http://localhost:3000`

## Screenshots

*Coming soon*

## License

Private project - All rights reserved
