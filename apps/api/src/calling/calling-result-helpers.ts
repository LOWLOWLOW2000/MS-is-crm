import { normalizeCallingResult } from './calling-result-canonical';

/** 担当者コンタクト相当（再架電・担当NG・旧名） */
export const isConnectedResult = (raw: string): boolean => {
  const r = normalizeCallingResult(raw);
  return r === '再架電' || r === '担当NG';
};

/** 興味あり（再架電・旧名の担当者あり興味） */
export const isInterestedResult = (raw: string): boolean => normalizeCallingResult(raw) === '再架電';
