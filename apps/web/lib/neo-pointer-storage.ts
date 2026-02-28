/** 設定ページで内容保存後に発火するイベント名（ウィジェットが購読して再読込） */
export const NEO_POINTER_CONTENT_CHANGED = 'neo-pointer-content-changed';

/** NEOポインタのON/OFFを localStorage で管理（ダッシュボード設定で切り替え） */
const NEO_POINTER_KEY = 'calling-neo-pointer-enabled';
const NEO_POINTER_CLIPS_KEY = 'calling-neo-pointer-clips';
const NEO_POINTER_TEMPLATES_KEY = 'calling-neo-pointer-templates';

export type NeoPointerClipItem = { text: string; meta: string };

const DEFAULT_CLIPS: NeoPointerClipItem[] = [
  { text: 'お世話になっております。', meta: 'サンプル' },
  { text: 'よろしくお願いいたします。', meta: 'サンプル' },
  { text: '承知いたしました。確認の上、ご連絡差し上げます。', meta: 'サンプル' },
];

const DEFAULT_TEMPLATES: string[] = [
  'よろしくお願いいたします。',
  'お世話になっております。',
];

export const getNeoPointerEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const v = localStorage.getItem(NEO_POINTER_KEY);
    return v === 'true';
  } catch {
    return false;
  }
};

export const setNeoPointerEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NEO_POINTER_KEY, String(enabled));
  } catch {
    // ignore
  }
};

export const getNeoPointerClips = (): NeoPointerClipItem[] => {
  if (typeof window === 'undefined') return DEFAULT_CLIPS;
  try {
    const raw = localStorage.getItem(NEO_POINTER_CLIPS_KEY);
    if (raw == null) return DEFAULT_CLIPS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_CLIPS;
    return parsed.filter(
      (x): x is NeoPointerClipItem =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as NeoPointerClipItem).text === 'string' &&
        typeof (x as NeoPointerClipItem).meta === 'string'
    );
  } catch {
    return DEFAULT_CLIPS;
  }
};

export const setNeoPointerClips = (items: NeoPointerClipItem[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NEO_POINTER_CLIPS_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

export const getNeoPointerTemplates = (): string[] => {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES;
  try {
    const raw = localStorage.getItem(NEO_POINTER_TEMPLATES_KEY);
    if (raw == null) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_TEMPLATES;
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return DEFAULT_TEMPLATES;
  }
};

export const setNeoPointerTemplates = (items: string[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NEO_POINTER_TEMPLATES_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};
