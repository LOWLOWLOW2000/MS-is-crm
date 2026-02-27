import type { UserRole } from '@/lib/types';

type RoleTheme = {
  label: string;
  badgeClass: string;
  subtitle: string;
};

export const getRoleTheme = (role: UserRole): RoleTheme => {
  switch (role) {
    case 'is_member':
      return {
        label: 'ISメンバー',
        badgeClass: 'bg-blue-600 text-white',
        subtitle: '今日の架電状況と次に架電する企業を確認しましょう。',
      };
    case 'director':
      return {
        label: 'ディレクター',
        badgeClass: 'bg-indigo-600 text-white',
        subtitle: 'チーム全体の状況とヘルプキューを確認しましょう。',
      };
    case 'enterprise_admin':
      return {
        label: '企業管理者',
        badgeClass: 'bg-emerald-600 text-white',
        subtitle: 'テナント全体のスコアと設定・契約状況を確認しましょう。',
      };
    case 'is_admin':
      return {
        label: 'IS管理者',
        badgeClass: 'bg-emerald-600 text-white',
        subtitle: 'ISチームの設定とリスト・レポートを管理しましょう。',
      };
    case 'developer':
      return {
        label: '開発者',
        badgeClass: 'bg-slate-700 text-white',
        subtitle: '全ロールの機能と連携状態を確認するためのビューです。',
      };
    default:
      return {
        label: 'ユーザー',
        badgeClass: 'bg-slate-500 text-white',
        subtitle: '現在の状況と次に行う操作を確認しましょう。',
      };
  }
};

