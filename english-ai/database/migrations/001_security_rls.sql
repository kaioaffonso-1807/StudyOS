-- StudyOS database security baseline.
-- The API currently uses a trusted direct Postgres connection. These policies
-- intentionally keep Supabase Data API roles closed until explicit API policies
-- are designed for a client-facing table.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.users, public.learning_profiles, public.learner_memory,
  public.attempts, public.mistakes, public.conversations,
  public.conversation_messages, public.learning_events
FROM anon, authenticated;

-- Do not expose internal learner data through the Supabase Data API by accident.
-- Add narrowly scoped authenticated policies and grants in a later migration
-- when/if direct client database access is introduced.
