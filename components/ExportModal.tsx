import React from 'react';
import { X, FileText, FileSpreadsheet, Download } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportFormat: 'standard' | 'categorized';
  setExportFormat: (format: 'standard' | 'categorized') => void;
  handleDownload: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, exportFormat, setExportFormat, handleDownload }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl border border-pink-100 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6 sm:mb-8">
          <div><h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Export Inventory</h3><p className="text-slate-500 text-xs sm:text-sm font-medium">Select your preferred file format</p></div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X className="w-5 sm:w-6 h-5 sm:h-6 text-slate-400" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button onClick={() => setExportFormat('standard')} className={`relative p-4 sm:p-6 rounded-2xl border-2 text-left transition-all ${exportFormat === 'standard' ? 'border-pink-500 bg-pink-50/50' : 'border-slate-100 hover:bg-slate-50'}`}>
            <FileText className={`w-8 sm:w-10 h-8 sm:h-10 mb-3 sm:mb-4 ${exportFormat === 'standard' ? 'text-pink-500' : 'text-slate-300'}`} />
            <h4 className="font-black text-xs sm:text-sm uppercase tracking-wide mb-1 sm:mb-2">Standard CSV</h4>
            <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Flat list format including both Zone fields and updated quantities.</p>
          </button>
          <button onClick={() => setExportFormat('categorized')} className={`relative p-4 sm:p-6 rounded-2xl border-2 text-left transition-all ${exportFormat === 'categorized' ? 'border-pink-500 bg-pink-50/50' : 'border-slate-100 hover:bg-slate-50'}`}>
            <FileSpreadsheet className={`w-8 sm:w-10 h-8 sm:h-10 mb-3 sm:mb-4 ${exportFormat === 'categorized' ? 'text-pink-500' : 'text-slate-300'}`} />
            <h4 className="font-black text-xs sm:text-sm uppercase tracking-wide mb-1 sm:mb-2">Categorized Excel</h4>
            <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">Formatted report with all zones and quantities listed.</p>
          </button>
        </div>
        <div className="flex gap-3 sm:gap-4 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-xs sm:text-sm">Cancel</button>
          <button onClick={handleDownload} className="flex-[2] py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm">
            <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4" /> Download File
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
