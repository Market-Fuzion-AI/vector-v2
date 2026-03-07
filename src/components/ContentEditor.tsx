import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { ContentItem, ContentPlatform, Mission, ContentStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { STATUS_BADGES } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { lsGet, lsSet, lsRemove } from '../utils/localStorage';
import { normalizeHashtags } from '../utils/normalizeHashtags';

interface ContentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  item?: ContentItem;
  initialStatus?: ContentStatus;
  missions: Mission[];
  onSave: (item: ContentItem) => Promise<void>;
  brandVoice: string;
}

/** Deterministic hash — same string always yields the same number */
const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const IMAGE_ASPECT_RATIOS: { id: string; label: string; size: string }[] = [
  { id: 'square',    label: '1:1',      size: '1024x1024' },
  { id: 'portrait',  label: '4:5',      size: '1024x1536' },
  { id: 'landscape', label: '16:9',     size: '1536x1024' },
];

const IMAGE_STYLE_PRESETS: { id: string; label: string; suffix: string }[] = [
  { id: 'auto',         label: 'Auto',         suffix: '' },
  { id: 'minimal',      label: 'Minimal',      suffix: 'minimal flat design, clean white background, soft shadows' },
  { id: '3d',           label: '3D',           suffix: 'stylized 3D render, vibrant colors, glossy materials' },
  { id: 'illustration', label: 'Illustration', suffix: 'hand-drawn illustration style, warm colors, editorial feel' },
  { id: 'photo',        label: 'Photo',        suffix: 'photorealistic, professional photography, well-lit' },
  { id: 'cyberpunk',    label: 'Cyberpunk',    suffix: 'cyberpunk aesthetic, neon lights, dark atmosphere, futuristic' },
];

const PLATFORMS: { id: ContentPlatform; label: string; color: string }[] = [
  { id: 'Instagram', label: 'Instagram', color: 'bg-pink-500' },
  { id: 'Facebook', label: 'Facebook', color: 'bg-blue-600' },
  { id: 'LinkedIn', label: 'LinkedIn', color: 'bg-blue-700' },
];

export const ContentEditor = ({ isOpen, onClose, item, initialStatus = 'idea', missions, onSave, brandVoice }: ContentEditorProps) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<ContentPlatform>('Instagram');
  const [hook, setHook] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [cta, setCta] = useState('');
  const [image, setImage] = useState<string | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStylePreset, setImageStylePreset] = useState('auto');
  const [imageGenStatus, setImageGenStatus] = useState<'idle' | 'generating' | 'uploading' | 'done' | 'error'>('idle');
  const [imageGenProgress, setImageGenProgress] = useState(0);
  const [imageAspectRatio, setImageAspectRatio] = useState('square');
  const [linkedMissionId, setLinkedMissionId] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [promptImproved, setPromptImproved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const progressIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const draftDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // localStorage key — only used for new (unsaved) items
  const draftKey = !item && currentUser ? `vector_v2_draft_new_${currentUser.uid}` : null;

  // Clear progress interval on unmount
  useEffect(() => () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); }, []);

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
        setImageUrl(item.imageUrl);
        setImagePrompt(item.imagePrompt || '');
        setImageStylePreset(item.imageStyle || 'auto');
        setLinkedMissionId(item.linkedMissionId || '');
        if (item.scheduledAt) {
          const date = new Date(item.scheduledAt);
          setScheduleDate(date.toISOString().split('T')[0]);
          setScheduleTime(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        }
      } else {
        // Reset for new item — then try to restore a local draft
        const saved = draftKey ? lsGet<{
          title: string; platform: ContentPlatform; hook: string;
          caption: string; hashtags: string; cta: string;
        }>(draftKey) : null;

        setTitle(saved?.title ?? '');
        setPlatform(saved?.platform ?? 'Instagram');
        setHook(saved?.hook ?? '');
        setCaption(saved?.caption ?? '');
        setHashtags(saved?.hashtags ?? '');
        setCta(saved?.cta ?? '');
        setImage(undefined);
        setImageUrl(undefined);
        setImagePrompt('');
        setImageStylePreset('auto');
        setImageAspectRatio('square');
        setLinkedMissionId('');
        setScheduleDate('');
        setScheduleTime('');
      }
      setIsDirty(false);
      setIsSaving(false);
      setSaveStatus('idle');
      setImageGenStatus('idle');
      setImageGenProgress(0);
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
      imageUrl !== item?.imageUrl ||
      imagePrompt !== (item?.imagePrompt || '') ||
      imageStylePreset !== (item?.imageStyle || 'auto') ||
      linkedMissionId !== (item?.linkedMissionId || '');

    setIsDirty(isChanged);
  }, [title, platform, hook, caption, hashtags, cta, image, imageUrl, imagePrompt, imageStylePreset, linkedMissionId, item, isOpen]);

  // Debounced localStorage save for new (unsaved) drafts
  useEffect(() => {
    if (!draftKey || !isOpen || item) return;
    if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
    draftDebounceRef.current = setTimeout(() => {
      lsSet(draftKey, { title, platform, hook, caption, hashtags, cta });
    }, 400);
    return () => { if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current); };
  }, [title, platform, hook, caption, hashtags, cta, draftKey, isOpen, item]);

  const handleClose = () => {
    if (isDirty && !isSaving) {
      if (window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const generateWithAI = async (type: 'hook' | 'caption' | 'cta' | 'hashtags') => {

    // ── context ───────────────────────────────────────────────────────────────
    const contextParts = [
      title && `Title: ${title}`,
      hook  && `Hook: ${hook}`,
      caption && `Caption (existing): ${caption}`,
    ].filter(Boolean).join('\n');

    // Pull a concrete noun/detail from title for the specificity rule
    // (a simple heuristic: take the longest word >=5 chars from title, or first noun-looking word)
    const titleWords = title.split(/\s+/).filter(w => w.length >= 4);
    const concreteDetail = titleWords[0] || title.split(/\s+/)[0] || '';

    const captionLimit = platform === 'LinkedIn' ? 520 : 240;

    // ── brand voice / style guide ─────────────────────────────────────────────
    const voiceGuide = brandVoice?.trim()
      ? `Brand voice (follow this closely): ${brandVoice.trim()}`
      : 'Tone: casual, friendly, confident. Short sentences. No corporate buzzwords. No marketing fluff.';

    const systemMsg =
      `You write social media copy. ` +
      `${voiceGuide} ` +
      `Never use: revolutionize, game-changer, unlock, elevate, next-level, transform, empower, leverage, synergy, cutting-edge. ` +
      `Output ONLY the requested text — no labels, no quotes, no extra commentary.`;

    // ── per-type prompt ───────────────────────────────────────────────────────
    let userPrompt = '';
    switch (type) {
      case 'hook':
        userPrompt =
          `Write one social media hook for this post.\n` +
          `Context:\n${contextParts}\n\n` +
          `Rules:\n` +
          `- Exactly 1 sentence, max 12 words\n` +
          `- Must include the word or concept "${concreteDetail}" or something concrete from the title\n` +
          `- No generic phrases. No hashtags. No emojis.\n` +
          `- Casual and confident tone.`;
        break;
      case 'caption':
        userPrompt =
          `Write a ${platform} caption for this post.\n` +
          `Context:\n${contextParts}\n\n` +
          `Format (follow exactly):\n` +
          `Line 1: short opener, max 70 chars\n` +
          `Line 2: • first bullet point\n` +
          `Line 3: • second bullet point\n` +
          `Line 4: short CTA line (no hashtags)\n\n` +
          `Rules:\n` +
          `- Max ${captionLimit} characters total\n` +
          `- At least one bullet must reference "${concreteDetail}" or a concrete detail from the title\n` +
          `- No hashtags anywhere in the caption\n` +
          `- Max 1 emoji total (optional, only if it genuinely fits)\n` +
          `- No corporate language, no filler phrases`;
        break;
      case 'cta':
        userPrompt =
          `Write one call-to-action for this post.\n` +
          `Context:\n${contextParts}\n\n` +
          `Rules:\n` +
          `- Max 7 words\n` +
          `- Must start with an action verb\n` +
          `- No trailing period. No emojis. No hashtags.\n` +
          `- Direct and friendly tone.`;
        break;
      case 'hashtags': {
        const hashtagCount = '3–5';
        userPrompt =
          `Generate hashtags for this ${platform} post.\n` +
          `Context:\n${contextParts}\n\n` +
          `Rules:\n` +
          `- ${hashtagCount} hashtags, each starts with #, separated by spaces, single line\n` +
          `- At least one must use a concrete keyword from the title\n` +
          `- No duplicates\n` +
          `- Output only the hashtags, nothing else.`;
        break;
      }
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    const callOpenAI = async (sysMsg: string, msg: string): Promise<string> => {
      const res = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: sysMsg }, { role: 'user', content: msg }],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
      });
      const data = await res.json() as { error?: string; text?: string };
      if (data.error) throw new Error(data.error);
      return data.text!;
    };

    // ── limit check ───────────────────────────────────────────────────────────
    const withinLimits = (text: string): boolean => {
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      if (type === 'hook') {
        const sentences = (text.match(/[.!?]/g) || []).length;
        return words <= 12 && sentences <= 1;
      }
      if (type === 'cta') return words <= 7;
      if (type === 'caption') return text.length <= captionLimit;
      if (type === 'hashtags') {
        const count = text.split(/\s+/).filter(t => t.startsWith('#')).length;
        return count >= 3 && count <= 5;
      }
      return true;
    };

    setIsGenerating(true);
    try {
      let result = await callOpenAI(systemMsg, userPrompt);

      // ── one rewrite pass if limits exceeded ───────────────────────────────
      if (!withinLimits(result)) {
        const limitDesc =
          type === 'hook'    ? '1 sentence, max 12 words' :
          type === 'cta'     ? 'max 7 words, starts with a verb, no period' :
                               `max ${captionLimit} characters, keep the 4-line bullet format`;
        result = await callOpenAI(
          systemMsg,
          `Rewrite to fit limits EXACTLY (${limitDesc}). Keep the same meaning, tone, and format. Output only the rewritten text:\n\n${result}`
        );
      }

      if (type === 'hook')     setHook(result);
      if (type === 'caption')  setCaption(result);
      if (type === 'cta')      setCta(result);
      if (type === 'hashtags') setHashtags(normalizeHashtags(result).join(' '));

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

  const generateImage = async () => {
    if (!currentUser) { alert("You must be logged in to generate images."); return; }
    if (!title.trim() && !imagePrompt.trim()) { alert("Add a title or image prompt first."); return; }

    const preset = IMAGE_STYLE_PRESETS.find(p => p.id === imageStylePreset);
    const aspectRatio = IMAGE_ASPECT_RATIOS.find(a => a.id === imageAspectRatio) || IMAGE_ASPECT_RATIOS[0];
    const basePrompt = imagePrompt.trim() || [title, hook, caption].filter(Boolean).join('. ');
    const finalPrompt = [basePrompt, preset?.suffix].filter(Boolean).join('. ') + '. No text overlay. High-quality, modern, clean composition.';

    // Clear any stale interval
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    setImageGenStatus('generating');
    setImageGenProgress(10);

    // Fake ramp: increment by 2–7 every 800ms, cap at 85
    progressIntervalRef.current = setInterval(() => {
      setImageGenProgress(prev => {
        if (prev >= 85) { clearInterval(progressIntervalRef.current!); return 85; }
        return Math.min(prev + Math.random() * 5 + 2, 85);
      });
    }, 800);

    try {
      // 1. Call image generation via backend proxy
      const res = await fetch('/api/openai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          size: aspectRatio.size,
          quality: 'high',
          output_format: 'png',
        }),
      });
      const data = await res.json() as { error?: string; b64?: string };
      if (data.error) throw new Error(data.error);

      // Jump to 95 when upload begins
      clearInterval(progressIntervalRef.current!);
      setImageGenStatus('uploading');
      setImageGenProgress(95);

      // 2. Decode base64 → Blob
      const b64 = data.b64;
      if (!b64) {
        throw new Error('Image data missing from response.');
      }
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'image/png' });

      // 3. Upload to Firebase Storage
      const storageRef = ref(storage, `users/${currentUser.uid}/content-images/${Date.now()}.png`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      setImageUrl(url);
      setImageGenProgress(100);
      setImageGenStatus('done');
    } catch (error) {
      console.error("Image generation error:", error);
      clearInterval(progressIntervalRef.current!);
      setImageGenStatus('error');
      setImageGenProgress(0);
    }
  };

  const improvePrompt = async () => {
    if (!imagePrompt.trim()) return;
    const styleLabel = IMAGE_STYLE_PRESETS.find(p => p.id === imageStylePreset)?.label || 'Auto';
    const ratioLabel = IMAGE_ASPECT_RATIOS.find(a => a.id === imageAspectRatio)?.label || '1:1';
    setIsImprovingPrompt(true);
    try {
      const res = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert prompt engineer for image generation. ' +
                'Rewrite the user\'s prompt into a structured, descriptive image-gen prompt ' +
                '(subject, scene, lighting, composition, visual style cues). ' +
                'Preserve the creative intent — but rephrase any wording that could trigger content safety filters. ' +
                'Replace graphic violence, gore, explicit content, or disturbing details with cinematic equivalents: ' +
                'use language like "cinematic", "stylized", "atmospheric", "dramatic", "dark fantasy", "implied", "silhouette", "moody lighting". ' +
                'The output must be safe for OpenAI image generation. ' +
                'Output ONLY the improved prompt text — no quotes, no labels, no commentary. ' +
                'Keep it under 500 characters.',
            },
            {
              role: 'user',
              content:
                `Original prompt: ${imagePrompt.trim()}\n` +
                `Style: ${styleLabel}\n` +
                `Aspect ratio: ${ratioLabel}\n` +
                `Requirements: no text overlay, high quality`,
            },
          ],
        }),
      });
      const data = await res.json() as { error?: string; text?: string };
      if (data.error) throw new Error(data.error);
      const improved = data.text!;
      setImagePrompt(improved);
      setPromptImproved(true);
      setTimeout(() => setPromptImproved(false), 2000);
    } catch (err) {
      console.error('Improve prompt error:', err);
    } finally {
      setIsImprovingPrompt(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !scheduleTime) return;
    if (!title.trim()) {
      alert("Please add a title before saving.");
      return;
    }
    
    setIsSaving(true);
    try {
      const newItem: ContentItem = {
        id: item?.id || Date.now().toString(),
        title: title || 'Untitled',
        platform,
        status: 'scheduled',
        hook,
        caption,
        hashtags: normalizeHashtags(hashtags),
        cta,
        imageUrl,
        linkedMissionId,
        scheduledAt: new Date(`${scheduleDate}T${scheduleTime}`).toISOString(),
        createdAt: item?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await onSave(newItem);
      if (draftKey) lsRemove(draftKey);
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

  const buildPayload = (targetStatus: ContentStatus): ContentItem => {
    const now = new Date().toISOString();
    return {
      ...(item?.id ? { id: item.id } : {}),
      title,
      platform,
      status: targetStatus,
      hook,
      caption,
      hashtags: hashtags.split(' ').filter(t => t.length > 0),
      cta,
      imageUrl,
      imagePrompt: imagePrompt || undefined,
      imageStyle: imageStylePreset !== 'auto' ? imageStylePreset : undefined,
      linkedMissionId,
      createdAt: item?.createdAt || now,
      updatedAt: now,
      scheduledAt: item?.scheduledAt,
    } as ContentItem;
  };

  const handleSaveIdea = async () => {
    if (!title.trim()) { alert("Please add a title before saving."); return; }
    setIsSavingContent(true);
    setSaveStatus('idle');
    try {
      await onSave(buildPayload('idea'));
      if (draftKey) lsRemove(draftKey);
      setSaveStatus('saved');
      setTimeout(() => onClose(), 800);
    } catch (error) {
      console.error("Error saving content:", error);
      setSaveStatus('error');
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleSaveAndMoveToDraft = async () => {
    if (!title.trim()) { alert("Please add a title before saving."); return; }
    setIsSavingContent(true);
    setSaveStatus('idle');
    try {
      await onSave(buildPayload('draft'));
      if (draftKey) lsRemove(draftKey);
      setSaveStatus('saved');
      setTimeout(() => onClose(), 800);
    } catch (error) {
      console.error("Error saving content:", error);
      setSaveStatus('error');
    } finally {
      setIsSavingContent(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
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

        {/* Media */}
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Media</label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          {/* Upload tap area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer overflow-hidden relative"
          >
            {(imageUrl || image) ? (
              <div className="relative w-full h-48">
                <img src={imageUrl || image} alt="Preview" className="w-full h-full object-contain rounded-lg" />
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

          {/* Image Prompt */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Image Prompt (optional)</label>
              <div className="flex items-center gap-2">
                {!imagePrompt && title && (
                  <button
                    onClick={() => setImagePrompt(title)}
                    className="text-[10px] font-bold text-[#2F5BFF] hover:underline"
                  >
                    Use title
                  </button>
                )}
                {imagePrompt.trim().length > 0 && (
                  <button
                    onClick={improvePrompt}
                    disabled={isImprovingPrompt || imageGenStatus === 'generating' || imageGenStatus === 'uploading'}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors disabled:opacity-40 ${
                      promptImproved
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'
                    }`}
                  >
                    {isImprovingPrompt ? '…' : promptImproved ? 'Improved ✓' : '✨ Improve'}
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={imagePrompt}
              onChange={e => setImagePrompt(e.target.value)}
              placeholder="Describe the image you want… (ex: minimal flat illustration of a robot typing, pastel colors)"
              rows={2}
              disabled={imageGenStatus === 'generating' || imageGenStatus === 'uploading'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all resize-none disabled:opacity-50"
            />
          </div>

          {/* Style presets */}
          <div className="mt-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Style</label>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {IMAGE_STYLE_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setImageStylePreset(p.id)}
                  disabled={imageGenStatus === 'generating' || imageGenStatus === 'uploading'}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border disabled:opacity-50 ${
                    imageStylePreset === p.id
                      ? 'bg-gray-900 text-white border-transparent'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="mt-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Aspect Ratio</label>
            <div className="flex gap-1.5">
              {IMAGE_ASPECT_RATIOS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setImageAspectRatio(a.id)}
                  disabled={imageGenStatus === 'generating' || imageGenStatus === 'uploading'}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border disabled:opacity-50 ${
                    imageAspectRatio === a.id
                      ? 'bg-gray-900 text-white border-transparent'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Image button + progress */}
          <div className="mt-2">
            <button
              onClick={generateImage}
              disabled={imageGenStatus === 'generating' || imageGenStatus === 'uploading' || isGenerating}
              className={`px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-colors border border-indigo-100 flex items-center gap-1.5 ${(imageGenStatus === 'generating' || imageGenStatus === 'uploading') ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {(imageGenStatus === 'generating' || imageGenStatus === 'uploading') ? (
                <>
                  <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  {imageGenStatus === 'uploading' ? 'Uploading…' : 'Generating…'}
                </>
              ) : (
                <><span>✨</span> Generate Image</>
              )}
            </button>

            {imageGenStatus !== 'idle' && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-gray-400">
                    {imageGenStatus === 'generating' ? 'Generating image…' :
                     imageGenStatus === 'uploading'  ? 'Uploading…' :
                     imageGenStatus === 'done'        ? 'Done ✓' : 'Failed'}
                  </span>
                  <span className="text-[10px] font-medium text-gray-400">{Math.round(imageGenProgress)}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      imageGenStatus === 'error' ? 'bg-red-400' :
                      imageGenStatus === 'done'  ? 'bg-emerald-400' :
                      'bg-indigo-500'
                    }`}
                    style={{ width: `${imageGenProgress}%` }}
                  />
                </div>
              </div>
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
          <button
            onClick={() => generateWithAI('hashtags')}
            disabled={isGenerating}
            className={`mt-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-colors border border-indigo-100 flex items-center gap-1.5 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span>✨</span> Generate Hashtags
          </button>
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
                    {(imageUrl || image) ? (
                      <img src={imageUrl || image} alt="Post" className="w-full h-full object-cover" />
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
                    {(imageUrl || image) ? (
                      <img src={imageUrl || image} alt="Post" className="w-full h-full object-cover" />
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
                    {(imageUrl || image) ? (
                      <img src={imageUrl || image} alt="Post" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={32} />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Social Proof Row */}
            {(() => {
              const seed = item?.id || title;
              const likes    = seed ? hashStr(seed + 'l') % 900 + 100 : 0;
              const comments = seed ? hashStr(seed + 'c') % 90 + 5 : 0;
              const shares   = seed ? hashStr(seed + 's') % 50 + 2 : 0;
              return (
                <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                  <span>❤️ {likes.toLocaleString()}</span>
                  <span>💬 {comments}</span>
                  <span>🔁 {shares}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Save Actions — sticky footer */}
      <div className="border-t border-gray-200 bg-white px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex flex-col gap-3 sticky bottom-0 z-20">
        {saveStatus === 'error' && (
          <p className="text-center text-xs font-medium text-red-500">Save failed — try again</p>
        )}
        <button
          onClick={handleSaveIdea}
          disabled={isSavingContent || saveStatus === 'saved'}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-colors border disabled:opacity-50 ${
            saveStatus === 'saved' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
            'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
          }`}
        >
          {isSavingContent ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save Idea'}
        </button>
        <button
          onClick={handleSaveAndMoveToDraft}
          disabled={isSavingContent || saveStatus === 'saved'}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-colors shadow-lg disabled:opacity-50 ${
            saveStatus === 'saved' ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
            'bg-[#2F5BFF] hover:bg-blue-600 text-white shadow-blue-500/20'
          }`}
        >
          {isSavingContent ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : 'Save + Move to Draft'}
        </button>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
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
