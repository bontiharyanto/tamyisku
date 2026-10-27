export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: string;
};

export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    id: 'streak_3_days',
    title: 'Semangat Pembelajar',
    description: 'Belajar Tamyiz tiga hari berturut-turut.',
    icon: '🔥',
    requirement: 'Streak 3 hari',
  },
  {
    id: 'streak_7_days',
    title: 'Istiqomah 7 Hari',
    description: 'Menjaga belajar selama tujuh hari berturut-turut.',
    icon: '🌙',
    requirement: 'Streak 7 hari',
  },
  {
    id: 'modules_5',
    title: 'Penjelajah Tamyiz',
    description: 'Menyelesaikan lima modul dengan nilai lulus.',
    icon: '🧭',
    requirement: '5 modul selesai',
  },
  {
    id: 'quiz_perfect',
    title: 'Nilai Sempurna',
    description: 'Mendapat skor 100 pada kuis untuk pertama kali.',
    icon: '⭐',
    requirement: 'Skor kuis 100',
  },
];
