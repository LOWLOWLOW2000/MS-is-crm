import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CallingResultType } from '@/lib/types';

interface CallingSessionDraftState {
  selectedResult: CallingResultType;
  memo: string;
  nextCallAt: string;
  urlInput: string;
  displayUrl: string;
  lastUpdatedAt: string | null;
  setSelectedResult: (value: CallingResultType) => void;
  setMemo: (value: string) => void;
  setNextCallAt: (value: string) => void;
  setUrlInput: (value: string) => void;
  setDisplayUrl: (value: string) => void;
  clearDraft: () => void;
}

const DEFAULT_RESULT: CallingResultType = '不在';
const DEFAULT_URL = 'https://example.com';
const DEFAULT_DISPLAY_URL = 'https://example.com/info';

export const useCallingSessionStore = create<CallingSessionDraftState>()(
  persist(
    (set) => ({
      selectedResult: DEFAULT_RESULT,
      memo: '',
      nextCallAt: '',
      urlInput: DEFAULT_URL,
      displayUrl: DEFAULT_DISPLAY_URL,
      lastUpdatedAt: null,
      setSelectedResult: (value) =>
        set(() => ({ selectedResult: value, lastUpdatedAt: new Date().toISOString() })),
      setMemo: (value) => set(() => ({ memo: value, lastUpdatedAt: new Date().toISOString() })),
      setNextCallAt: (value) =>
        set(() => ({ nextCallAt: value, lastUpdatedAt: new Date().toISOString() })),
      setUrlInput: (value) => set(() => ({ urlInput: value, lastUpdatedAt: new Date().toISOString() })),
      setDisplayUrl: (value) =>
        set(() => ({ displayUrl: value, lastUpdatedAt: new Date().toISOString() })),
      clearDraft: () =>
        set(() => ({
          selectedResult: DEFAULT_RESULT,
          memo: '',
          nextCallAt: '',
          urlInput: DEFAULT_URL,
          displayUrl: DEFAULT_DISPLAY_URL,
          lastUpdatedAt: new Date().toISOString(),
        })),
    }),
    {
      name: 'calling-session-draft-v1',
    },
  ),
);
