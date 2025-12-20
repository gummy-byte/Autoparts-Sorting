
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
  Share
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
import { GoogleGenAI, Type } from "@google/genai";
import { InventoryItem, ItemCategory, CategoryStat } from './types';
import { classifyItem } from './utils/classifier';

// Pinkish theme colors for charts
const COLORS = [
  '#ec4899', '#d946ef', '#f43f5e', '#fb7185', '#be185d', 
  '#9d174d', '#db2777', '#f472b6', '#fda4af', '#fce7f3'
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
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
      alert("AI categorization failed. Check your API key.");
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
    <div className="h-screen w-full flex flex-col md:flex-row bg-[#fff1f5] font-['Inter'] overflow-hidden">
      {/* Settings Modal */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pink-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200 border border-pink-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-pink-800 flex items-center gap-2"><Github className="w-6 h-6" />GitHub Sync</h3>
              <button onClick={() => setIsSyncModalOpen(false)} className="text-pink-300 hover:text-pink-600"><AlertCircle className="w-5 h-5 rotate-45" /></button>
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

      {/* Floating Sidebar Design */}
      <aside className="w-full md:w-80 p-6 flex-shrink-0 flex flex-col">
        <div className="flex-1 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative border border-white/5">
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
              <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'overview' ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xl shadow-pink-600/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                <LayoutDashboard className="w-5 h-5" /> <span className="font-semibold text-sm">Dashboard</span>
              </button>
              <button onClick={() => setActiveTab('inventory')} className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'inventory' ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-xl shadow-pink-600/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                <ListFilter className="w-5 h-5" /> <span className="font-semibold text-sm">Inventory</span>
              </button>
            </nav>
          </div>

          <div className="mt-auto p-8 space-y-4 bg-white/5 backdrop-blur-md">
            <button 
              onClick={refineWithAI} 
              disabled={items.length === 0 || isAiRunning}
              className={`w-full group flex items-center justify-center gap-3 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${isAiRunning ? 'bg-pink-700 animate-pulse' : 'bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:scale-[1.03] shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40'} text-white disabled:opacity-50`}
            >
              {isAiRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-pink-200 group-hover:rotate-12 transition-transform" />}
              {isAiRunning ? 'Thinking...' : 'AI Categorize'}
            </button>
            
            <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] text-pink-400 uppercase tracking-[0.2em] font-black">Sync Engine</p>
                <button onClick={() => setIsSyncModalOpen(true)} className="p-1.5 hover:bg-white/10 rounded-xl transition-all text-slate-400"><Settings className="w-3.5 h-3.5" /></button>
              </div>
              <button onClick={syncToGitHub} disabled={items.length === 0 || isSyncing} className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl text-[11px] font-bold transition-all ${syncStatus === 'success' ? 'bg-emerald-500' : syncStatus === 'error' ? 'bg-rose-500' : 'bg-white/10 hover:bg-white/20'} text-white disabled:opacity-50`}>
                {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : syncStatus === 'success' ? <Check className="w-3.5 h-3.5" /> : <Github className="w-3.5 h-3.5" />}
                {isSyncing ? 'Pushing...' : syncStatus === 'success' ? 'Synced!' : 'Cloud Save'}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 md:pl-0 h-full">
        <div className="h-full flex flex-col">
          <header className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-5 shadow-sm mb-6 flex-shrink-0">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{activeTab === 'overview' ? 'Real-time Stats' : 'Manage Stock'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">AI Categorization Active</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleLoadSample} className="px-5 py-3 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-2xl transition-all font-bold text-sm flex items-center gap-2 border border-pink-100 shadow-sm"><RefreshCw className="w-4 h-4" />Sample</button>
              <button onClick={exportToCSV} disabled={items.length === 0} className="px-5 py-3 bg-white border border-slate-200 hover:border-pink-300 hover:bg-pink-50 text-slate-700 hover:text-pink-600 rounded-2xl transition-all font-bold text-sm flex items-center gap-2 shadow-sm disabled:opacity-50"><Download className="w-4 h-4" />Export CSV</button>
              <label className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-pink-600 text-white rounded-2xl cursor-pointer transition-all shadow-xl shadow-slate-900/10 font-bold text-sm">
                <FileUp className="w-4 h-4" />Import <input type="file" className="hidden" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (e) => processCSV(e.target?.result as string); r.readAsText(f); } }} />
              </label>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-6">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-full text-center max-w-xl mx-auto px-6">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-pink-500 blur-3xl opacity-20 animate-pulse"></div>
                  <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl border border-pink-50"><Sparkles className="w-12 h-12 text-pink-500" /></div>
                </div>
                <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Organize Your Inventory with AI</h3>
                <p className="text-slate-500 mb-10 leading-relaxed text-lg font-medium">Upload a messy CSV of automotive parts. Gemini AI will scan part numbers and descriptions to categorize them automatically.</p>
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <button onClick={handleLoadSample} className="px-8 py-4 bg-white border-2 border-slate-100 text-slate-700 font-black rounded-[1.5rem] hover:border-pink-200 hover:bg-pink-50 transition-all shadow-md">Try with Sample Data</button>
                  <label className="px-8 py-4 bg-pink-600 text-white font-black rounded-[1.5rem] hover:bg-pink-700 transition-all shadow-xl shadow-pink-600/20 cursor-pointer text-center">Upload CSV File <input type="file" className="hidden" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (e) => processCSV(e.target?.result as string); r.readAsText(f); } }} /></label>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <StatCard title="Unique SKUs" value={items.length} icon={<Package />} color="pink" />
                  <StatCard title="Total Inventory" value={items.reduce((a,b)=>a+b.qty, 0)} icon={<BarChart3 />} color="rose" />
                  <StatCard title="Stock Alerts" value={items.filter(i=>i.qty<=0).length} icon={<AlertCircle />} color="fuchsia" subtitle="Low Qty" />
                  <StatCard title="Segments" value={stats.length} icon={<Filter />} color="rose" />
                </div>

                {activeTab === 'overview' ? (
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
                ) : (
                  <div className="bg-white rounded-[2.5rem] border border-white shadow-xl shadow-pink-900/5 overflow-hidden flex flex-col h-full">
                    <div className="p-8 border-b border-pink-50 flex flex-col sm:flex-row gap-5 justify-between bg-pink-50/10 flex-shrink-0">
                      <div className="relative flex-1 group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-pink-500 transition-colors" />
                        <input type="text" placeholder="Search part codes, names..." className="w-full pl-14 pr-8 py-5 bg-white border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 outline-none transition-all text-sm font-bold shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      </div>
                      <div className="relative min-w-[280px]">
                        <Filter className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select className="w-full pl-14 pr-12 py-5 bg-white border-2 border-slate-100 rounded-[1.5rem] focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 outline-none appearance-none transition-all text-sm font-black text-slate-700 shadow-sm" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                          <option value="All">All Categories</option>
                          {Object.values(ItemCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left table-fixed min-w-[800px]">
                        <thead className="sticky top-0 bg-white z-10"><tr className="text-slate-400 text-[10px] uppercase tracking-[0.3em] font-black border-b border-pink-50 shadow-sm"><th className="px-10 py-7 w-48">SKU Code</th><th className="px-10 py-7">Description</th><th className="px-10 py-7 w-64">AI Label</th><th className="px-10 py-7 w-32 text-right">Qty</th></tr></thead>
                        <tbody className="divide-y divide-pink-50">{paginatedItems.map(item => (
                          <tr key={item.id} className="hover:bg-pink-50/20 transition-colors group">
                            <td className="px-10 py-6 font-mono text-[11px] text-pink-600 font-black tracking-tight">{item.code}</td>
                            <td className="px-10 py-6"><p className="text-sm font-bold text-slate-800 line-clamp-2 leading-relaxed">{item.description}</p></td>
                            <td className="px-10 py-6">
                              <div className="relative group/sel">
                                <select value={item.category} onChange={(e) => handleCategoryChange(item.id, e.target.value as ItemCategory)} className="w-full bg-pink-50/50 hover:bg-white hover:ring-2 hover:ring-pink-500/20 text-pink-700 text-[11px] font-black uppercase tracking-wider px-4 py-2.5 rounded-2xl appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all border border-transparent hover:border-pink-100 shadow-sm">
                                  {Object.values(ItemCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-pink-400 pointer-events-none group-hover/sel:text-pink-600" />
                              </div>
                            </td>
                            <td className={`px-10 py-6 text-right font-black text-sm ${item.qty <= 0 ? 'text-rose-500' : 'text-slate-800'}`}>{item.qty}</td>
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
