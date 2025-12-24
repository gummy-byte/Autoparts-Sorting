-- Run this in your Supabase SQL Editor

-- 1. Tables
create table if not exists categories (
  name text primary key
);

create table if not exists zones (
  name text primary key
);

create table if not exists inventory_items (
  id text primary key,
  qty int,
  code text,
  description text,
  category text,
  zone text,
  zone2 text
);

-- 2. RLS Policies
alter table inventory_items enable row level security;
alter table categories enable row level security;
alter table zones enable row level security;

-- Public access (Warning: insecure, good for prototyping only)
create policy "Public Access Items" on inventory_items for all using (true);
create policy "Public Access Categories" on categories for all using (true);
create policy "Public Access Zones" on zones for all using (true);

-- 3. Enable Realtime
-- This is crucial for the "realtime" requirement
alter publication supabase_realtime add table inventory_items;
-- Optional: if you want realtime updates for categories too
alter publication supabase_realtime add table categories;
alter publication supabase_realtime add table zones;

-- 4. RPC Function for unlimited fetching
-- By default, Supabase limits API rows to 1000. This function bypasses it.
create or replace function get_all_inventory()
returns setof inventory_items
language sql
as $$
  select * from inventory_items order by description asc;
$$;
