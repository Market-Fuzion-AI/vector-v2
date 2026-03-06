import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Calendar, Clock, CheckCircle2, AlertCircle, FileText, Edit2, Loader2 } from 'lucide-react';
import { ContentItem, ContentStatus, ContentPlatform, Mission } from '../types';
import { ContentEditor } from './ContentEditor';
import { motion, AnimatePresence } from 'motion/react';
import { STATUS_BADGES } from '../constants';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { normalizeHashtags } from '../utils/normalizeHashtags';

interface ContentViewProps {
  missions: Mission[];
  webhookPublish: string;
  webhookSecret: string;
  brandVoice: string;
}

const STATUS_TABS: ContentStatus[] = ['idea', 'draft', 'scheduled', 'published'];

const PLATFORM_ICONS: Record<ContentPlatform, { color: string; bg: string }> = {
  'Instagram': { color: 'text-pink-600', bg: 'bg-pink-50' },
  'Facebook': { color: 'text-blue-600', bg: 'bg-blue-50' },
  'LinkedIn': { color: 'text-blue-700', bg: 'bg-blue-50' },
};

const STATUS_COLORS: Record<ContentStatus, string> = {
  'idea': 'border-l-gray-400',
  'draft': 'border-l-blue-500',
  'scheduled': 'border-l-orange-500',
  'published': 'border-l-green-500',
};

export const ContentView = ({ missions, webhookPublish, webhookSecret, brandVoice }: ContentViewProps) => {
  const { currentUser } = useAuth();
  const [activeStatus, setActiveStatus] = useState<ContentStatus>('idea');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | undefined>(undefined);
  const [schedulingItem, setSchedulingItem] = useState<ContentItem | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [publishErrors, setPublishErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentUser) {
      setContentItems([]);
      return;
    }

    const q = query(collection(db, 'marketingDrafts'), where('uid', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentItem));
      // Sort by updatedAt desc
      items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setContentItems(items);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const filteredItems = contentItems.filter(item => item.status === activeStatus);

  const handleSaveContent = async (item: ContentItem) => {
    if (!currentUser) return;

    try {
      const sanitize = (obj: Record<string, unknown>) =>
        Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));

      if (item.id) {
        // Update existing
        const docRef = doc(db, 'marketingDrafts', item.id);
        const { id, ...data } = item;
        await updateDoc(docRef, sanitize({ ...data, updatedAt: new Date().toISOString() }));
      } else {
        // Create new
        const { id, ...data } = item;
        await addDoc(collection(db, 'marketingDrafts'), sanitize({
          ...data,
          uid: currentUser.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
      }
      
      // Switch to the tab where the item now lives
      setActiveStatus(item.status);
      
    } catch (error) {
      console.error("Error saving content:", error);
    }
  };

  const handleEdit = (item: ContentItem) => {
    setEditingItem(item);
    setIsEditorOpen(true);
  };

  const handleNew = () => {
    setEditingItem(undefined);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditingItem(undefined);
  };

  const updateContentStatus = async (id: string, nextStatus: ContentStatus) => {
    if (!currentUser) return;

    try {
      const docRef = doc(db, 'marketingDrafts', id);
      await updateDoc(docRef, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const duplicateToDraft = async (item: ContentItem) => {
    if (!currentUser) return;

    try {
      const { id, ...data } = item;
      await addDoc(collection(db, 'marketingDrafts'), {
        ...data,
        title: `${item.title} (Copy)`,
        status: 'draft',
        uid: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: null
      });
      setActiveStatus('draft');
    } catch (error) {
      console.error("Error duplicating content:", error);
    }
  };

  const handleScheduleClick = (item: ContentItem) => {
    setSchedulingItem(item);
    setScheduleDate(new Date().toISOString().split('T')[0]);
  };

  const confirmSchedule = async () => {
    if (!schedulingItem || !scheduleDate || !currentUser) return;
    
    // Default to 9 AM on selected date
    const scheduledAt = new Date(`${scheduleDate}T09:00:00`).toISOString();

    try {
      const docRef = doc(db, 'marketingDrafts', schedulingItem.id);
      await updateDoc(docRef, {
        status: 'scheduled',
        scheduledAt,
        updatedAt: new Date().toISOString()
      });
      
      setSchedulingItem(null);
      setScheduleDate('');
    } catch (error) {
      console.error("Error scheduling content:", error);
    }
  };

  const handlePublishNow = async (e: React.MouseEvent, item: ContentItem) => {
    e.stopPropagation();

    if (!webhookPublish) {
      alert("Add Publish webhook in Settings.");
      return;
    }

    // Idempotency guard
    if (publishingIds.has(item.id)) return;

    setPublishingIds(prev => new Set(prev).add(item.id));
    setPublishErrors(prev => { const n = { ...prev }; delete n[item.id]; return n; });

    const publishedAt = new Date().toISOString();
    const hashtags = normalizeHashtags(item.hashtags);
    const payload = {
      requestId: crypto.randomUUID(),
      userId: currentUser?.uid,
      contentId: item.id,
      platform: item.platform,
      title: item.title,
      hook: item.hook ?? null,
      caption: item.caption ?? null,
      hashtags,
      cta: item.cta ?? null,
      imageUrl: item.imageUrl ?? null,
      scheduledAt: item.scheduledAt ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    try {
      const publishHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webhookSecret) publishHeaders['x-vector-secret'] = webhookSecret;
      const res = await fetch(webhookPublish, {
        method: 'POST',
        headers: publishHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Update Firestore on success
      const docRef = doc(db, 'marketingDrafts', item.id);
      await updateDoc(docRef, {
        status: 'published',
        publishedAt,
        updatedAt: publishedAt,
      });
      setActiveStatus('published');
    } catch (err) {
      console.error("Publish Webhook Error:", err);
      setPublishErrors(prev => ({ ...prev, [item.id]: 'Failed to publish. Try again.' }));
    } finally {
      setPublishingIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 px-1">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Content</h2>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Manage your digital footprint.</p>
        </div>
        <button 
          onClick={handleNew}
          disabled={activeStatus === 'published'}
          className={`bg-[#2F5BFF] hover:bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all active:scale-95 ${activeStatus === 'published' ? 'opacity-50 cursor-not-allowed hover:bg-[#2F5BFF]' : ''}`}
          title={activeStatus === 'published' ? "Cannot create directly in Published" : "New Content"}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Segmented Control */}
      <div className="bg-gray-100/50 p-1 rounded-xl flex mb-6 overflow-x-auto no-scrollbar">
        {STATUS_TABS.map((status) => (
          <button
            key={status}
            onClick={() => setActiveStatus(status)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeStatus === status
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Content List */}
      <div className="space-y-3">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-xl p-4 border border-gray-100 border-l-4 ${STATUS_COLORS[item.status]} shadow-sm active:scale-[0.99] transition-all group hover:border-gray-200`}
            >
              <div onClick={() => handleEdit(item)} className="cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${PLATFORM_ICONS[item.platform].bg} ${PLATFORM_ICONS[item.platform].color}`}>
                      {item.platform}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_BADGES[item.status].bg} ${STATUS_BADGES[item.status].text}`}>
                      {STATUS_BADGES[item.status].label}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                
                <h3 className="text-sm font-bold text-gray-900 mb-1 line-clamp-1 group-hover:text-[#2F5BFF] transition-colors">
                  {item.title}
                </h3>
                
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">
                  {item.caption || item.hook || 'No content yet...'}
                </p>

                <div className="flex items-center gap-3 pt-3 border-t border-gray-50 mb-3">
                  {item.status === 'scheduled' && item.scheduledAt && (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">
                      <Clock size={10} />
                      <span>Scheduled: {new Date(item.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </div>
                  )}
                  {item.linkedMissionId && (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                      <span>Linked to Mission</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Inline publish error */}
              {publishErrors[item.id] && (
                <p className="text-[10px] font-medium text-red-500 mt-1 px-0.5">{publishErrors[item.id]}</p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                {item.status === 'idea' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateContentStatus(item.id, 'draft'); }}
                    className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors border border-gray-200"
                  >
                    Move to Draft
                  </button>
                )}
                {item.status === 'draft' && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleScheduleClick(item); }}
                      className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors border border-gray-200"
                    >
                      Schedule
                    </button>
                    <button
                      onClick={(e) => handlePublishNow(e, item)}
                      disabled={publishingIds.has(item.id)}
                      className="flex-1 py-2 bg-[#2F5BFF]/10 hover:bg-[#2F5BFF]/20 text-[#2F5BFF] rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {publishingIds.has(item.id) ? <Loader2 size={12} className="animate-spin" /> : null}
                      {publishingIds.has(item.id) ? 'Publishing...' : 'Publish Now'}
                    </button>
                  </>
                )}
                {item.status === 'scheduled' && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                      className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors border border-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); updateContentStatus(item.id, 'draft'); }}
                      className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors border border-gray-200"
                    >
                      Move to Draft
                    </button>
                    <button
                      onClick={(e) => handlePublishNow(e, item)}
                      disabled={publishingIds.has(item.id)}
                      className="flex-1 py-2 bg-[#2F5BFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {publishingIds.has(item.id) ? <Loader2 size={12} className="animate-spin" /> : null}
                      {publishingIds.has(item.id) ? 'Publishing...' : 'Publish Now'}
                    </button>
                  </>
                )}
                {item.status === 'published' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); duplicateToDraft(item); }}
                    className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors border border-gray-200"
                  >
                    Duplicate to Draft
                  </button>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 text-gray-300">
              <FileText size={20} />
            </div>
            <p className="text-sm font-bold text-gray-900">No {activeStatus.toLowerCase()} items</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
              Tap the + button to start creating new content.
            </p>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {isEditorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <ContentEditor
              isOpen={isEditorOpen}
              onClose={handleCloseEditor}
              item={editingItem}
              initialStatus={activeStatus}
              missions={missions}
              onSave={handleSaveContent}
              brandVoice={brandVoice}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scheduling Modal */}
      {schedulingItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Schedule Post</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                <input 
                  type="date" 
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setSchedulingItem(null)}
                className="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmSchedule}
                disabled={!scheduleDate}
                className="flex-1 py-2 bg-[#2F5BFF] hover:bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
