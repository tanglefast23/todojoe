-- =====================================================
-- SUPABASE SCHEMA FOR MOONFOLIO (Investment Tracker)
-- This script is IDEMPOTENT - safe to run multiple times
-- =====================================================

-- Step 1: Drop everything if it exists (clean slate)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
DROP TRIGGER IF EXISTS update_tags_updated_at ON public.tags;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
DROP TRIGGER IF EXISTS update_portfolios_updated_at ON public.portfolios;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.portfolios CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Step 2: Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 3: Create tables
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_included_in_combined BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(portfolio_id, name)
);

CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto')),
    quantity DECIMAL(20, 8) NOT NULL CHECK (quantity >= 0),
    price DECIMAL(20, 8) NOT NULL CHECK (price >= 0),
    date TIMESTAMPTZ NOT NULL,
    notes TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    auto_refresh_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    refresh_interval_seconds INTEGER NOT NULL DEFAULT 30,
    metrics_mode TEXT NOT NULL DEFAULT 'simple' CHECK (metrics_mode IN ('simple', 'pro')),
    currency TEXT NOT NULL DEFAULT 'USD',
    risk_free_rate DECIMAL(5, 2) NOT NULL DEFAULT 4.5,
    active_portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 4: Create indexes
CREATE INDEX idx_portfolios_user_id ON public.portfolios(user_id);
CREATE INDEX idx_accounts_portfolio_id ON public.accounts(portfolio_id);
CREATE INDEX idx_transactions_portfolio_id ON public.transactions(portfolio_id);
CREATE INDEX idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX idx_transactions_symbol ON public.transactions(symbol);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_tags_user_id ON public.tags(user_id);

-- Step 5: Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own portfolios" ON public.portfolios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolios" ON public.portfolios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolios" ON public.portfolios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolios" ON public.portfolios FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (EXISTS (SELECT 1 FROM public.portfolios WHERE portfolios.id = accounts.portfolio_id AND portfolios.user_id = auth.uid()));
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.portfolios WHERE portfolios.id = accounts.portfolio_id AND portfolios.user_id = auth.uid()));
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (EXISTS (SELECT 1 FROM public.portfolios WHERE portfolios.id = accounts.portfolio_id AND portfolios.user_id = auth.uid()));
CREATE POLICY "Users can delete own accounts" ON public.accounts FOR DELETE USING (EXISTS (SELECT 1 FROM public.portfolios WHERE portfolios.id = accounts.portfolio_id AND portfolios.user_id = auth.uid()));

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (EXISTS (SELECT 1 FROM public.portfolios WHERE portfolios.id = transactions.portfolio_id AND portfolios.user_id = auth.uid()));
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.portfolios WHERE portfolios.id = transactions.portfolio_id AND portfolios.user_id = auth.uid()));
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE USING (EXISTS (SELECT 1 FROM public.portfolios WHERE portfolios.id = transactions.portfolio_id AND portfolios.user_id = auth.uid()));
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE USING (EXISTS (SELECT 1 FROM public.portfolios WHERE portfolios.id = transactions.portfolio_id AND portfolios.user_id = auth.uid()));

CREATE POLICY "Users can view own tags" ON public.tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON public.tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.tags FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Step 7: Create timestamp update function and triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON public.portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Create new user handler (auto-creates default data on signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_portfolio_id UUID;
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));

    INSERT INTO public.portfolios (user_id, name, is_included_in_combined)
    VALUES (NEW.id, 'My Portfolio', TRUE)
    RETURNING id INTO new_portfolio_id;

    INSERT INTO public.accounts (portfolio_id, name) VALUES
        (new_portfolio_id, 'TFSA'),
        (new_portfolio_id, 'RRSP'),
        (new_portfolio_id, 'Other');

    INSERT INTO public.user_settings (user_id, active_portfolio_id)
    VALUES (NEW.id, new_portfolio_id);

    INSERT INTO public.tags (user_id, name, color) VALUES
        (NEW.id, 'Stocks', '#3b82f6'),
        (NEW.id, 'Crypto', '#10b981');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Done! Schema created successfully.
