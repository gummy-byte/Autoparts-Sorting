
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
  CheckCircle2,
  Download,
  ChevronLeft,
  ChevronRight
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
import { InventoryItem, ItemCategory, CategoryStat } from './types';
import { classifyItem } from './utils/classifier';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#64748b', '#14b8a6',
  '#a855f7', '#6366f1', '#fbbf24', '#f43f5e'
];

const ITEMS_PER_PAGE = 15;

/**
 * Robust CSV Line Parser that handles quoted values containing commas
 */
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

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  const processCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    let qtyIdx = -1;
    let codeIdx = -1;
    let descIdx = -1;
    let headerLineIdx = -1;

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const parts = parseCSVLine(lines[i]).map(p => p.toLowerCase());
      const foundQty = parts.findIndex(p => p.includes('qty') || p.includes('quantity') || p === 'q');
      const foundCode = parts.findIndex(p => p.includes('code') || p.includes('part') || p.includes('sku'));
      const foundDesc = parts.findIndex(p => p.includes('desc') || p.includes('item') || p.includes('name'));

      if ((foundQty !== -1 && foundCode !== -1) || (foundQty !== -1 && foundDesc !== -1) || (foundCode !== -1 && foundDesc !== -1)) {
        qtyIdx = foundQty;
        codeIdx = foundCode;
        descIdx = foundDesc;
        headerLineIdx = i;
        break;
      }
    }

    if (headerLineIdx === -1) {
      qtyIdx = 0; codeIdx = 1; descIdx = 2;
      headerLineIdx = -1;
    }

    const parsedItems: InventoryItem[] = [];
    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const parts = parseCSVLine(lines[i]);
      if (parts.length < 2) continue;

      const qtyStr = qtyIdx !== -1 ? parts[qtyIdx] : "0";
      const code = codeIdx !== -1 ? parts[codeIdx] : "N/A";
      const description = descIdx !== -1 ? parts[descIdx] : "No Description";
      const qty = parseInt(qtyStr.replace(/[^0-9-]/g, '')) || 0;
      
      parsedItems.push({
        id: `${code}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        qty,
        code: code || "UNKNOWN",
        description: description || "Untitled Part",
        category: classifyItem(description)
      });
    }
    setItems(parsedItems);
  };

  const handleCategoryChange = (id: string, newCategory: ItemCategory) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, category: newCategory } : item
    ));
  };

  const exportToCSV = () => {
    if (items.length === 0) return;
    
    const headers = ["Quantity", "Code", "Description", "Category"];
    const rows = items.map(item => [
      item.qty,
      `"${item.code.replace(/"/g, '""')}"`,
      `"${item.description.replace(/"/g, '""')}"`,
      `"${item.category}"`
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `categorized_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadSample = () => {
    const sampleData = `Qty,Code,Item Description
2,(AC) 315143,BLOWER MOTOR TOYOTA UNSER/AVANZA (RL)
0,(AC)2850,CABIN FILTER TOYOTA INNOVA/ESTIMA
15,(AC)CFMY,CABIN FILTER PERODUA ALZA/MYVI BEST/AXIA (120010)
0,03C115561J,OIL FILTER VOLKSWAGEN/AUDI /GOLF/A1/A3
1,2105,CVT OIL TOYOTA TC 4L INC L.C
7,11193-97201,PLUG SEAL SET KELISA 1.0
4,11427508969,OIL FILTER BMW E46 2.0
2,08269-P9908ZT3,CVT OIL HONDA CVTF 3.5L INC L.C
1,11302-87Z03,TIMING COVER PERODUA MYVI KENARI KELISA INC L.C
3,17220-RNA-000,AIR FILTER HONDA CIVIC 1.8
1,17801-0C010,AIR FILTER TOYOTA HI-LUX/INNOVA/KUN26/GUN125 INC L.C
-2,0986AB8001C,BRAKE PUMP (R) PERODUA MYVI INC L.C-BOSCH
5,33490-B1030-G,OIL COOLER ASSY PERODUA AXIA,BEZZA ORIGINAL
8,3530397501,AUTO FILTER PERODUA MYVI LB/ALZA/AXIA/BEZZA INC L.C
2,35303-87408,AUTO FILTER PERODUA KEMBARA OLD INC L.C
2,A608A1,IGNITION COIL PLUG PROTON PERDANA INC LC
4,BKR5E-11,SPARK PLUG PERODUA KENARI/KELISA/VIVA BKR5E-11 -NGK- 3PCS INC L.C
6,GDB7707,BRAKE PAD (F) PROTON SAGA BLM/FLX INC L.C -TRW-
10,7615,LIQUI MOLY FULLY SYNTHETIC SPECIAL TEC AA 5W30 - 1L (EO)
58,9004K-10000,AUTO TRANS FLUID ATF PERODUA D3-SP`;
    processCSV(sampleData);
  };

  const stats: CategoryStat[] = useMemo(() => {
    const map = new Map<ItemCategory, { count: number; totalQty: number }>();
    items.forEach(item => {
      const current = map.get(item.category) || { count: 0, totalQty: 0 };
      map.set(item.category, {
        count: current.count + 1,
        totalQty: current.totalQty + item.qty
      });
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, selectedCategory]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const totalStock = items.reduce((acc, item) => acc + item.qty, 0);
  const outOfStock = items.filter(i => i.qty <= 0).length;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-500 p-2 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">AutoParts AI</h1>
          </div>

          <nav className="space-y-1">
            <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">Overview</span>
            </button>
            <button onClick={() => setActiveTab('inventory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'inventory' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <ListFilter className="w-5 h-5" />
              <span className="font-medium">Inventory</span>
            </button>
          </nav>
        </div>

        <div className="mt-auto p-6">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">Management Tools</p>
            <button 
              onClick={exportToCSV}
              disabled={items.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all"
            >
              <Download className="w-3 h-3" />
              Export Data
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'overview' ? 'Dashboard Summary' : 'Inventory Management'}
            </h2>
            <p className="text-slate-500 text-sm">Review, Edit, and Export Inventory</p>
          </div>

          <div className="flex items-center gap-3">
             <button 
              onClick={handleLoadSample}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-medium text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Load Sample
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition-all shadow-md font-medium text-sm">
              <FileUp className="w-4 h-4" />
              Upload CSV
              <input type="file" className="hidden" accept=".csv" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => processCSV(e.target?.result as string);
                  reader.readAsText(file);
                }
              }} />
            </label>
          </div>
        </header>

        <div className="p-8">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-lg mx-auto">
              <div className="bg-blue-50 p-6 rounded-full mb-6">
                <FileUp className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Automotive Categorization</h3>
              <p className="text-slate-500 mb-8">Upload your CSV to instantly organize cabin filters, oil filters, brake pads, and more with our intelligent parsing engine.</p>
              <button onClick={handleLoadSample} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-2xl hover:bg-slate-50 transition-all shadow-sm">
                Try Sample Data
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Total Items" value={items.length} icon={<Package className="text-blue-500" />} color="blue" />
                <StatCard title="Total Stock Qty" value={totalStock} icon={<BarChart3 className="text-emerald-500" />} color="emerald" />
                <StatCard title="Out of Stock" value={outOfStock} icon={<AlertCircle className="text-rose-500" />} color="rose" subtitle="Qty ≤ 0" />
                <StatCard title="Categories" value={stats.length} icon={<Filter className="text-amber-500" />} color="amber" />
              </div>

              {activeTab === 'overview' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                      Items per Category
                    </h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.slice(0, 8)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                          <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {stats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <LayoutDashboard className="w-5 h-5 text-emerald-500" />
                      Distribution Summary
                    </h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.slice(0, 6)}
                            cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                            paddingAngle={5} dataKey="count"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {stats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider">Top Performing Categories</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-slate-400 text-[11px] uppercase tracking-widest font-bold">
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Unique Parts</th>
                            <th className="px-6 py-4">Total Quantity</th>
                            <th className="px-6 py-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stats.map((stat, idx) => (
                            <tr key={stat.name} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                  <span className="font-semibold text-slate-700">{stat.name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600 font-medium">{stat.count} items</td>
                              <td className="px-6 py-4 text-slate-600 font-medium">{stat.totalQty} units</td>
                              <td className="px-6 py-4">
                                <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${stat.totalQty > 20 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                  {stat.totalQty > 20 ? 'Optimal' : 'Low Stock'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between bg-slate-50/30">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search by code or description..."
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="relative min-w-[200px]">
                      <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select 
                        className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none transition-all text-sm font-medium"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      >
                        <option value="All">All Categories</option>
                        {Object.values(ItemCategory).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="overflow-x-auto min-h-[500px]">
                    <table className="w-full text-left table-fixed">
                      <thead>
                        <tr className="text-slate-400 text-[11px] uppercase tracking-widest font-bold">
                          <th className="px-8 py-5 w-40">Code</th>
                          <th className="px-8 py-5">Item Description</th>
                          <th className="px-8 py-5 w-56">Category</th>
                          <th className="px-8 py-5 w-32 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedItems.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-8 py-4 font-mono text-[11px] text-blue-600 font-bold break-all">{item.code}</td>
                            <td className="px-8 py-4">
                              <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">{item.description}</p>
                            </td>
                            <td className="px-8 py-4">
                              <div className="relative group/select">
                                <select 
                                  value={item.category}
                                  onChange={(e) => handleCategoryChange(item.id, e.target.value as ItemCategory)}
                                  className="w-full bg-slate-100 hover:bg-white hover:ring-2 hover:ring-blue-500/20 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all border border-transparent hover:border-slate-200"
                                >
                                  {Object.values(ItemCategory).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none group-hover/select:text-blue-500" />
                              </div>
                            </td>
                            <td className={`px-8 py-4 text-right font-bold text-sm ${item.qty <= 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                              {item.qty}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {filteredItems.length > 0 && (
                    <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-sm text-slate-500 font-medium">
                        Showing <span className="text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)}</span> of <span className="text-slate-900">{filteredItems.length}</span> parts
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        
                        <div className="flex items-center gap-1">
                          {[...Array(Math.min(5, totalPages))].map((_, i) => {
                            let pageNum = currentPage;
                            if (currentPage <= 3) pageNum = i + 1;
                            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else pageNum = currentPage - 2 + i;
                            
                            if (pageNum > totalPages || pageNum < 1) return null;

                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600'}`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>

                        <button 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRight className="w-5 h-5 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {filteredItems.length === 0 && (
                    <div className="py-20 text-center text-slate-400">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="font-medium">No results matching your current search or filter.</p>
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

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'emerald' | 'rose' | 'amber';
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subtitle }) => {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    rose: 'bg-rose-50 border-rose-100 text-rose-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colorMap[color]} transition-transform group-hover:scale-110`}>
          {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
        </div>
        {subtitle && <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{subtitle}</span>}
      </div>
      <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
      <p className="text-3xl font-black text-slate-800">{value.toLocaleString()}</p>
    </div>
  );
};

export default App;
