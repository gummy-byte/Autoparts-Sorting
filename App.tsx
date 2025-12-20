
import React, { useState, useMemo, useEffect } from 'react';
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
  Tag
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
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dynamic Categories State
  const [availableCategories, setAvailableCategories] = useState<string[]>(Object.values(ItemCategory));
  
  // Category Creation Modal State
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryTarget, setCategoryTarget] = useState<{ type: 'single' | 'bulk', id?: string } | null>(null);

  // Selection State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Sync States
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [ghConfig, setGhConfig] = useState<GitHubConfig>(() => {
    const saved = localStorage.getItem('gh_config');
    return saved ? JSON.parse(saved) : { token: '', repo: '', path: 'inventory_categorized.csv', branch: 'main' };
  });

  // Export States
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'standard' | 'categorized'>('standard');

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('gh_config', JSON.stringify(ghConfig));
  }, [ghConfig]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedItems(new Set()); // Clear selection on filter change
  }, [searchTerm, selectedCategory]);

  const processCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    let qtyIdx = -1, codeIdx = -1, descIdx = -1, catIdx = -1, headerLineIdx = -1;
    
    // Find header row and column indices
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const parts = parseCSVLine(lines[i]).map(p => p.toLowerCase());
      const fQty = parts.findIndex(p => p.includes('qty') || p.includes('quantity') || p === 'q');
      const fCode = parts.findIndex(p => p.includes('code') || p.includes('part') || p.includes('sku'));
      const fDesc = parts.findIndex(p => p.includes('desc') || p.includes('item') || p.includes('name'));
      const fCat = parts.findIndex(p => p.includes('category') || p.includes('type') || p.includes('group') || p === 'cat');

      if ((fQty !== -1 && fCode !== -1) || (fQty !== -1 && fDesc !== -1) || (fCode !== -1 && fDesc !== -1)) {
        qtyIdx = fQty; codeIdx = fCode; descIdx = fDesc; catIdx = fCat; headerLineIdx = i; break;
      }
    }

    if (headerLineIdx === -1) { 
      qtyIdx = 0; codeIdx = 1; descIdx = 2; headerLineIdx = -1; 
      // Keep catIdx as -1 if we couldn't determine header, assuming no category column
    }

    const parsedItems: InventoryItem[] = [];
    const newCategories = new Set<string>();

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

      // If category is empty or "null" string, use classifier
      if (!category || category.toLowerCase() === 'null') {
        category = classifyItem(description);
      } else {
        // If we found a category in CSV, ensure it's added to our available categories
        if (category.trim()) newCategories.add(category.trim());
      }
      
      parsedItems.push({
        id: `${code}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        qty,
        code: code || "UNKNOWN",
        description: description || "Untitled Part",
        category
      });
    }

    // Update available categories with any new ones found
    if (newCategories.size > 0) {
      setAvailableCategories(prev => {
        const combined = new Set([...prev, ...Array.from(newCategories)]);
        return Array.from(combined).sort();
      });
    }

    setItems(parsedItems);
  };

  const openAddCategoryModal = (type: 'single' | 'bulk', id?: string) => {
    setCategoryTarget({ type, id });
    setNewCategoryName("");
    setIsAddCategoryModalOpen(true);
  };

  const handleConfirmAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const name = newCategoryName.trim();
    
    setAvailableCategories(prev => {
      if (prev.includes(name)) return prev;
      return [...prev, name].sort();
    });

    if (categoryTarget?.type === 'bulk') {
        setItems(prev => prev.map(item => selectedItems.has(item.id) ? { ...item, category: name } : item));
        setSelectedItems(new Set());
    } else if (categoryTarget?.type === 'single' && categoryTarget.id) {
        setItems(prev => prev.map(item => item.id === categoryTarget.id ? { ...item, category: name } : item));
    }

    setIsAddCategoryModalOpen(false);
  };

  const handleCategoryChange = (id: string, newCategory: string) => {
    if (newCategory === '__NEW__') {
      openAddCategoryModal('single', id);
    } else {
      setItems(prev => prev.map(item => item.id === id ? { ...item, category: newCategory } : item));
    }
  };

  const handleBulkCategoryChange = (newCategory: string) => {
    if (newCategory === '__NEW__') {
      openAddCategoryModal('bulk');
    } else {
      setItems(prev => prev.map(item => selectedItems.has(item.id) ? { ...item, category: newCategory } : item));
      setSelectedItems(new Set());
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const generateStandardCSV = () => {
    const headers = ["Quantity", "Code", "Description", "Category"];
    const rows = items.map(item => [item.qty, `"${item.code}"`, `"${item.description}"`, `"${item.category}"`]);
    return [headers, ...rows].map(e => e.join(",")).join("\n");
  };

  const generateCategorizedCSVPreview = () => {
    // This is just for the text preview box
    let csv = "No,Code,Description,Qty\n";
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, InventoryItem[]>);
    const sortedCategories = Object.keys(grouped).sort();
    let globalIndex = 1;

    sortedCategories.forEach(cat => {
      csv += `\n[ ${cat.toUpperCase()} ]\n`; // Simplified text representation
      grouped[cat].forEach(item => {
        csv += `${globalIndex},"${item.code}","${item.description}",${item.qty}\n`;
        globalIndex++;
      });
    });
    return csv;
  };

  const generateCategorizedXLS = () => {
    // This generates an HTML table that Excel interprets as a spreadsheet with formatting
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
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Inventory Report</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
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
              <th style="width: 80px">Qty</th>
            </tr>
          </thead>
          <tbody>
    `;

    sortedCategories.forEach(cat => {
      // Category Header Row with Yellow Background
      html += `
        <tr>
          <td colspan="4" class="category-header">${cat.toUpperCase()}</td>
        </tr>
      `;
      
      grouped[cat].forEach(item => {
        html += `
          <tr>
            <td>${globalIndex}</td>
            <td>${item.code}</td>
            <td>${item.description}</td>
            <td class="qty-col">${item.qty}</td>
          </tr>
        `;
        globalIndex++;
      });
    });

    html += `</tbody></table></body></html>`;
    return html;
  };

  const getExportPreview = () => {
    const content = exportFormat === 'standard' ? generateStandardCSV() : generateCategorizedCSVPreview();
    const lines = content.split('\n');
    return lines.slice(0, 10).join('\n') + (lines.length > 10 ? '\n...' : '');
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
      if (put.ok) { setSyncStatus('success'); setTimeout(() => setSyncStatus('idle'), 3000); }
      else throw new Error();
    } catch { setSyncStatus('error'); }
    finally { setIsSyncing(false); }
  };

  const handleLoadSample = () => {
    const sample = `Qty,Code,Item Description,Category
2,(AC) 315143,BLOWER MOTOR TOYOTA UNSER/AVANZA (RL),
0,(AC)2850,CABIN FILTER TOYOTA INNOVA/ESTIMA,Cabin Filter
15,(AC)CFMY,CABIN FILTER PERODUA ALZA/MYVI BEST/AXIA (120010),
0,03C115561J,03C115561J (UNKNOWN DESC),Unknown
1,2105,CVT OIL TOYOTA TC 4L INC L.C,Fluids & Oils
7,11193-97201,PLUG SEAL SET KELISA 1.0,
4,11427508969,OIL FILTER BMW E46 2.0,Oil Filter
2,08269-P9908ZT3,CVT OIL HONDA CVTF 3.5L INC L.C,Fluids & Oils
1,11302-87Z03,TIMING COVER PERODUA MYVI KENARI KELISA INC L.C,Engine Parts
3,17220-RNA-000,AIR FILTER HONDA CIVIC 1.8,
6,GDB7707,BRAKE PAD (F) PROTON SAGA BLM/FLX INC L.C -TRW-,Brakes`;
    processCSV(sample);
  };

  const handleTabChange = (tab: 'overview' | 'inventory') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false); // Auto close menu on selection
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
    return items.filter(item => {
      const matchS = item.description.toLowerCase().includes(searchTerm.toLowerCase()) || item.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchC = selectedCategory === "All" || item.category === selectedCategory;
      return matchS && matchC;
    });
  }, [items, searchTerm, selectedCategory]);

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
        <div 
          className="fixed inset-0 bg-pink-900/30 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Add Category Modal */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-pink-100 transform transition-all scale-100">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Tag className="w-5 h-5 text-pink-500" /> New Category</h3>
               <button onClick={() => setIsAddCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50"><X className="w-5 h-5" /></button>
             </div>
             
             <div className="mb-6">
               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Category Name</label>
               <input 
                 autoFocus
                 type="text" 
                 value={newCategoryName}
                 onChange={(e) => setNewCategoryName(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleConfirmAddCategory()}
                 placeholder="e.g., Transmission"
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-none font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400"
               />
             </div>

             <div className="flex gap-3">
               <button onClick={() => setIsAddCategoryModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all text-sm">Cancel</button>
               <button onClick={handleConfirmAddCategory} className="flex-[2] py-3 bg-pink-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-pink-600/20 hover:bg-pink-700 text-sm">Create & Apply</button>
             </div>
           </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-4 border border-white/10 pr-6">
            <div className="bg-pink-600 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider">
              {selectedItems.size} Selected
            </div>
            <div className="h-6 w-px bg-slate-700"></div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-300">Move to:</span>
              <div className="relative group/bulk">
                 <select 
                    className="appearance-none bg-slate-800 border border-slate-700 hover:border-pink-500 rounded-xl px-4 py-2 pr-10 text-sm font-bold focus:ring-2 focus:ring-pink-500/50 outline-none transition-all cursor-pointer"
                    onChange={(e) => {
                      if (e.target.value) handleBulkCategoryChange(e.target.value);
                    }}
                    value=""
                 >
                    <option value="" disabled>Choose Category...</option>
                    {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    <option value="__NEW__" className="text-pink-400 font-bold">+ Create New Category</option>
                 </select>
                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <button 
              onClick={() => setSelectedItems(new Set())}
              className="ml-2 p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pink-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200 border border-pink-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-pink-800 flex items-center gap-2"><Github className="w-6 h-6" />GitHub Sync</h3>
              <button onClick={() => setIsSyncModalOpen(false)} className="text-pink-300 hover:text-pink-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-1.5">Personal Access Token</label>
                <input type="password" placeholder="ghp_..." className="w-full px-4 py-3 bg-pink-50 border border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500/20 outline-none" value={ghConfig.token} onChange={(e) => setGhConfig({...ghConfig, token: e.target.value})} />
              </div>
              <div><label className="block text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-1.5">Repository (owner/repo)</label>
                <input type="text" placeholder="user/repo" className="w-full px-4 py-3 bg-pink-50 border border-pink-100 rounded-xl focus:ring-2 focus:ring-pink-500/20 outline-none" value={ghConfig.repo} onChange={(e) => setGhConfig({...ghConfig, repo: e.target.value})} />
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setIsSyncModalOpen(false)} className="flex-1 py-3 text-pink-600 font-bold hover:bg-pink-50 rounded-xl transition-all">Cancel</button>
              <button onClick={() => { setIsSyncModalOpen(false); syncToGitHub(); }} className="flex-1 py-3 bg-pink-600 text-white font-bold rounded-xl transition-all shadow-xl shadow-pink-600/20 flex items-center justify-center gap-2"><Save className="w-4 h-4" />Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Format Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl border border-pink-100 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Export Inventory</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Select your preferred file format</p>
              </div>
              <button onClick={() => setIsExportModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <button 
                onClick={() => setExportFormat('standard')}
                className={`relative p-6 rounded-2xl border-2 text-left transition-all group ${exportFormat === 'standard' ? 'border-pink-500 bg-pink-50/50 ring-4 ring-pink-500/10' : 'border-slate-100 hover:border-pink-200 hover:bg-slate-50'}`}
              >
                <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center transition-colors ${exportFormat === 'standard' ? 'bg-pink-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-pink-100 group-hover:text-pink-600'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className={`font-black text-sm uppercase tracking-wide mb-2 ${exportFormat === 'standard' ? 'text-pink-700' : 'text-slate-700'}`}>Standard CSV</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">Flat list with Quantity, Code, Description, and Category columns. Best for further data processing.</p>
                {exportFormat === 'standard' && <div className="absolute top-4 right-4 w-3 h-3 bg-pink-500 rounded-full shadow-lg shadow-pink-500/30"></div>}
              </button>

              <button 
                onClick={() => setExportFormat('categorized')}
                className={`relative p-6 rounded-2xl border-2 text-left transition-all group ${exportFormat === 'categorized' ? 'border-pink-500 bg-pink-50/50 ring-4 ring-pink-500/10' : 'border-slate-100 hover:border-pink-200 hover:bg-slate-50'}`}
              >
                <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center transition-colors ${exportFormat === 'categorized' ? 'bg-pink-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-pink-100 group-hover:text-pink-600'}`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className={`font-black text-sm uppercase tracking-wide mb-2 ${exportFormat === 'categorized' ? 'text-pink-700' : 'text-slate-700'}`}>Categorized Excel Report</h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">Formatted .xls file with color-coded headers (Yellow) and grouped categories. Ready for printing.</p>
                {exportFormat === 'categorized' && <div className="absolute top-4 right-4 w-3 h-3 bg-pink-500 rounded-full shadow-lg shadow-pink-500/30"></div>}
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0 mb-8 bg-slate-900 rounded-2xl border border-slate-800">
              <div className="px-5 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">File Preview</span>
                <span className="text-[10px] font-mono text-slate-600">inventory_{exportFormat}.{exportFormat === 'standard' ? 'csv' : 'xls'}</span>
              </div>
              <div className="p-5 overflow-auto custom-scrollbar flex-1">
                <pre className="font-mono text-xs text-slate-300 whitespace-pre leading-relaxed">{getExportPreview()}</pre>
                {exportFormat === 'categorized' && <p className="text-[10px] text-pink-400 mt-2 font-mono">Note: Preview shows text structure. Downloaded file will include Yellow headers and formatting.</p>}
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-100">
              <button onClick={() => setIsExportModalOpen(false)} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
              <button onClick={handleDownload} className="flex-[2] py-3.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl transition-all shadow-xl shadow-pink-600/20 flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Download File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Sidebar Design - Fixed on Desktop */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 flex flex-col 
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Sidebar Background Handler (hidden on desktop) */}
        <div className="absolute inset-0 bg-[#fff1f5] lg:hidden -z-10" />

        <div className="flex-1 bg-slate-900 text-white flex flex-col overflow-hidden relative border-r border-white/5">
          {/* Close Button for Mobile */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-6 right-6 lg:hidden p-2 text-slate-400 hover:text-white transition-colors bg-white/10 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8">
            <div className="flex items-center gap-3 mb-10">
              <div className="bg-gradient-to-br from-pink-400 to-rose-600 p-2.5 rounded-2xl shadow-lg shadow-pink-500/20">
                <Package className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-pink-200">
                AutoPart
              </h1>
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
                <p className="text-[10px] text-pink-400 uppercase tracking-[0.2em] font-black">Sync Engine</p>
                <button onClick={() => { setIsMobileMenuOpen(false); setIsSyncModalOpen(true); }} className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-slate-400"><Settings className="w-3.5 h-3.5" /></button>
              </div>
              <button onClick={syncToGitHub} disabled={items.length === 0 || isSyncing} className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl text-[11px] font-bold transition-all ${syncStatus === 'success' ? 'bg-emerald-500' : syncStatus === 'error' ? 'bg-rose-500' : 'bg-white/10 hover:bg-white/20'} text-white disabled:opacity-50`}>
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : syncStatus === 'success' ? <Check className="w-3.5 h-3.5" /> : <Github className="w-3.5 h-3.5" />}
                {isSyncing ? 'Pushing...' : syncStatus === 'success' ? 'Synced!' : 'Cloud Save'}
              </button>
            </div>
            
            <p className="text-[10px] text-slate-600 font-bold text-center uppercase tracking-widest pt-2">
              created by syamim with <span className="text-pink-500">❤️</span>
            </p>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-6 lg:ml-80 h-full transition-all duration-300">
        <div className="h-full flex flex-col">
          <header className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] px-6 py-5 flex flex-col sm:flex-row justify-between items-center gap-5 shadow-sm mb-6 flex-shrink-0">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-pink-50 hover:text-pink-600 rounded-xl transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{activeTab === 'overview' ? 'Real-time Stats' : 'Manage Stock'}</h2>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button onClick={handleLoadSample} className="px-4 py-3 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-2xl transition-all font-bold text-sm flex items-center gap-2 border border-pink-100 shadow-sm whitespace-nowrap"><RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">Sample</span></button>
              <button onClick={() => setIsExportModalOpen(true)} disabled={items.length === 0} className="px-4 py-3 bg-white border border-slate-200 hover:border-pink-300 hover:bg-pink-50 text-slate-700 hover:text-pink-600 rounded-2xl transition-all font-bold text-sm flex items-center gap-2 shadow-sm disabled:opacity-50 whitespace-nowrap"><Download className="w-4 h-4" /><span className="hidden sm:inline">Export</span></button>
              <label className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-pink-600 text-white rounded-2xl cursor-pointer transition-all shadow-xl shadow-slate-900/10 font-bold text-sm whitespace-nowrap">
                <FileUp className="w-4 h-4" /><span className="hidden sm:inline">Import</span> <input type="file" className="hidden" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (e) => processCSV(e.target?.result as string); r.readAsText(f); } }} />
              </label>
            </div>
          </header>

          <div className={`flex-1 ${activeTab === 'inventory' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto pr-2 custom-scrollbar'} pb-6`}>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-full text-center max-w-xl mx-auto px-6">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-pink-500 blur-3xl opacity-20 animate-pulse"></div>
                  <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl border border-pink-50"><Sparkles className="w-12 h-12 text-pink-500" /></div>
                </div>
                <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Organize Your Inventory</h3>
                <p className="text-slate-500 mb-10 leading-relaxed text-lg font-medium">Upload a CSV of automotive parts. The system will scan part numbers and descriptions to categorize them automatically.</p>
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <button onClick={handleLoadSample} className="px-8 py-4 bg-white border-2 border-slate-100 text-slate-700 font-black rounded-[1.5rem] hover:border-pink-200 hover:bg-pink-50 transition-all shadow-md">Try with Sample Data</button>
                  <label className="px-8 py-4 bg-pink-600 text-white font-black rounded-[1.5rem] hover:bg-pink-700 transition-all shadow-xl shadow-pink-600/20 cursor-pointer text-center">Upload CSV File <input type="file" className="hidden" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (e) => processCSV(e.target?.result as string); r.readAsText(f); } }} /></label>
                </div>
              </div>
            ) : (
              <>
                {activeTab === 'overview' ? (
                  <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard title="Unique SKUs" value={items.length} icon={<Package />} color="pink" />
                    <StatCard title="Total Inventory" value={items.reduce((a,b)=>a+b.qty, 0)} icon={<BarChart3 />} color="rose" />
                    <StatCard title="Stock Alerts" value={items.filter(i=>i.qty<=0).length} icon={<AlertCircle />} color="fuchsia" subtitle="Low Qty" />
                    <StatCard title="Segments" value={stats.length} icon={<Filter />} color="rose" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-white shadow-xl shadow-pink-900/5">
                      <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-3"><BarChart3 className="w-5 h-5 text-pink-500" />Top Categories</h3>
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#fdf2f8" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: '#fff5f8' }} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="count" radius={[0, 14, 14, 0]} barSize={20}>
                              {stats.map((e, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-white shadow-xl shadow-pink-900/5">
                      <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-3"><LayoutDashboard className="w-5 h-5 text-rose-500" />Distribution Mix</h3>
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={stats.slice(0, 6)} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={10} dataKey="count">
                              {stats.map((e, i) => <Cell key={`p-${i}`} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={4} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-white shadow-xl shadow-pink-900/5 overflow-hidden">
                      <div className="px-10 py-7 border-b border-pink-50 bg-pink-50/20 flex justify-between items-center"><h3 className="font-black text-slate-700 uppercase text-[10px] tracking-[0.2em]">Detailed Inventory Health</h3></div>
                      <div className="overflow-x-auto"><table className="w-full text-left">
                        <thead><tr className="text-slate-400 text-[10px] uppercase tracking-[0.3em] font-black"><th className="px-10 py-6">Category</th><th className="px-10 py-6">SKUs</th><th className="px-10 py-6">Stock level</th><th className="px-10 py-6">Action</th></tr></thead>
                        <tbody className="divide-y divide-pink-50">{stats.map((s, i) => (
                          <tr key={s.name} className="hover:bg-pink-50/30 transition-colors group">
                            <td className="px-10 py-6"><div className="flex items-center gap-4"><div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: COLORS[i % COLORS.length] }} /><span className="font-bold text-slate-800">{s.name}</span></div></td>
                            <td className="px-10 py-6 text-slate-500 font-bold text-sm">{s.count} items</td>
                            <td className="px-10 py-6 text-slate-500 font-bold text-sm">{s.totalQty} units</td>
                            <td className="px-10 py-6"><span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${s.totalQty > 15 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{s.totalQty > 15 ? 'Good' : 'Restock'}</span></td>
                          </tr>
                        ))}</tbody></table></div>
                    </div>
                  </div>
                  </>
                ) : (
                  <div className="bg-white rounded-[2.5rem] border border-white shadow-xl shadow-pink-900/5 overflow-hidden flex flex-col h-full">
                    <div className="p-8 border-b border-pink-50 flex flex-col sm:flex-row gap-5 justify-between bg-pink-50/10 flex-shrink-0">
                      <div className="relative flex-1 group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-pink-500 transition-colors" />
                        <input type="text" placeholder="Search part codes, names..." className="w-full pl-14 pr-8 py-5 bg-white border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 outline-none transition-all text-sm font-bold shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      </div>
                      <div className="relative min-w-[200px] sm:min-w-[280px]">
                        <Filter className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select className="w-full pl-14 pr-12 py-5 bg-white border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 outline-none appearance-none transition-all text-sm font-black text-slate-700 shadow-sm" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                          <option value="All">All Categories</option>
                          {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left table-fixed min-w-[800px]">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="text-slate-400 text-[10px] uppercase tracking-[0.3em] font-black border-b border-pink-50 shadow-sm">
                            <th className="pl-10 pr-4 py-4 w-16">
                              <button 
                                onClick={toggleAll}
                                className={`w-4 h-4 rounded-lg border-2 flex items-center justify-center transition-all ${isAllSelected ? 'bg-pink-600 border-pink-600' : 'border-slate-300 hover:border-pink-400'}`}
                              >
                                {isAllSelected && <Check className="w-3 h-3 text-white" />}
                              </button>
                            </th>
                            <th className="px-4 py-4 w-48">SKU Code</th>
                            <th className="px-10 py-4">Description</th>
                            <th className="px-10 py-4 w-64">Category</th>
                            <th className="px-10 py-4 w-32 text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-pink-50">{paginatedItems.map(item => (
                          <tr key={item.id} className={`transition-colors group ${selectedItems.has(item.id) ? 'bg-pink-50/60 hover:bg-pink-100/60' : 'hover:bg-pink-50/20'}`}>
                            <td className="pl-10 pr-4 py-2">
                              <button 
                                onClick={() => toggleSelection(item.id)}
                                className={`w-4 h-4 rounded-lg border-2 flex items-center justify-center transition-all ${selectedItems.has(item.id) ? 'bg-pink-600 border-pink-600' : 'border-slate-200 group-hover:border-pink-300'}`}
                              >
                                {selectedItems.has(item.id) && <Check className="w-3 h-3 text-white" />}
                              </button>
                            </td>
                            <td className="px-4 py-2 font-mono text-[11px] text-pink-600 font-black tracking-tight">{item.code}</td>
                            <td className="px-10 py-2"><p className="text-xs font-bold text-slate-800 line-clamp-2 leading-relaxed">{item.description}</p></td>
                            <td className="px-10 py-2">
                              <div className="relative group/sel">
                                <select 
                                  value={item.category} 
                                  onChange={(e) => handleCategoryChange(item.id, e.target.value)} 
                                  className="w-full bg-pink-50/50 hover:bg-white hover:ring-2 hover:ring-pink-500/20 text-pink-700 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all border border-transparent hover:border-pink-100 shadow-sm"
                                >
                                  {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                  <option value="__NEW__" className="text-pink-400 font-bold">+ New Category</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-pink-400 pointer-events-none group-hover/sel:text-pink-600" />
                              </div>
                            </td>
                            <td className={`px-10 py-2 text-right font-black text-xs ${item.qty <= 0 ? 'text-rose-500' : 'text-slate-800'}`}>{item.qty}</td>
                          </tr>
                        ))}</tbody></table>
                    </div>
                    {filteredItems.length > 0 && (
                      <div className="mt-auto px-10 py-8 bg-pink-50/10 flex flex-col sm:flex-row items-center justify-between gap-6 flex-shrink-0">
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Page <span className="text-pink-600 font-black">{currentPage}</span> / <span className="text-slate-800 font-black">{totalPages}</span></p>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-4 rounded-[1.5rem] border border-pink-100 bg-white hover:bg-pink-50 disabled:opacity-30 transition-all shadow-sm"><ChevronLeft className="w-5 h-5 text-pink-600" /></button>
                          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-4 rounded-[1.5rem] border border-pink-100 bg-white hover:bg-pink-50 disabled:opacity-30 transition-all shadow-sm"><ChevronRight className="w-5 h-5 text-pink-600" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const StatCard: React.FC<{title: string; value: number; icon: React.ReactNode; color: string; subtitle?: string}> = ({ title, value, icon, color, subtitle }) => {
  const map: any = { 
    pink: 'bg-pink-50 text-pink-600 border-pink-100', 
    rose: 'bg-rose-50 text-rose-600 border-rose-100', 
    fuchsia: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100' 
  };
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-white shadow-xl shadow-pink-900/5 hover:shadow-pink-900/10 hover:-translate-y-1.5 transition-all duration-500 group">
      <div className="flex items-center justify-between mb-6">
        <div className={`p-4 rounded-2xl ${map[color] || map.pink} border transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
          {React.cloneElement(icon as any, { className: 'w-7 h-7' })}
        </div>
        {subtitle && <span className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-300">{subtitle}</span>}
      </div>
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
      <p className="text-4xl font-black text-slate-800 tracking-tighter">{value.toLocaleString()}</p>
    </div>
  );
};

export default App;
