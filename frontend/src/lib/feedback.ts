import toast from 'react-hot-toast';
import { errorText } from './format';
import type { Dict } from './i18n';

// Result feedback for actions: a loading toast that turns into success or the server's translated error.
// The error is thrown again so the form can stay open and show it inline as well.
export async function withToasts<T>(t: Dict, work: () => Promise<T>, success: string | ((r: T) => string), loading = t.feedback.working): Promise<T> {
  const id = toast.loading(loading);
  try {
    const result = await work();
    toast.success(typeof success === 'function' ? success(result) : success, { id });
    return result;
  } catch (e) {
    toast.error(errorText(e, t), { id });
    throw e;
  }
}

export const notify = {
  success: (m: string) => toast.success(m),
  error: (m: string) => toast.error(m),
  info: (m: string) => toast(m)
};
