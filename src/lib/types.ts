// ── استوديو الروايات — الأنواع المشتركة ──────────────────────────────

export type MembershipStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  facebookId?: string | null;
  facebookUrl?: string | null;
  facebookName?: string | null;
  membershipStatus: MembershipStatus;
  role: 'admin' | 'member';
  points: number;
  createdAt: string;
}

export interface Novel {
  id: string;
  userId: string;
  title: string;
  authorName: string;
  genre: string;
  description: string;
  coverUrl?: string | null;
  coverColor: string;
  status: 'draft' | 'ongoing' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  novelId: string;
  userId: string;
  title: string;
  content: string;
  order: number;
  wordCount: number;
  published: boolean;
  fbPostUrl?: string | null;
  fbPostId?: string | null;
  lastSyncedReactions?: number;
  lastSyncedComments?: number;
  createdAt: string;
  updatedAt: string;
}

export type PointsReason =
  | 'chapter_created'
  | 'words_milestone'
  | 'published'
  | 'reaction'
  | 'comment'
  | 'daily_login';

export interface PointsEvent {
  id: string;
  userId: string;
  amount: number;
  reason: PointsReason;
  label: string;
  chapterId?: string | null;
  novelId?: string | null;
  createdAt: string;
}

export interface MembershipRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  facebookUrl: string;
  facebookName?: string | null;
  note?: string | null;
  status: MembershipStatus;
  reviewedBy?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  points: number;
  level: number;
  novels: number;
  chapters: number;
}
