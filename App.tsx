
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
  Zap
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
  Pie,
  Legend
} from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem, ItemCategory, CategoryStat } from './types';
import { classifyItem } from './utils/classifier';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#64748b', '#14b8a6',
  '#a855f7', '#6366f1', '#fbbf24', '#f43f5e'
];

const ITEMS_PER_PAGE = 15;

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
  const [isAiRunning, setIsAiRunning] = useState(false);
  
  // GitHub Sync State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [ghConfig, setGhConfig] = useState<GitHubConfig>(() => {
    const saved = localStorage.getItem('gh_config');
    return saved ? JSON.parse(saved) : { token: '', repo: '', path: 'inventory_categorized.csv', branch: 'main' };
  });

  useEffect(() => {
    localStorage.setItem('gh_config', JSON.stringify(ghConfig));
  }, [ghConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  const processCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    let qtyIdx = -1, codeIdx = -1, descIdx = -1, headerLineIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const parts = parseCSVLine(lines[i]).map(p => p.toLowerCase());
      const fQty = parts.findIndex(p => p.includes('qty') || p.includes('quantity') || p === 'q');
      const fCode = parts.findIndex(p => p.includes('code') || p.includes('part') || p.includes('sku'));
      const fDesc = parts.findIndex(p => p.includes('desc') || p.includes('item') || p.includes('name'));

      if ((fQty !== -1 && fCode !== -1) || (fQty !== -1 && fDesc !== -1) || (fCode !== -1 && fDesc !== -1)) {
        qtyIdx = fQty; codeIdx = fCode; descIdx = fDesc; headerLineIdx = i; break;
      }
    }

    if (headerLineIdx === -1) { qtyIdx = 0; codeIdx = 1; descIdx = 2; headerLineIdx = -1; }

    const parsedItems: InventoryItem[] = [];
    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const parts = parseCSVLine(lines[i]);
      if (parts.length < 2) continue;
      const qty = parseInt((qtyIdx !== -1 ? parts[qtyIdx] : "0").replace(/[^0-9-]/g, '')) || 0;
      const code = codeIdx !== -1 ? parts[codeIdx] : "N/A";
      const description = descIdx !== -1 ? parts[descIdx] : "No Description";
      
      parsedItems.push({
        id: `${code}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        qty,
        code: code || "UNKNOWN",
        description: description || "Untitled Part",
        category: classifyItem(description)
      });
    }
    setItems(parsedItems);
  };

  const refineWithAI = async () => {
    if (items.length === 0 || isAiRunning) return;
    setIsAiRunning(true);

    try {
      // Correctly initialize GoogleGenAI with process.env.API_KEY directly
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Categorize the following automotive parts into one of these exact categories: ${Object.values(ItemCategory).join(', ')}.
      
      Items:
      ${items.map(item => `- Code: ${item.code}, Description: ${item.description}`).join('\n')}
      
      Return a JSON array of objects with 'code' and 'category'.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING },
                category: { type: Type.STRING, enum: Object.values(ItemCategory) }
              },
              required: ["code", "category"]
            }
          }
        }
      });

      const results = JSON.parse(response.text || '[]');
      setItems(prev => prev.map(item => {
        const aiMatch = results.find((r: any) => r.code === item.code);
        return aiMatch ? { ...item, category: aiMatch.category as ItemCategory } : item;
      }));
    } catch (err) {
      console.error("AI Categorization failed:", err);
      alert("AI sync failed. Please check your API key in the environment variables.");
    } finally {
      setIsAiRunning(false);
    }
  };

  const handleCategoryChange = (id: string, newCategory: ItemCategory) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, category: newCategory } : item));
  };

  const generateCSVString = () => {
    const headers = ["Quantity", "Code", "Description", "Category"];
    const rows = items.map(item => [item.qty, `"${item.code}"`, `"${item.description}"`, `"${item.category}"`]);
    return [headers, ...rows].map(e => e.join(",")).join("\n");
  };

  const exportToCSV = () => {
    if (items.length === 0) return;
    const blob = new Blob([generateCSVString()], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `categorized_inventory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const syncToGitHub = async () => {
    if (!ghConfig.token || !ghConfig.repo || !ghConfig.path) { setIsSyncModalOpen(true); return; }
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      const contentBase64 = btoa(unescape(encodeURIComponent(generateCSVString())));
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
    const sample = `Qty,Code,Item Description
2,(AC) 315143,BLOWER MOTOR TOYOTA UNSER/AVANZA (RL)
0,(AC)2850,CABIN FILTER TOYOTA INNOVA/ESTIMA
15,(AC)CFMY,CABIN FILTER PERODUA ALZA/MYVI BEST/AXIA (120010)
0,03C115561J,03C115561J (UNKNOWN DESC)
1,2105,CVT OIL TOYOTA TC 4L INC L.C
7,11193-97201,PLUG SEAL SET KELISA 1.0
4,11427508969,OIL FILTER BMW E46 2.0
2,08269-P9908ZT3,CVT OIL HONDA CVTF 3.5L INC L.C
1,11302-87Z03,TIMING COVER PERODUA MYVI KENARI KELISA INC L.C
3,17220-RNA-000,AIR FILTER HONDA CIVIC 1.8
6,GDB7707,BRAKE PAD (F) PROTON SAGA BLM/FLX INC L.C -TRW-`;
    processCSV(sample);
  };

  const stats: CategoryStat[] = useMemo(() => {
    const map = new Map<ItemCategory, { count: number; totalQty: number }>();
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative bg-slate-50 font-['Inter']">
      {/* Settings Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200 border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Github className="w-6 h-6" />GitHub Sync</h3>
              <button onClick={() => setIsSyncModalOpen(false)} className="text-slate-400 hover:text-slate-600"><AlertCircle className="w-5 h-5 rotate-45" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Personal Access Token</label>
                <input type="password" placeholder="ghp_..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" value={ghConfig.token} onChange={(e) => setGhConfig({...ghConfig, token: e.target.value})} />
              </div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Repository (owner/repo)</label>
                <input type="text" placeholder="user/repo" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none" value={ghConfig.repo} onChange={(e) => setGhConfig({...ghConfig, repo: e.target.value})} />
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setIsSyncModalOpen(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
              <button onClick={() => { setIsSyncModalOpen(false); syncToGitHub(); }} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2"><Save className="w-4 h-4" />Save</button>
            </div>
          </div>
        </div>
      )}

      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-500 p-2 rounded-lg"><Package className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-bold tracking-tight">AutoParts Dash</h1>
          </div>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <LayoutDashboard className="w-5 h-5" /> <span className="font-medium">Overview</span>
            </button>
            <button onClick={() => setActiveTab('inventory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'inventory' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <ListFilter className="w-5 h-5" /> <span className="font-medium">Inventory</span>
            </button>
          </nav>
        </div>
        <div className="mt-auto p-6 space-y-4 border-t border-slate-800/50">
          <button 
            onClick={refineWithAI} 
            disabled={items.length === 0 || isAiRunning}
            className={`w-full group flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-bold transition-all ${isAiRunning ? 'bg-indigo-600 animate-pulse' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:scale-[1.02] shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30'} text-white disabled:opacity-50`}
          >
            {isAiRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-indigo-200 group-hover:rotate-12 transition-transform" />}
            {isAiRunning ? 'AI Processing...' : 'Smart Categorize'}
          </button>
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
            <div className="flex justify-between items-center mb-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cloud Actions</p>
              <button onClick={() => setIsSyncModalOpen(true)} className="p-1 hover:bg-slate-700 rounded-md transition-colors"><Settings className="w-3 h-3 text-slate-400" /></button>
            </div>
            <button onClick={syncToGitHub} disabled={items.length === 0 || isSyncing} className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${syncStatus === 'success' ? 'bg-emerald-500' : syncStatus === 'error' ? 'bg-rose-500' : 'bg-slate-700 hover:bg-slate-600'} text-white disabled:opacity-50`}>
              {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : syncStatus === 'success' ? <Check className="w-3 h-3" /> : <Github className="w-3 h-3" />}
              {isSyncing ? 'Syncing...' : syncStatus === 'success' ? 'Synced!' : 'Save to GitHub'}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{activeTab === 'overview' ? 'Dashboard Summary' : 'Inventory Management'}</h2>
            <p className="text-slate-500 text-sm flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />Gemini 3 Powered Insights</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleLoadSample} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-medium text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />Sample</button>
            <label className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer transition-all shadow-lg shadow-slate-900/10 font-medium text-sm">
              <FileUp className="w-4 h-4" />Upload CSV <input type="file" className="hidden" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (e) => processCSV(e.target?.result as string); r.readAsText(f); } }} />
            </label>
          </div>
        </header>

        <div className="p-8">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-lg mx-auto">
              <div className="bg-indigo-50 p-7 rounded-full mb-6 border-4 border-white shadow-xl"><Sparkles className="w-10 h-10 text-indigo-500" /></div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Smart Categorization Engine</h3>
              <p className="text-slate-500 mb-10 leading-relaxed text-lg">Use Google Gemini AI to instantly analyze part codes and descriptions. Perfect for messy automotive inventory CSV exports.</p>
              <button onClick={handleLoadSample} className="px-8 py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-md hover:shadow-lg">Get Started with Sample Data</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <StatCard title="Total Items" value={items.length} icon={<Package className="text-blue-500" />} color="blue" />
                <StatCard title="Total Units" value={items.reduce((a,b)=>a+b.qty, 0)} icon={<BarChart3 className="text-emerald-500" />} color="emerald" />
                <StatCard title="Out of Stock" value={items.filter(i=>i.qty<=0).length} icon={<AlertCircle className="text-rose-500" />} color="rose" subtitle="Qty ≤ 0" />
                <StatCard title="Active Categories" value={stats.length} icon={<Filter className="text-amber-500" />} color="amber" />
              </div>

              {activeTab === 'overview' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-500" />Volume by Category</h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={18}>
                            {stats.map((e, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2"><LayoutDashboard className="w-5 h-5 text-emerald-500" />Inventory Health Mix</h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.slice(0, 6)} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={8} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {stats.map((e, i) => <Cell key={`p-${i}`} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"><h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Category Deep-Dive</h3></div>
                    <div className="overflow-x-auto"><table className="w-full text-left">
                      <thead><tr className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black"><th className="px-8 py-5">Category</th><th className="px-8 py-5">Unique SKUs</th><th className="px-8 py-5">On-Hand Total</th><th className="px-8 py-5">Inventory Status</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{stats.map((s, i) => (
                        <tr key={s.name} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-8 py-5"><div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} /><span className="font-bold text-slate-700">{s.name}</span></div></td>
                          <td className="px-8 py-5 text-slate-500 font-medium">{s.count} parts</td>
                          <td className="px-8 py-5 text-slate-500 font-medium">{s.totalQty} units</td>
                          <td className="px-8 py-5"><span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${s.totalQty > 20 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{s.totalQty > 20 ? 'Stock Healthy' : 'Action Required'}</span></td>
                        </tr>
                      ))}</tbody></table></div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between bg-slate-50/30">
                    <div className="relative flex-1">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" placeholder="Search SKU, name, or keywords..." className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="relative min-w-[240px]">
                      <Filter className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select className="w-full pl-12 pr-10 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none transition-all text-sm font-bold text-slate-700" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                        <option value="All">All Categories</option>
                        {Object.values(ItemCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="overflow-x-auto min-h-[500px]">
                    <table className="w-full text-left table-fixed">
                      <thead><tr className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black"><th className="px-8 py-6 w-40">Code</th><th className="px-8 py-6">Description</th><th className="px-8 py-6 w-60">Category Classification</th><th className="px-8 py-6 w-32 text-right">Qty</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{paginatedItems.map(item => (
                        <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                          <td className="px-8 py-5 font-mono text-[11px] text-indigo-600 font-black tracking-tight">{item.code}</td>
                          <td className="px-8 py-5"><p className="text-sm font-bold text-slate-800 line-clamp-2 leading-relaxed">{item.description}</p></td>
                          <td className="px-8 py-5">
                            <div className="relative group/sel"><select value={item.category} onChange={(e) => handleCategoryChange(item.id, e.target.value as ItemCategory)} className="w-full bg-slate-100 hover:bg-white hover:ring-2 hover:ring-blue-500/20 text-slate-600 text-[11px] font-black uppercase tracking-wider px-3 py-2 rounded-xl appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent hover:border-slate-200">
                                {Object.values(ItemCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              </select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none group-hover/sel:text-blue-500" /></div>
                          </td>
                          <td className={`px-8 py-5 text-right font-black text-sm ${item.qty <= 0 ? 'text-rose-500' : 'text-slate-700'}`}>{item.qty}</td>
                        </tr>
                      ))}</tbody></table>
                  </div>
                  {filteredItems.length > 0 && (
                    <div className="px-8 py-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-6">
                      <p className="text-sm text-slate-500 font-medium">Page <span className="text-slate-900 font-bold">{currentPage}</span> of <span className="text-slate-900 font-bold">{totalPages}</span> ({filteredItems.length} records)</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

const StatCard: React.FC<{title: string; value: number; icon: React.ReactNode; color: string; subtitle?: string}> = ({ title, value, icon, color, subtitle }) => {
  const map:any = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', rose: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600' };
  return (
    <div className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
      <div className="flex items-center justify-between mb-5">
        <div className={`p-4 rounded-2xl ${map[color]} transition-transform group-hover:scale-110`}>{React.cloneElement(icon as any, { className: 'w-7 h-7' })}</div>
        {subtitle && <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{subtitle}</span>}
      </div>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1.5">{title}</p>
      <p className="text-4xl font-black text-slate-800 tracking-tight">{value.toLocaleString()}</p>
    </div>
  );
};

export default App;