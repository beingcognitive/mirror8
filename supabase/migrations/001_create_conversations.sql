-- Create conversations table for persisting voice transcripts and insights
create table conversations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  future_id text not null,
  transcript jsonb default '[]',
  insights jsonb default '[]',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz default now()
);

alter table conversations enable row level security;

create policy "Users can read own conversations"
  on conversations for select using (
    session_id in (select id from sessions where user_id = auth.uid())
  );
