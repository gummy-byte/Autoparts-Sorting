import React from 'react';
import { Menu, Plus, Download, FileUp } from 'lucide-react';
import { InventoryItem } from '../types';

interface HeaderProps {
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  activeTab: 'overview' | 'inventory';
  openAddModal: (type: 'category' | 'zone' | 'zone2' | 'new_item', mode: 'single' | 'bulk', id?: string) => void;
  setIsExportModalOpen: (isOpen: boolean) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  items: InventoryItem[];
}

const Header: React.FC<HeaderProps> = ({ setIsMobileMenuOpen, activeTab, openAddModal, setIsExportModalOpen, handleFileSelect, items }) => {
  return (
    <header className="bg-white/70 backdrop-blur-xl border border-white rounded-[1.5rem] sm:rounded-[2rem] px-4 sm:px-6 py-3 sm:py-5 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-5 shadow-sm mb-4 sm:mb-6 flex-shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-pink-50 hover:text-pink-600 rounded-xl transition-colors"><Menu className="w-6 h-6" /></button>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{activeTab === 'overview' ? 'Real-time Stats' : 'Manage Stock'}</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            {activeTab === 'inventory' && (
                <button onClick={() => openAddModal('new_item', 'single')} className="px-4 py-3 bg-pink-100 text-pink-600 rounded-2xl hover:bg-pink-200 transition-all font-black text-sm flex items-center gap-2 shadow-sm border border-pink-200">
                    <Plus className="w-4 h-4" /> Add Item
                </button>
            )}
            <button onClick={() => setIsExportModalOpen(true)} disabled={items.length === 0} className="px-3 sm:px-4 py-2 sm:py-3 bg-white border border-slate-200 hover:border-pink-300 hover:bg-pink-50 text-slate-700 hover:text-pink-600 rounded-xl sm:rounded-2xl transition-all font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm disabled:opacity-50 whitespace-nowrap"><Download className="w-3.5 sm:w-4 h-3.5 sm:h-4" /><span className="hidden sm:inline">Export</span></button>
             <label className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-slate-900 hover:bg-pink-600 text-white rounded-xl sm:rounded-2xl cursor-pointer transition-all shadow-xl shadow-slate-900/10 font-bold text-xs sm:text-sm whitespace-nowrap">
              <FileUp className="w-3.5 sm:w-4 h-3.5 sm:h-4" /><span className="hidden sm:inline">Import</span> <input type="file" className="hidden" accept=".csv" onChange={handleFileSelect} />
            </label>
          </div>
        </header>
  );
};

export default Header;
