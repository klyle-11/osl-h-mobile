"use client";
// @ts-nocheck

import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

// We load foliate-js modules at runtime via ESM CDN to avoid bundling complexities.
// This keeps the app lightweight and lets us integrate highlighting via Overlayer events.

const FOLIATE_SRC = "https://cdn.jsdelivr.net/gh/johnfactotum/foliate-js@main/view.js";

export type Highlight = {
  id: string; // annotation id
  cfi: string;
  color?: string;
  note?: string;
};

export type FoliateViewRef = {
  open: (blobOrUrl: Blob | string) => Promise<void>;
  addHighlight: (h: Highlight) => Promise<void>;
  deleteHighlight: (id: string) => Promise<void>;
  showAtCFI: (cfi: string) => Promise<void>;
};

type Props = {
  onHighlightCreate?: (cfi: string, range: Range) => void;
  onHighlightTap?: (id: string, cfi: string, range: Range) => void;
};

const FoliateView = forwardRef<FoliateViewRef, Props>(function FoliateViewComp({ onHighlightCreate, onHighlightTap }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const colorMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const ensureFoliate = async () => {
      if (customElements.get("foliate-view")) {
        if (!cancelled) setReady(true);
        return;
      }
      // Reuse a global promise to avoid duplicate loads
      const w = window as any;
      if (!w.__foliatePromise) {
        w.__foliatePromise = new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.type = "module";
          s.src = FOLIATE_SRC;
          s.async = true;
          s.onload = () => resolve();
          s.onerror = (e) => reject(e);
          document.head.appendChild(s);
        });
      }
      try {
        await w.__foliatePromise;
        if (!cancelled) setReady(true);
      } catch (e) {
        // Surface error in console; keep ready=false
        console.error("Failed to load foliate-js", e);
      }
    };
    ensureFoliate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !hostRef.current) return;
    const el = document.createElement("foliate-view");
    el.style.display = "block";
    el.style.height = "100%";
    el.style.width = "100%";

    // Attach selection handlers per inner document so we read selection from that doc.
    const attachSelectionHandlers = (doc: Document, index: number) => {
      let timer: number | null = null;
      const schedule = () => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          try {
            const sel = doc.defaultView?.getSelection?.() || (doc as any).getSelection?.();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            if (!range || range.collapsed) return;
            const cfi = (el as any).getCFI(index, range);
            onHighlightCreate?.(cfi, range);
            sel.removeAllRanges();
          } catch {}
        }, 0);
      };
      doc.addEventListener("selectionchange", schedule);
      doc.addEventListener("pointerup", schedule);
      doc.addEventListener("mouseup", schedule);
      doc.addEventListener("touchend", schedule);
    };
    // Attach on initial and subsequent section loads
    el.addEventListener("load", (e: any) => {
      const { doc, index } = e.detail || {};
      if (doc && (typeof index === 'number')) attachSelectionHandlers(doc, index);
    });

    // When foliate draws overlay and user taps highlight, show popover
    el.addEventListener("show-annotation", (e: any) => {
      const { value, range } = e.detail;
      onHighlightTap?.(value, value, range);
    });

    // Draw custom highlight style with color map
    el.addEventListener("draw-annotation", (e: any) => {
      const { draw, annotation } = e.detail;
      const color = colorMap.current.get(annotation.value) || "#fde047"; // amber-300
      const svgNS = "http://www.w3.org/2000/svg";
      const highlighter = (rects: any[]) => {
        const g = document.createElementNS(svgNS, "g");
        g.setAttribute("fill", color);
        g.style.opacity = ".3";
        for (const { left, top, height, width } of rects) {
          const r = document.createElementNS(svgNS, "rect");
          r.setAttribute("x", String(left));
          r.setAttribute("y", String(top));
          r.setAttribute("height", String(height));
          r.setAttribute("width", String(width));
          g.appendChild(r);
        }
        return g;
      };
      draw(highlighter, { color });
    });

    hostRef.current.appendChild(el);
    viewRef.current = el;
    return () => {
      el?.remove?.();
      viewRef.current = null;
    };
  }, [ready]);

  useImperativeHandle(ref, () => ({
    async open(blobOrUrl: Blob | string) {
      if (!viewRef.current) throw new Error("View not ready");
      await viewRef.current.open(blobOrUrl);
      await viewRef.current.init?.({ showTextStart: true });
    },
    async addHighlight(h: Highlight) {
      if (!viewRef.current) return;
  if (h.color) colorMap.current.set(h.cfi, h.color);
      await viewRef.current.addAnnotation?.({ value: h.cfi });
    },
    async deleteHighlight(id: string) {
      // We store cfi as id for foliate overlay; deletion is by same value.
      if (!viewRef.current) return;
      await viewRef.current.deleteAnnotation?.({ value: id });
  colorMap.current.delete(id);
    },
    async showAtCFI(cfi: string) {
      if (!viewRef.current) return;
      await viewRef.current.showAnnotation?.({ value: cfi });
    },
  }));

  return <div ref={hostRef} className="w-full h-full" />;
});

export default FoliateView;
