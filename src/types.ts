export type MissionCategory = 
  | 'Personal'
  | 'Financial'
  | 'Development'
  | 'Automation'
  | 'Admin'
  | 'Design'
  | 'Planning'
  | 'Strategic' // Keeping for backward compatibility if needed, or map them
  | 'Tactical'; // Keeping for backward compatibility if needed, or map them

export interface MissionTimer {
  isRunning: boolean;
  elapsedSeconds: number;
  startedAt?: string;
  pausedAt?: string;
  pauseCount: number;
}

export interface Mission {
  id: string;
  title: string;
  category: MissionCategory;
  dueDate?: string;
  effort?: string; // e.g., '1h', '2h', '4h', 'Custom'
  progress?: number;
  status: 'Active' | 'Queue' | 'Backlog' | 'Completed';
  completedDate?: string; // ISO string
  elapsedSeconds?: number;
  startedAt?: string; // ISO string
  endedAt?: string; // ISO string
}

export type ContentPlatform = 'Instagram' | 'Facebook' | 'LinkedIn';
export type ContentStatus = 'idea' | 'draft' | 'scheduled' | 'published';

export interface ContentItem {
  id: string;
  title: string;
  platform: ContentPlatform;
  status: ContentStatus;
  hook?: string;
  caption?: string;
  hashtags?: string[];
  cta?: string;
  media?: string[]; // Placeholder for media URLs
  image?: string; // Base64 image string
  linkedMissionId?: string;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
}

export const initialMissions: Mission[] = [
  { id: '1', title: 'Finalize V2 UI Polish', category: 'Design', dueDate: 'Feb 21', progress: 65, status: 'Active' },
  { id: '2', title: 'Deploy V2 to Production', category: 'Development', dueDate: 'Feb 23', effort: '4h', status: 'Queue' },
  { id: '3', title: 'Update Documentation', category: 'Admin', effort: '2h', status: 'Queue' },
  { id: '4', title: 'Fix Mobile Navigation Bug', category: 'Development', effort: '1h', status: 'Queue' },
  { id: '5', title: 'Q2 Roadmap Planning', category: 'Planning', status: 'Backlog' },
  { id: '6', title: 'Optimize Database Queries', category: 'Development', status: 'Backlog' },
  { id: '7', title: 'Team Onboarding Flow', category: 'Admin', status: 'Backlog' },
];

export const initialContent: ContentItem[] = [
  {
    id: '1',
    title: 'V2 Launch Announcement',
    platform: 'LinkedIn',
    status: 'idea',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Behind the Scenes: Design Process',
    platform: 'Instagram',
    status: 'draft',
    hook: 'Ever wonder how we design?',
    caption: 'Here is a sneak peek into our design process for the new V2 interface. We focused on clarity and speed.',
    hashtags: ['#design', '#ui', '#ux'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Feature Spotlight: Dark Mode',
    platform: 'Facebook',
    status: 'scheduled',
    caption: 'Dark mode is finally here! Switch it on in settings.',
    scheduledAt: '2026-02-25T10:00:00.000Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
