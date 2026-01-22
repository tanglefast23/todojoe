# JV To Do

A personal productivity hub combining task management, calendar integration, Gmail inbox, daily market briefings, and AI-powered search — all in one app.

**Live:** [todojoe.app](https://todojoe.app)

## Features

### Task Management
- **Quick Task Entry** — Add tasks with title and priority level (urgent/regular)
- **Task Lifecycle** — Track tasks from creation through completion
- **File Attachments** — Upload images or files to tasks for context
- **Cross-Device Sync** — Real-time synchronization via Supabase

### Calendar
- **Unified Calendar View** — See both local and Google Calendar events together
- **Event Creation** — Add events with title, date, time, and optional end time
- **Natural Language Parsing** — Create events from text like "Dentist tomorrow at 3pm"
- **Image-to-Event** — Upload a flyer or screenshot to automatically extract and create events
- **Google Calendar Sync** — Two-way integration with your Google Calendar

### Gmail Integration
- **Inbox View** — Browse your Gmail Primary inbox
- **Full Email Reading** — View complete email content with HTML rendering
- **Quick Actions** — Delete and archive emails directly from the app
- **Unread Indicators** — Visual distinction between read and unread messages

### Daily Briefing
- **Cryptocurrency Prices** — BTC, ETH, HYPE, ZEC with 24h changes
- **Stock Market** — Top gainers and losers from 30+ tracked symbols
- **Commodities** — Silver, uranium, and copper ETF tracking
- **News Categories** — Vietnam, global, entertainment, tech, and vibe coding news
- **AI-Powered** — News aggregated via Gemini with search grounding

### AI Search
- **Smart Search** — Ask questions about your calendar and emails
- **Image Analysis** — Upload images and ask questions about them
- **Search History** — Review past queries and responses

### Settings
- **Data Export** — Download tasks and events as JSON backup
- **Data Import** — Restore from backup files
- **Clear Data** — Reset all local data with confirmation

## Tech Stack

### Frontend
- **Next.js 16** — React framework with App Router
- **React 19** — UI library
- **TypeScript** — Strict mode, no `any` types
- **Tailwind CSS 4** — Utility-first styling
- **Zustand** — State management with localStorage persistence
- **TanStack Query** — Server state and caching
- **Radix UI** — Accessible component primitives
- **Lucide React** — Icon library

### Backend & Services
- **Supabase** — PostgreSQL database, real-time sync, file storage
- **Google APIs** — Calendar, Gmail, Gemini 2.0 Flash
- **Groq API** — Fast LLM inference for search and NLP
- **Yahoo Finance** — Stock and crypto market data
- **CoinGecko** — Cryptocurrency prices

## Getting Started

### Prerequisites
- Node.js >= 20.9.0
- Supabase project
- Google OAuth credentials (for calendar/email features)
- API keys for Groq and Gemini (for AI features)

### Installation

```bash
cd frontend
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google APIs (Optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback

# AI APIs (Optional)
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
```

### Development

```bash
npm run dev
```

The app runs at `http://localhost:3000`

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── calendar/          # Calendar view
│   ├── daily/             # Daily briefing
│   ├── entry/             # Task entry
│   ├── gmail/             # Gmail inbox
│   ├── search/            # AI search
│   ├── settings/          # Data management
│   └── api/               # API routes
├── components/            # React components
├── stores/                # Zustand state stores
├── lib/                   # Utilities and API clients
└── types/                 # TypeScript definitions
```

## License

Private project — All rights reserved
