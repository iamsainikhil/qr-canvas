-- Create table to track upload rate limits by IP
CREATE TABLE public.upload_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_ip TEXT NOT NULL,
  upload_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on client_ip for efficient upsert
CREATE UNIQUE INDEX idx_upload_rate_limits_ip ON public.upload_rate_limits(client_ip);

-- Create index on window_start for cleanup queries
CREATE INDEX idx_upload_rate_limits_window ON public.upload_rate_limits(window_start);

-- Enable RLS
ALTER TABLE public.upload_rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access - only service role (Edge Function) can access this table
-- This is intentional - we don't want users to be able to reset their rate limits