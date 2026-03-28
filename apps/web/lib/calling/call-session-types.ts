/**
 * 架電セッション（CallSurface / MockCallProvider）で共有する対象・状態の型。
 */

export interface PersonaCallTarget {
  kind: 'persona'
  targetId: string
  label: string
  phone: string
  email: string | null
}

export interface PhoneCallTarget {
  kind: 'phone'
  label: string
  phone: string
}

export type CallSessionTarget = PersonaCallTarget | PhoneCallTarget | null
