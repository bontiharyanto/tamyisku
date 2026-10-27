export type UserRole = 'user' | 'tutor' | 'admin';
export type SubscriptionStatus = 'active' | 'inactive' | 'expired';

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

export type Subscription = {
  status: SubscriptionStatus;
  startDate: string | null;
  endDate: string | null;
  paymentMethod: string | null;
};

export type Lesson = {
  id: string;
  title: string;
  level: number;
  category: string | null;
  description: string | null;
  orderIndex: number;
};

export type QuranWord = {
  id: string;
  lessonId: string;
  surahNumber: number;
  ayahNumber: number;
  wordPosition: number;
  arabicText: string;
  transliteration: string | null;
  translation: string;
  tamyizCategory: string;
  colorCode: string | null;
  audioUrl: string | null;
};

export type QuizItem = {
  id: string;
  lessonId: string;
  question: string;
  correctAnswer: string;
  scorePoints: number;
  arabicText: string;
  translation: string;
  explanation: string;
  audioUrl: string | null;
  orderIndex: number;
};

export type ProgressRow = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  score: number;
  isCompleted: boolean;
  updatedAt: string;
};

export type Overview = {
  activeSubscribers: number;
  monthlyRevenue: number;
  dailyActiveLearners: number;
  completedModules: number;
  totalUsers: number;
};

export type Streak = {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
};

export type EarnedBadge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: string;
  unlockedAt: string | null;
};

export type Celebration = {
  currentStreak: number;
  longestStreak: number;
  streakIncreased: boolean;
  newBadges: { id: string; title: string; description: string; icon: string }[];
};

export type NotifyPrefs = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export type ManagedUser = AppUser & {
  createdAt: string;
  subscription: Subscription;
};

export function teaches(role: UserRole | undefined) {
  return role === 'admin' || role === 'tutor';
}

export function roleLabel(role: UserRole | undefined) {
  if (role === 'admin') return 'Admin';
  if (role === 'tutor') return 'Pengajar';
  return 'Santri';
}

export function isSubscriptionActive(subscription: Subscription | null) {
  if (!subscription || subscription.status !== 'active' || !subscription.endDate) return false;
  return new Date(subscription.endDate).getTime() > Date.now();
}

export function subscriptionState(subscription: Subscription | null): SubscriptionStatus {
  if (!subscription || subscription.status === 'inactive') return 'inactive';
  if (!isSubscriptionActive(subscription)) return 'expired';
  return 'active';
}
