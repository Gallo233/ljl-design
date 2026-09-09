import { useEffect, type RefObject } from "react";

/** Match the actual loaded font baseline to the same top-origin 44px paper grid. */
export function useNotebookBaselines(rootRef: RefObject<HTMLElement | null>, locale: string) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    let disposed = false;
    const align = () => {
      frame = 0;
      const panel = root.querySelector<HTMLElement>('[data-notebook-copy]');
      if (!panel) return;
      const pitch = 44;
      const shift = Number.parseFloat(getComputedStyle(root).getPropertyValue('--contact-shift')) || 0;
      for (const element of panel.querySelectorAll<HTMLElement>('[data-ruled-text]')) {
        element.style.translate = '0 0';
        const marker = document.createElement('span');
        marker.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline';
        marker.setAttribute('aria-hidden', 'true');
        element.append(marker);
        const baseline = marker.getBoundingClientRect().bottom - panel.parentElement!.getBoundingClientRect().top - shift;
        marker.remove();
        const correction = Math.round(baseline / pitch) * pitch - baseline;
        element.style.translate = `0 ${correction.toFixed(2)}px`;
      }
    };
    const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(align); };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    const panel = root.querySelector('[data-notebook-copy]');
    if (panel) observer.observe(panel);
    document.fonts.ready.then(schedule);
    schedule();
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [rootRef, locale]);
}
