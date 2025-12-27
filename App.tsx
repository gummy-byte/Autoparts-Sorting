import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Settings2, 
  Loader2, 
  Check, 
  Sparkles, 
  Search, 
  MapPin, 
  Eye, 
  EyeOff, 
  Minus,
  Database,
  Plus
} from 'lucide-react';
import { InventoryItem, ItemCategory, CategoryStat } from './types';
import { classifyItem } from './utils/classifier';
import { fetchInventory, saveItem, replaceInventory, subscribeToInventory, saveCategory, saveZone } from './utils/supabase';
import { parseCSVLine } from './utils/csvHelpers';
import { generateStandardCSV, generateCategorizedXLS } from './utils/fileGenerators';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import AddModal from './components/AddModal';
import PasswordModal from './components/PasswordModal';
import ExportModal from './components/ExportModal';
import BulkActionBar from './components/BulkActionBar';
import QuantityInput from './components/QuantityInput';

const UPLOAD_PASSWORD = import.meta.env.VITE_UPLOAD_PASSWORD || 'admin123';

const ITEMS_PER_PAGE = 100;

interface ColumnVisibility {
  category: boolean;
  zone: boolean;
  zone2: boolean;
  qty: boolean;
  description: boolean;
}

const naturalSort = (a: string, b: string) => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

const App: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory'>('overview');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedZone, setSelectedZone] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [availableCategories, setAvailableCategories] = useState<string[]>(Object.values(ItemCategory));
  const [availableZones, setAvailableZones] = useState<string[]>(["Unassigned", "Zone A", "Zone B", "Zone C"]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'category' | 'zone' | 'zone2' | 'new_item'>('category');
  const [modalTarget, setModalTarget] = useState<{ type: 'single' | 'bulk', id?: string } | null>(null);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [pendingCSVContent, setPendingCSVContent] = useState<string | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  
  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    const saved = localStorage.getItem('visible_columns');
    return saved ? JSON.parse(saved) : { category: true, zone: true, zone2: true, qty: true, description: true };
  });
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync & Export State
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCleanupPromptOpen, setIsCleanupPromptOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  // Race Condition Protection: Track pending operations
  const pendingOperations = useRef<Map<string, number>>(new Map());
  const saveTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [exportFormat, setExportFormat] = useState<'standard' | 'categorized'>('standard');
  const [ghConfig, setGhConfig] = useState<{ token: string; repo: string; path: string; branch: string }>(() => {
    const saved = localStorage.getItem('gh_config');
    return saved ? JSON.parse(saved) : { token: '', repo: '', path: 'inventory_categorized.csv', branch: 'main' };
  });

  // Persist GH Config
  useEffect(() => {
    localStorage.setItem('gh_config', JSON.stringify(ghConfig));
  }, [ghConfig]);

  // Initial Fetch & Realtime Subscription
  // Ref for syncing state to access in closure
  const isSyncingRef = useRef(isSyncing);
  useEffect(() => { isSyncingRef.current = isSyncing; }, [isSyncing]);

  useEffect(() => {
    // 1. Fetch Initial Data
    setIsLoading(true);
    fetchInventory().then(data => {
      setItems(data.items);
      const loadedZones = data.zones.length > 0 ? data.zones : ["Zone A", "Zone B", "Zone C"];
      // Ensure 'Unassigned' is consistently available as the first option
      const uniqueZones = Array.from(new Set(["Unassigned", ...loadedZones])).sort(naturalSort);
      // Force "Unassigned" to be at the top if sort moves it
      const finalZones = ["Unassigned", ...uniqueZones.filter(z => z !== "Unassigned")];
      setAvailableZones(finalZones);

      const loadedCategories = data.categories.length > 0 ? data.categories : Object.values(ItemCategory);
      setAvailableCategories(Array.from(new Set(loadedCategories)).sort(naturalSort));
    }).catch(err => console.error("Failed to fetch Supabase data:", err))
      .finally(() => setIsLoading(false));

    // 2. Subscribe to Realtime Changes - OPTIMIZED with race condition protection
    const subscription = subscribeToInventory((payload) => {
        // Prevent self-echo if we are currently handling a bulk sync locally
        if (isSyncingRef.current) return;

        const { eventType, new: newItem, old: oldItem } = payload;

        setItems((prevItems) => {
            if (eventType === 'INSERT') {
                // Prevent duplicate inserts
                if (prevItems.some(i => i.id === newItem.id)) return prevItems;
                return [...prevItems, newItem as InventoryItem];
            } else if (eventType === 'UPDATE') {
                // CRITICAL: Check if we have a pending operation for this item
                const pendingTimestamp = pendingOperations.current.get(newItem.id);
                const serverTimestamp = new Date(newItem.updated_at || 0).getTime();
                
                // If we have a newer pending operation, ignore this server update
                if (pendingTimestamp && pendingTimestamp > serverTimestamp) {
                    console.log(`Ignoring stale server update for ${newItem.id}`);
                    return prevItems;
                }
                
                // Clear pending operation once server confirms
                pendingOperations.current.delete(newItem.id);
                
                return prevItems.map(item => item.id === newItem.id ? (newItem as InventoryItem) : item);
            } else if (eventType === 'DELETE') {
                pendingOperations.current.delete(oldItem.id);
                return prevItems.filter(item => item.id !== oldItem.id);
            }
            return prevItems;
        });
    });

    return () => {
        subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedItems(new Set()); 
    setIsSearching(true);
    const timer = setTimeout(() => setIsSearching(false), 500); // Artificial delay for feedback
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCategory, selectedZone]);

  // Click outside listener for column dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; 
    if (f) { 
        const r = new FileReader(); 
        r.onload = (e) => {
            const content = e.target?.result as string;
            setPendingCSVContent(content);
            setIsPasswordModalOpen(true);
        }; 
        r.readAsText(f); 
    }
  };

  const verifyPasswordAndUpload = async () => {
    if (passwordInput !== UPLOAD_PASSWORD) {
        alert("Incorrect Password!");
        return;
    }
    if (pendingCSVContent) {
        setIsSyncing(true); // Start loading state
        setSyncStatus('syncing');
        try {
            await processCSV(pendingCSVContent);
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            console.error(e);
            setSyncStatus('error');
            alert("Upload failed. Please check console.");
        } finally {
            setIsSyncing(false); // End loading state
            setPendingCSVContent(null);
            setIsPasswordModalOpen(false);
            setPasswordInput("");
            
            // Do one final fetch to ensure we correspond with server state
            fetchInventory().then(data => {
                setItems(data.items);
                setAvailableCategories(data.categories);
                setAvailableZones(data.zones);
            });
        }
    }
  };

  const processCSV = async (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return;

    let qtyIdx = -1, codeIdx = -1, descIdx = -1, catIdx = -1, zoneIdx = -1, zone2Idx = -1, headerLineIdx = -1;
    
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
        // Use imported parseCSVLine
      const parts = parseCSVLine(lines[i]).map(p => p.toLowerCase());
      const fQty = parts.findIndex(p => p.includes('qty') || p.includes('quantity') || p === 'q');
      const fCode = parts.findIndex(p => p.includes('code') || p.includes('part') || p.includes('sku'));
      const fDesc = parts.findIndex(p => p.includes('desc') || p.includes('item') || p.includes('name'));
      const fCat = parts.findIndex(p => p.includes('category') || p.includes('type') || p.includes('group') || p === 'cat');
      
      const fZone = parts.findIndex(p => 
          (p.includes('zone') || p.includes('location') || p.includes('bin') || p.includes('shelf') || p.includes('rack')) 
          && (!p.includes('2') && !p.includes('two') && !p.includes('secondary'))
      );
      
      const fZone2 = parts.findIndex(p => 
          (p.includes('zone') || p.includes('location') || p.includes('bin') || p.includes('shelf') || p.includes('rack')) 
          && (p.includes('2') || p.includes('two') || p.includes('secondary'))
      );

      if ((fQty !== -1 && fCode !== -1) || (fQty !== -1 && fDesc !== -1) || (fCode !== -1 && fDesc !== -1)) {
        qtyIdx = fQty; codeIdx = fCode; descIdx = fDesc; catIdx = fCat; zoneIdx = fZone; zone2Idx = fZone2; headerLineIdx = i; break;
      }
    }

    if (headerLineIdx === -1) { 
      qtyIdx = 0; codeIdx = 1; descIdx = 2; headerLineIdx = -1; 
    }

    const parsedItems: InventoryItem[] = [];
    const newCategories = new Set<string>();
    const newZones = new Set<string>();

    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const parts = parseCSVLine(lines[i]);
      if (parts.length < 2) continue;
      const qty = parseInt((qtyIdx !== -1 ? parts[qtyIdx] : "0").replace(/[^0-9-]/g, '')) || 0;
      const code = codeIdx !== -1 ? parts[codeIdx] : "N/A";
      const description = descIdx !== -1 ? parts[descIdx] : "No Description";
      
      let category = "";
      if (catIdx !== -1 && parts[catIdx]) {
        category = parts[catIdx].trim();
      }

      let zone = "Unassigned";
      if (zoneIdx !== -1 && parts[zoneIdx]) {
        zone = parts[zoneIdx].trim();
      }

      let zone2 = "Unassigned";
      if (zone2Idx !== -1 && parts[zone2Idx]) {
        zone2 = parts[zone2Idx].trim();
      }

      if (!category || category.toLowerCase() === 'null') {
        category = classifyItem(description);
        newCategories.add(category); // Fix: Add auto-classified category to the set
      } else {
        if (category.trim()) newCategories.add(category.trim());
      }

      if (zone.trim() && zone.toLowerCase() !== 'null' && zone !== 'Unassigned') {
        newZones.add(zone.trim());
      }
      if (zone2.trim() && zone2.toLowerCase() !== 'null' && zone2 !== 'Unassigned') {
        newZones.add(zone2.trim());
      }
      
      parsedItems.push({
        id: `${code}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        qty,
        code: code || "UNKNOWN",
        description: description || "Untitled Part",
        category,
        zone: zone || "Unassigned",
        zone2: zone2 || "Unassigned"
      });
    }

    if (newCategories.size > 0) {
      setAvailableCategories(prev => {
        const combined = new Set([...prev, ...Array.from(newCategories)]);
        return Array.from(combined).sort(naturalSort);
      });
    }

    if (newZones.size > 0) {
      setAvailableZones(prev => {
        const combined = new Set([...prev, ...Array.from(newZones)]);
        const sorted = Array.from(combined).sort(naturalSort);
        // Ensure unassigned is first
        if (sorted.includes('Unassigned')) {
             return ['Unassigned', ...sorted.filter(z => z !== 'Unassigned')];
        }
        return sorted;
      });
    }

    try {
        await replaceInventory(parsedItems, Array.from(newCategories), Array.from(newZones));
        // State update handled by subscription
    } catch(e) {
        console.error("Failed to replace inventory", e);
        alert("Failed to upload data to cloud.");
    }
  };

  const handleClearData = async () => {
   // Deprecated for now, or could map to clearing supabase
   // await replaceInventory([], [], []);
   setItems([]);
  };

  const openAddModal = (type: 'category' | 'zone' | 'zone2' | 'new_item', mode: 'single' | 'bulk', id?: string) => {
    setModalType(type);
    setModalTarget({ type: mode, id });
    setIsAddModalOpen(true);
  };

  const handleConfirmAdd = async (name: string, itemData?: any) => {
    // For local UI immediately (optimistic) - actual source of truth IS Supabase
    if (modalType === 'new_item') {
      if (!itemData || !itemData.code || !itemData.description) return;
      const newItem: InventoryItem = {
        id: `${itemData.code}-${Date.now()}`,
        ...itemData
      };
      saveItem(newItem); // Save to Supabase
      setIsAddModalOpen(false);
      return;
    }

    if (!name.trim()) return;
    const finalName = name.trim();
    
    try {
        // 1. Persist the new definition FIRST
        if (modalType === 'category') {
             await saveCategory(finalName);
             setAvailableCategories(prev => prev.includes(finalName) ? prev : [...prev, finalName].sort(naturalSort));
        } else {
             await saveZone(finalName);
             setAvailableZones(prev => {
                 if (prev.includes(finalName)) return prev;
                 const sorted = [...prev, finalName].sort(naturalSort);
                 if (sorted.includes('Unassigned')) {
                     return ['Unassigned', ...sorted.filter(z => z !== 'Unassigned')];
                 }
                 return sorted;
             });
        }

        // 2. Then update the items
        const updates: Promise<any>[] = [];
        if (modalType === 'category') {
            if (modalTarget?.type === 'bulk') {
                selectedItems.forEach(id => {
                    const item = items.find(i => i.id === id);
                    if(item) updates.push(saveItem({...item, category: finalName}));
                });
            } else if (modalTarget?.id) {
                const item = items.find(i => i.id === modalTarget.id);
                if(item) updates.push(saveItem({...item, category: finalName}));
            }
        } else {
            const fieldToUpdate = modalType === 'zone2' ? 'zone2' : 'zone';
             if (modalTarget?.type === 'bulk') {
                selectedItems.forEach(id => {
                    const item = items.find(i => i.id === id);
                    if(item) updates.push(saveItem({...item, [fieldToUpdate]: finalName}));
                });
            } else if (modalTarget?.id) {
                const item = items.find(i => i.id === modalTarget.id);
                if(item) updates.push(saveItem({...item, [fieldToUpdate]: finalName}));
            }
        }

        await Promise.all(updates);
        
        if (modalTarget?.type === 'bulk') setSelectedItems(new Set());
        setIsAddModalOpen(false);

    } catch (e) {
        console.error("Failed to add new category/zone", e);
        alert("Failed to create new option. Please try again.");
    }
  };

  const handleFieldChange = (id: string, field: 'category' | 'zone' | 'zone2' | 'qty', value: string | number) => {
    if (value === '__NEW__') {
      openAddModal(field as any, 'single', id);
    } else {
       const item = items.find(i => i.id === id);
       
       if (item) {
           const newValue = field === 'qty' ? (typeof value === 'string' ? (parseInt(value) || 0) : value) : value;
           const updatedItem = { ...item, [field]: newValue };

           // 1. Mark operation as pending with timestamp
           pendingOperations.current.set(id, Date.now());

           // 2. Optimistic Update
           setItems(prev => prev.map(i => i.id === id ? updatedItem : i));

           // 3. Debounce rapid changes (e.g., typing in quantity)
           const existingTimeout = saveTimeouts.current.get(id);
           if (existingTimeout) clearTimeout(existingTimeout);
           
           const timeout = setTimeout(() => {
               // 4. Persist to Server
               saveItem(updatedItem)
                   .then(() => {
                       // Success - pending operation will be cleared by realtime update
                   })
                   .catch(err => {
                       console.error("Failed to save item, reverting", err);
                       // 5. Revert on failure
                       pendingOperations.current.delete(id);
                       setItems(currentItems => currentItems.map(i => i.id === id ? item : i));
                       alert("Failed to save change. Please check connection.");
                   })
                   .finally(() => {
                       saveTimeouts.current.delete(id);
                   });
           }, 300); // 300ms debounce for rapid changes
           
           saveTimeouts.current.set(id, timeout);
       }
    }
  };

  const handleBulkFieldChange = (field: 'category' | 'zone' | 'zone2' | 'qty', value: string | number) => {
    if (value === '__NEW__') {
      openAddModal(field as any, 'bulk');
    } else {
      const itemsToUpdate: InventoryItem[] = [];
      const updates: Promise<any>[] = [];
      
      // 1. Collect items and prepare updates
      selectedItems.forEach(id => {
          const item = items.find(i => i.id === id);
          if (item) {
            const newValue = field === 'qty' ? (typeof value === 'string' ? (parseInt(value) || 0) : value) : value;
            const updatedItem = { ...item, [field]: newValue };
            itemsToUpdate.push(updatedItem);
            pendingOperations.current.set(id, Date.now());
          }
      });
      
      // 2. Optimistic Update
      setItems(prev => prev.map(item => {
          const updated = itemsToUpdate.find(u => u.id === item.id);
          return updated || item;
      }));
      
      // 3. Persist to Server
      itemsToUpdate.forEach(item => {
          updates.push(
              saveItem(item).catch(err => {
                  console.error(`Failed to save item ${item.id}`, err);
                  pendingOperations.current.delete(item.id);
              })
          );
      });
      
      Promise.all(updates).catch(() => {
          alert("Some items failed to save. Please check connection.");
      });
      
      if (field !== 'qty') setSelectedItems(new Set());
    }
  };

  const adjustQty = (id: string, delta: number) => {
    const item = items.find(i => i.id === id);
    if(item) {
        const updatedItem = { ...item, qty: Math.max(0, item.qty + delta) };
        
        // 1. Mark as pending
        pendingOperations.current.set(id, Date.now());
        
        // 2. Optimistic Update
        setItems(prev => prev.map(i => i.id === id ? updatedItem : i));
        
        // 3. Persist to Server
        saveItem(updatedItem).catch(err => {
            console.error("Failed to adjust quantity", err);
            pendingOperations.current.delete(id);
            setItems(prev => prev.map(i => i.id === id ? item : i));
        });
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const toggleColumn = (col: keyof ColumnVisibility) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const handleDownload = () => {
    let content, mimeType, extension;
    if (exportFormat === 'standard') {
      content = generateStandardCSV(items);
      mimeType = 'text/csv;charset=utf-8;';
      extension = 'csv';
    } else {
      content = generateCategorizedXLS(items);
      mimeType = 'application/vnd.ms-excel;charset=utf-8';
      extension = 'xls';
    }

    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_${exportFormat}_${new Date().toISOString().split('T')[0]}.${extension}`;
    link.click();
    setIsExportModalOpen(false);
    setTimeout(() => setIsCleanupPromptOpen(true), 1000);
  };

  const handleTabChange = (tab: 'overview' | 'inventory') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const stats: CategoryStat[] = useMemo(() => {
    const map = new Map<string, { count: number; totalQty: number }>();
    items.forEach(item => {
      const current = map.get(item.category) || { count: 0, totalQty: 0 };
      map.set(item.category, { count: current.count + 1, totalQty: current.totalQty + item.qty });
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count);
  }, [items]);

  const filteredItems = useMemo(() => {
    const searchTokens = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    return items.filter(item => {
      const itemText = (item.description + " " + item.code).toLowerCase();
      const matchS = searchTokens.every(token => itemText.includes(token));
      const matchC = selectedCategory === "All" || item.category === selectedCategory;
      const matchZ = selectedZone === "All" || item.zone === selectedZone || item.zone2 === selectedZone;
      return matchS && matchC && matchZ;
    });
  }, [items, searchTerm, selectedCategory, selectedZone]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const isAllSelected = paginatedItems.length > 0 && paginatedItems.every(i => selectedItems.has(i.id));

  const toggleAll = () => {
    const newSet = new Set(selectedItems);
    if (isAllSelected) {
      paginatedItems.forEach(i => newSet.delete(i.id));
    } else {
      paginatedItems.forEach(i => newSet.add(i.id));
    }
    setSelectedItems(newSet);
  };

  return (
    <div className="h-screen w-full flex bg-[#fff1f5] font-['Inter'] overflow-hidden">
      
      <AddModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        modalType={modalType} 
        onConfirm={handleConfirmAdd} 
        availableCategories={availableCategories} 
      />

      <PasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
        passwordInput={passwordInput} 
        setPasswordInput={setPasswordInput} 
        verifyPasswordAndUpload={verifyPasswordAndUpload} 
        setPendingCSVContent={setPendingCSVContent} 
      />

      <BulkActionBar 
        selectedItems={selectedItems} 
        setSelectedItems={setSelectedItems} 
        availableCategories={availableCategories} 
        availableZones={availableZones} 
        handleBulkFieldChange={handleBulkFieldChange} 
      />

      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
        activeTab={activeTab} 
        handleTabChange={handleTabChange} 
      />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 lg:ml-80 h-full transition-all duration-300 flex flex-col">
        <Header 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
          activeTab={activeTab} 
          openAddModal={openAddModal} 
          setIsExportModalOpen={setIsExportModalOpen} 
          handleFileSelect={handleFileSelect} 
          items={items} 
        />

        <div className={`flex-1 min-h-0 ${activeTab === 'inventory' ? 'flex flex-col' : 'overflow-y-auto pr-1 sm:pr-2 custom-scrollbar'}`}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-full text-center max-w-xl mx-auto px-6 py-12">
              <div className="relative mb-6 sm:mb-8">
                <div className="absolute inset-0 bg-pink-500 blur-3xl opacity-20 animate-pulse"></div>
                <div className="relative bg-white p-8 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-pink-50"><Sparkles className="w-10 sm:w-12 h-10 sm:h-12 text-pink-500" /></div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mb-3 sm:mb-4 tracking-tight">Full Control Over Stock</h3>
              <p className="text-slate-500 mb-8 sm:mb-10 leading-relaxed text-base sm:text-lg font-medium">AutoPart is now fully editable. Update quantities in real-time, add new items manually, and organize your warehouse with dual zones.</p>
              <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                <label className="px-6 sm:px-8 py-3.5 sm:py-4 bg-pink-600 text-white font-black rounded-2xl sm:rounded-[1.5rem] hover:bg-pink-700 transition-all shadow-xl shadow-pink-600/20 cursor-pointer text-center">Upload CSV File <input type="file" className="hidden" accept=".csv" onChange={handleFileSelect} /></label>
                <button onClick={() => openAddModal('new_item', 'single')} className="px-6 sm:px-8 py-3.5 sm:py-4 bg-white text-slate-700 border-2 border-slate-100 font-black rounded-2xl sm:rounded-[1.5rem] hover:border-pink-200 hover:bg-pink-50 transition-all text-center">Manual Entry</button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' ? (
                <DashboardOverview items={items} stats={stats} />
              ) : (
                <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-white shadow-xl overflow-hidden flex flex-col h-full">
                  <div className="p-4 sm:p-6 lg:p-8 border-b border-pink-50 flex flex-col lg:flex-row gap-3 sm:gap-5 justify-between bg-pink-50/10 flex-shrink-0 relative z-30">
                    <div className="relative flex-[2] group">
                      <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 group-focus-within:text-pink-500" />
                      <input type="text" placeholder="Search sku, name..." className="w-full pl-10 sm:pl-14 pr-4 sm:pr-8 py-3 sm:py-5 bg-white border-2 border-slate-100 rounded-xl sm:rounded-[1.5rem] focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 outline-none text-xs sm:text-sm font-bold shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex flex-row gap-2 sm:gap-3 flex-1">
                      <div className="relative flex-1 min-w-0">
                        <MapPin className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 pointer-events-none" />
                        <select className="w-full pl-8 sm:pl-14 pr-6 sm:pr-12 py-3 sm:py-5 bg-white border-2 border-slate-100 rounded-xl sm:rounded-[1.5rem] outline-none appearance-none text-[10px] sm:text-xs font-black text-slate-700 shadow-sm truncate" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                          <option value="All">All Categories</option>
                          {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 pointer-events-none" />
                      </div>
                      <div className="relative flex-1 min-w-0">
                        <MapPin className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 pointer-events-none" />
                        <select className="w-full pl-8 sm:pl-14 pr-6 sm:pr-12 py-3 sm:py-5 bg-white border-2 border-slate-100 rounded-xl sm:rounded-[1.5rem] outline-none appearance-none text-[10px] sm:text-xs font-black text-slate-700 shadow-sm truncate" value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
                          <option value="All">All Zones</option>
                          {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 pointer-events-none" />
                      </div>
                      <div className="relative" ref={dropdownRef}>
                        <button onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)} className="p-3 sm:p-5 bg-white border-2 border-slate-100 rounded-xl sm:rounded-[1.5rem] hover:bg-slate-50 transition-all text-slate-400 hover:text-pink-600 shadow-sm">
                          <Settings2 className="w-4 sm:w-5 h-4 sm:h-5" />
                        </button>
                        {isColumnDropdownOpen && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-pink-50 p-3 flex flex-col gap-1.5 animate-in slide-in-from-top-2 fade-in duration-200">
                             <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Visible Columns</p>
                             <button onClick={() => toggleColumn('description')} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-pink-50 transition-all group">
                                <span className={`text-xs font-bold ${visibleColumns.description ? 'text-slate-800' : 'text-slate-400'}`}>Description</span>
                                {visibleColumns.description ? <Eye className="w-3.5 h-3.5 text-pink-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                             </button>
                             <button onClick={() => toggleColumn('category')} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-pink-50 transition-all group">
                                <span className={`text-xs font-bold ${visibleColumns.category ? 'text-slate-800' : 'text-slate-400'}`}>Category</span>
                                {visibleColumns.category ? <Eye className="w-3.5 h-3.5 text-pink-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                             </button>
                             <button onClick={() => toggleColumn('zone')} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-pink-50 transition-all group">
                                <span className={`text-xs font-bold ${visibleColumns.zone ? 'text-slate-800' : 'text-slate-400'}`}>Zone 1</span>
                                {visibleColumns.zone ? <Eye className="w-3.5 h-3.5 text-pink-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                             </button>
                             <button onClick={() => toggleColumn('zone2')} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-pink-50 transition-all group">
                                <span className={`text-xs font-bold ${visibleColumns.zone2 ? 'text-slate-800' : 'text-slate-400'}`}>Zone 2</span>
                                {visibleColumns.zone2 ? <Eye className="w-3.5 h-3.5 text-pink-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                             </button>
                             <button onClick={() => toggleColumn('qty')} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-pink-50 transition-all group">
                                <span className={`text-xs font-bold ${visibleColumns.qty ? 'text-slate-800' : 'text-slate-400'}`}>Quantity</span>
                                {visibleColumns.qty ? <Eye className="w-3.5 h-3.5 text-pink-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-300" />}
                             </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto min-h-0 custom-scrollbar relative">
                    {/* Search Loading Overlay */}
                    {isSearching && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-30 flex items-center justify-center animate-in fade-in duration-200">
                        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                      </div>
                    )}
                    
                    <table className="w-full text-left table-fixed min-w-[1200px]">
                      <colgroup>
                        <col style={{ width: '50px' }} /> {/* Checkbox */}
                        <col style={{ width: '140px' }} /> {/* SKU */}
                        {visibleColumns.description && <col style={{ width: '300px' }} />} {/* Description */}
                        {visibleColumns.category && <col style={{ width: '200px' }} />} {/* Category */}
                        {visibleColumns.zone && <col style={{ width: '150px' }} />} {/* Zone 1 */}
                        {visibleColumns.zone2 && <col style={{ width: '150px' }} />} {/* Zone 2 */}
                        {visibleColumns.qty && <col style={{ width: '120px' }} />} {/* Qty */}
                      </colgroup>

                      <thead className="sticky top-0 bg-white z-20 shadow-sm leading-none">
                        <tr className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-pink-50 h-10">
                          <th className="pl-6 w-[50px]">
                            <button onClick={toggleAll} className={`w-4 h-4 rounded-lg border-2 flex items-center justify-center transition-all ${isAllSelected ? 'bg-pink-600 border-pink-600' : 'border-slate-300 hover:border-pink-400'}`}>
                              {isAllSelected && <Check className="w-3 h-3 text-white" />}
                            </button>
                          </th>
                          <th className="px-4 w-[140px] truncate">SKU Code</th>
                          {visibleColumns.description && <th className="px-4 w-[300px] truncate">Description</th>}
                          {visibleColumns.category && <th className="px-4 w-[200px] truncate">Category</th>}
                          {visibleColumns.zone && <th className="px-4 w-[150px] truncate">Zone 1</th>}
                          {visibleColumns.zone2 && <th className="px-4 w-[150px] truncate">Zone 2</th>}
                          {visibleColumns.qty && <th className="px-4 w-[120px] text-right truncate">Qty</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pink-50">{paginatedItems.map(item => (
                        <tr key={item.id} className={`transition-colors group h-14 ${selectedItems.has(item.id) ? 'bg-pink-50/60' : 'hover:bg-pink-50/20'}`}>
                          <td className="pl-6 py-2">
                            <button onClick={() => toggleSelection(item.id)} className={`w-4 h-4 rounded-lg border-2 flex items-center justify-center transition-all ${selectedItems.has(item.id) ? 'bg-pink-600 border-pink-600' : 'border-slate-200 group-hover:border-pink-300'}`}>
                              {selectedItems.has(item.id) && <Check className="w-3 h-3 text-white" />}
                            </button>
                          </td>
                          <td className="px-4 py-2 font-mono text-[11px] text-pink-600 font-black tracking-tight truncate">{item.code}</td>
                          {visibleColumns.description && <td className="px-4 py-2"><p className="text-xs font-bold text-slate-800 leading-tight break-words line-clamp-2" title={item.description}>{item.description}</p></td>}
                          {visibleColumns.category && (
                            <td className="px-4 py-2">
                               <select value={item.category} onChange={(e) => handleFieldChange(item.id, 'category', e.target.value)} className="w-full bg-pink-50 hover:bg-white text-pink-700 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl appearance-none cursor-pointer border border-transparent hover:border-pink-100 shadow-sm outline-none truncate transition-all">
                                 {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                 <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
                               </select>
                            </td>
                          )}
                          {visibleColumns.zone && (
                            <td className="px-4 py-2">
                               <select value={item.zone} onChange={(e) => handleFieldChange(item.id, 'zone', e.target.value)} className="w-full bg-slate-50 hover:bg-white text-slate-700 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl appearance-none cursor-pointer border border-transparent hover:border-slate-200 shadow-sm outline-none truncate transition-all">
                                 {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                                 <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
                               </select>
                            </td>
                          )}
                          {visibleColumns.zone2 && (
                            <td className="px-4 py-2">
                               <select value={item.zone2} onChange={(e) => handleFieldChange(item.id, 'zone2', e.target.value)} className="w-full bg-slate-50 hover:bg-white text-slate-700 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl appearance-none cursor-pointer border border-transparent hover:border-slate-200 shadow-sm outline-none truncate transition-all">
                                 {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
                                 <option value="__NEW__" className="text-pink-400 font-bold">+ New</option>
                               </select>
                            </td>
                          )}
                          {visibleColumns.qty && (
                            <td className="px-4 py-2">
                               <QuantityInput 
                                 value={item.qty} 
                                 onChange={(newQty) => handleFieldChange(item.id, 'qty', newQty)} 
                               />
                            </td>
                          )}
                        </tr>
                      ))}</tbody></table>
                  </div>
                  {filteredItems.length > 0 && (
                    <div className="mt-auto px-4 sm:px-10 py-4 sm:py-8 bg-pink-50/10 flex flex-row items-center justify-between gap-4 flex-shrink-0 border-t border-pink-50 relative z-20">
                      <p className="text-[10px] sm:text-sm text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap">Page <span className="text-pink-600 font-black">{currentPage}</span> / <span className="text-slate-800 font-black">{totalPages}</span></p>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 sm:p-4 rounded-xl sm:rounded-[1.5rem] border border-pink-100 bg-white disabled:opacity-30 hover:bg-pink-50 transition-colors"><ChevronLeft className="w-4 sm:w-5 h-4 sm:h-5 text-pink-600" /></button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 sm:p-4 rounded-xl sm:rounded-[1.5rem] border border-pink-100 bg-white disabled:opacity-30 hover:bg-pink-50 transition-colors"><ChevronRight className="w-4 sm:w-5 h-4 sm:h-5 text-pink-600" /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        exportFormat={exportFormat} 
        setExportFormat={setExportFormat} 
        handleDownload={handleDownload} 
      />
      
      {/* Processing Initial Data Loading */}
      {isLoading && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md">
            <Loader2 className="w-12 h-12 text-pink-500 animate-spin mb-4" />
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Loading Inventory...</h3>
        </div>
      )}

      {/* Syncing Overlay - Keeps existing sync overlay */}
      {isSyncing && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
             <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-slate-700"></div>
                <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-4 border-t-pink-500 border-r-pink-500 border-b-transparent border-l-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Database className="w-8 h-8 text-pink-500 animate-pulse" />
                </div>
             </div>
             <h3 className="mt-8 text-2xl font-black text-white tracking-tight">Syncing Database</h3>
             <p className="text-slate-400 font-medium mt-2 animate-pulse">Processing inventory data...</p>
        </div>
      )}
    </div>
  );
};

export default App;
