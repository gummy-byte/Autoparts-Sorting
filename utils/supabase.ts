
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

export const saveCategory = async (name: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('categories').upsert({ name }, { onConflict: 'name' });
    if (error) throw error;
}

export const saveZone = async (name: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('zones').upsert({ name }, { onConflict: 'name' });
    if (error) throw error;
}

export const replaceInventory = async (items: InventoryItem[], categories: string[], zones: string[]) => {
  if (!supabase) throw new Error("Supabase client not initialized");

  // Format data for JSONB
  const catData = categories.map(name => ({ name }));
  const zoneData = zones.map(name => ({ name }));
  
  // NOTE: If items array is too large (> 3MB usually), we might hit payload limits.
  // For robustness with large files, we might need chunking, BUT chunking removes atomicity 
  // unless we manage a transaction manually (which is hard over HTTP).
  // For now, we assume reasonable file sizes (< 5000 rows).
  
  const { error } = await supabase.rpc('bulk_replace_inventory', {
      p_categories: catData,
      p_zones: zoneData,
      p_items: items
  });

  if (error) {
      console.error("RPC Bulk Replace Failed:", error);
      throw error;
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
