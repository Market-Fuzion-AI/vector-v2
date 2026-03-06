import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Tag, Target } from 'lucide-react';
import { Mission, MissionCategory } from '../types';
import { CATEGORY_CONFIG } from '../constants';

interface AddMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (mission: { title: string; category: MissionCategory; dueDate?: string; destination: 'Today' | 'Next' | 'Backlog' }) => Promise<void> | void;
  isSaving?: boolean;
}

export const AddMissionModal = ({ isOpen, onClose, onAdd, isSaving = false }: AddMissionModalProps) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MissionCategory>('Personal');
  const [dueDate, setDueDate] = useState('');
  const [destination, setDestination] = useState<'Today' | 'Next' | 'Backlog'>('Today');
  const [localIsSaving, setLocalIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const addLockRef = useRef(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Reset form on open
      setTitle('');
      setCategory('Personal');
      setDueDate('');
      setDestination('Today');
      setLocalIsSaving(false);
      setSaveStatus('idle');
      addLockRef.current = false;
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = async () => {
    if (addLockRef.current || !title.trim() || localIsSaving || isSaving) return;

    addLockRef.current = true;
    setLocalIsSaving(true);
    setSaveStatus('idle');

    try {
      await onAdd({ title, category, dueDate: dueDate || undefined, destination });
      setSaveStatus('saved');
      setTimeout(() => onClose(), 800);
    } catch (error) {
      console.error("Error adding mission:", error);
      setSaveStatus('error');
      addLockRef.current = false;
      setLocalIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center shrink-0 bg-white sticky top-0 z-10">
          <h3 className="text-base font-bold text-gray-900">Add New Mission</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-50">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Mission Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all placeholder-gray-400"
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
               <Tag size={10} /> Category
            </label>
            <div className="relative">
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MissionCategory)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] appearance-none transition-all"
                >
                    {(Object.keys(CATEGORY_CONFIG) as MissionCategory[]).filter(cat => cat !== 'Strategic' && cat !== 'Tactical').map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Calendar size={10} /> Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
            />
          </div>

          {/* Destination Selector */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Target size={10} /> Destination <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value as 'Today' | 'Next' | 'Backlog')}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] appearance-none transition-all"
              >
                <option value="Today">Today's Mission</option>
                <option value="Next">Next Missions</option>
                <option value="Backlog">Mission Backlog</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-5 py-4 flex justify-end items-center border-t border-gray-100 gap-3 shrink-0 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!title.trim() || isSaving || localIsSaving || saveStatus === 'saved'}
            className={`px-6 py-2.5 text-white text-xs font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
              saveStatus === 'saved'  ? 'bg-emerald-500 shadow-emerald-500/20' :
              saveStatus === 'error'  ? 'bg-red-500 shadow-red-500/20' :
              (!title.trim() || isSaving || localIsSaving) ? 'bg-[#2F5BFF] opacity-50 cursor-not-allowed shadow-none' :
              'bg-[#2F5BFF] hover:bg-blue-600 shadow-blue-500/20'
            }`}
          >
            {(isSaving || localIsSaving) && saveStatus === 'idle' ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveStatus === 'saved' ? 'Saved ✓'
              : saveStatus === 'error' ? 'Save failed — try again'
              : 'Add Mission'}
          </button>
        </div>
      </div>
    </div>
  );
};
