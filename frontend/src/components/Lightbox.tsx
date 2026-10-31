"use client";
import { useEffect } from "react";

// Full-screen picture viewer.
type Props = {
  src: string | null;
  onClose: () => void;
};

export default function Lightbox({ src, onClose }: Props) {
  useEffect(() => {
    if (!src) return;
    // Captured first, so Esc closes the picture and not the sheet behind it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [src, onClose]);
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 [&_img]:max-w-full [&_img]:max-h-full [&_img]:bg-white [&_img]:rounded-md [background:rgba(5,10,15,.9)] z-70 flex items-center justify-center p-5 cursor-zoom-out"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <img src={src} alt="" />
    </div>
  );
}
