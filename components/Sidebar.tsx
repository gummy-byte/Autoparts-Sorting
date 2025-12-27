import React from 'react';
import { X, Package, LayoutDashboard, ListFilter, Database } from 'lucide-react';

interface SidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  activeTab: 'overview' | 'inventory';
  handleTabChange: (tab: 'overview' | 'inventory') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isMobileMenuOpen, setIsMobileMenuOpen, activeTab, handleTabChange }) => {
  return (
    <>
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-pink-900/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}/>
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
              <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-pink-200">Quick Management</h1>
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
            {/* Supabase Status */}
            <div className={`p-4 rounded-2xl border transition-all bg-emerald-900/20 border-emerald-500/30`}>
              <div className="flex justify-between items-center mb-1">
                <p className="text-[10px] text-emerald-400 uppercase tracking-[0.2em] font-black flex items-center gap-1.5"><Database className="w-3 h-3" /> Realtime DB</p>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse box-shadow-emerald-500/50" />
              </div>
              <p className="text-[9px] text-slate-400 mt-2 font-medium">Connected & Syncing Automatically</p>
            </div>
            <div className="flex justify-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black flex items-center gap-1.5">Created by <a href="https://syamim.design/" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Syamim</a> with ❤️</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
