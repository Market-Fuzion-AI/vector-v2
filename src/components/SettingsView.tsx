import React, { useState } from 'react';
import { User, Camera, Save, Bell, Moon, Shield, LogOut, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase';
import { collection, query, where, getDocs, limit, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateEmail, updatePassword } from 'firebase/auth';
import imageCompression from 'browser-image-compression';

export interface UserProfile {
  name: string;
  avatarUrl: string;
  linkedinUrl?: string;
  tagline?: string;
  streak?: number;
  lastCompletionDate?: string;
}

interface SettingsViewProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

export const SettingsView = ({ user, onUpdateUser }: SettingsViewProps) => {
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [linkedinUrl, setLinkedinUrl] = useState(user?.linkedinUrl || '');
  const [tagline, setTagline] = useState(user?.tagline || 'Ready To Take On The Day!');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [openaiKey, setOpenaiKey] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [webhookReport, setWebhookReport] = useState('');
  const [webhookPublish, setWebhookPublish] = useState('');
  const [firebaseTestResult, setFirebaseTestResult] = useState<string | null>(null);
  
  // New account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { currentUser, signOut, authError } = useAuth();

  React.useEffect(() => {
    // Update local state if user prop changes (e.g. from parent refresh)
    if (user) {
      setName(user.name || '');
      setAvatarUrl(user.avatarUrl || '');
      setLinkedinUrl(user.linkedinUrl || '');
      setTagline(user.tagline || '');
    }
  }, [user]);

  React.useEffect(() => {
    if (currentUser?.email) {
      setEmail(currentUser.email);
    }
  }, [currentUser]);

  React.useEffect(() => {
    const storedStreak = localStorage.getItem('streakCount');
    if (storedStreak) {
      setStreakCount(parseInt(storedStreak, 10));
    }
    const storedKey = localStorage.getItem('vector_openai_key');
    if (storedKey) {
      setOpenaiKey(storedKey);
    }
    const storedBrandVoice = localStorage.getItem('vector_brand_voice');
    if (storedBrandVoice) {
      setBrandVoice(storedBrandVoice);
    }
    const storedWebhookReport = localStorage.getItem('vector_webhook_report');
    if (storedWebhookReport) {
      setWebhookReport(storedWebhookReport);
    }
    const storedWebhookPublish = localStorage.getItem('vector_webhook_publish');
    if (storedWebhookPublish) {
      setWebhookPublish(storedWebhookPublish);
    }
  }, []);

  const handleSaveSettings = async () => {
    if (!currentUser) return;
    setIsSaving(true);

    try {
      // 1. Password Validation
      if (password || confirmPassword) {
        if (password !== confirmPassword) {
          alert("Passwords do not match.");
          setIsSaving(false);
          return;
        }
        if (password.length < 6) {
          alert("Password must be at least 6 characters.");
          setIsSaving(false);
          return;
        }
      }

      // 2. Auth Updates (Email & Password)
      if (email !== currentUser.email) {
        await updateEmail(currentUser, email);
      }
      if (password) {
        await updatePassword(currentUser, password);
      }

      // 3. Firestore Updates (Profile + Settings)
      const userRef = doc(db, 'users', currentUser.uid);
      const userData = {
        name,
        avatarUrl,
        linkedinUrl,
        tagline,
        openaiApiKey: openaiKey,
        brandVoice,
        webhooks: {
          report: webhookReport,
          publish: webhookPublish
        },
        updatedAt: new Date().toISOString()
      };

      await setDoc(userRef, userData, { merge: true });

      // 4. LocalStorage Updates (Legacy Support)
      localStorage.setItem('vector_openai_key', openaiKey);
      localStorage.setItem('vector_brand_voice', brandVoice);
      localStorage.setItem('vector_webhook_report', webhookReport);
      localStorage.setItem('vector_webhook_publish', webhookPublish);

      // 5. Update Parent State
      onUpdateUser({ name, avatarUrl, linkedinUrl, tagline });

      // Clear sensitive fields
      setPassword('');
      setConfirmPassword('');
      
      alert("Settings saved successfully!");

    } catch (error: any) {
      console.error("Error saving settings:", error);
      alert(`Failed to save settings: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestFirebase = async () => {
    if (!currentUser) {
      setFirebaseTestResult("Sign in first (No active session)");
      return;
    }

    try {
      const q = query(collection(db, "missions"), where("uid", "==", currentUser.uid), limit(1));
      const querySnapshot = await getDocs(q);
      setFirebaseTestResult(`Success: signed in as ${currentUser.uid}. missions query ok. Found ${querySnapshot.size} docs.`);
    } catch (error: any) {
      console.error("Firestore Test Error:", error);
      setFirebaseTestResult(`Error: ${error.code} | ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentUser) {
      alert("Please sign in to upload a profile photo.");
      return;
    }

    try {
      setIsUploading(true);

      // 1. Compress image
      const options = {
        maxSizeMB: 0.25, // Target ~250KB
        maxWidthOrHeight: 768,
        useWebWorker: true,
        fileType: 'image/webp'
      };
      
      const compressedFile = await imageCompression(file, options);
      
      // 2. Upload to Firebase Storage
      const storageRef = ref(storage, `users/${currentUser.uid}/profile/avatar.webp`);
      
      await uploadBytes(storageRef, compressedFile, {
        contentType: 'image/webp'
      });

      // 3. Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // 4. Update state & Firestore
      setAvatarUrl(downloadURL);
      
      // Update Firestore immediately with the new URL
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { avatarUrl: downloadURL }, { merge: true });
      
      // Also update parent state
      onUpdateUser({ 
        name, 
        avatarUrl: downloadURL, 
        linkedinUrl, 
        tagline 
      });

    } catch (error) {
      console.error("Error uploading avatar:", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 px-1">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h2>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Manage your profile and preferences.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <div className="flex flex-col items-center">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <div className={`relative mb-4 group cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => fileInputRef.current?.click()}>
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-gray-50 shadow-md">
                <img 
                  src={avatarUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-0 right-0 bg-[#2F5BFF] text-white p-2 rounded-full shadow-lg border-2 border-white hover:bg-blue-600 transition-colors">
                <Camera size={14} />
              </div>
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>

            <div className="w-full space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Your daily motto..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">LinkedIn URL</label>
                <input
                  type="text"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                />
              </div>

              {/* Account Fields Merged Here */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-900 mb-3">Account Details</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">New Password (Optional)</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave blank to keep current"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI & Automations */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">AI & Automations</h4>
          </div>
          <div className="p-4 space-y-6">
            {/* AI Section */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">OpenAI API Key</label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                />
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Used to generate captions, hooks, and CTAs inside Content.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Brand Voice (Optional)</label>
                <textarea
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  placeholder="Describe your voice, audience, and style..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Describe your voice, audience, and style. Used when generating hooks/captions/CTAs.
                </p>
              </div>
            </div>

            <div className="h-px bg-gray-100 w-full"></div>

            {/* Automations Section */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Generate Report Webhook (Make.com)</label>
                <input
                  type="text"
                  value={webhookReport}
                  onChange={(e) => setWebhookReport(e.target.value)}
                  placeholder="https://hook.make.com/..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                />
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Triggered when clicking Generate Report.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Publish Content Webhook (Make.com)</label>
                <input
                  type="text"
                  value={webhookPublish}
                  onChange={(e) => setWebhookPublish(e.target.value)}
                  placeholder="https://hook.make.com/..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F5BFF]/20 focus:border-[#2F5BFF] transition-all"
                />
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Triggered when publishing content.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Main Save Button */}
        <div className="sticky bottom-6 z-10">
          <button 
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="w-full py-4 bg-[#2F5BFF] hover:bg-blue-600 text-white rounded-2xl text-base font-bold transition-all shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save size={20} />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>

        {/* Firebase Test */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Firebase Test</h4>
          </div>
          <div className="p-4 space-y-4">
            <button 
              onClick={handleTestFirebase}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-orange-500/20"
            >
              Test Firebase
            </button>
            {firebaseTestResult && (
              <p className="text-sm text-center font-medium text-gray-700">
                {firebaseTestResult}
              </p>
            )}
          </div>
        </div>



        {/* Debug Info */}
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-[10px] font-mono text-gray-500 break-all">
          <h4 className="font-bold text-gray-700 mb-2 uppercase tracking-widest">Debug Info</h4>
          <p>Origin: {window.location.origin}</p>
          <p>Auth Domain Hint: Ensure this origin is in Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains.</p>
          <p>User UID: {currentUser?.uid || 'null'}</p>
          <p>User Email: {currentUser?.email || 'null'}</p>
          {authError && <p className="text-red-500 font-bold mt-1">Last Auth Error: {authError}</p>}
        </div>

        {/* Danger Zone */}
        <button 
          onClick={handleSignOut}
          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-200 flex items-center justify-center gap-2 text-red-500 font-medium hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
        
        <div className="text-center text-[10px] text-gray-400 font-medium pt-4">
          Vector OS v2.0.4 (Beta)
        </div>
      </div>
    </div>
  );
};
