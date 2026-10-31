// One confirmation dialog at a time, promise-based:
//   if (!(await confirm({ title, message, confirmText, tone }))) return;
// Plain TypeScript (no React, no path aliases) so it can be tested with node --test.

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  tone?: ConfirmTone;
  /** Extra line under the message, e.g. what cannot be undone. */
  note?: string;
  /** Deletes: the user must type this exactly before Confirm works. */
  typeToConfirm?: string;
  typeLabel?: string;
}

export interface AskOptions extends ConfirmOptions {
  inputLabel: string;
  initial?: string;
  required?: boolean;
  maxLength?: number;
}

export interface OpenDialog {
  id: number;
  kind: 'confirm' | 'ask';
  options: ConfirmOptions & Partial<AskOptions>;
}

type Pending = OpenDialog & { resolve: (value: boolean | string | null) => void };

export function createConfirmStore() {
  let current: Pending | null = null;
  const queue: Pending[] = [];
  const listeners = new Set<() => void>();
  let seq = 0;
  const emit = () => listeners.forEach((l) => l());

  function open(kind: 'confirm' | 'ask', options: ConfirmOptions | AskOptions) {
    return new Promise<boolean | string | null>((resolve) => {
      const p: Pending = { id: ++seq, kind, options, resolve };
      if (current) queue.push(p);
      else current = p;
      emit();
    });
  }

  function settle(value: boolean | string | null) {
    if (!current) return;
    const done = current;
    current = queue.shift() ?? null;
    done.resolve(value);
    emit();
  }

  // Confirm only counts when the typed code / required text is there.
  function canAccept(input = '') {
    if (!current) return false;
    const { typeToConfirm, required } = current.options;
    if (typeToConfirm && input.trim().toUpperCase() !== typeToConfirm.trim().toUpperCase()) return false;
    if (current.kind === 'ask' && required && !input.trim()) return false;
    return true;
  }

  return {
    confirm: (options: ConfirmOptions) => open('confirm', options) as Promise<boolean>,
    ask: (options: AskOptions) => open('ask', options) as Promise<string | null>,
    canAccept,
    accept(input = '') {
      if (!current || !canAccept(input)) return false;
      settle(current.kind === 'ask' ? input.trim() : true);
      return true;
    },
    cancel() {
      if (current) settle(current.kind === 'ask' ? null : false);
    },
    /** Escape cancels; returns true when the key was used. */
    handleKey(key: string) {
      if (key !== 'Escape' || !current) return false;
      this.cancel();
      return true;
    },
    getSnapshot: (): OpenDialog | null => current,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
}

export type ConfirmStore = ReturnType<typeof createConfirmStore>;
