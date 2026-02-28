-- Create profiles table first
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  strategy_rules TEXT,
  risk_tolerance TEXT,
  last_updated_strategy TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  show_short_term_performance BOOLEAN DEFAULT true
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when auth.user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create holdings table
CREATE TABLE holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'fund')),
  average_buy_price NUMERIC,
  quantity NUMERIC,
  user_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and create policies for holdings
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own holdings" 
ON holdings FOR ALL 
USING (auth.uid() = user_id);

-- Create temptation_log table
CREATE TABLE temptation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  price_at_logging NUMERIC,
  date_logged TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  reason_to_skip TEXT
);

-- Enable RLS and create policies for temptation_log
ALTER TABLE temptation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own temptation logs" 
ON temptation_log FOR ALL 
USING (auth.uid() = user_id);

-- Create insights_feed table
CREATE TABLE insights_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  broker_name TEXT,
  ticker TEXT,
  ai_summary TEXT,
  sentiment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and create policies for insights_feed
ALTER TABLE insights_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own insights feed" 
ON insights_feed FOR ALL 
USING (auth.uid() = user_id);
