-- Run this in your Supabase SQL Editor to apply the race condition fixes

-- 1. Add timestamp column to existing table
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default now();

-- 2. Update existing rows to have a timestamp
UPDATE inventory_items SET updated_at = now() WHERE updated_at IS NULL;

-- 3. Create the auto-update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER update_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_items' 
AND column_name = 'updated_at';
