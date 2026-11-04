"use client";
/**
 * Free-hand drawing surface for hanzi, tuned for iPad + Apple Pencil:
 * pointer events with coalesced points, no scrolling while drawing, and
 * palm rejection (once a pencil is detected, finger touches are ignored when
 * "solo lápiz" is enabled in settings).
 */
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { Point } from "@/lib/drawing";
import { useSettings } from "@/lib/settings/store";
import { RiceGrid, themeColor } from "./hanzi";

export interface DrawingCanvasHandle {
  strokes(): Point[][];
  undo(): void;
  clear(): void;
}

let penDetected = false; // shared across canvases for the whole visit

export function DrawingCanvas({
  size,
  disabled,
  strokeColors,
  onChange,
  ref,
}: {
  size: number;
  disabled?: boolean;
  /** Per-stroke colours (after grading). */
  strokeColors?: string[];
  onChange?: (count: number) => void;
  ref?: Ref<DrawingCanvasHandle>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const active = useRef<number | null>(null);
  const { penOnly } = useSettings();

  const redraw = () => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(6, size / 26);
    const fg = themeColor("fg");
    strokes.current.forEach((stroke, i) => {
      ctx.strokeStyle = strokeColors?.[i] ?? fg;
      ctx.beginPath();
      stroke.forEach((p, k) => {
        if (k === 0) ctx.moveTo(p.x, p.y);
        else {
          // quadratic smoothing through midpoints
          const prev = stroke[k - 1];
          ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + p.x) / 2, (prev.y + p.y) / 2);
        }
      });
      if (stroke.length === 1) ctx.lineTo(stroke[0].x + 0.1, stroke[0].y);
      ctx.stroke();
    });
  };

  useImperativeHandle(ref, () => ({
    strokes: () => strokes.current,
    undo: () => {
      strokes.current = strokes.current.slice(0, -1);
      redraw();
      onChange?.(strokes.current.length);
    },
    clear: () => {
      strokes.current = [];
      redraw();
      onChange?.(0);
    },
  }));

  // Size the backing store for crisp lines on retina screens.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = size * dpr;
    el.height = size * dpr;
    redraw();
  });

  const point = (e: React.PointerEvent | PointerEvent): Point => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || active.current !== null) return;
    if (e.pointerType === "pen") penDetected = true;
    if (penOnly && penDetected && e.pointerType === "touch") return; // palm rejection
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety (keeps strokes going outside the box) */
    }
    active.current = e.pointerId;
    strokes.current = [...strokes.current, [point(e)]];
    redraw();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current !== e.pointerId) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const current = strokes.current[strokes.current.length - 1];
    for (const ev of events.length ? events : [e.nativeEvent]) current.push(point(ev));
    redraw();
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    onChange?.(strokes.current.length);
  };

  return (
    <div className="relative rounded-2xl bg-surface" style={{ width: size, height: size }}>
      <RiceGrid />
      <canvas
        ref={canvas}
        className="relative touch-none select-none"
        style={{ width: size, height: size, touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-label="Zona de dibujo"
      />
    </div>
  );
}
