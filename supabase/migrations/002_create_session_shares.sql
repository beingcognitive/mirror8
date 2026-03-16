create table session_shares (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null unique,
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_session_shares_token on session_shares(share_token) where is_active = true;

-- RLS: defense in depth even though backend uses service-role key
alter table session_shares enable row level security;

create policy "Users can read own session shares"
  on session_shares for select using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

create policy "Users can insert own session shares"
  on session_shares for insert with check (
    session_id in (select id from sessions where user_id = auth.uid())
  );

create policy "Users can update own session shares"
  on session_shares for update using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

create policy "Users can delete own session shares"
  on session_shares for delete using (
    session_id in (select id from sessions where user_id = auth.uid())
  );
