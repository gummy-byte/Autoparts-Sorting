import React from 'react';
import { Settings2 } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  passwordInput: string;
  setPasswordInput: (value: string) => void;
  verifyPasswordAndUpload: () => void;
  setPendingCSVContent: (content: string | null) => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onClose, passwordInput, setPasswordInput, verifyPasswordAndUpload, setPendingCSVContent }) => {
  if (!isOpen) return null;

  const handleCancel = () => {
    onClose();
    setPendingCSVContent(null);
    setPasswordInput("");
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in">
       <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl border border-pink-100">
         <div className="bg-pink-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6 text-pink-600">
            <Settings2 className="w-7 h-7" />
         </div>
         <h3 className="text-xl font-black text-slate-800 mb-2 text-center">Admin Access Required</h3>
         <p className="text-center text-slate-500 text-sm font-medium mb-6">Enter password to upload & overwrite data.</p>
         
         <input autoFocus type="password" placeholder="Enter Password..." className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none border border-slate-200 focus:border-pink-500 font-bold text-slate-800 text-center text-lg mb-6" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verifyPasswordAndUpload()} />

         <div className="flex gap-3">
           <button onClick={handleCancel} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
           <button onClick={verifyPasswordAndUpload} className="flex-[1.5] py-3 bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-600/20 hover:bg-pink-700">Unlock & Upload</button>
         </div>
       </div>
    </div>
  );
};

export default PasswordModal;
