import React from 'react';
import { X, ChevronDown } from 'lucide-react';

interface BulkActionBarProps {
  selectedItems: Set<string>;
  setSelectedItems: (items: Set<string>) => void;
  availableCategories: string[];
  availableZones: string[];
  handleBulkFieldChange: (field: 'category' | 'zone' | 'zone2' | 'qty', value: string | number) => void;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({ selectedItems, setSelectedItems, availableCategories, availableZones, handleBulkFieldChange }) => {
  if (selectedItems.size === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-4 sm:gap-6 border border-white/10 pr-6 overflow-x-auto max-w-[95vw]">
        <div className="bg-pink-600 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider whitespace-nowrap">
          {selectedItems.size} Selected
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest hidden sm:inline">Bulk Edit:</span>
          <div className="flex gap-2">
            <div className="relative">
              <select className="appearance-none bg-slate-800 border border-slate-700 hover:border-pink-500 rounded-xl px-4 py-2 pr-8 text-[10px] sm:text-xs font-bold outline-none cursor-pointer min-w-[80px]" onChange={(e) => handleBulkFieldChange('category', e.target.value)} value="">
                  <option value="" disabled>Cat...</option>
                  {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select className="appearance-none bg-slate-800 border border-slate-700 hover:border-pink-500 rounded-xl px-4 py-2 pr-8 text-[10px] sm:text-xs font-bold outline-none cursor-pointer min-w-[80px]" onChange={(e) => handleBulkFieldChange('zone', e.target.value)} value="">
                  <option value="" disabled>Zone 1...</option>
                  {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                  <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1 text-white">
                <span className="text-[9px] font-black uppercase text-slate-500">Qty</span>
                <input 
                    type="number" 
                    placeholder="Set" 
                    className="bg-transparent w-10 text-xs font-bold outline-none border-b border-white/20 focus:border-pink-500" 
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleBulkFieldChange('qty', (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }}
                />
            </div>
          </div>
        </div>
        <button onClick={() => setSelectedItems(new Set())} className="ml-2 p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default BulkActionBar;
