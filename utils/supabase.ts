
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InventoryItem } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const fetchInventory = async () => {
  if (!supabase) throw new Error("Supabase client not initialized. Check .env variables.");
  
  // Fetch items in chunks to bypass the 1000 row limit
  let allItems: InventoryItem[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .range(from, to)
        .order('description', { ascending: true });

      if (error) throw error;

      if (data) {
          allItems = [...allItems, ...(data as InventoryItem[])];
          if (data.length < pageSize) {
              hasMore = false;
          } else {
              page++;
          }
      } else {
          hasMore = false;
      }
  }
  
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('name');
    
  if (catError) throw catError;
    
  const { data: zones, error: zoneError } = await supabase
    .from('zones')
    .select('name');
    
  if (zoneError) throw zoneError;

  return {
    items: allItems,
    categories: categories.map((c: any) => c.name),
    zones: zones.map((z: any) => z.name)
  };
};

export const saveItem = async (item: InventoryItem) => {
    if (!supabase) return;
    const { error } = await supabase.from('inventory_items').upsert(item);
    if (error) throw error;
}

export const deleteItem = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (error) throw error;
}

export const replaceInventory = async (items: InventoryItem[], categories: string[], zones: string[]) => {
  if (!supabase) throw new Error("Supabase client not initialized");

  // 1. Delete all existing items (Clear the board)
  const { error: deleteError } = await supabase.from('inventory_items').delete().neq('id', '0'); // Hack to delete all
  if (deleteError) throw deleteError;

  // 2. Upsert categories & zones (We keep them additive usually, but we could clear them too if requested)
  if (categories.length > 0) {
      const catData = categories.map(name => ({ name }));
      const { error: catError } = await supabase.from('categories').upsert(catData, { onConflict: 'name' });
      if (catError) throw catError;
  }
  
  if (zones.length > 0) {
      const zoneData = zones.map(name => ({ name }));
      const { error: zoneError } = await supabase.from('zones').upsert(zoneData, { onConflict: 'name' });
      if (zoneError) throw zoneError;
  }
  
  // 3. Insert new items in batches to avoid payload limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const { error: itemError } = await supabase.from('inventory_items').insert(batch);
      if (itemError) throw itemError;
  }
};

export const subscribeToInventory = (
    onItemChange: (payload: any) => void,
) => {
    if (!supabase) return null;

    const subscription = supabase
        .channel('inventory_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, (payload) => {
            onItemChange(payload);
        })
        .subscribe();

    return subscription;
};
