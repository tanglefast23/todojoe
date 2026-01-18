# Investment Tracker API

FastAPI backend for the Investment Tracker dashboard.

## Setup

```bash
# Create virtual environment
uv venv
source .venv/bin/activate

# Install dependencies
uv pip install -e ".[dev]"

# Copy environment file
cp .env.example .env

# Start Redis (requires Docker)
docker-compose up -d

# Run development server
uv run fastapi dev app/main.py
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/stocks/{symbol}/quote` - Get stock quote
- `GET /api/stocks/{symbol}/history?range=1M` - Get stock history
- `GET /api/stocks/batch?symbols=AAPL,GOOGL` - Get batch quotes
- `GET /api/crypto/{symbol}/quote` - Get crypto quote
- `GET /api/crypto/{symbol}/history?range=1M` - Get crypto history
- `GET /api/crypto/batch?symbols=BTC,ETH` - Get batch quotes
