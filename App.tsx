
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Filter, 
  Search, 
  FileUp, 
  ChevronDown, 
  AlertCircle,
  BarChart3,
  ListFilter,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Github,
  Settings,
  Save,
  Loader2,
  Check,
  Sparkles,
  Zap,
  Share,
  FileText,
  Layers,
  X,
  FileSpreadsheet,
  Menu,
  CheckSquare,
  Square,
  Plus,
  Tag,
  Database,
  Trash2,
  MapPin,
  Settings2,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { InventoryItem, ItemCategory, CategoryStat } from './types';
import { classifyItem } from './utils/classifier';

// Pinkish theme colors for charts
const COLORS = [
  '#ec4899', '#d946ef', '#f43f5e', '#fb7185', '#be185d', 
  '#9d174d', '#db2777', '#f472b6', '#fda4af', '#fce7f3'
];

const ITEMS_PER_PAGE = 100;

interface GitHubConfig {
  token: string;
  repo: string;
  path: string;
  branch: string;
}

interface ColumnVisibility {
  category: boolean;
  zone: boolean;
  zone2: boolean;
  qty: boolean;
  description: boolean;
}

// IndexedDB Helpers
const DB_NAME = 'AutoPartDB';
const STORE_NAME = 'InventoryStore';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3); // Bumped version for zone2
    request.onupgradeneeded = (event: any) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveToDB = async (items: InventoryItem[], categories: string[], zones: string[]) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(items, 'items');
  store.put(categories, 'categories');
  store.put(zones, 'zones');
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
  });
};

const loadFromDB = async (): Promise<{items: InventoryItem[], categories: string[], zones: string[]} | null> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const itemsReq = store.get('items');
  const catsReq = store.get('categories');
  const zonesReq = store.get('zones');
  
  return new Promise((resolve) => {
    tx.oncomplete = () => {
      if (itemsReq.result) {
        resolve({ 
          items: itemsReq.result, 
          categories: catsReq.result || Object.values(ItemCategory),
          zones: zonesReq.result || ["Unassigned", "Zone A", "Zone B", "Zone C"]
        });
      } else {
        resolve(null);
      }
    };
  });
};

const clearDB = async () => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.clear();
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
};

const App: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory'>('overview');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedZone, setSelectedZone] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [availableCategories, setAvailableCategories] = useState<string[]>(Object.values(ItemCategory));
  const [availableZones, setAvailableZones] = useState<string[]>(["Unassigned", "Zone A", "Zone B", "Zone C"]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'category' | 'zone' | 'zone2'>('category');
  const [newName, setNewName] = useState("");
  const [modalTarget, setModalTarget] = useState<{ type: 'single' | 'bulk', id?: string } | null>(null);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isCleanupPromptOpen, setIsCleanupPromptOpen] = useState(false);
  
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    const saved = localStorage.getItem('visible_columns');
    return saved ? JSON.parse(saved) : { category: true, zone: true, zone2: true, qty: true, description: true };
  });

  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [ghConfig, setGhConfig] = useState<GitHubConfig>(() => {
    const saved = localStorage.getItem('gh_config');
    return saved ? JSON.parse(saved) : { token: '', repo: '', path: 'inventory_categorized.csv', branch: 'main' };
  });

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'standard' | 'categorized'>('standard');

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const data = await loadFromDB();
      if (data) {
        setItems(data.items);
        setAvailableCategories(data.categories);
        setAvailableZones(data.zones);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      saveToDB(items, availableCategories, availableZones);
    }
  }, [items, availableCategories, availableZones]);

  useEffect(() => {
    localStorage.setItem('gh_config', JSON.stringify(ghConfig));
  }, [ghConfig]);

  useEffect(() => {
    localStorage.setItem('visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedItems(new Set()); 
  }, [searchTerm, selectedCategory, selectedZone]);

  // Click outside listener for column dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const processCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    let qtyIdx = -1, codeIdx = -1, descIdx = -1, catIdx = -1, zoneIdx = -1, zone2Idx = -1, headerLineIdx = -1;
    
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const parts = parseCSVLine(lines[i]).map(p => p.toLowerCase());
      const fQty = parts.findIndex(p => p.includes('qty') || p.includes('quantity') || p === 'q');
      const fCode = parts.findIndex(p => p.includes('code') || p.includes('part') || p.includes('sku'));
      const fDesc = parts.findIndex(p => p.includes('desc') || p.includes('item') || p.includes('name'));
      const fCat = parts.findIndex(p => p.includes('category') || p.includes('type') || p.includes('group') || p === 'cat');
      
      const fZone = parts.findIndex(p => (p.includes('zone') || p.includes('location')) && !p.includes('2'));
      const fZone2 = parts.findIndex(p => (p.includes('zone') || p.includes('location')) && p.includes('2'));

      if ((fQty !== -1 && fCode !== -1) || (fQty !== -1 && fDesc !== -1) || (fCode !== -1 && fDesc !== -1)) {
        qtyIdx = fQty; codeIdx = fCode; descIdx = fDesc; catIdx = fCat; zoneIdx = fZone; zone2Idx = fZone2; headerLineIdx = i; break;
      }
    }

    if (headerLineIdx === -1) { 
      qtyIdx = 0; codeIdx = 1; descIdx = 2; headerLineIdx = -1; 
    }

    const parsedItems: InventoryItem[] = [];
    const newCategories = new Set<string>();
    const newZones = new Set<string>();

    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const parts = parseCSVLine(lines[i]);
      if (parts.length < 2) continue;
      const qty = parseInt((qtyIdx !== -1 ? parts[qtyIdx] : "0").replace(/[^0-9-]/g, '')) || 0;
      const code = codeIdx !== -1 ? parts[codeIdx] : "N/A";
      const description = descIdx !== -1 ? parts[descIdx] : "No Description";
      
      let category = "";
      if (catIdx !== -1 && parts[catIdx]) {
        category = parts[catIdx].trim();
      }

      let zone = "Unassigned";
      if (zoneIdx !== -1 && parts[zoneIdx]) {
        zone = parts[zoneIdx].trim();
      }

      let zone2 = "Unassigned";
      if (zone2Idx !== -1 && parts[zone2Idx]) {
        zone2 = parts[zone2Idx].trim();
      }

      if (!category || category.toLowerCase() === 'null') {
        category = classifyItem(description);
      } else {
        if (category.trim()) newCategories.add(category.trim());
      }

      if (zone.trim() && zone.toLowerCase() !== 'null' && zone !== 'Unassigned') {
        newZones.add(zone.trim());
      }
      if (zone2.trim() && zone2.toLowerCase() !== 'null' && zone2 !== 'Unassigned') {
        newZones.add(zone2.trim());
      }
      
      parsedItems.push({
        id: `${code}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        qty,
        code: code || "UNKNOWN",
        description: description || "Untitled Part",
        category,
        zone: zone || "Unassigned",
        zone2: zone2 || "Unassigned"
      });
    }

    if (newCategories.size > 0) {
      setAvailableCategories(prev => {
        const combined = new Set([...prev, ...Array.from(newCategories)]);
        return Array.from(combined).sort();
      });
    }

    if (newZones.size > 0) {
      setAvailableZones(prev => {
        const combined = new Set([...prev, ...Array.from(newZones)]);
        return Array.from(combined).sort();
      });
    }

    setItems(parsedItems);
  };

  const handleClearData = async () => {
    await clearDB();
    setItems([]);
    setAvailableCategories(Object.values(ItemCategory));
    setAvailableZones(["Unassigned", "Zone A", "Zone B", "Zone C"]);
    setIsCleanupPromptOpen(false);
  };

  const openAddModal = (type: 'category' | 'zone' | 'zone2', mode: 'single' | 'bulk', id?: string) => {
    setModalType(type);
    setModalTarget({ type: mode, id });
    setNewName("");
    setIsAddModalOpen(true);
  };

  const handleConfirmAdd = () => {
    if (!newName.trim()) return;
    const name = newName.trim();
    
    if (modalType === 'category') {
      setAvailableCategories(prev => prev.includes(name) ? prev : [...prev, name].sort());
      if (modalTarget?.type === 'bulk') {
        setItems(prev => prev.map(item => selectedItems.has(item.id) ? { ...item, category: name } : item));
      } else if (modalTarget?.id) {
        setItems(prev => prev.map(item => item.id === modalTarget.id ? { ...item, category: name } : item));
      }
    } else {
      // Handles both zone and zone2 field updates
      const fieldToUpdate = modalType === 'zone2' ? 'zone2' : 'zone';
      setAvailableZones(prev => prev.includes(name) ? prev : [...prev, name].sort());
      if (modalTarget?.type === 'bulk') {
        setItems(prev => prev.map(item => selectedItems.has(item.id) ? { ...item, [fieldToUpdate]: name } : item));
      } else if (modalTarget?.id) {
        setItems(prev => prev.map(item => item.id === modalTarget.id ? { ...item, [fieldToUpdate]: name } : item));
      }
    }

    if (modalTarget?.type === 'bulk') setSelectedItems(new Set());
    setIsAddModalOpen(false);
  };

  const handleFieldChange = (id: string, field: 'category' | 'zone' | 'zone2', value: string) => {
    if (value === '__NEW__') {
      openAddModal(field, 'single', id);
    } else {
      setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    }
  };

  const handleBulkFieldChange = (field: 'category' | 'zone' | 'zone2', value: string) => {
    if (value === '__NEW__') {
      openAddModal(field, 'bulk');
    } else {
      setItems(prev => prev.map(item => selectedItems.has(item.id) ? { ...item, [field]: value } : item));
      setSelectedItems(new Set());
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const toggleColumn = (col: keyof ColumnVisibility) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const generateStandardCSV = () => {
    const headers = ["Quantity", "Code", "Description", "Category", "Zone 1", "Zone 2"];
    const rows = items.map(item => [item.qty, `"${item.code}"`, `"${item.description}"`, `"${item.category}"`, `"${item.zone}"`, `"${item.zone2}"`]);
    return [headers, ...rows].map(e => e.join(",")).join("\n");
  };

  const generateCategorizedXLS = () => {
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, InventoryItem[]>);
    const sortedCategories = Object.keys(grouped).sort();
    let globalIndex = 1;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          .header { background-color: #f1f5f9; font-weight: bold; }
          .category-header { background-color: #FFFF00; font-weight: bold; font-size: 14px; } 
          .qty-col { text-align: right; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr class="header">
              <th style="width: 50px">No</th>
              <th style="width: 150px">Code</th>
              <th style="width: 400px">Description</th>
              <th style="width: 120px">Zone 1</th>
              <th style="width: 120px">Zone 2</th>
              <th style="width: 80px">Qty</th>
            </tr>
          </thead>
          <tbody>
    `;

    sortedCategories.forEach(cat => {
      html += `<tr><td colspan="6" class="category-header">${cat.toUpperCase()}</td></tr>`;
      grouped[cat].forEach(item => {
        html += `<tr><td>${globalIndex}</td><td>${item.code}</td><td>${item.description}</td><td>${item.zone}</td><td>${item.zone2}</td><td class="qty-col">${item.qty}</td></tr>`;
        globalIndex++;
      });
    });

    html += `</tbody></table></body></html>`;
    return html;
  };

  const handleDownload = () => {
    let content, mimeType, extension;
    if (exportFormat === 'standard') {
      content = generateStandardCSV();
      mimeType = 'text/csv;charset=utf-8;';
      extension = 'csv';
    } else {
      content = generateCategorizedXLS();
      mimeType = 'application/vnd.ms-excel;charset=utf-8';
      extension = 'xls';
    }

    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_${exportFormat}_${new Date().toISOString().split('T')[0]}.${extension}`;
    link.click();
    setIsExportModalOpen(false);
    setTimeout(() => setIsCleanupPromptOpen(true), 1000);
  };

  const syncToGitHub = async () => {
    if (!ghConfig.token || !ghConfig.repo || !ghConfig.path) { setIsSyncModalOpen(true); return; }
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      const contentBase64 = btoa(unescape(encodeURIComponent(generateStandardCSV())));
      const getFile = await fetch(`https://api.github.com/repos/${ghConfig.repo}/contents/${ghConfig.path}?ref=${ghConfig.branch}`, {
        headers: { 'Authorization': `token ${ghConfig.token}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      let sha: string | undefined;
      if (getFile.status === 200) { sha = (await getFile.json()).sha; }
      const put = await fetch(`https://api.github.com/repos/${ghConfig.repo}/contents/${ghConfig.path}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${ghConfig.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Inventory update: ${new Date().toLocaleString()}`, content: contentBase64, branch: ghConfig.branch, sha })
      });
      if (put.ok) { 
        setSyncStatus('success'); 
        setTimeout(() => setSyncStatus('idle'), 3000);
        setTimeout(() => setIsCleanupPromptOpen(true), 1000);
      }
      else throw new Error();
    } catch { setSyncStatus('error'); }
    finally { setIsSyncing(false); }
  };

  const handleTabChange = (tab: 'overview' | 'inventory') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const stats: CategoryStat[] = useMemo(() => {
    const map = new Map<string, { count: number; totalQty: number }>();
    items.forEach(item => {
      const current = map.get(item.category) || { count: 0, totalQty: 0 };
      map.set(item.category, { count: current.count + 1, totalQty: current.totalQty + item.qty });
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count);
  }, [items]);

  const filteredItems = useMemo(() => {
    const searchTokens = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    return items.filter(item => {
      const itemText = (item.description + " " + item.code).toLowerCase();
      
      // Match all search tokens (AND search)
      const matchS = searchTokens.every(token => itemText.includes(token));
      
      const matchC = selectedCategory === "All" || item.category === selectedCategory;
      const matchZ = selectedZone === "All" || item.zone === selectedZone || item.zone2 === selectedZone;
      
      return matchS && matchC && matchZ;
    });
  }, [items, searchTerm, selectedCategory, selectedZone]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const isAllSelected = paginatedItems.length > 0 && paginatedItems.every(i => selectedItems.has(i.id));

  const toggleAll = () => {
    const newSet = new Set(selectedItems);
    if (isAllSelected) {
      paginatedItems.forEach(i => newSet.delete(i.id));
    } else {
      paginatedItems.forEach(i => newSet.add(i.id));
    }
    setSelectedItems(newSet);
  };

  return (
    <div className="h-screen w-full flex bg-[#fff1f5] font-['Inter'] overflow-hidden">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-pink-900/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}/>
      )}

      {/* Cleanup Prompt Modal */}
      {isCleanupPromptOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl border border-pink-100 text-center">
             <div className="bg-pink-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-pink-600">
                <Trash2 className="w-8 h-8" />
             </div>
             <h3 className="text-xl font-black text-slate-800 mb-3 tracking-tight">Export Successful!</h3>
             <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
               Your work is now safely saved. Would you like to clear the temporary browser storage for a fresh start?
             </p>
             <div className="flex flex-col gap-3">
               <button onClick={handleClearData} className="w-full py-4 bg-pink-600 text-white font-black rounded-2xl shadow-xl shadow-pink-600/20 hover:bg-pink-700 transition-all">Yes, Clear Storage</button>
               <button onClick={() => setIsCleanupPromptOpen(false)} className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-all">Not yet, keep data</button>
             </div>
           </div>
        </div>
      )}

      {/* Add New Category/Zone Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-pink-100">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                 {modalType === 'category' ? <Tag className="w-5 h-5 text-pink-500" /> : <MapPin className="w-5 h-5 text-pink-500" />}
                 New {modalType === 'category' ? 'Category' : 'Zone'}
               </h3>
               <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50"><X className="w-5 h-5" /></button>
             </div>
             <div className="mb-6">
               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Name</label>
               <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleConfirmAdd()} placeholder={`e.g., ${modalType === 'category' ? 'Transmission' : 'Zone D'}`} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-none font-bold text-slate-800" />
             </div>
             <div className="flex gap-3">
               <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-sm">Cancel</button>
               <button onClick={handleConfirmAdd} className="flex-[2] py-3 bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-600/20 hover:bg-pink-700 text-sm">Create & Apply</button>
             </div>
           </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-4 sm:gap-6 border border-white/10 pr-6 overflow-x-auto max-w-[95vw]">
            <div className="bg-pink-600 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider whitespace-nowrap">
              {selectedItems.size} Selected
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest hidden sm:inline">Move to:</span>
              <div className="flex gap-2">
                <div className="relative">
                  <select className="appearance-none bg-slate-800 border border-slate-700 hover:border-pink-500 rounded-xl px-4 py-2 pr-8 text-[10px] sm:text-xs font-bold focus:ring-2 focus:ring-pink-500/50 outline-none transition-all cursor-pointer min-w-[80px]" onChange={(e) => handleBulkFieldChange('category', e.target.value)} value="">
                      <option value="" disabled>Cat...</option>
                      {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select className="appearance-none bg-slate-800 border border-slate-700 hover:border-pink-500 rounded-xl px-4 py-2 pr-8 text-[10px] sm:text-xs font-bold focus:ring-2 focus:ring-pink-500/50 outline-none transition-all cursor-pointer min-w-[80px]" onChange={(e) => handleBulkFieldChange('zone', e.target.value)} value="">
                      <option value="" disabled>Zone 1...</option>
                      {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                      <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select className="appearance-none bg-slate-800 border border-slate-700 hover:border-pink-500 rounded-xl px-4 py-2 pr-8 text-[10px] sm:text-xs font-bold focus:ring-2 focus:ring-pink-500/50 outline-none transition-all cursor-pointer min-w-[80px]" onChange={(e) => handleBulkFieldChange('zone2', e.target.value)} value="">
                      <option value="" disabled>Zone 2...</option>
                      {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                      <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedItems(new Set())} className="ml-2 p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-80 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute inset-0 bg-[#fff1f5] lg:hidden -z-10" />
        <div className="flex-1 bg-slate-900 text-white flex flex-col overflow-hidden relative border-r border-white/5">
          <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-6 right-6 lg:hidden p-2 text-slate-400 hover:text-white transition-colors bg-white/10 rounded-full">
            <X className="w-5 h-5" />
          </button>

          <div className="p-8">
            <div className="flex items-center gap-3 mb-10">
              <div className="bg-gradient-to-br from-pink-400 to-rose-600 p-2.5 rounded-2xl shadow-lg shadow-pink-500/20">
                <Package className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-pink-200">AutoPart</h1>
            </div>
            <nav className="space-y-2">
              <button onClick={() => handleTabChange('overview')} className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'overview' ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xl shadow-pink-600/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                <LayoutDashboard className="w-5 h-5" /> <span className="font-semibold text-sm">Dashboard</span>
              </button>
              <button onClick={() => handleTabChange('inventory')} className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'inventory' ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xl shadow-pink-600/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                <ListFilter className="w-5 h-5" /> <span className="font-semibold text-sm">Inventory</span>
              </button>
            </nav>
          </div>

          <div className="mt-auto p-8 space-y-4 bg-white/5 backdrop-blur-md">
            <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] text-pink-400 uppercase tracking-[0.2em] font-black flex items-center gap-1.5"><Database className="w-3 h-3" /> Cloud Save</p>
                <button onClick={() => { setIsMobileMenuOpen(false); setIsSyncModalOpen(true); }} className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-slate-400"><Settings className="w-3.5 h-3.5" /></button>
              </div>
              <button onClick={syncToGitHub} disabled={items.length === 0 || isSyncing} className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl text-[11px] font-bold transition-all ${syncStatus === 'success' ? 'bg-emerald-500' : syncStatus === 'error' ? 'bg-rose-500' : 'bg-white/10 hover:bg-white/20'} text-white disabled:opacity-50`}>
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : syncStatus === 'success' ? <Check className="w-3.5 h-3.5" /> : <Github className="w-3.5 h-3.5" />}
                {isSyncing ? 'Pushing...' : syncStatus === 'success' ? 'Synced!' : 'Cloud Sync'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 lg:ml-80 h-full transition-all duration-300 flex flex-col">
        <header className="bg-white/70 backdrop-blur-xl border border-white rounded-[1.5rem] sm:rounded-[2rem] px-4 sm:px-6 py-3 sm:py-5 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-5 shadow-sm mb-4 sm:mb-6 flex-shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-pink-50 hover:text-pink-600 rounded-xl transition-colors"><Menu className="w-6 h-6" /></button>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{activeTab === 'overview' ? 'Real-time Stats' : 'Manage Stock'}</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            {items.length > 0 && (
              <button onClick={() => setIsCleanupPromptOpen(true)} className="p-2 sm:p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl sm:rounded-2xl transition-all"><Trash2 className="w-4 sm:w-5 h-4 sm:h-5" /></button>
            )}
            <button onClick={() => setIsExportModalOpen(true)} disabled={items.length === 0} className="px-3 sm:px-4 py-2 sm:py-3 bg-white border border-slate-200 hover:border-pink-300 hover:bg-pink-50 text-slate-700 hover:text-pink-600 rounded-xl sm:rounded-2xl transition-all font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm disabled:opacity-50 whitespace-nowrap"><Download className="w-3.5 sm:w-4 h-3.5 sm:h-4" /><span className="hidden sm:inline">Export</span></button>
            <label className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-slate-900 hover:bg-pink-600 text-white rounded-xl sm:rounded-2xl cursor-pointer transition-all shadow-xl shadow-slate-900/10 font-bold text-xs sm:text-sm whitespace-nowrap">
              <FileUp className="w-3.5 sm:w-4 h-3.5 sm:h-4" /><span className="hidden sm:inline">Import</span> <input type="file" className="hidden" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (e) => processCSV(e.target?.result as string); r.readAsText(f); } }} />
            </label>
          </div>
        </header>

        <div className={`flex-1 min-h-0 ${activeTab === 'inventory' ? 'flex flex-col' : 'overflow-y-auto pr-1 sm:pr-2 custom-scrollbar'}`}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-full text-center max-w-xl mx-auto px-6 py-12">
              <div className="relative mb-6 sm:mb-8">
                <div className="absolute inset-0 bg-pink-500 blur-3xl opacity-20 animate-pulse"></div>
                <div className="relative bg-white p-8 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-pink-50"><Sparkles className="w-10 sm:w-12 h-10 sm:h-12 text-pink-500" /></div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mb-3 sm:mb-4 tracking-tight">Warehouse Logistics</h3>
              <p className="text-slate-500 mb-8 sm:mb-10 leading-relaxed text-base sm:text-lg font-medium">AutoPart now supports dual Zones! Categorize your inventory and track multiple warehouse locations with ease.</p>
              <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                <label className="px-6 sm:px-8 py-3.5 sm:py-4 bg-pink-600 text-white font-black rounded-2xl sm:rounded-[1.5rem] hover:bg-pink-700 transition-all shadow-xl shadow-pink-600/20 cursor-pointer text-center">Upload CSV File <input type="file" className="hidden" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (e) => processCSV(e.target?.result as string); r.readAsText(f); } }} /></label>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' ? (
                <div className="pb-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                    <StatCard title="Unique SKUs" value={items.length} icon={<Package />} color="pink" />
                    <StatCard title="Total Inventory" value={items.reduce((a,b)=>a+b.qty, 0)} icon={<BarChart3 />} color="rose" />
                    <StatCard title="Stock Alerts" value={items.filter(i=>i.qty<=0).length} icon={<AlertCircle />} color="fuchsia" subtitle="Low Qty" />
                    <StatCard title="Segments" value={stats.length} icon={<Filter />} color="rose" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                    <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white shadow-xl">
                      <h3 className="text-base sm:text-lg font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-3"><BarChart3 className="w-5 h-5 text-pink-500" />Top Categories</h3>
                      <div className="h-64 sm:h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.slice(0, 8)} layout="vertical" margin={{ left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#fdf2f8" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: '#fff5f8' }} />
                            <Bar dataKey="count" radius={[0, 14, 14, 0]} barSize={16}>
                              {stats.map((e, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white shadow-xl">
                      <h3 className="text-base sm:text-lg font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-3"><LayoutDashboard className="w-5 h-5 text-rose-500" />Distribution Mix</h3>
                      <div className="h-64 sm:h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={stats.slice(0, 6)} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="count">
                              {stats.map((e, i) => <Cell key={`p-${i}`} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={4} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-white shadow-xl overflow-hidden flex flex-col h-full">
                  <div className="p-4 sm:p-6 lg:p-8 border-b border-pink-50 flex flex-col lg:flex-row gap-3 sm:gap-5 justify-between bg-pink-50/10 flex-shrink-0 relative z-30">
                    <div className="relative flex-[2] group">
                      <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 group-focus-within:text-pink-500" />
                      <input type="text" placeholder="Search sku, name..." className="w-full pl-10 sm:pl-14 pr-4 sm:pr-8 py-3 sm:py-5 bg-white border-2 border-slate-100 rounded-xl sm:rounded-[1.5rem] focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 outline-none text-xs sm:text-sm font-bold shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex flex-row gap-2 sm:gap-3 flex-1">
                      <div className="relative flex-1 min-w-0">
                        <Filter className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 pointer-events-none" />
                        <select className="w-full pl-8 sm:pl-14 pr-6 sm:pr-12 py-3 sm:py-5 bg-white border-2 border-slate-100 rounded-xl sm:rounded-[1.5rem] outline-none appearance-none text-[10px] sm:text-xs font-black text-slate-700 shadow-sm truncate" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                          <option value="All">All Categories</option>
                          {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 pointer-events-none" />
                      </div>
                      <div className="relative flex-1 min-w-0">
                        <MapPin className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 pointer-events-none" />
                        <select className="w-full pl-8 sm:pl-14 pr-6 sm:pr-12 py-3 sm:py-5 bg-white border-2 border-slate-100 rounded-xl sm:rounded-[1.5rem] outline-none appearance-none text-[10px] sm:text-xs font-black text-slate-700 shadow-sm truncate" value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
                          <option value="All">All Zones</option>
                          {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 pointer-events-none" />
                      </div>
                      <div className="relative" ref={dropdownRef}>
                        <button onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)} className="p-3 sm:p-5 bg-white border-2 border-slate-100 rounded-xl sm:rounded-[1.5rem] hover:bg-slate-50 transition-all text-slate-400 hover:text-pink-600 shadow-sm">
                          <Settings2 className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>
                        {isColumnDropdownOpen && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-pink-50 p-3 flex flex-col gap-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                             <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Visible Columns</p>
                             <button onClick={() => toggleColumn('description')} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-pink-50 transition-all group">
                                <span className={`text-xs font-bold ${visibleColumns.description ? 'text-slate-800' : 'text-slate-400'}`}>Description</span>
                                {visibleColumns.description ? <Eye className="w-3.5 h-3.5 text-pink-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                             </button>
                             <button onClick={() => toggleColumn('category')} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-pink-50 transition-all group">
                                <span className={`text-xs font-bold ${visibleColumns.category ? 'text-slate-800' : 'text-slate-400'}`}>Category</span>
                                {visibleColumns.category ? <Eye className="w-3.5 h-3.5 text-pink-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                             </button>
                             <button onClick={() => toggleColumn('zone')} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-pink-50 transition-all group">
                                <span className={`text-xs font-bold ${visibleColumns.zone ? 'text-slate-800' : 'text-slate-400'}`}>Zone 1</span>
                                {visibleColumns.zone ? <Eye className="w-3.5 h-3.5 text-pink-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                             </button>
                             <button onClick={() => toggleColumn('zone2')} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-pink-50 transition-all group">
                                <span className={`text-xs font-bold ${visibleColumns.zone2 ? 'text-slate-800' : 'text-slate-400'}`}>Zone 2</span>
                                {visibleColumns.zone2 ? <Eye className="w-3.5 h-3.5 text-pink-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                             </button>
                             <button onClick={() => toggleColumn('qty')} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-pink-50 transition-all group">
                                <span className={`text-xs font-bold ${visibleColumns.qty ? 'text-slate-800' : 'text-slate-400'}`}>Quantity</span>
                                {visibleColumns.qty ? <Eye className="w-3.5 h-3.5 text-pink-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                             </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto min-h-0 custom-scrollbar">
                    <table className="w-full text-left table-fixed min-w-[700px] sm:min-w-[1200px]">
                      <thead className="sticky top-0 bg-white z-20 shadow-sm">
                        <tr className="text-slate-400 text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] font-black border-b border-pink-50">
                          <th className="pl-4 sm:pl-10 pr-2 py-2 sm:py-4 w-12 sm:w-16">
                            <button onClick={toggleAll} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md sm:rounded-lg border-2 flex items-center justify-center transition-all ${isAllSelected ? 'bg-pink-600 border-pink-600' : 'border-slate-300 hover:border-pink-400'}`}>
                              {isAllSelected && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />}
                            </button>
                          </th>
                          <th className="px-2 sm:px-4 py-2 sm:py-4 w-32 sm:w-40">SKU Code</th>
                          {visibleColumns.description && <th className="px-2 sm:px-6 py-2 sm:py-4">Description</th>}
                          {visibleColumns.category && <th className="px-2 sm:px-6 py-2 sm:py-4 w-40 sm:w-48">Category</th>}
                          {visibleColumns.zone && <th className="px-2 sm:px-6 py-2 sm:py-4 w-32 sm:w-48">Zone 1</th>}
                          {visibleColumns.zone2 && <th className="px-2 sm:px-6 py-2 sm:py-4 w-32 sm:w-48">Zone 2</th>}
                          {visibleColumns.qty && <th className="px-2 sm:px-6 py-2 sm:py-4 w-20 sm:w-28 text-right">Qty</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pink-50">{paginatedItems.map(item => (
                        <tr key={item.id} className={`transition-colors group ${selectedItems.has(item.id) ? 'bg-pink-50/60' : 'hover:bg-pink-50/20'}`}>
                          <td className="pl-4 sm:pl-10 pr-2 py-1.5 sm:py-2">
                            <button onClick={() => toggleSelection(item.id)} className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md sm:rounded-lg border-2 flex items-center justify-center transition-all ${selectedItems.has(item.id) ? 'bg-pink-600 border-pink-600' : 'border-slate-200 group-hover:border-pink-300'}`}>
                              {selectedItems.has(item.id) && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />}
                            </button>
                          </td>
                          <td className="px-2 sm:px-4 py-1.5 sm:py-2 font-mono text-[10px] sm:text-[11px] text-pink-600 font-black tracking-tight">{item.code}</td>
                          {visibleColumns.description && <td className="px-2 sm:px-6 py-1.5 sm:py-2"><p className="text-[10px] sm:text-xs font-bold text-slate-800 leading-tight">{item.description}</p></td>}
                          {visibleColumns.category && (
                            <td className="px-2 sm:px-6 py-1.5 sm:py-2">
                               <select value={item.category} onChange={(e) => handleFieldChange(item.id, 'category', e.target.value)} className="w-full bg-pink-50/40 hover:bg-white text-pink-700 text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl appearance-none cursor-pointer border border-transparent hover:border-pink-100 shadow-sm outline-none truncate">
                                 {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                 <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
                               </select>
                            </td>
                          )}
                          {visibleColumns.zone && (
                            <td className="px-2 sm:px-6 py-1.5 sm:py-2">
                               <select value={item.zone} onChange={(e) => handleFieldChange(item.id, 'zone', e.target.value)} className="w-full bg-slate-50 hover:bg-white text-slate-700 text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl appearance-none cursor-pointer border border-transparent hover:border-slate-200 shadow-sm outline-none truncate">
                                 {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                                 <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
                               </select>
                            </td>
                          )}
                          {visibleColumns.zone2 && (
                            <td className="px-2 sm:px-6 py-1.5 sm:py-2">
                               <select value={item.zone2} onChange={(e) => handleFieldChange(item.id, 'zone2', e.target.value)} className="w-full bg-slate-50/70 hover:bg-white text-slate-700 text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl appearance-none cursor-pointer border border-transparent hover:border-slate-200 shadow-sm outline-none truncate">
                                 {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                                 <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
                               </select>
                            </td>
                          )}
                          {visibleColumns.qty && <td className={`px-2 sm:px-6 py-1.5 sm:py-2 text-right font-black text-[10px] sm:text-xs ${item.qty <= 0 ? 'text-rose-500' : 'text-slate-800'}`}>{item.qty}</td>}
                        </tr>
                      ))}</tbody></table>
                  </div>
                  {filteredItems.length > 0 && (
                    <div className="mt-auto px-4 sm:px-10 py-4 sm:py-8 bg-pink-50/10 flex flex-row items-center justify-between gap-4 flex-shrink-0 border-t border-pink-50 relative z-20">
                      <p className="text-[10px] sm:text-sm text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap">Page <span className="text-pink-600 font-black">{currentPage}</span> / <span className="text-slate-800 font-black">{totalPages}</span></p>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 sm:p-4 rounded-xl sm:rounded-[1.5rem] border border-pink-100 bg-white disabled:opacity-30 hover:bg-pink-50 transition-colors"><ChevronLeft className="w-4 sm:w-5 h-4 sm:h-5 text-pink-600" /></button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 sm:p-4 rounded-xl sm:rounded-[1.5rem] border border-pink-100 bg-white disabled:opacity-30 hover:bg-pink-50 transition-colors"><ChevronRight className="w-4 sm:w-5 h-4 sm:h-5 text-pink-600" /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      
      {/* Settings/Export Modals */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl border border-pink-100 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <div><h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Export Inventory</h3><p className="text-slate-500 text-xs sm:text-sm font-medium">Select your preferred file format</p></div>
              <button onClick={() => setIsExportModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100"><X className="w-5 sm:w-6 h-5 sm:h-6 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button onClick={() => setExportFormat('standard')} className={`relative p-4 sm:p-6 rounded-2xl border-2 text-left transition-all ${exportFormat === 'standard' ? 'border-pink-500 bg-pink-50/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                <FileText className={`w-8 sm:w-10 h-8 sm:h-10 mb-3 sm:mb-4 ${exportFormat === 'standard' ? 'text-pink-500' : 'text-slate-300'}`} />
                <h4 className="font-black text-xs sm:text-sm uppercase tracking-wide mb-1 sm:mb-2">Standard CSV</h4>
                <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Flat list format including both Zone fields.</p>
              </button>
              <button onClick={() => setExportFormat('categorized')} className={`relative p-4 sm:p-6 rounded-2xl border-2 text-left transition-all ${exportFormat === 'categorized' ? 'border-pink-500 bg-pink-50/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                <FileSpreadsheet className={`w-8 sm:w-10 h-8 sm:h-10 mb-3 sm:mb-4 ${exportFormat === 'categorized' ? 'text-pink-500' : 'text-slate-300'}`} />
                <h4 className="font-black text-xs sm:text-sm uppercase tracking-wide mb-1 sm:mb-2">Categorized Excel</h4>
                <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Formatted report with all zone locations listed.</p>
              </button>
            </div>
            <div className="flex gap-3 sm:gap-4 pt-4 border-t border-slate-100">
              <button onClick={() => setIsExportModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-xs sm:text-sm">Cancel</button>
              <button onClick={handleDownload} className="flex-[2] py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm">
                <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> Download File
              </button>
            </div>
          </div>
        </div>
      )}

      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-pink-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl border border-pink-100">
            <div className="flex justify-between items-center mb-6"><h3 className="text-lg sm:text-xl font-bold text-pink-800 flex items-center gap-2"><Github className="w-5 sm:w-6 h-5 sm:h-6" />GitHub Sync</h3><button onClick={() => setIsSyncModalOpen(false)} className="text-pink-300 hover:text-pink-600"><X className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] font-bold text-pink-400 uppercase tracking-widest block mb-1">Token</label><input type="password" placeholder="ghp_..." className="w-full px-4 py-3 bg-pink-50 rounded-xl outline-none text-xs sm:text-sm" value={ghConfig.token} onChange={(e) => setGhConfig({...ghConfig, token: e.target.value})} /></div>
              <div><label className="text-[10px] font-bold text-pink-400 uppercase tracking-widest block mb-1">Repo (user/repo)</label><input type="text" placeholder="user/repo" className="w-full px-4 py-3 bg-pink-50 rounded-xl outline-none text-xs sm:text-sm" value={ghConfig.repo} onChange={(e) => setGhConfig({...ghConfig, repo: e.target.value})} /></div>
            </div>
            <div className="mt-8 flex gap-3"><button onClick={() => setIsSyncModalOpen(false)} className="flex-1 py-3 text-pink-600 font-bold hover:bg-pink-50 rounded-xl text-xs sm:text-sm">Cancel</button><button onClick={() => { setIsSyncModalOpen(false); syncToGitHub(); }} className="flex-1 py-3 bg-pink-600 text-white font-bold rounded-xl shadow-xl shadow-pink-600/20 flex items-center justify-center gap-2 text-xs sm:text-sm"><Save className="w-4 h-4" />Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{title: string; value: number; icon: React.ReactNode; color: string; subtitle?: string}> = ({ title, value, icon, color, subtitle }) => {
  const map: any = { pink: 'bg-pink-50 text-pink-600 border-pink-100', rose: 'bg-rose-50 text-rose-600 border-rose-100', fuchsia: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100' };
  return (
    <div className="bg-white p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white shadow-xl hover:-translate-y-1.5 transition-all duration-500 group">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${map[color] || map.pink} border transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>{React.cloneElement(icon as any, { className: 'w-5 sm:w-7 h-5 sm:h-7' })}</div>
        {subtitle && <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] text-pink-300">{subtitle}</span>}
      </div>
      <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] mb-1 sm:mb-2">{title}</p>
      <p className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tighter">{value.toLocaleString()}</p>
    </div>
  );
};

export default App;
