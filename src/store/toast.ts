// Short pop-up messages ("Call placed", "You won 250 Clout") and live score alerts.
import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error' | 'alert';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** Live alerts: a bold headline ("GOAL! Harbor City 2-1"). */
  title?: string;
  /** Live alerts: the team colour for the stripe. */
  color?: string;
  /** Live alerts: where tapping goes (an event screen). */
  href?: string;
  /** Live alerts: a short label such as "72'" or "Q4 2:11". */
  meta?: string;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, tone?: ToastTone, extra?: Pick<Toast, 'title' | 'color' | 'href' | 'meta'>) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message, tone = 'info', extra) => {
    const id = ++counter;
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone, ...extra }] });
    setTimeout(() => get().dismiss(id), tone === 'alert' ? 6000 : tone === 'error' ? 4200 : 3000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (message: string, tone: ToastTone = 'info') => useToastStore.getState().show(message, tone);

/** A live score alert banner that opens the event when tapped. */
export const liveAlert = (input: { title: string; message: string; color: string; href: string; meta?: string }) =>
  useToastStore.getState().show(input.message, 'alert', { title: input.title, color: input.color, href: input.href, meta: input.meta });
