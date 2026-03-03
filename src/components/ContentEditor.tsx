import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Calendar, Send, Save, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { ContentItem, ContentPlatform, Mission, ContentStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { STATUS_BADGES } from '../constants';

interface ContentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  item?: ContentItem;
  initialStatus?: ContentStatus;
  missions: Mission[];
  onSave: (item: ContentItem) => Promise<void>;
}

const PLATFORMS: { id: ContentPlatform; label: string; color: string }[] = [
  { id: 'Instagram', label: 'Instagram', color: 'bg-pink-500' },
  { id: 'Facebook', label: 'Facebook', color: 'bg-blue-600' },
  { id: 'LinkedIn', label: 'LinkedIn', color: 'bg-blue-700' },
];

export const ContentEditor = ({ isOpen, onClose, item, initialStatus = 'idea', missions, onSave }: ContentEditorProps) => {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<ContentPlatform>('Instagram');
  const [hook, setHook] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [cta, setCta] = useState('');
  const [image, setImage] = useState<string | undefined>(undefined);
  const [linkedMissionId, setLinkedMissionId] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Determine the effective status for the current session
  const currentStatus = item?.status || initialStatus;

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setTitle(item.title);
        setPlatform(item.platform);
        setHook(item.hook || '');
        setCaption(item.caption || '');
        setHashtags(item.hashtags ? item.hashtags.join(' ') : '');
        setCta(item.cta || '');
        setImage(item.image);
        setLinkedMissionId(item.linkedMissionId || '');
        if (item.scheduledAt) {
          const date = new Date(item.scheduledAt);
          setScheduleDate(date.toISOString().split('T')[0]);
          setScheduleTime(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        }
      } else {
        // Reset for new item
        setTitle('');
        setPlatform('Instagram');
        setHook('');
        setCaption('');
        setHashtags('');
        setCta('');
        setImage(undefined);
        setLinkedMissionId('');
        setScheduleDate('');
        setScheduleTime('');
      }
      setIsDirty(false);
      setIsSaving(false);
    }
  }, [isOpen, item]);

  // Mark as dirty on change
  useEffect(() => {
    if (!isOpen) return;
    
    // Check if current values differ from initial values
    const isChanged = 
      title !== (item?.title || '') ||
      platform !== (item?.platform || 'Instagram') ||
      hook !== (item?.hook || '') ||
      caption !== (item?.caption || '') ||
      hashtags !== (item?.hashtags ? item.hashtags.join(' ') : '') ||
      cta !== (item?.cta || '') ||
      image !== item?.image ||
      linkedMissionId !== (item?.linkedMissionId || '');

    setIsDirty(isChanged);
  }, [title, platform, hook, caption, hashtags, cta, image, linkedMissionId, item, isOpen]);

  const handleClose = () => {
    if (isDirty && !isSaving) {
      if (window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const generateWithAI = async (type: 'hook' | 'caption' | 'cta') => {
    const apiKey = localStorage.getItem('vector_openai_key');
    if (!apiKey) {
      alert("Add OpenAI key in Settings first.");
      return;
    }

    const context = `Title: ${title}\n${caption ? `Current Caption: ${caption}` : ''}`;
    let userPrompt = "";
    
    switch (type) {
      case 'hook':
        userPrompt = `Write a strong social media hook about: ${context}`;
        break;
      case 'caption':
        userPrompt = `Write a full caption for: ${context}`;
        break;
      case 'cta':
        userPrompt = `Write a compelling CTA for: ${context}`;
        break;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a social media content strategist. Generate concise, high-performing content." },
            { role: "user", content: userPrompt }
          ]
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      const generatedText = data.choices[0].message.content.trim();

      if (type === 'hook') setHook(prev => prev ? `${prev} ${generatedText}` : generatedText);
      if (type === 'caption') setCaption(prev => prev ? `${prev}\n\n${generatedText}` : generatedText);
      if (type === 'cta') setCta(prev => prev ? `${prev} ${generatedText}` : generatedText);

    } catch (error) {
      console.error("AI Generation Error:", error);
      alert("Failed to generate content. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (targetStatus: ContentStatus = currentStatus) => {
    // If status is scheduled, we need to ensure we have a date
    if (targetStatus === 'scheduled' && (!scheduleDate || !scheduleTime)) {
      setShowScheduleModal(true);
      return;
    }

    setIsSaving(true);
    try {
      const newItem: ContentItem = {
        id: item?.id || Date.now().toString(),
        title: title || 'Untitled',
        platform,
        status: targetStatus,
        hook,
        caption,
        hashtags: hashtags.split(' ').filter(t => t.length > 0),
        cta,
        image,
        linkedMissionId,
        createdAt: item?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: targetStatus === 'scheduled' && scheduleDate && scheduleTime 
          ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString() 
          : item?.scheduledAt,
      };
      await onSave(newItem);
      setIsDirty(false);
      onClose();
    } catch (error) {
      console.error("Error saving content:", error);
      alert("Failed to save content. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsSaving(true);
    try {
      const newItem: ContentItem = {
        id: item?.id || Date.now().toString(),
        title: title || 'Untitled',
        platform,
        status: 'published',
        hook,
        caption,
        hashtags: hashtags.split(' ').filter(t => t.length > 0),
        cta,
        image,
        linkedMissionId,
        createdAt: item?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await onSave(newItem);
      setIsDirty(false);
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error publishing content:", error);
      alert("Failed to publish content. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) return;
    
    setIsSaving(true);
    try {
      const newItem: ContentItem = {
        id: item?.id || Date.now().toString(),
        title: title || 'Untitled',
        platform,
        status: 'scheduled',
        hook,
        caption,
        hashtags: hashtags.split(' ').filter(t => t.length > 0),
        cta,
        image,
        linkedMissionId,
        scheduledAt: new Date(`${scheduleDate}T${scheduleTime}`).toISOString(),
        createdAt: item?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await onSave(newItem);
      setIsDirty(false);
      setShowScheduleModal(false);
      onClose();
    } catch (error) {
      console.error("Error scheduling content:", error);
      alert("Failed to schedule content. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderActionButtons = () => {
    const saveButtonClass = "flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const actionButtonClass = "flex-1 py-3 bg-[#2F5BFF] hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const isNew = !item;
    const saveText = isNew 
      ? (currentStatus === 'idea' ? 'Save Idea' : 'Save Draft') 
      : 'Save Changes';

    if (isSaving) {
      return (
        <button disabled className="w-full py-3 bg-gray-100 text-gray-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          Saving...
        </button>
      );
    }

    switch (currentStatus) {
      case 'idea':
        return (
          <>
            <button onClick={() => handleSave('idea')} className={saveButtonClass} disabled={isSaving}>
              <Save size={16} />
              {saveText}
            </button>
            <button onClick={() => handleSave('draft')} className={actionButtonClass} disabled={isSaving}>
              Move to Draft
              <ChevronRight size={16} />
            </button>
          </>
        );
      case 'draft':
        return (
          <>
            <button onClick={() => handleSave('draft')} className={saveButtonClass} disabled={isSaving}>
              <Save size={16} />
              Save Draft
            </button>
            <button onClick={() => handleSave('scheduled')} className={actionButtonClass} disabled={isSaving}>
              Move to Scheduled
              <ChevronRight size={16} />
            </button>
          </>
        );
      case 'scheduled':
        return (
          <>
            <button onClick={() => handleSave('scheduled')} className={saveButtonClass} disabled={isSaving}>
              <Save size={16} />
              Save Changes
            </button>
            <button onClick={handlePublish} className={actionButtonClass} disabled={isSaving}>
              Move to Published
              <ChevronRight size={16} />
            </button>
          </>
        );
      case 'published':
        return (
          <button onClick={() => handleSave('published')} className={saveButtonClass} disabled={isSaving}>
            <Save size={16} />
            Save Changes
          </button>
        );
      default:
        // Fallback for any other status
        return (
           <button onClick={() => handleSave(currentStatus)} className={saveButtonClass} disabled={isSaving}>
            <Save size={16} />
            Save Changes
          </button>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-900">{item ? 'Edit Content' : 'New Idea'}</h2>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_BADGES[currentStatus].bg} ${STATUS_BADGES[currentStatus].text}`}>
            {STATUS_BADGES[currentStatus].label}
          </span>
        </div>
        <div className="w-6"></div> {/* Spacer for centering */}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-32">
        
        {/* Title */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Post Title / Idea</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the post about?"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
          />
        </div>

        {/* Platform */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Platform</label>
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  platform === p.id
                    ? `bg-gray-900 text-white border-transparent shadow-lg shadow-gray-900/10`
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hook */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Hook (Optional)</label>
          <input
            type="text"
            value={hook}
            onChange={(e) => setHook(e.target.value)}
            placeholder="Grab attention..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
          />
          <button
            onClick={() => generateWithAI('hook')}
            disabled={isGenerating}
            className={`mt-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-colors border border-indigo-100 flex items-center gap-1.5 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span>✨</span> Generate Hook
          </button>
        </div>



        {/* Caption */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Caption</label>
            <span className="text-[10px] font-medium text-gray-400">{caption.length} chars</span>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your caption here..."
            rows={6}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all resize-none"
          />
          <button
            onClick={() => generateWithAI('caption')}
            disabled={isGenerating}
            className={`mt-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-colors border border-indigo-100 flex items-center gap-1.5 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span>✨</span> Generate Caption
          </button>
        </div>

        {/* Media Placeholder */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Media</label>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer overflow-hidden relative"
          >
            {image ? (
              <div className="relative w-full h-48">
                <img src={image} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs font-bold bg-black/50 px-3 py-1 rounded-full">Change Image</span>
                </div>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                  <ImageIcon size={20} />
                </div>
                <span className="text-xs font-medium">Add Image</span>
              </>
            )}
          </div>
        </div>

        {/* Hashtags */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Hashtags</label>
          <input
            type="text"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#design #tech #startup"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
          />
        </div>

        {/* CTA */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Call to Action</label>
          <input
            type="text"
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            placeholder="Link in bio..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
          />
          <button
            onClick={() => generateWithAI('cta')}
            disabled={isGenerating}
            className={`mt-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-colors border border-indigo-100 flex items-center gap-1.5 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span>✨</span> Generate CTA
          </button>
        </div>

        {/* Link to Mission */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Link to Mission (Optional)</label>
          <select
            value={linkedMissionId}
            onChange={(e) => setLinkedMissionId(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all appearance-none"
          >
            <option value="">Select a mission...</option>
            {missions.map(m => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>

        {/* Preview Section */}
        <div className="pt-6 border-t border-gray-100">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">Live Preview</label>
          
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm max-w-xs mx-auto">
            {/* Platform Header Mockup */}
            <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200"></div>
              <div className="flex-1">
                <div className="h-2 w-20 bg-gray-200 rounded mb-1"></div>
                <div className="h-1.5 w-12 bg-gray-100 rounded"></div>
              </div>
            </div>

            {/* Content Preview */}
            <div className="p-0">
              {platform === 'Instagram' && (
                <>
                  <div className="aspect-square bg-gray-100 flex items-center justify-center text-gray-300 overflow-hidden">
                    {image ? (
                      <img src={image} alt="Post" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={32} />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-900 whitespace-pre-wrap">
                      {hook && <span className="font-bold block mb-1">{hook}</span>}
                      {caption || <span className="text-gray-300 italic">Caption preview...</span>}
                    </p>
                    {hashtags && <p className="text-xs text-blue-600 mt-1">{hashtags}</p>}
                  </div>
                </>
              )}

              {platform === 'Facebook' && (
                <>
                  <div className="p-3 pb-2">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {hook && <span className="font-bold block mb-1">{hook}</span>}
                      {caption || <span className="text-gray-300 italic">Caption preview...</span>}
                    </p>
                    {hashtags && <p className="text-xs text-blue-600 mt-1">{hashtags}</p>}
                  </div>
                  <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-300 overflow-hidden">
                    {image ? (
                      <img src={image} alt="Post" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={32} />
                    )}
                  </div>
                  <div className="bg-gray-50 p-2 border-t border-gray-100">
                    <div className="h-2 w-32 bg-gray-200 rounded mb-1"></div>
                    <div className="h-2 w-20 bg-gray-200 rounded"></div>
                  </div>
                </>
              )}

              {platform === 'LinkedIn' && (
                <div className="p-4">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap mb-3">
                    {hook && <span className="font-bold block mb-2">{hook}</span>}
                    {caption || <span className="text-gray-300 italic">Caption preview...</span>}
                  </p>
                  {hashtags && <p className="text-xs text-blue-600 mb-3">{hashtags}</p>}
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 overflow-hidden">
                    {image ? (
                      <img src={image} alt="Post" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={32} />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Platform Footer Mockup */}
            <div className="px-3 py-2 border-t border-gray-100 flex justify-between">
               <div className="h-3 w-3 rounded-full bg-gray-200"></div>
               <div className="h-3 w-3 rounded-full bg-gray-200"></div>
               <div className="h-3 w-3 rounded-full bg-gray-200"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div 
        data-testid="content-action-bar"
        className="border-t border-gray-200 bg-white p-4 pb-8 flex gap-2 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)] sticky bottom-0 z-20"
      >
        <button 
          onClick={handleClose}
          disabled={isSaving}
          className="px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          Cancel
        </button>
        
        <button 
          onClick={() => handleSave(currentStatus)}
          disabled={isSaving}
          className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Save size={16} />
          Save
        </button>

        {currentStatus === 'idea' && (
          <button 
            onClick={() => handleSave('draft')}
            disabled={isSaving}
            className="flex-1 py-3 bg-[#2F5BFF] hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            {isSaving ? 'Saving...' : (
              <>
                To Draft
                <ChevronRight size={16} />
              </>
            )}
          </button>
        )}

        {currentStatus === 'draft' && (
          <button 
            onClick={() => handleSave('scheduled')}
            disabled={isSaving}
            className="flex-1 py-3 bg-[#2F5BFF] hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            {isSaving ? 'Saving...' : (
              <>
                Schedule
                <ChevronRight size={16} />
              </>
            )}
          </button>
        )}

        {currentStatus === 'scheduled' && (
          <button 
            onClick={handlePublish}
            disabled={isSaving}
            className="flex-1 py-3 bg-[#2F5BFF] hover:bg-blue-600 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            {isSaving ? 'Publishing...' : (
              <>
                Publish
                <ChevronRight size={16} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
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
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Time</label>
                <input 
                  type="time" 
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button 
                onClick={handleSchedule}
                disabled={!scheduleDate || !scheduleTime}
                className="flex-1 py-2 bg-[#2F5BFF] text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-[70] w-[90%] max-w-sm"
          >
            <CheckCircle2 size={20} className="text-emerald-400" />
            <div>
              <p className="text-sm font-bold">Published Successfully</p>
              <p className="text-xs text-gray-400">Your content is live.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
