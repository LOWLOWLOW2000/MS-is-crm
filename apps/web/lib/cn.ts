import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind クラスをマージする（shadcn/ui と同様）
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
