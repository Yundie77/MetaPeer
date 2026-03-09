import { useEffect } from 'react';

export default function useResizableSidebar({
  dragging,
  splitRef,
  setDragging,
  setSidebarWidth,
  minLeft = 240,
  minRight = 420
}) {
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (event) => {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const raw = event.clientX - rect.left;
      const maxLeft = Math.max(minLeft, totalWidth - minRight);
      const clamped = Math.min(Math.max(raw, minLeft), maxLeft);
      setSidebarWidth(clamped);
    };

    const stop = () => setDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stop);
    window.addEventListener('mouseleave', stop);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('mouseleave', stop);
    };
  }, [dragging, splitRef, setDragging, setSidebarWidth, minLeft, minRight]);

  return {
    startDragging: () => setDragging(true)
  };
}

