import React, { useState } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  DropAnimation,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Play,
  Pause,
  CheckCircle2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Clock,
  Target,
  Zap,
  Edit2,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Mission, MissionCategory } from '../types';
import { EditMissionModal } from './EditMissionModal';
import { AddMissionModal } from './AddMissionModal';
import { getCategoryStyle } from '../constants';

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.5',
      },
    },
  }),
};

const SortableItem: React.FC<{ mission: Mission; onEdit: (mission: Mission) => void }> = ({ mission, onEdit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mission.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const isBacklog = mission.status === 'Backlog';
  const categoryStyle = getCategoryStyle(mission.category);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderTopWidth: '2px',
        borderTopColor: categoryStyle.color
      }}
      className={`rounded-lg p-3.5 border shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-3 group transition-colors mb-2 ${
        isBacklog 
          ? 'bg-white/40 border-gray-100 hover:bg-white hover:border-gray-200' 
          : 'bg-white border-gray-100 hover:border-gray-200'
      }`}
    >
      <div {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing">
        <GripVertical size={14} />
      </div>
      
      <div className="flex-1 cursor-pointer" onClick={() => onEdit(mission)}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryStyle.bg} ${categoryStyle.text}`}>
            {mission.category}
          </span>
          {mission.dueDate && (
            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
              <Clock size={10} /> {mission.dueDate}
            </span>
          )}
        </div>
        <h4 className={`text-sm font-medium ${isBacklog ? 'text-gray-400 group-hover:text-gray-600' : 'text-gray-900'}`}>
          {mission.title}
        </h4>
      </div>

      <div className="flex items-center gap-2">
        {mission.effort && (
          <div className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
            {mission.effort}
          </div>
        )}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onEdit(mission);
          }}
          className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
        >
          <Edit2 size={12} />
        </button>
      </div>
    </div>
  );
};

// DroppableZone Wrapper
const DroppableZone = ({ id, children, disabled = false, className = '' }: { id: string, children: React.ReactNode, disabled?: boolean, className?: string }) => {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  
  return (
    <div 
      ref={setNodeRef} 
      className={`transition-all duration-300 rounded-lg ${isOver ? 'ring-2 ring-[#2F5BFF]/30 bg-[#2F5BFF]/5' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

interface PlanViewProps {
  missions: Mission[];
  onUpdateMissions: (missions: Mission[]) => void;
  weeklyFocus: string;
  onUpdateWeeklyFocus: (focus: string) => void;
  onAddMission: (mission: { title: string; category: MissionCategory; dueDate?: string; destination: 'Today' | 'Next' | 'Backlog' }) => Promise<void>;
  onSaveMission: (mission: Mission) => void;
  onDeleteMission: (id: string) => void;
  isSaving: boolean;
}

export const PlanView = ({ 
  missions, 
  onUpdateMissions, 
  weeklyFocus, 
  onUpdateWeeklyFocus,
  onAddMission,
  onSaveMission,
  onDeleteMission,
  isSaving
}: PlanViewProps) => {
  const [isBacklogOpen, setIsBacklogOpen] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<Mission | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMissionTarget, setAddMissionTarget] = useState<'Active' | 'Queue' | 'Backlog'>('Backlog');
  
  const [isEditingObjective, setIsEditingObjective] = useState(false);
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const objectiveInputRef = React.useRef<HTMLInputElement>(null);
  const focusInputRef = React.useRef<HTMLInputElement>(null);

  const [sprintGoal, setSprintGoal] = useState(() => {
    return localStorage.getItem('vector_quarter_objective') || "Launch V2 Beta";
  });

  React.useEffect(() => {
    localStorage.setItem('vector_quarter_objective', sprintGoal);
  }, [sprintGoal]);

  React.useEffect(() => {
    if (isEditingObjective && objectiveInputRef.current) {
      objectiveInputRef.current.focus();
    }
  }, [isEditingObjective]);

  React.useEffect(() => {
    if (isEditingFocus && focusInputRef.current) {
      focusInputRef.current.focus();
    }
  }, [isEditingFocus]);
  
  // Date Logic for Command Center
  const now = new Date();
  const currentQuarter = Math.floor((now.getMonth() + 3) / 3);
  const quarterStartMonth = (currentQuarter - 1) * 3;
  const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1);
  
  const diffTime = now.getTime() - quarterStart.getTime();
  const dayOfQuarter = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const weekOfQuarter = Math.ceil(dayOfQuarter / 7);
  const daysLeft = 90 - dayOfQuarter;
  const sprintProgress = Math.min(100, Math.floor((dayOfQuarter / 90) * 100));

  const activeMission = missions.find(m => m.status === 'Active');
  const queueMissions = missions.filter(m => m.status === 'Queue');
  const backlogMissions = missions.filter(m => m.status === 'Backlog');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveDragItem(missions.find(m => m.id === active.id) || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeMission = missions.find(m => m.id === active.id);
    if (!activeMission) return;

    // Handle dragging between Queue and Backlog
    // We only want to reorder if we are over a sortable item in a different container
    // OR if we are over the container itself (empty list case)
    
    const isOverQueue = over.id === 'queue-zone' || queueMissions.some(m => m.id === over.id);
    const isOverBacklog = over.id === 'backlog-zone' || backlogMissions.some(m => m.id === over.id);

    // Prevent dragging from Backlog directly to Active (handled in DragEnd, but visual feedback here?)
    // If dragging from Backlog, and over Active, we don't want to do anything in DragOver.

    if (activeMission.status === 'Queue' && isOverBacklog) {
       // Moving Queue -> Backlog
       // Update status to Backlog
       const newMissions = missions.map(m => 
         m.id === active.id ? { ...m, status: 'Backlog' as const } : m
       );
       onUpdateMissions(newMissions);
    } else if (activeMission.status === 'Backlog' && isOverQueue) {
       // Moving Backlog -> Queue
       // Update status to Queue
       const newMissions = missions.map(m => 
         m.id === active.id ? { ...m, status: 'Queue' as const } : m
       );
       onUpdateMissions(newMissions);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragItem(null);

    if (!over) return;
    if (active.id === over.id) return;

    const mission = missions.find(m => m.id === active.id);
    if (!mission) return;

    // 1. Drop on Active Zone
    if (over.id === 'active-zone') {
      // Constraint: Only from Queue
      if (mission.status === 'Queue') {
        // Promote to Active
        // If there is an existing active mission, move it to Queue (pause)
        const currentActive = missions.find(m => m.status === 'Active');
        
        const newMissions = missions.map(m => {
          if (m.id === active.id) return { ...m, status: 'Active' as const, progress: m.progress || 0 };
          if (currentActive && m.id === currentActive.id) return { ...m, status: 'Queue' as const };
          return m;
        });
        
        // Move old active to top of queue if it exists
        if (currentActive) {
           const oldActiveIndex = newMissions.findIndex(m => m.id === currentActive.id);
           if (oldActiveIndex !== -1) {
             const [oldActive] = newMissions.splice(oldActiveIndex, 1);
             // Find where queue starts
             const firstQueueIndex = newMissions.findIndex(m => m.status === 'Queue');
             if (firstQueueIndex !== -1) {
               newMissions.splice(firstQueueIndex, 0, oldActive);
             } else {
               newMissions.push(oldActive); // Should be after active
             }
             // Persist old active status change
             onSaveMission({ ...oldActive, status: 'Queue' });
           }
        }
        
        // Persist new active status change
        onSaveMission({ ...mission, status: 'Active', progress: mission.progress || 0 });
        onUpdateMissions(newMissions);
      }
      return;
    }

    // 2. Reordering within lists or moving between lists
    // Check if status changed during DragOver (optimistic update) or needs final update
    // Since DragOver updates local state, we need to ensure persistence here if status changed
    
    // However, DragOver might have already changed the status in local state 'missions'
    // But 'mission' variable comes from 'missions' state at start of render? 
    // No, 'missions.find' gets current state.
    
    // If we moved from Backlog to Queue, mission.status is ALREADY 'Queue' due to DragOver updates?
    // Let's check. onUpdateMissions updates 'missions'.
    // So 'mission.status' here reflects the state AFTER DragOver updates.
    
    // We need to persist the status if it's different from what it was BEFORE drag started?
    // Or just ensure we save it.
    
    // Actually, simpler: just save the mission with its current status (which might have been updated by DragOver)
    // But we also need to handle reordering.
    
    if (active.id !== over.id) {
      const oldIndex = missions.findIndex((item) => item.id === active.id);
      const newIndex = missions.findIndex((item) => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
         // If status is different (e.g. dragged from Backlog to Queue and dropped), DragOver handled the visual update
         // We need to persist the new status.
         // Note: DragOver updates 'missions', so missions[oldIndex] has the NEW status if it was updated.
         
         const updatedMission = missions[oldIndex];
         
         // We should persist if the status implies a change we care about.
         // Since we don't have a 'previous status' easily available without tracking, 
         // and we want to be safe, we can just save.
         // But wait, DragOver updates happen frequently. We only want to save on Drop.
         
         // If the user dragged from Backlog to Queue, DragOver updated local state to 'Queue'.
         // Now on Drop, we confirm it.
         
         // We need to make sure we persist the change.
         onSaveMission(updatedMission);

         onUpdateMissions(arrayMove(missions, oldIndex, newIndex));
      }
    } else {
      // Dropped in same place, but maybe status changed (e.g. dragged to other list and dropped exactly on itself? unlikely)
      // Or dragged to other list and dropped.
      // If active.id === over.id, usually no reorder.
      // But if we moved lists, over.id might be the same item if it's the only one?
      // No, dnd-kit handles this.
      
      // If we just changed lists but no reorder needed (e.g. dropped at end), 
      // active.id !== over.id usually unless we dropped on self.
      
      // If we moved lists, we MUST persist.
      // Check if mission status matches the container we dropped in?
      // Actually, DragOver already updated the status in 'missions'.
      // We just need to persist 'mission'.
      onSaveMission(mission);
    }
  };

  const handleCompleteActive = () => {
    if (!activeMission) return;

    const newMissions = missions.filter(m => m.id !== activeMission.id); // Remove completed
    const firstQueueIndex = newMissions.findIndex(m => m.status === 'Queue');
    
    if (firstQueueIndex !== -1) {
      newMissions[firstQueueIndex] = { ...newMissions[firstQueueIndex], status: 'Active', progress: 0 };
      
      // Conveyor Belt: Move first Backlog item to Queue
      const firstBacklogIndex = newMissions.findIndex(m => m.status === 'Backlog');
      if (firstBacklogIndex !== -1) {
         newMissions[firstBacklogIndex] = { ...newMissions[firstBacklogIndex], status: 'Queue' };
      }
    }
    
    onUpdateMissions(newMissions);
  };

  const handlePauseActive = () => {
    if (!activeMission) return;

    const newMissions = missions.map(m => 
      m.id === activeMission.id ? { ...m, status: 'Queue' as const } : m
    );
    
    // Move paused mission to top of queue
    const pausedMissionIndex = newMissions.findIndex(m => m.id === activeMission.id);
    const [pausedMission] = newMissions.splice(pausedMissionIndex, 1);
    
    const firstQueueIndex = newMissions.findIndex(m => m.status === 'Queue');
    if (firstQueueIndex !== -1) {
      newMissions.splice(firstQueueIndex, 0, pausedMission);
    } else {
      newMissions.unshift(pausedMission);
    }
    
    onUpdateMissions(newMissions);
  };

  const handleAddToQueue = (id: string) => {
    if (queueMissions.length >= 3) return;
    onUpdateMissions(missions.map(m => 
      m.id === id ? { ...m, status: 'Queue' } : m
    ));
  };

  const [editingMission, setEditingMission] = useState<Mission | null>(null);

  const handleEditMission = (mission: Mission) => {
    setEditingMission(mission);
  };

  const handleSaveMission = (updatedMission: Mission) => {
    onSaveMission(updatedMission);
    setEditingMission(null);
  };

  const handleDeleteMission = (id: string) => {
    onDeleteMission(id);
    setEditingMission(null);
  };

  const handleAddMission = async (mission: { title: string; category: MissionCategory; dueDate?: string; destination: 'Today' | 'Next' | 'Backlog' }) => {
    await onAddMission(mission);
    setIsAddModalOpen(false);
  };

  return (
    <div className="pb-24 pt-8 px-4 sm:px-5 max-w-md mx-auto">
        
        {/* Command Center */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">Command Center</h1>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
            
            {/* 1. Current Cycle */}
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">CURRENT CYCLE</span>
                <span className="text-sm font-semibold text-gray-900">Q{currentQuarter} {now.getFullYear()} • Week {weekOfQuarter}</span>
              </div>
              <div className="text-[10px] font-medium text-gray-400">
                Week {weekOfQuarter} of 13
              </div>
            </div>

            <div className="h-px bg-gray-100 w-full"></div>

            {/* 2. Quarter Objective */}
            <div className="p-4" onClick={() => !isEditingObjective && setIsEditingObjective(true)}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">QUARTER OBJECTIVE</span>
              </div>
              {isEditingObjective ? (
                <input
                  ref={objectiveInputRef}
                  type="text"
                  value={sprintGoal}
                  onChange={(e) => setSprintGoal(e.target.value)}
                  onBlur={() => setIsEditingObjective(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingObjective(false)}
                  className="w-full text-sm font-semibold text-gray-900 placeholder-gray-300 border-none p-0 focus:ring-0 bg-transparent outline-none mb-3"
                />
              ) : (
                <h2 className="text-sm font-semibold text-gray-900 mb-3 cursor-pointer hover:text-blue-600 transition-colors truncate">
                  {sprintGoal}
                </h2>
              )}
              <div className="space-y-1.5">
                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gray-900 rounded-full transition-all duration-500"
                    style={{ width: `${sprintProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[9px] font-medium text-gray-400">
                  <span>Day {dayOfQuarter} of 90</span>
                  <span>{sprintProgress}%</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100 w-full"></div>

            {/* 3. Weekly Focus */}
            <div className="p-4 flex items-center gap-4" onClick={() => !isEditingFocus && setIsEditingFocus(true)}>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0">WEEKLY FOCUS</span>
              {isEditingFocus ? (
                <input
                  ref={focusInputRef}
                  type="text"
                  value={weeklyFocus}
                  onChange={(e) => onUpdateWeeklyFocus(e.target.value)}
                  onBlur={() => setIsEditingFocus(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingFocus(false)}
                  className="w-full text-sm font-semibold text-gray-900 placeholder-gray-300 border-none p-0 focus:ring-0 bg-transparent outline-none"
                />
              ) : (
                <span className="text-sm font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors truncate flex-1">
                  {weeklyFocus}
                </span>
              )}
            </div>

          </div>

          {/* Consolidated Add Mission Button */}
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-full bg-[#2F5BFF] hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm tracking-wide"
          >
            <Plus size={18} strokeWidth={3} />
            ADD MISSION
          </button>
        </div>

        <div className="relative pl-8 space-y-10">
          {/* Conveyor Spine */}
          <div className="absolute left-[3px] top-3 bottom-10 w-[2px] bg-gradient-to-b from-gray-200 via-gray-200 to-gray-100/50"></div>

        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
        >
          {/* 4. Today's Focus */}
          <section className="relative">
            <div className="absolute -left-[33px] top-0 z-10">
               <div className={`w-4 h-4 rounded-full border-[3px] border-[#F2F2F7] ${activeMission ? 'bg-[#2F5BFF] shadow-[0_0_0_2px_rgba(47,91,255,0.2)]' : 'bg-gray-300'}`}></div>
            </div>
            
            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 ${activeMission ? 'text-[#2F5BFF]' : 'text-gray-400'}`}>
              TODAY'S MISSION
              {activeMission && <span className="w-1.5 h-1.5 rounded-full bg-[#2F5BFF] animate-pulse"></span>}
            </h3>
            
            <DroppableZone id="active-zone" disabled={activeDragItem?.status === 'Backlog'}>
              {activeMission ? (
                <div 
                  className="bg-white rounded-xl p-5 shadow-[0_4px_20px_-4px_rgba(47,91,255,0.15)] border border-[#2F5BFF]/20 ring-1 ring-[#2F5BFF]/10 relative group transition-all hover:shadow-[0_8px_24px_-6px_rgba(47,91,255,0.2)]"
                  style={{ borderTopWidth: '2px', borderTopColor: getCategoryStyle(activeMission.category).color }}
                >
                  <button 
                    onClick={() => handleEditMission(activeMission)}
                    className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  >
                    <Edit2 size={14} />
                  </button>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${getCategoryStyle(activeMission.category).bg} ${getCategoryStyle(activeMission.category).text}`}>
                      {activeMission.category}
                    </span>
                    <div className="flex gap-2 pr-6">
                      <button 
                        onClick={handlePauseActive}
                        className="p-1.5 rounded-md hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Pause and return to queue"
                      >
                        <Pause size={16} />
                      </button>
                      <button 
                        onClick={handleCompleteActive}
                        className="p-1.5 rounded-md hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors"
                        title="Complete and start next"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h2 className="text-lg font-bold text-gray-900 mb-2 leading-tight cursor-pointer hover:text-[#2F5BFF] transition-colors" onClick={() => handleEditMission(activeMission)}>
                    {activeMission.title}
                  </h2>


                  
                  {activeMission.dueDate && (
                     <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                       <Clock size={12} />
                       <span>Due {activeMission.dueDate}</span>
                     </div>
                  )}
                </div>
              ) : (
                <div className="bg-white/50 rounded-xl p-6 border border-dashed border-gray-300 text-center flex flex-col items-center justify-center min-h-[140px] group hover:bg-white/80 transition-colors">
                  {queueMissions.length > 0 ? (
                    <div className="w-full flex flex-col items-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Ready to Execute?</p>
                      
                      <div 
                        className="w-full bg-white rounded-lg p-3 border border-gray-200 shadow-sm mb-4 text-left opacity-75 blur-[0.5px] group-hover:blur-0 transition-all"
                        style={{ borderTopWidth: '2px', borderTopColor: getCategoryStyle(queueMissions[0].category).color }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${getCategoryStyle(queueMissions[0].category).bg} ${getCategoryStyle(queueMissions[0].category).text}`}>
                            {queueMissions[0].category}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {queueMissions[0].title}
                        </h4>
                      </div>

                      <button 
                        onClick={() => {
                          const newMissions = missions.map(m => {
                            if (m.id === queueMissions[0].id) {
                              return { ...m, status: 'Active' as const, progress: 0 };
                            }
                            return m;
                          });
                          onUpdateMissions(newMissions);
                        }}
                        className="bg-[#2F5BFF] hover:bg-blue-600 text-white text-[10px] font-bold py-2 px-4 rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Play size={12} fill="currentColor" />
                        START MISSION
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                       {backlogMissions.length === 0 ? (
                         <>
                           <p className="text-xs text-gray-500 font-medium mb-3">No Missions Yet</p>
                           <p className="text-[10px] text-gray-400">Add a mission to get started.</p>
                         </>
                       ) : (
                         <>
                           <p className="text-xs text-gray-500 font-medium mb-1">No Active Mission</p>
                           <p className="text-[10px] text-gray-400">Select a mission from below to begin.</p>
                         </>
                       )}
                    </div>
                  )}
                </div>
              )}
            </DroppableZone>
          </section>

          {/* 2. Next Missions */}
          <section className="relative">
            <div className="absolute -left-[30px] top-1 w-2.5 h-2.5 rounded-full bg-white border-[2px] border-gray-300 z-10"></div>
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Next Missions</h3>
              <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{queueMissions.length} Ready</span>
            </div>

            <DroppableZone id="queue-zone" className="min-h-[50px]">
              <SortableContext 
                items={queueMissions.map(m => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {queueMissions.map((mission) => (
                    <SortableItem key={mission.id} mission={mission} onEdit={handleEditMission} />
                  ))}
                  {queueMissions.length === 0 && (
                    <div className="h-12 border border-dashed border-gray-200 rounded-lg flex items-center justify-center text-[10px] text-gray-400">
                      Drag missions here from backlog
                    </div>
                  )}
                </div>
              </SortableContext>
            </DroppableZone>
          </section>

          {/* 3. Mission Backlog */}
          <section className="relative">
            <div className="absolute -left-[30px] top-3.5 w-2.5 h-2.5 rounded-full bg-gray-200 ring-4 ring-[#F2F2F7] z-10"></div>
            
            <button 
              onClick={() => setIsBacklogOpen(!isBacklogOpen)}
              className="w-full flex justify-between items-center py-2 group mb-2"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition-colors">Mission Backlog</h3>
                <div className={`transition-transform duration-300 ${isBacklogOpen ? 'rotate-90' : ''}`}>
                   <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500" />
                </div>
              </div>
              <span className="text-[10px] font-medium text-gray-300">{backlogMissions.length} Items</span>
            </button>

            <AnimatePresence>
              {isBacklogOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <DroppableZone id="backlog-zone" className="pt-1">
                    <SortableContext 
                      items={backlogMissions.map(m => m.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {backlogMissions.map((mission) => (
                          <SortableItem key={mission.id} mission={mission} onEdit={handleEditMission} />
                        ))}
                      </div>
                    </SortableContext>
                  </DroppableZone>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* 4. Archived Missions */}
          <section className="relative">
            <div className="absolute -left-[30px] top-3.5 w-2.5 h-2.5 rounded-full bg-gray-300 ring-4 ring-[#F2F2F7] z-10"></div>
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Archived Missions</h3>
              <span className="text-[9px] font-medium text-gray-300">{missions.filter(m => m.status === 'Completed').length} Items</span>
            </div>

            <div className="space-y-2">
              {missions
                .filter(m => m.status === 'Completed')
                .sort((a, b) => new Date(b.completedDate || 0).getTime() - new Date(a.completedDate || 0).getTime())
                .map((mission) => {
                  const categoryStyle = getCategoryStyle(mission.category);
                  
                  // Duration Logic
                  const elapsed = mission.elapsedSeconds || 0;
                  const durationMinutes = Math.floor(elapsed / 60);
                  const durationDisplay = (elapsed > 0 && elapsed < 60) 
                    ? '<1m' 
                    : `${durationMinutes}m`;

                  // Time Logic
                  const startTime = mission.startedAt ? new Date(mission.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
                  const endTime = mission.endedAt ? new Date(mission.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
                  const isToday = mission.completedDate && new Date(mission.completedDate).toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={mission.id}
                      style={{
                        borderTopWidth: '2px',
                        borderTopColor: categoryStyle.color
                      }}
                      className="bg-gray-50/50 rounded-lg p-3.5 border border-gray-100 flex items-center gap-3 opacity-75 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${categoryStyle.bg} ${categoryStyle.text} saturate-50`}>
                            {mission.category}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                            ⏱ {durationDisplay}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-700 line-through decoration-gray-300">
                          {mission.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5 text-[9px] text-gray-400 font-medium">
                          <span>{startTime} – {endTime}</span>
                          {!isToday && mission.completedDate && (
                            <>
                              <span>•</span>
                              <span>{new Date(mission.completedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-emerald-500/50">
                        <CheckCircle2 size={16} />
                      </div>
                    </div>
                  );
                })}
                
                {missions.filter(m => m.status === 'Completed').length === 0 && (
                  <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-2 text-gray-300">
                      <CheckCircle2 size={14} />
                    </div>
                    <p className="text-[10px] font-medium text-gray-400">Completed missions will appear here.</p>
                  </div>
                )}
            </div>
          </section>

          <DragOverlay dropAnimation={dropAnimation}>
            {activeId ? (
               <div className="bg-white rounded-md p-4 border border-[#2F5BFF] shadow-lg flex items-center gap-3">
                 <div className="text-[#2F5BFF]">
                   <GripVertical size={16} />
                 </div>
                 <div className="flex-1">
                   <h4 className="text-sm font-medium text-gray-900">
                     {missions.find(m => m.id === activeId)?.title}
                   </h4>
                 </div>
               </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {editingMission && (
          <EditMissionModal
            mission={editingMission}
            isOpen={!!editingMission}
            onClose={() => setEditingMission(null)}
            onSave={handleSaveMission}
            onDelete={handleDeleteMission}
          />
        )}

        <AddMissionModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddMission}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
};
