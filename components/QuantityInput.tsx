import React, { useState, useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

interface QuantityInputProps {
  value: number;
  onChange: (newValue: number) => void;
  className?: string;
}

const QuantityInput: React.FC<QuantityInputProps> = ({ value, onChange, className }) => {
  // Local state for the input value to support uncommitted typing
  const [localValue, setLocalValue] = useState(value.toString());
  // Track if we are currently editing to prevent external updates from overriding typing
  const [isEditing, setIsEditing] = useState(false);

  // Sync with prop updates, but ONLY if not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value.toString());
    }
  }, [value, isEditing]);

  const commitChange = () => {
    const parsed = parseInt(localValue);
    if (!isNaN(parsed) && parsed !== value) {
      onChange(parsed);
    } else {
        // Revert invalid input
        setLocalValue(value.toString());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const increment = () => {
      const newVal = value + 1;
      onChange(newVal);
      setLocalValue(newVal.toString());
  };

  const decrement = () => {
      const newVal = Math.max(0, value - 1);
      onChange(newVal);
      setLocalValue(newVal.toString());
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button onClick={decrement} className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-100 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors">
        <Minus className="w-3 h-3" />
      </button>
      <input 
        type="number" 
        value={localValue}
        onFocus={() => setIsEditing(true)}
        onBlur={commitChange}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`w-14 bg-transparent text-right font-black text-xs outline-none focus:bg-pink-50 rounded px-1 transition-all ${parseInt(localValue) <= 0 ? 'text-rose-500' : 'text-slate-800'} ${className || ''}`}
      />
      <button onClick={increment} className="p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 border border-slate-200 transition-colors">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};

export default QuantityInput;
