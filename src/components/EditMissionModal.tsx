import React, { useState, useEffect } from 'react';
import { X, Trash2, Calendar, Tag } from 'lucide-react';
import { Mission, MissionCategory } from '../types';
import { CATEGORY_CONFIG } from '../constants';

interface EditMissionModalProps {
  mission: Mission;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedMission: Mission) => void;
  onDelete: (id: string) => void;
}

export const EditMissionModal = ({ mission, isOpen, onClose, onSave, onDelete }: EditMissionModalProps) => {
  const [title, setTitle] = useState(mission.title);
  const [category, setCategory] = useState<MissionCategory>(mission.category);
  const [dueDate, setDueDate] = useState(mission.dueDate || '');

  useEffect(() => {
    if (isOpen) {
      setTitle(mission.title);
      setCategory(mission.category);
      setDueDate(mission.dueDate || '');
    }
  }, [isOpen, mission]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      ...mission,
      title,
      category,
      dueDate: dueDate || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-[95%] max-w-sm max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-sm font-bold text-gray-900">Edit Mission</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Mission Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
              placeholder="Enter mission name"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CATEGORY_CONFIG) as MissionCategory[]).filter(cat => cat !== 'Strategic' && cat !== 'Tactical').map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      category === cat
                        ? `${config.bg} ${config.text} ring-1`
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                    style={category === cat ? { borderColor: config.color, '--tw-ring-color': config.color } as React.CSSProperties : {}}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }}></span>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Calendar size={10} /> Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
            />
          </div>
        </div>

        <div className="bg-gray-50 px-5 py-4 flex justify-between items-center border-t border-gray-100 sticky bottom-0">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this mission?')) {
                onDelete(mission.id);
              }
            }}
            className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
            title="Delete Mission"
          >
            <Trash2 size={18} />
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[#2F5BFF] hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
