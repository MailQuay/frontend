import { create } from 'zustand';

export type ToastVariant = 'default' | 'destructive' | 'success';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => string;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    counter += 1;
    const id = `toast-${counter}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-4) }));
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((entry) => entry.id !== id) }));
      }, 5000);
    }
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((entry) => entry.id !== id) })),
}));

export function toast(title: string, options: { description?: string; variant?: ToastVariant } = {}) {
  return useToastStore.getState().push({
    title,
    description: options.description,
    variant: options.variant ?? 'default',
  });
}
