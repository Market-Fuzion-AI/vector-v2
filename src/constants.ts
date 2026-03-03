import { MissionCategory, ContentStatus } from './types';

export const CATEGORY_CONFIG: Record<MissionCategory, { color: string; bg: string; text: string; border: string }> = {
  'Personal': { color: '#16A34A', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'Financial': { color: '#D4AF37', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  'Development': { color: '#4F46E5', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Automation': { color: '#2563EB', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Admin': { color: '#F97316', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Design': { color: '#DB2777', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  'Planning': { color: '#0D9488', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  'Strategic': { color: '#A855F7', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'Tactical': { color: '#3B82F6', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

export const getCategoryStyle = (category: MissionCategory) => {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG['Tactical'];
};

export const STATUS_BADGES: Record<ContentStatus, { bg: string; text: string; label: string }> = {
  'idea': { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Idea' },
  'draft': { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Draft' },
  'scheduled': { bg: 'bg-orange-50', text: 'text-orange-600', label: 'Scheduled' },
  'published': { bg: 'bg-green-50', text: 'text-green-600', label: 'Published' },
};
