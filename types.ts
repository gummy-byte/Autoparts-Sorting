
export interface InventoryItem {
  id: string;
  qty: number;
  code: string;
  description: string;
  category: string;
  zone: string;
}

export enum ItemCategory {
  CABIN_FILTER = "Cabin Filter",
  OIL_FILTER = "Oil Filter",
  AIR_FILTER = "Air Filter",
  BRAKES = "Brakes",
  IGNITION = "Ignition (Plugs/Coils)",
  FLUIDS = "Fluids & Oils",
  SUSPENSION = "Suspension (Absorbers/Links)",
  BELTS = "Belts",
  GASKETS_SEALS = "Gaskets & Seals",
  COOLING = "Cooling System",
  BATTERY = "Battery",
  WIPERS = "Wipers",
  ELECTRICAL = "Electrical/Relays",
  OTHER = "Other/Hardware"
}

export interface CategoryStat {
  name: string;
  count: number;
  totalQty: number;
  // Add index signature for compatibility with charting libraries like Recharts
  [key: string]: string | number;
}
