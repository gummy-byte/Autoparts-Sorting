import React, { useState, useEffect } from 'react';
import { X, Plus, Tag, MapPin } from 'lucide-react';
import { InventoryItem } from '../types';

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalType: 'category' | 'zone' | 'zone2' | 'new_item';
  onConfirm: (name: string, itemData?: any) => void;
  availableCategories: string[];
}

const AddModal: React.FC<AddModalProps> = ({ isOpen, onClose, modalType, onConfirm, availableCategories }) => {
  const [name, setName] = useState("");
  const [itemData, setItemData] = useState({ code: '', description: '', category: '', zone: 'Unassigned', zone2: 'Unassigned', qty: 0 });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setItemData({ 
        code: '', 
        description: '', 
        category: availableCategories[0] || '', 
        zone: 'Unassigned', 
        zone2: 'Unassigned', 
        qty: 0 
      });
    }
  }, [isOpen, availableCategories]);

  const handleConfirm = () => {
      onConfirm(name, itemData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
       <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-pink-100">
         <div className="flex justify-between items-center mb-6">
           <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
             {modalType === 'new_item' ? <Plus className="w-5 h-5 text-pink-500" /> : modalType === 'category' ? <Tag className="w-5 h-5 text-pink-500" /> : <MapPin className="w-5 h-5 text-pink-500" />}
             {modalType === 'new_item' ? 'Add New Item' : `New ${modalType === 'category' ? 'Category' : 'Zone'}`}
           </h3>
           <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50"><X className="w-5 h-5" /></button>
         </div>
         
         {modalType === 'new_item' ? (
           <div className="space-y-4">
             <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">SKU / Part Code</label><input type="text" className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-pink-500 font-bold text-slate-800" value={itemData.code} onChange={(e) => setItemData({...itemData, code: e.target.value})} /></div>
             <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</label><input type="text" className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-pink-500 font-bold text-slate-800" value={itemData.description} onChange={(e) => setItemData({...itemData, description: e.target.value})} /></div>
             <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                    <select className="w-full px-3 py-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-pink-500 font-bold text-slate-800 appearance-none" value={itemData.category} onChange={(e) => setItemData({...itemData, category: e.target.value})}>
                        {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Initial Qty</label>
                    <input type="number" className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-pink-500 font-bold text-slate-800" value={itemData.qty} onChange={(e) => setItemData({...itemData, qty: parseInt(e.target.value) || 0})} />
                </div>
             </div>
           </div>
         ) : (
           <div className="mb-6">
             <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Name</label>
             <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleConfirm()} placeholder={`e.g., ${modalType === 'category' ? 'Transmission' : 'Zone D'}`} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500/20 focus:border-pink-50 outline-none font-bold text-slate-800" />
           </div>
         )}

         <div className="flex gap-3 mt-8">
           <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-sm">Cancel</button>
           <button onClick={handleConfirm} className="flex-[2] py-3 bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-600/20 hover:bg-pink-700 text-sm">{modalType === 'new_item' ? 'Add Item' : 'Create & Apply'}</button>
         </div>
       </div>
    </div>
  );
};

export default AddModal;
