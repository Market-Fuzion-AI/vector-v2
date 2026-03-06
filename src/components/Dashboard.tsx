import React, { useState, useEffect } from 'react';
import { 
  MoreHorizontal, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Layout, 
  FileText, 
  Calendar,
  ChevronRight,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Pause,
  Settings,
  Linkedin,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

import { PlanView } from './PlanView';
import { ContentView } from './ContentView';
import { SettingsView, UserProfile, UserSettings } from './SettingsView';
import { EditMissionModal } from './EditMissionModal';
import { AddMissionModal } from './AddMissionModal';
import { Mission, MissionTimer, MissionCategory } from '../types';
import { getCategoryStyle } from '../constants';
import { normalizeStatus } from '../utils/missionStatus';
import { lsGet, lsSet, lsRemove } from '../utils/localStorage';

// --- Components ---

const Avatar = ({ url, onClick }: { url: string; onClick?: () => void }) => (
  <div className="relative cursor-pointer" onClick={onClick}>
    <img 
      src={url} 
      alt="Profile" 
      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
    />
    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
  </div>
);

const GreetingHeader = ({ user, onAvatarClick, streak, completedToday }: { user: UserProfile; onAvatarClick: () => void; streak: number; completedToday: number }) => {
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);
  useEffect(() => { setIsAvatarLoaded(false); }, [user.avatarUrl]);

  const handleLinkedinClick = () => {
    if (user.linkedinUrl) {
      window.open(user.linkedinUrl, '_blank');
    } else {
      console.warn('No LinkedIn URL set in settings.');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200">
      {/* Row 1: Avatar, Greeting, LinkedIn */}
      <div className="flex items-start justify-between mb-0">
        <div className="flex items-start gap-3 min-w-0 flex-1">
           <div className="relative shrink-0 cursor-pointer mt-1" onClick={onAvatarClick}>
             {user.avatarUrl && (
               <img
                 src={user.avatarUrl}
                 alt="Profile"
                 className={`w-10 h-10 rounded-full object-cover border border-gray-100 ${isAvatarLoaded ? '' : 'hidden'}`}
                 onLoad={() => setIsAvatarLoaded(true)}
               />
             )}
             {(!user.avatarUrl || !isAvatarLoaded) && (
               <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-100" />
             )}
             <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
           </div>
           <h2 className="text-lg font-bold text-gray-900 leading-tight tracking-tight pt-0.5 min-w-0 truncate">
             Good morning, {user.name} <span className="text-base opacity-80">☀️</span>
           </h2>
        </div>
        <button 
          onClick={handleLinkedinClick}
          className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 text-[#0077B5] hover:bg-gray-100 transition-colors shrink-0 mt-1"
          title={user.linkedinUrl ? "Open LinkedIn" : "Set LinkedIn URL in Settings"}
        >
          <Linkedin size={16} fill="currentColor" />
        </button>
      </div>

      {/* Row 2: Tagline */}
      <div className="mb-4 pl-[52px] -mt-3">
        <p className="text-xs font-medium text-gray-500 leading-tight truncate">
          {user.tagline || 'Ready To Take On The Day!'}
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100 w-full mb-4"></div>

      {/* Row 3: Stats */}
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
        {streak > 0 && (
          <span className="font-bold text-orange-500 flex items-center gap-1">
            <span>🔥</span> {streak}-day streak
          </span>
        )}
        {streak > 0 && <span>·</span>}
        <span>{completedToday} mission{completedToday !== 1 ? 's' : ''} completed today</span>
      </div>
    </div>
  );
};

const ActiveMissionSection = ({ 
  isMissionActive, 
  onToggle, 
  activeMission,
  onCompleteMission,
  onActivateNext,
  missionTimer,
  nextMissionsCount,
}: { 
  isMissionActive: boolean; 
  onToggle: () => void;
  activeMission?: Mission;
  onCompleteMission: () => void;
  onActivateNext: () => void;
  missionTimer: MissionTimer;
  nextMissionsCount: number;
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeMission) {
    if (nextMissionsCount === 0) {
      return (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-dashed border-gray-300 text-center flex flex-col items-center justify-center shadow-sm">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
            <Layout size={24} />
          </div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">No Active Mission</h3>
          <p className="text-xs text-gray-500 mb-6 max-w-[200px] mx-auto">The command center is clear. Go to Plan to add a mission.</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-dashed border-gray-300 text-center flex flex-col items-center justify-center shadow-sm">
        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
          <Layout size={24} />
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">No Active Mission</h3>
        <p className="text-xs text-gray-500 mb-6 max-w-[200px] mx-auto">The command center is clear. Select a mission to begin execution.</p>
        <button
          onClick={onActivateNext}
          className="bg-[#2F5BFF] hover:bg-blue-600 text-white text-xs font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2 focus:outline-none focus:ring-0"
        >
          <CheckCircle2 size={16} />
          ACTIVATE NEXT MISSION
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className={`bg-white rounded-2xl p-5 sm:p-6 relative overflow-hidden group transition-colors ${
          isMissionActive
            ? 'shadow-sm border-2 border-[#2F5BFF]'
            : 'shadow-sm border border-gray-200'
        }`}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isMissionActive ? 'bg-orange-500' : 'bg-gray-300'}`}></div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">TODAY'S MISSION</span>
          </div>
          {activeMission.dueDate && (
            <span className="text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <Clock size={10} />
              {activeMission.dueDate}
            </span>
          )}
        </div>

        <h3 className="text-2xl font-bold text-gray-900 mb-4 tracking-tight leading-snug flex flex-col gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded w-fit ${getCategoryStyle(activeMission.category).bg} ${getCategoryStyle(activeMission.category).text}`}>
            {activeMission.category}
          </span>
          {activeMission.title}
        </h3>

        {/* Timer Display */}
        <div className="mb-6 flex items-center gap-2 text-xs font-medium text-gray-500">
          {missionTimer.isRunning ? (
            <>
              <span className="animate-pulse text-[#2F5BFF]">⏱</span>
              <span className="text-gray-900 tabular-nums">{formatTime(missionTimer.elapsedSeconds)}</span>
              <span className="text-gray-400">elapsed</span>
            </>
          ) : missionTimer.elapsedSeconds > 0 ? (
            <>
              <span className="text-orange-500">⏸</span>
              <span className="text-gray-900">Paused</span>
              <span className="text-gray-400">at {formatTime(missionTimer.elapsedSeconds)}</span>
            </>
          ) : (
            <>
              <span className="text-gray-300">⏱</span>
              <span className="text-gray-400">00:00</span>
              <span className="text-gray-300">•</span>
              <span className="text-gray-400">Not started</span>
            </>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={(e) => { (e.currentTarget as HTMLElement).blur(); onToggle(); }}
            className={`flex-1 text-white font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm tracking-wide focus:outline-none focus:ring-0 ${
              isMissionActive
                ? 'bg-gray-900 hover:bg-black shadow-gray-900/20'
                : 'bg-[#2F5BFF] hover:bg-blue-600 shadow-blue-500/20'
            }`}
          >
            {isMissionActive ? (
              <>
                <span>PAUSE MISSION</span>
                <Pause size={16} className="opacity-80" />
              </>
            ) : (
              <>
                <span>{missionTimer.elapsedSeconds > 0 ? 'RESUME MISSION' : 'START MISSION'}</span>
                <ChevronRight size={16} className="opacity-80" />
              </>
            )}
          </button>
          
          {isMissionActive && (
            <button
              onClick={(e) => { (e.currentTarget as HTMLElement).blur(); onCompleteMission(); }}
              className="w-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center focus:outline-none focus:ring-0"
              title="Complete Mission"
            >
              <CheckCircle2 size={24} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const NextUpSection = ({ 
  isBlurred, 
  nextMissions,
  onEdit
}: { 
  isBlurred?: boolean; 
  nextMissions: Mission[];
  onEdit: (mission: Mission) => void;
}) => {
  return (
    <div className={`bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200 transition-all duration-500 ${isBlurred ? 'opacity-50 grayscale-[0.5]' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">NEXT MISSIONS</span>
        <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{nextMissions.length} Ready</span>
      </div>
      
      {nextMissions.length === 0 ? (
        <div className="text-center py-4 border border-dashed border-gray-100 rounded-xl bg-gray-50/50">
          <p className="text-xs font-medium text-gray-400">No next missions queued</p>
        </div>
      ) : (
        <div className="space-y-1">
          {nextMissions.map((mission) => (
            <button
              key={mission.id}
              onClick={(e) => { (e.currentTarget as HTMLElement).blur(); onEdit(mission); }}
              className="w-full flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-3 -mx-3 rounded-xl transition-colors active:scale-[0.99] text-left focus:outline-none focus:ring-0"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${getCategoryStyle(mission.category).bg} ${getCategoryStyle(mission.category).text}`}>
                  {mission.category}
                </span>
                <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">{mission.title}</p>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                {mission.dueDate && (
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md group-hover:bg-white group-hover:shadow-sm transition-all">
                    {mission.dueDate}
                  </span>
                )}
                <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const DailyCloseSection = ({ isBlurred, missions, weeklyFocus, webhookReport, webhookSecret }: { isBlurred?: boolean; missions: Mission[]; weeklyFocus: string; webhookReport: string; webhookSecret: string }) => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState('Good');
  const [win, setWin] = useState('');
  const [friction, setFriction] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryTimestamp, setSummaryTimestamp] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const isSendingRef = React.useRef(false);
  const briefDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const briefKey = currentUser ? `vector_v2_dailybrief_${currentUser.uid}_${today}` : null;

  // Load today's debrief: Firestore first, fall back to localStorage draft
  React.useEffect(() => {
    if (!currentUser) return;
    const summaryRef = doc(db, 'users', currentUser.uid, 'dailySummaries', today);
    getDoc(summaryRef).then((snap) => {
      if (snap.exists()) {
        // Firestore wins — load and discard any local draft
        const data = snap.data();
        if (data.summary) setSummary(data.summary);
        if (data.mood) setMood(data.mood);
        if (data.energy) setEnergy(data.energy);
        if (data.win) setWin(data.win);
        if (data.friction) setFriction(data.friction);
        if (data.createdAt) setSummaryTimestamp(data.createdAt);
        setShowSummary(true);
        if (briefKey) lsRemove(briefKey); // clean up stale local copy
      } else if (briefKey) {
        // No Firestore doc yet — restore local draft if one exists
        const draft = lsGet<{ win: string; friction: string; mood: string; energy: number }>(briefKey);
        if (draft) {
          if (draft.win !== undefined) setWin(draft.win);
          if (draft.friction !== undefined) setFriction(draft.friction);
          if (draft.mood) setMood(draft.mood);
          if (draft.energy) setEnergy(draft.energy);
        }
      }
    }).catch((err) => console.error('Error loading daily summary:', err));
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced localStorage save as user types
  React.useEffect(() => {
    if (!briefKey) return;
    if (briefDebounceRef.current) clearTimeout(briefDebounceRef.current);
    briefDebounceRef.current = setTimeout(() => {
      lsSet(briefKey, { win, friction, mood, energy });
    }, 400);
    return () => { if (briefDebounceRef.current) clearTimeout(briefDebounceRef.current); };
  }, [win, friction, mood, energy, briefKey]);

  const handleGenerateReport = async () => {
    if (!currentUser) {
      alert("Sign in to save your daily debrief.");
      return;
    }

    // Idempotency guard — prevent double-send on rapid taps
    if (isSendingRef.current) return;

    // Validate webhook before doing anything else
    if (!webhookReport) {
      alert("Add Generate Report webhook in Settings.");
      return;
    }

    isSendingRef.current = true;
    setReportStatus('sending');

    // 1. Gather Data
    const completedToday = missions.filter(m =>
      m.status === 'Completed' &&
      m.completedDate &&
      new Date(m.completedDate).toDateString() === new Date().toDateString()
    );

    const topMissions = completedToday
      .sort((a, b) => new Date(b.completedDate!).getTime() - new Date(a.completedDate!).getTime())
      .slice(0, 3)
      .map(m => m.title);

    // 2. Build Summary String
    let report = `Today was a ${mood.toLowerCase()} day with energy at ${energy}/5. `;
    if (win) report += `Your biggest win was: "${win}". `;
    if (friction) report += `You encountered some friction with: "${friction}". `;
    if (completedToday.length > 0) {
      report += `You completed ${completedToday.length} mission${completedToday.length > 1 ? 's' : ''}, including ${topMissions.join(', ')}. `;
    } else {
      report += `No missions were explicitly marked complete today. `;
    }
    if (weeklyFocus) report += `This aligned with your weekly focus on "${weeklyFocus}".`;

    // 3. Store & Update State
    const timestamp = new Date().toISOString();
    setSummary(report);
    setSummaryTimestamp(timestamp);
    setShowSummary(true);

    // Persist to Firestore: users/{uid}/dailySummaries/{YYYY-MM-DD}
    const summaryRef = doc(db, 'users', currentUser.uid, 'dailySummaries', today);
    setDoc(summaryRef, { summary: report, mood, energy, win, friction, createdAt: timestamp })
      .catch((err) => console.error('Error saving daily summary:', err));

    // 4. Trigger Webhook — rich payload
    const payload = {
      requestId: crypto.randomUUID(),
      userId: currentUser.uid,
      timestamp,
      day: today,
      energy,
      mood,
      win,
      friction,
      missions: missions.map(m => ({ id: m.id, title: m.title, status: m.status, category: m.category })),
    };

    try {
      const reportHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webhookSecret) reportHeaders['x-vector-secret'] = webhookSecret;
      const res = await fetch(webhookReport, {
        method: 'POST',
        headers: reportHeaders,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (briefKey) lsRemove(briefKey); // draft promoted to Firestore — no longer needed
      setReportStatus('sent');
      setTimeout(() => setReportStatus('idle'), 2000);
    } catch (err) {
      console.error("Webhook Error:", err);
      setReportStatus('failed');
      setTimeout(() => setReportStatus('idle'), 3000);
    } finally {
      isSendingRef.current = false;
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 transition-all duration-500 overflow-hidden ${isBlurred ? 'opacity-50 grayscale-[0.5]' : ''}`}>
      <button
        onClick={(e) => { (e.currentTarget as HTMLElement).blur(); setIsOpen(!isOpen); }}
        className="w-full flex items-center justify-between p-5 sm:p-6 hover:bg-gray-50/50 transition-colors focus:outline-none focus:ring-0"
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
            <RotateCcw size={20} />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-gray-900">Daily Debrief</h3>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Close the loop on today.</p>
          </div>
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
           <ChevronDown size={18} className="text-gray-300" />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-100"
          >
            <div className="p-5 sm:p-6 space-y-6">
              {/* Win */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-1">
                  <span className="text-yellow-500">🏆</span> Win
                </label>
                <input 
                  type="text" 
                  value={win}
                  onChange={(e) => setWin(e.target.value)}
                  placeholder="What moved the needle today?"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                />
              </div>

              {/* Difficult */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-1">
                  <span className="text-red-500">⚠️</span> Friction
                </label>
                <input 
                  type="text" 
                  value={friction}
                  onChange={(e) => setFriction(e.target.value)}
                  placeholder="Blockers, distractions, or friction..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                />
              </div>

              {/* Mood */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">
                  Mood
                </label>
                <div className="flex gap-2">
                  {[
                    { label: 'Good', emoji: '🙂' },
                    { label: 'Neutral', emoji: '😐' },
                    { label: 'Off', emoji: '😕' }
                  ].map((m) => (
                    <button
                      key={m.label}
                      onClick={() => setMood(m.label)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                        mood === m.label 
                          ? 'bg-[#2F5BFF] border-transparent text-white shadow-md shadow-blue-500/20' 
                          : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      <span className="mr-1.5">{m.emoji}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block flex items-center gap-1">
                  <span className="text-blue-500">⚡</span> Energy
                </label>
                <div className="flex justify-between bg-gray-50 p-1 rounded-xl border border-gray-200 mb-1.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => setEnergy(level)}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                        energy === level 
                          ? 'bg-[#2F5BFF] text-white shadow-md shadow-blue-500/20' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] font-medium text-gray-400 px-1">
                  <span>Drained</span>
                  <span>Steady</span>
                  <span>Peak</span>
                </div>
              </div>

              <button
                onClick={handleGenerateReport}
                disabled={reportStatus === 'sending'}
                className={`w-full mt-4 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-white
                  ${reportStatus === 'sending' ? 'opacity-70 cursor-not-allowed' : 'active:scale-[0.98]'}
                  ${reportStatus === 'sent' ? 'bg-green-500 shadow-md shadow-green-500/20' :
                    reportStatus === 'failed' ? 'bg-red-500 shadow-md shadow-red-500/20' :
                    showSummary ? 'bg-[#5A75D6] hover:bg-[#4A65C6] shadow-md shadow-blue-500/10' :
                    'bg-[#3B64FF] hover:bg-[#2F5BFF] shadow-lg shadow-blue-500/20'}`}
              >
                {reportStatus === 'sending' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <RotateCcw size={18} className="text-white/90" />
                )}
                <span>
                  {reportStatus === 'sent' ? 'Sent ✅' :
                   reportStatus === 'failed' ? 'Failed to send' :
                   reportStatus === 'sending' ? 'Sending...' :
                   showSummary ? 'REGENERATE REPORT' : 'GENERATE REPORT'}
                </span>
              </button>

              <AnimatePresence>
                {showSummary && summary && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: 10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: 10 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 bg-gray-50/80 rounded-2xl p-5 border border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">🧠</span>
                        <h4 className="text-sm font-bold text-gray-900">Daily Summary</h4>
                      </div>
                      
                      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
                        <p>{summary}</p>
                      </div>

                      <div className="mt-5 pt-4 border-t border-gray-200/60 flex justify-between items-center text-[10px] text-gray-400 font-medium tracking-wide">
                        <span>Generated at {summaryTimestamp ? new Date(summaryTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Just now'}</span>
                        <span className="opacity-70">Based on Mood, Energy, Alignment</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => {
  const navItems = [
    { icon: Layout, label: 'Today' },
    { icon: Calendar, label: 'Plan' },
    { icon: FileText, label: 'Content' },
    { icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 px-6 z-50">
      <div className="flex justify-between items-center max-w-md mx-auto h-16">
        {navItems.map((item, index) => (
          <button
            key={index}
            onClick={(e) => { (e.currentTarget as HTMLElement).blur(); setActiveTab(item.label); }}
            className={`flex flex-col items-center gap-1 w-12 focus:outline-none focus:ring-0 ${
              activeTab === item.label ? 'text-[#2F5BFF]' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <item.icon size={22} strokeWidth={activeTab === item.label ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { currentUser } = useAuth();

  // 1. All useState hooks
  const [isMissionActive, setIsMissionActive] = useState(false);
  const [activeTab, setActiveTab] = useState('Today');
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>({
    brandVoice: '',
    webhookReport: '',
    webhookPublish: '',
    webhookSecret: '',
  });
  const [missions, setMissions] = useState<Mission[]>([]);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = React.useRef(false);
  const migratedStatusDocIdsRef = React.useRef<Set<string>>(new Set());
  const [user, setUser] = useState<UserProfile>({
    name: 'Emerson',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
    streak: 0,
    lastCompletionDate: ''
  });
  const [missionTimer, setMissionTimer] = useState<MissionTimer>({
    isRunning: false,
    elapsedSeconds: 0,
    pauseCount: 0
  });
  // Derived state for completedToday
  const completedToday = missions.filter(m => {
    if (m.status !== 'Completed' || !m.completedDate) return false;
    const today = new Date().toDateString();
    const completed = new Date(m.completedDate).toDateString();
    return today === completed;
  }).length;

  // Derived streak from user state (with check for broken streak)
  const streak = React.useMemo(() => {
    if (!user.lastCompletionDate || !user.streak) return 0;
    const today = new Date();
    const lastDate = new Date(user.lastCompletionDate);
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // If last completion was today or yesterday, streak is valid
    // Note: diffDays calculation might be tricky with timezones, but let's stick to simple logic for now
    // Better: check if lastDate is < today - 1 day (midnight to midnight)
    
    const todayString = today.toDateString();
    const lastDateString = lastDate.toDateString();
    
    if (todayString === lastDateString) return user.streak;
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === lastDateString) return user.streak;
    
    return 0; // Streak broken
  }, [user.streak, user.lastCompletionDate]);

  const [weeklyFocus, setWeeklyFocus] = useState("Polish UI & Fix Critical Bugs");
  const [quarterObjective, setQuarterObjective] = useState("Launch V2 Beta");

  // 2. All useEffect hooks
  
  // Hydrate user from Firestore on auth change
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!currentUser) return;

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          // Merge with existing state to keep defaults if fields are missing
          setUser(prev => ({
            ...prev,
            name: data.name || prev.name,
            avatarUrl: data.avatarUrl || prev.avatarUrl,
            linkedinUrl: data.linkedinUrl || prev.linkedinUrl,
            tagline: data.tagline || prev.tagline,
            streak: data.streak || 0,
            lastCompletionDate: data.lastCompletionDate || ''
          }));
          setUserSettings({
            brandVoice: data.brandVoice || '',
            webhookReport: data.webhooks?.report || '',
            webhookPublish: data.webhooks?.publish || '',
            webhookSecret: data.webhooks?.secret || '',
          });
          if (data.weeklyFocus) setWeeklyFocus(data.weeklyFocus);
          if (data.quarterObjective) setQuarterObjective(data.quarterObjective);
        } else {
          // Create minimal doc if not exists
          const newProfile = {
            name: currentUser.displayName || user.name,
            avatarUrl: user.avatarUrl,
            tagline: user.tagline,
            linkedinUrl: user.linkedinUrl || '',
            streak: 0,
            lastCompletionDate: ''
          };
          await setDoc(userRef, newProfile, { merge: true });
          // No need to setUser here as it matches current state
        }
        setIsProfileLoaded(true);
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setIsProfileLoaded(true); // show UI even on error rather than hanging
      }
    };

    fetchUserProfile();
  }, [currentUser]);

  // Load/Seed Missions from Firestore
  useEffect(() => {
    if (!currentUser) {
      setMissions([]);
      return;
    }

    const missionsRef = collection(db, 'missions');
    // Order by createdAt to keep consistent order. 
    // Note: This requires an index if combined with 'where'. 
    // If index missing, it will error in console with link to create it.
    // For now, let's just fetch and sort client-side if needed, or rely on default order.
    // But 'orderBy' is better. Let's try simple query first to avoid index issues for now, 
    // or assume index creation is fine.
    // Actually, let's just filter by uid.
    const q = query(missionsRef, where('uid', '==', currentUser.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setMissions([]);
      } else {
        const loadedMissions = snapshot.docs.map((snapDoc) => {
          const data = snapDoc.data();
          const normalizedStatus = normalizeStatus(data.status);

          // Safe one-time migration: write normalized status back to Firestore if needed.
          const storedTrimmed = typeof data.status === 'string' ? data.status.trim() : '';
          if (
            storedTrimmed !== normalizedStatus &&
            !migratedStatusDocIdsRef.current.has(snapDoc.id)
          ) {
            migratedStatusDocIdsRef.current.add(snapDoc.id);
            void updateDoc(doc(db, 'missions', snapDoc.id), { status: normalizedStatus }).catch((e) => {
              console.error('Failed to migrate mission status', snapDoc.id, e);
            });
          }
          return {
            id: snapDoc.id,
            ...data,
            // Ensure status exists to prevent "undefined status" crashes
            status: normalizedStatus
          } as Mission;
        });
        
        // Sort by status (Active first) then createdAt?
        // Or just keep them as is.
        // Let's sort by createdAt to maintain insertion order (simulating the initial array order)
        loadedMissions.sort((a, b) => {
           // If createdAt exists
           if (a['createdAt'] && b['createdAt']) {
             return new Date(a['createdAt']).getTime() - new Date(b['createdAt']).getTime();
           }
           return 0;
        });

        setMissions(loadedMissions);
      }
    }, (error) => {
      console.error("Error fetching missions:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Persist weeklyFocus + quarterObjective to Firestore when they change
  React.useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    void updateDoc(userRef, { weeklyFocus }).catch(() => {});
  }, [weeklyFocus, currentUser]);

  React.useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    void updateDoc(userRef, { quarterObjective }).catch(() => {});
  }, [quarterObjective, currentUser]);

  // Initialize streak and daily count from localStorage
  // REMOVED: Logic is now handled by Firestore hydration and derived state
  
  const activeMission = missions.find(m => m.status === 'Active');
  const nextMissions = missions.filter(m => m.status === 'Queue');

  React.useEffect(() => {
    if (!activeMission) {
      setIsMissionActive(false);
      setMissionTimer(prev => ({ ...prev, isRunning: false }));
    }
  }, [activeMission]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (missionTimer.isRunning) {
      interval = setInterval(() => {
        setMissionTimer(prev => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [missionTimer.isRunning]);

  // 3. Helper functions
  const handleUpdateUser = (updatedUser: UserProfile) => {
    if (!updatedUser) return;
    setUser(prev => ({ ...prev, ...updatedUser }));
  };

  const recordMissionCompletion = async () => {
    if (!currentUser) return;
    
    const today = new Date();
    const todayString = today.toDateString();
    const lastDateString = user.lastCompletionDate ? new Date(user.lastCompletionDate).toDateString() : '';
    
    let newStreak = user.streak || 0;
    
    // If already completed today, don't increment streak
    if (lastDateString === todayString) {
      // do nothing to streak
    } else {
      // Check if yesterday was completed
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastDateString === yesterday.toDateString()) {
        newStreak += 1;
      } else {
        newStreak = 1; // Reset or start new
      }
    }
    
    // Update Firestore
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        streak: newStreak,
        lastCompletionDate: today.toISOString()
      });
      
      // Update local state immediately for UI responsiveness
      setUser(prev => ({
        ...prev,
        streak: newStreak,
        lastCompletionDate: today.toISOString()
      }));
      
    } catch (error) {
      console.error("Error updating streak:", error);
    }
  };

  const handleAvatarClick = () => {
    setActiveTab('Settings');
  };

  const handleToggleMission = async () => {
    if (isMissionActive) {
      // Pausing
      setMissionTimer(prev => ({
        ...prev,
        isRunning: false,
        pausedAt: new Date().toISOString(),
        pauseCount: prev.pauseCount + 1
      }));
      setIsMissionActive(false);
      
      // Persist elapsed time to Firestore
      if (activeMission && currentUser) {
        try {
          const missionRef = doc(db, 'missions', activeMission.id);
          await updateDoc(missionRef, {
            elapsedSeconds: missionTimer.elapsedSeconds,
            updatedAt: new Date().toISOString(),
            uid: currentUser.uid
          });
        } catch (error) {
          console.error("Error saving paused state:", error);
        }
      }

    } else {
      // Starting/Resuming
      setMissionTimer(prev => ({
        ...prev,
        isRunning: true,
        startedAt: prev.startedAt || new Date().toISOString(),
        pausedAt: undefined
      }));
      setIsMissionActive(true);
    }
  };

  const handleCompleteMission = async () => {
    if (!activeMission || !currentUser) return;
    
    recordMissionCompletion();

    try {
      // 1. Mark current as Completed
      const missionRef = doc(db, 'missions', activeMission.id);
      await updateDoc(missionRef, {
        status: 'Completed',
        completedDate: new Date().toISOString(),
        elapsedSeconds: missionTimer.elapsedSeconds,
        startedAt: missionTimer.startedAt || new Date().toISOString(),
        endedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uid: currentUser.uid
      });

      // 2. Find next in Queue and make Active
      const nextQueue = missions.find(m => m.status === 'Queue');
      if (nextQueue) {
        await updateDoc(doc(db, 'missions', nextQueue.id), { 
          status: 'Active', 
          progress: 0,
          updatedAt: new Date().toISOString(),
          uid: currentUser.uid
        });
      }

      // 3. Find first in Backlog and move to Queue (Conveyor Belt)
      const nextBacklog = missions.find(m => m.status === 'Backlog');
      if (nextBacklog) {
        await updateDoc(doc(db, 'missions', nextBacklog.id), { 
          status: 'Queue',
          updatedAt: new Date().toISOString(),
          uid: currentUser.uid
        });
      }

      // Exit focus mode
      setIsMissionActive(false);
      setMissionTimer({
        isRunning: false,
        elapsedSeconds: 0,
        pauseCount: 0
      });

    } catch (error) {
      console.error("Error completing mission:", error);
    }
  };

  const handleActivateNext = async () => {
    if (!currentUser) return;
    const nextQueue = missions.find(m => m.status === 'Queue');
    if (nextQueue) {
      try {
        await updateDoc(doc(db, 'missions', nextQueue.id), { 
          status: 'Active', 
          progress: 0,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          uid: currentUser.uid
        });
        
        setIsMissionActive(true);
        setMissionTimer({
          isRunning: true,
          elapsedSeconds: 0,
          startedAt: new Date().toISOString(),
          pauseCount: 0
        });
      } catch (error) {
        console.error("Error activating next mission:", error);
      }
    }
  };

  const handleEditMission = (mission: Mission) => {
    setEditingMission(mission);
  };

  const handleSaveMission = async (updatedMission: Mission) => {
    if (!currentUser) return;
    try {
      const missionRef = doc(db, 'missions', updatedMission.id);
      // Destructure to remove id from the data payload
      const { id, ...data } = updatedMission;
      await updateDoc(missionRef, {
        ...data,
        updatedAt: new Date().toISOString(),
        uid: currentUser.uid
      });
      setEditingMission(null);
    } catch (error) {
      console.error("Error saving mission:", error);
    }
  };

  const handleDeleteMission = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'missions', id));
      if (activeMission && activeMission.id === id) {
        setIsMissionActive(false);
      }
      setEditingMission(null);
    } catch (error) {
      console.error("Error deleting mission:", error);
    }
  };

  const createMission = async (missionData: {
    title: string;
    category: MissionCategory;
    dueDate?: string;
    destination: 'Today' | 'Next' | 'Backlog';
  }) => {
    // DEBUG: tells us if createMission is firing once or multiple times per click
    console.count('[createMission] called');
  
    if (isSavingRef.current) {
      console.warn('[createMission] called while saving, ignoring.');
      return;
    }
  
    console.debug('[createMission] payload', missionData);
  
    isSavingRef.current = true;
    setIsSaving(true);
  
    try {
      if (!currentUser) throw new Error('No user logged in');
  
      // Map destination to status
      let status: 'Active' | 'Queue' | 'Backlog' = 'Backlog';
      if (missionData.destination === 'Today') status = 'Active';
      else if (missionData.destination === 'Next') status = 'Queue';
      else if (missionData.destination === 'Backlog') status = 'Backlog';
  
      // If destination is Today (Active), pause any existing active mission
      if (status === 'Active') {
        const currentActive = missions.find(m => m.status === 'Active');
        if (currentActive) {
          const currentActiveRef = doc(db, 'missions', currentActive.id);
          await updateDoc(currentActiveRef, {
            status: 'Queue',
            updatedAt: new Date().toISOString(),
          });
        }
      }
  
      const newMission = {
        title: missionData.title,
        category: missionData.category,
        dueDate: missionData.dueDate,
        status: status,
        uid: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
  
      // Remove undefined fields
      const sanitizedMission = Object.fromEntries(
        Object.entries(newMission).filter(([_, v]) => v !== undefined)
      );
  
      await addDoc(collection(db, 'missions'), sanitizedMission);
    } catch (error) {
      console.error('[createMission] Error creating mission:', error);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleAddMission = async (mission: { title: string; category: MissionCategory; dueDate?: string; destination: 'Today' | 'Next' | 'Backlog' }) => {
    await createMission(mission);
    setIsAddModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F2F2F7] to-[#E5E5EA] text-gray-900 font-sans pb-10 overflow-x-hidden selection:bg-[#2F5BFF]/20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#F2F2F7]/90 backdrop-blur-md px-4 sm:px-5 py-3">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{activeTab}</h1>
        </div>
      </header>

      <main className="px-4 sm:px-5 max-w-md mx-auto pt-2 pb-24">
        {/* Always mounted — hidden via HTML attribute to preserve state across tab switches */}
        <div hidden={activeTab !== 'Today'}>
          <div className="space-y-6 pt-6">
            {isProfileLoaded && <GreetingHeader user={user} onAvatarClick={handleAvatarClick} streak={streak} completedToday={completedToday} />}
            <div className="mt-6 mb-6 relative">
              <ActiveMissionSection
                isMissionActive={isMissionActive}
                onToggle={handleToggleMission}
                activeMission={activeMission}
                onCompleteMission={handleCompleteMission}
                onActivateNext={handleActivateNext}
                missionTimer={missionTimer}
                nextMissionsCount={nextMissions.length}
              />
              {/* Conveyor Belt Connector */}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-6 h-6 w-px bg-gray-300"></div>
            </div>
            <NextUpSection
              isBlurred={isMissionActive}
              nextMissions={nextMissions}
              onEdit={handleEditMission}
            />
            <DailyCloseSection isBlurred={isMissionActive} missions={missions} weeklyFocus={weeklyFocus} webhookReport={userSettings.webhookReport} webhookSecret={userSettings.webhookSecret} />
          </div>
        </div>

        <div hidden={activeTab !== 'Plan'}>
          <PlanView
            missions={missions}
            onUpdateMissions={setMissions}
            weeklyFocus={weeklyFocus}
            onUpdateWeeklyFocus={setWeeklyFocus}
            quarterObjective={quarterObjective}
            onUpdateQuarterObjective={setQuarterObjective}
            onAddMission={handleAddMission}
            onSaveMission={handleSaveMission}
            onDeleteMission={handleDeleteMission}
            isSaving={isSaving}
          />
        </div>

        <div hidden={activeTab !== 'Content'}>
          <ContentView missions={missions} webhookPublish={userSettings.webhookPublish} webhookSecret={userSettings.webhookSecret} brandVoice={userSettings.brandVoice} />
        </div>

        <div hidden={activeTab !== 'Settings'}>
          <SettingsView user={user} onUpdateUser={handleUpdateUser} settings={userSettings} />
        </div>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

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
  );
}
