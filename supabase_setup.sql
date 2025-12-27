-- Run this in your Supabase SQL Editor

-- 1. Tables
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  name text unique not null
);

create table if not exists zones (
  id uuid default gen_random_uuid() primary key,
  name text unique not null
);

create table if not exists inventory_items (
  id text primary key,
  qty int,
  code text,
  description text,
  category text, -- We stored name here. If you want relation, change to category_id uuid references categories(id)
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

-- 5. RPC Function for Atomic Bulk Replacement
create or replace function bulk_replace_inventory(
    p_categories jsonb,
    p_zones jsonb,
    p_items jsonb
) returns void language plpgsql as $$
begin
    -- 1. Truncate tables to remove old data
    -- Using truncate is faster than delete for full clear
    truncate table inventory_items;
    truncate table categories cascade; 
    truncate table zones cascade;

    -- 2. Insert Categories
    insert into categories (name)
    select value->>'name' from jsonb_array_elements(p_categories)
    on conflict (name) do nothing;

    -- 3. Insert Zones
    insert into zones (name)
    select value->>'name' from jsonb_array_elements(p_zones)
    on conflict (name) do nothing;

    -- 4. Insert Items
    insert into inventory_items (id, qty, code, description, category, zone, zone2)
    select 
        value->>'id',
        (value->>'qty')::int,
        value->>'code',
        value->>'description',
        value->>'category',
        value->>'zone',
        value->>'zone2'
    from jsonb_array_elements(p_items);
end;
$$;
