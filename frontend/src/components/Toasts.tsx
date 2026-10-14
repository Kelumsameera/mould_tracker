'use client';
import { useCallback, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((text: string) => {
    setMsg(text);
    setShow(true);
    setTimer((old) => { if (old) clearTimeout(old); return setTimeout(() => setShow(false), 2400); });
  }, []);
  void timer;
  return { msg, show, toast };
}

export default function Toast({ msg, show }: { msg: string; show: boolean }) {
  return <div className={'toast' + (show ? ' show' : '')} role="status" aria-live="polite">{msg}</div>;
}
