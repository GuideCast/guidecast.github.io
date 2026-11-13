import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { BoxRect, ActionType } from '../../types/guide';

export interface InteractiveBoxEditorProps {
  imageUrl: string;
  box: BoxRect | null;
  cursorPos?: { x: number; y: number } | null;
  onChangeBoxAndCursor?: (newBox: BoxRect, newCursorPos: { x: number; y: number }) => void;
  onChangeBox?: (newBox: BoxRect) => void;
  onChangeCursor?: (newCursorPos: { x: number; y: number }) => void;
  onLiveChange?: (newBox: BoxRect, newCursorPos: { x: number; y: number }) => void;

  // Blur / Mask areas
  blurBoxes?: BoxRect[];
  globalBlurBoxes?: BoxRect[];
  maskBoxes?: BoxRect[];
  onAddBlurBox?: (box: BoxRect) => void;
  onRemoveBlurBox?: (index: number) => void;
  onAddGlobalBlurBox?: (box: BoxRect) => void;
  onRemoveGlobalBlurBox?: (index: number) => void;
  onAddMaskBox?: (box: BoxRect) => void;
  onRemoveMaskBox?: (index: number) => void;

  // Draw mode when dragging outside current box
  drawMode?: 'target' | 'blur' | 'globalBlur' | 'mask' | 'none';
  onDrawComplete?: (box: BoxRect, mode: 'target' | 'blur' | 'globalBlur' | 'mask') => void;

  // Display configuration
  stepNumber?: number;
  actionType?: ActionType;
  readOnly?: boolean;
  uiLang?: 'en' | 'ru';
  className?: string;
  style?: React.CSSProperties;
  showCursor?: boolean;
  showHandles?: boolean;
  overlayChildren?: React.ReactNode;
}

type DragState =
  | { type: 'none' }
  | {
      type: 'move_box';
      startClientX: number;
      startClientY: number;
      startBox: BoxRect;
      startCursor: { x: number; y: number };
    }
  | {
      type: 'resize_box';
      handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
      startClientX: number;
      startClientY: number;
      startBox: BoxRect;
      startCursor: { x: number; y: number };
      relCursorX: number;
      relCursorY: number;
    }
  | {
      type: 'drag_cursor';
      startClientX: number;
      startClientY: number;
    }
  | {
      type: 'draw_new';
      startPctX: number;
      startPctY: number;
      currentPctX: number;
      currentPctY: number;
    };

/**
 * Calculates default cursor position at bottom-right edge of the button box
 * (box.x + box.w * 0.96, box.y + box.h * 0.92) to avoid obscuring text inside button.
 */
export function computeDefaultCursorPos(box: BoxRect): { x: number; y: number } {
  return {
    x: Math.min(100, Math.max(0, Math.round((box.x + box.w * 0.96) * 10) / 10)),
    y: Math.min(100, Math.max(0, Math.round((box.y + box.h * 0.92) * 10) / 10)),
  };
}

const RESIZE_HANDLES: Array<{
  id: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  left: string;
  top: string;
  cursor: string;
  titleEn: string;
  titleRu: string;
}> = [
  { id: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize', titleEn: 'Resize top-left', titleRu: 'Тянуть верх-лево' },
  { id: 'n', left: '50%', top: '0%', cursor: 'ns-resize', titleEn: 'Resize top', titleRu: 'Тянуть сверху' },
  { id: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize', titleEn: 'Resize top-right', titleRu: 'Тянуть верх-право' },
  { id: 'e', left: '100%', top: '50%', cursor: 'ew-resize', titleEn: 'Resize right', titleRu: 'Тянуть справа' },
  { id: 'se', left: '100%', top: '100%', cursor: 'nwse-resize', titleEn: 'Resize bottom-right', titleRu: 'Тянуть низ-право' },
  { id: 's', left: '50%', top: '100%', cursor: 'ns-resize', titleEn: 'Resize bottom', titleRu: 'Тянуть снизу' },
  { id: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize', titleEn: 'Resize bottom-left', titleRu: 'Тянуть низ-лево' },
  { id: 'w', left: '0%', top: '50%', cursor: 'ew-resize', titleEn: 'Resize left', titleRu: 'Тянуть слева' },
];

export const InteractiveBoxEditor: React.FC<InteractiveBoxEditorProps> = ({
  imageUrl,
  box,
  cursorPos,
  onChangeBoxAndCursor,
  onChangeBox,
  onChangeCursor,
  onLiveChange,
  blurBoxes,
  globalBlurBoxes,
  maskBoxes,
  onAddBlurBox,
  onRemoveBlurBox,
  onAddGlobalBlurBox,
  onRemoveGlobalBlurBox,
  onAddMaskBox,
  onRemoveMaskBox,
  drawMode = 'target',
  onDrawComplete,
  stepNumber,
  actionType,
  readOnly = false,
  uiLang = 'en',
  className = '',
  style,
  showCursor = true,
  showHandles = true,
  overlayChildren,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [renderRect, setRenderRect] = useState<{ left: number; top: number; width: number; height: number }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  const [dragState, setDragState] = useState<DragState>({ type: 'none' });

  // Internal visual box and cursor state (allows butter-smooth 60fps dragging)
  const [activeBox, setActiveBox] = useState<BoxRect | null>(box);
  const [activeCursorPos, setActiveCursorPos] = useState<{ x: number; y: number } | null>(
    cursorPos || (box ? computeDefaultCursorPos(box) : null)
  );

  // Sync internal state with props when not actively dragging
  useEffect(() => {
    if (dragState.type === 'none') {
      setActiveBox(box);
    }
  }, [box, dragState.type]);

  useEffect(() => {
    if (dragState.type === 'none') {
      setActiveCursorPos(cursorPos || (box ? computeDefaultCursorPos(box) : null));
    }
  }, [cursorPos, box, dragState.type]);

  // Handle image load to get natural dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    }
  };

  useEffect(() => {
    if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth) {
      setNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
    }
  }, [imageUrl]);

  // Compute rendered image bounds within container (accounting for letterbox/pillarbox)
  const updateRenderRect = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const cWidth = container.clientWidth;
    const cHeight = container.clientHeight;
    if (!cWidth || !cHeight) return;

    const natW = naturalSize.width || imageRef.current?.naturalWidth || 0;
    const natH = naturalSize.height || imageRef.current?.naturalHeight || 0;

    if (!natW || !natH) {
      setRenderRect({ left: 0, top: 0, width: cWidth, height: cHeight });
      return;
    }

    const imageAspect = natW / natH;
    const containerAspect = cWidth / cHeight;

    let w = cWidth;
    let h = cHeight;
    let left = 0;
    let top = 0;

    if (containerAspect > imageAspect) {
      // Pillarbox (letterbox on sides)
      h = cHeight;
      w = h * imageAspect;
      left = (cWidth - w) / 2;
    } else {
      // Letterbox (bars on top/bottom)
      w = cWidth;
      h = w / imageAspect;
      top = (cHeight - h) / 2;
    }

    setRenderRect({ left, top, width: w, height: h });
  }, [naturalSize]);

  useEffect(() => {
    updateRenderRect();
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      updateRenderRect();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateRenderRect]);

  // --- Handlers: Move Box ---
  const handleBoxMovePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !activeBox) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const currentCursor = activeCursorPos || computeDefaultCursorPos(activeBox);
    setDragState({
      type: 'move_box',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: { ...activeBox },
      startCursor: { ...currentCursor },
    });
  };

  const handleBoxMovePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.type !== 'move_box' || renderRect.width === 0 || renderRect.height === 0) return;
    e.stopPropagation();

    const deltaPctX = ((e.clientX - dragState.startClientX) / renderRect.width) * 100;
    const deltaPctY = ((e.clientY - dragState.startClientY) / renderRect.height) * 100;

    let newX = Math.round((dragState.startBox.x + deltaPctX) * 10) / 10;
    let newY = Math.round((dragState.startBox.y + deltaPctY) * 10) / 10;

    newX = Math.max(0, Math.min(100 - dragState.startBox.w, newX));
    newY = Math.max(0, Math.min(100 - dragState.startBox.h, newY));

    const appliedDeltaX = newX - dragState.startBox.x;
    const appliedDeltaY = newY - dragState.startBox.y;

    const newCursorX = Math.max(0, Math.min(100, Math.round((dragState.startCursor.x + appliedDeltaX) * 10) / 10));
    const newCursorY = Math.max(0, Math.min(100, Math.round((dragState.startCursor.y + appliedDeltaY) * 10) / 10));

    const newBox: BoxRect = { ...dragState.startBox, x: newX, y: newY };
    const newCursor = { x: newCursorX, y: newCursorY };

    setActiveBox(newBox);
    setActiveCursorPos(newCursor);
    onLiveChange?.(newBox, newCursor);
  };

  const handleBoxMovePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.type !== 'move_box') return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragState({ type: 'none' });

    if (activeBox && activeCursorPos) {
      onChangeBoxAndCursor?.(activeBox, activeCursorPos);
      onChangeBox?.(activeBox);
      onChangeCursor?.(activeCursorPos);
    }
  };

  // --- Handlers: Resize Handles ---
  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  ) => {
    if (readOnly || !activeBox) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const currentCursor = activeCursorPos || computeDefaultCursorPos(activeBox);
    const relCursorX = activeBox.w > 0 ? (currentCursor.x - activeBox.x) / activeBox.w : 0.96;
    const relCursorY = activeBox.h > 0 ? (currentCursor.y - activeBox.y) / activeBox.h : 0.92;

    setDragState({
      type: 'resize_box',
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: { ...activeBox },
      startCursor: { ...currentCursor },
      relCursorX,
      relCursorY,
    });
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.type !== 'resize_box' || renderRect.width === 0 || renderRect.height === 0) return;
    e.stopPropagation();

    const deltaPctX = ((e.clientX - dragState.startClientX) / renderRect.width) * 100;
    const deltaPctY = ((e.clientY - dragState.startClientY) / renderRect.height) * 100;

    const x0 = dragState.startBox.x;
    const y0 = dragState.startBox.y;
    const w0 = dragState.startBox.w;
    const h0 = dragState.startBox.h;
    const x1 = x0 + w0;
    const y1 = y0 + h0;

    const minW = 2;
    const minH = 2;

    let newX = x0;
    let newY = y0;
    let newW = w0;
    let newH = h0;

    switch (dragState.handle) {
      case 'nw': {
        const left = Math.min(x1 - minW, Math.max(0, x0 + deltaPctX));
        const top = Math.min(y1 - minH, Math.max(0, y0 + deltaPctY));
        newX = left;
        newY = top;
        newW = x1 - left;
        newH = y1 - top;
        break;
      }
      case 'n': {
        const top = Math.min(y1 - minH, Math.max(0, y0 + deltaPctY));
        newY = top;
        newH = y1 - top;
        break;
      }
      case 'ne': {
        const top = Math.min(y1 - minH, Math.max(0, y0 + deltaPctY));
        const right = Math.max(x0 + minW, Math.min(100, x1 + deltaPctX));
        newY = top;
        newW = right - x0;
        newH = y1 - top;
        break;
      }
      case 'e': {
        const right = Math.max(x0 + minW, Math.min(100, x1 + deltaPctX));
        newW = right - x0;
        break;
      }
      case 'se': {
        const right = Math.max(x0 + minW, Math.min(100, x1 + deltaPctX));
        const bottom = Math.max(y0 + minH, Math.min(100, y1 + deltaPctY));
        newW = right - x0;
        newH = bottom - y0;
        break;
      }
      case 's': {
        const bottom = Math.max(y0 + minH, Math.min(100, y1 + deltaPctY));
        newH = bottom - y0;
        break;
      }
      case 'sw': {
        const left = Math.min(x1 - minW, Math.max(0, x0 + deltaPctX));
        const bottom = Math.max(y0 + minH, Math.min(100, y1 + deltaPctY));
        newX = left;
        newW = x1 - left;
        newH = bottom - y0;
        break;
      }
      case 'w': {
        const left = Math.min(x1 - minW, Math.max(0, x0 + deltaPctX));
        newX = left;
        newW = x1 - left;
        break;
      }
    }

    newX = Math.round(newX * 10) / 10;
    newY = Math.round(newY * 10) / 10;
    newW = Math.max(1, Math.round(newW * 10) / 10);
    newH = Math.max(1, Math.round(newH * 10) / 10);

    const newCursorX = Math.max(0, Math.min(100, Math.round((newX + newW * dragState.relCursorX) * 10) / 10));
    const newCursorY = Math.max(0, Math.min(100, Math.round((newY + newH * dragState.relCursorY) * 10) / 10));

    const newBox: BoxRect = { x: newX, y: newY, w: newW, h: newH };
    const newCursor = { x: newCursorX, y: newCursorY };

    setActiveBox(newBox);
    setActiveCursorPos(newCursor);
    onLiveChange?.(newBox, newCursor);
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.type !== 'resize_box') return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragState({ type: 'none' });

    if (activeBox && activeCursorPos) {
      onChangeBoxAndCursor?.(activeBox, activeCursorPos);
      onChangeBox?.(activeBox);
      onChangeCursor?.(activeCursorPos);
    }
  };

  // --- Handlers: Drag Cursor Pointer ---
  const handleCursorPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    setDragState({
      type: 'drag_cursor',
      startClientX: e.clientX,
      startClientY: e.clientY,
    });
  };

  const handleCursorPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.type !== 'drag_cursor' || !overlayRef.current) return;
    e.stopPropagation();

    const overlayRect = overlayRef.current.getBoundingClientRect();
    if (overlayRect.width === 0 || overlayRect.height === 0) return;

    const rawPctX = ((e.clientX - overlayRect.left) / overlayRect.width) * 100;
    const rawPctY = ((e.clientY - overlayRect.top) / overlayRect.height) * 100;

    const newCursor = {
      x: Math.max(0, Math.min(100, Math.round(rawPctX * 10) / 10)),
      y: Math.max(0, Math.min(100, Math.round(rawPctY * 10) / 10)),
    };

    setActiveCursorPos(newCursor);
    if (activeBox) {
      onLiveChange?.(activeBox, newCursor);
    }
  };

  const handleCursorPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.type !== 'drag_cursor') return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragState({ type: 'none' });

    if (activeCursorPos) {
      if (activeBox) {
        onChangeBoxAndCursor?.(activeBox, activeCursorPos);
      }
      onChangeCursor?.(activeCursorPos);
    }
  };

  // --- Handlers: Draw New Box on Overlay Background ---
  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || drawMode === 'none' || !overlayRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const overlayRect = overlayRef.current.getBoundingClientRect();
    if (overlayRect.width === 0 || overlayRect.height === 0) return;

    const startPctX = Math.max(0, Math.min(100, ((e.clientX - overlayRect.left) / overlayRect.width) * 100));
    const startPctY = Math.max(0, Math.min(100, ((e.clientY - overlayRect.top) / overlayRect.height) * 100));

    setDragState({
      type: 'draw_new',
      startPctX,
      startPctY,
      currentPctX: startPctX,
      currentPctY: startPctY,
    });
  };

  const handleOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.type !== 'draw_new' || !overlayRef.current) return;

    const overlayRect = overlayRef.current.getBoundingClientRect();
    if (overlayRect.width === 0 || overlayRect.height === 0) return;

    const curPctX = Math.max(0, Math.min(100, ((e.clientX - overlayRect.left) / overlayRect.width) * 100));
    const curPctY = Math.max(0, Math.min(100, ((e.clientY - overlayRect.top) / overlayRect.height) * 100));

    setDragState({
      ...dragState,
      currentPctX: curPctX,
      currentPctY: curPctY,
    });
  };

  const handleOverlayPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragState.type !== 'draw_new') return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const { startPctX, startPctY, currentPctX, currentPctY } = dragState;
    setDragState({ type: 'none' });

    let finalBox: BoxRect;
    const w = Math.abs(currentPctX - startPctX);
    const h = Math.abs(currentPctY - startPctY);

    if (w < 1.5 && h < 1.5) {
      // Single click: default 12% x 7% box centered around click
      const bw = 12;
      const bh = 7;
      finalBox = {
        x: Math.max(0, Math.min(100 - bw, Math.round((startPctX - bw / 2) * 10) / 10)),
        y: Math.max(0, Math.min(100 - bh, Math.round((startPctY - bh / 2) * 10) / 10)),
        w: bw,
        h: bh,
      };
    } else {
      finalBox = {
        x: Math.round(Math.min(startPctX, currentPctX) * 10) / 10,
        y: Math.round(Math.min(startPctY, currentPctY) * 10) / 10,
        w: Math.max(1, Math.round(w * 10) / 10),
        h: Math.max(1, Math.round(h * 10) / 10),
      };
    }

    if (drawMode === 'blur') {
      onAddBlurBox?.(finalBox);
      onDrawComplete?.(finalBox, 'blur');
    } else if (drawMode === 'globalBlur') {
      onAddGlobalBlurBox?.(finalBox);
      onDrawComplete?.(finalBox, 'globalBlur');
    } else if (drawMode === 'mask') {
      onAddMaskBox?.(finalBox);
      onDrawComplete?.(finalBox, 'mask');
    } else {
      const defaultCursor = computeDefaultCursorPos(finalBox);
      setActiveBox(finalBox);
      setActiveCursorPos(defaultCursor);
      onChangeBoxAndCursor?.(finalBox, defaultCursor);
      onChangeBox?.(finalBox);
      onChangeCursor?.(defaultCursor);
      onDrawComplete?.(finalBox, 'target');
    }
  };

  const cursorTooltip =
    uiLang === 'ru'
      ? 'Перетащите указатель, чтобы не закрывать буквы'
      : "Drag pointer so it doesn't cover text";

  const effectiveCursor = activeCursorPos || (activeBox ? computeDefaultCursorPos(activeBox) : null);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none ${className}`}
      style={style}
    >
      {/* Background Image */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Captured frame"
        onLoad={handleImageLoad}
        className="w-full h-full object-contain pointer-events-none select-none"
      />

      {/* Rendered Overlay Frame (exact pixel match with image) */}
      <div
        ref={overlayRef}
        onPointerDown={handleOverlayPointerDown}
        onPointerMove={handleOverlayPointerMove}
        onPointerUp={handleOverlayPointerUp}
        onPointerCancel={() => setDragState({ type: 'none' })}
        className="absolute overflow-visible select-none cursor-crosshair"
        style={{
          left: `${renderRect.left}px`,
          top: `${renderRect.top}px`,
          width: `${renderRect.width}px`,
          height: `${renderRect.height}px`,
          touchAction: 'none',
        }}
      >
        {/* Global Blur Boxes */}
        {globalBlurBoxes?.map((b, idx) => (
          <div
            key={`gblur-${idx}`}
            className="absolute border border-purple-500/70 bg-purple-500/20 backdrop-blur-md rounded select-none z-10"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
            }}
          >
            <div className="absolute top-0.5 left-1 text-[9px] font-bold text-purple-300 pointer-events-none">
              GLOBAL BLUR
            </div>
            {onRemoveGlobalBlurBox && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveGlobalBlurBox(idx);
                }}
                className="absolute -top-2 -right-2 w-4 h-4 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow pointer-events-auto"
                title={uiLang === 'ru' ? 'Удалить сквозной блюр' : 'Remove global blur'}
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* Screenshot Specific Blur Boxes */}
        {blurBoxes?.map((b, idx) => (
          <div
            key={`blur-${idx}`}
            className="absolute border border-amber-500/70 bg-amber-500/20 backdrop-blur-md rounded select-none z-10"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
            }}
          >
            <div className="absolute top-0.5 left-1 text-[9px] font-bold text-amber-300 pointer-events-none">
              BLUR
            </div>
            {onRemoveBlurBox && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveBlurBox(idx);
                }}
                className="absolute -top-2 -right-2 w-4 h-4 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow pointer-events-auto"
                title="Remove blur"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* Mask Boxes */}
        {maskBoxes?.map((b, idx) => (
          <div
            key={`mask-${idx}`}
            className="absolute border border-slate-700 bg-slate-950 rounded select-none z-10"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
            }}
          >
            <div className="absolute top-0.5 left-1 text-[9px] font-bold text-slate-400 pointer-events-none">
              MASK
            </div>
            {onRemoveMaskBox && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveMaskBox(idx);
                }}
                className="absolute -top-2 -right-2 w-4 h-4 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow pointer-events-auto"
                title="Remove mask"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* Primary Red Box */}
        {activeBox && (
          <div
            className="absolute border-2 border-rose-500 bg-rose-500/20 rounded shadow-[0_0_14px_rgba(244,63,94,0.8)] z-20 select-none"
            style={{
              left: `${activeBox.x}%`,
              top: `${activeBox.y}%`,
              width: `${activeBox.w}%`,
              height: `${activeBox.h}%`,
            }}
          >
            {/* Movable Inner Area */}
            <div
              onPointerDown={handleBoxMovePointerDown}
              onPointerMove={handleBoxMovePointerMove}
              onPointerUp={handleBoxMovePointerUp}
              className={`w-full h-full ${readOnly ? 'cursor-default' : 'cursor-move'} touch-none`}
              title={uiLang === 'ru' ? 'Тяните для перемещения рамки' : 'Drag to move box'}
            >
              {/* Step Badge */}
              {stepNumber !== undefined && (
                <div className="absolute -top-5 left-0 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded shadow whitespace-nowrap pointer-events-none select-none">
                  #{stepNumber}
                  {actionType ? ` · ${actionType.toUpperCase()}` : ''}
                </div>
              )}
            </div>

            {/* 8 Resize Handles */}
            {showHandles &&
              !readOnly &&
              RESIZE_HANDLES.map((h) => (
                <div
                  key={h.id}
                  onPointerDown={(e) => handleResizePointerDown(e, h.id)}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerUp}
                  className="absolute w-3.5 h-3.5 bg-white border-2 border-rose-600 rounded-sm shadow-md hover:scale-125 transition-transform z-30 select-none touch-none"
                  style={{
                    left: h.left,
                    top: h.top,
                    transform: 'translate(-50%, -50%)',
                    cursor: h.cursor,
                  }}
                  title={uiLang === 'ru' ? h.titleRu : h.titleEn}
                />
              ))}
          </div>
        )}

        {/* In-Progress Drawing Box Overlay */}
        {dragState.type === 'draw_new' && (
          <div
            className={`absolute border-2 border-dashed pointer-events-none z-25 ${
              drawMode === 'blur'
                ? 'border-amber-400 bg-amber-400/20 backdrop-blur-sm'
                : drawMode === 'globalBlur'
                ? 'border-purple-400 bg-purple-500/20 backdrop-blur-sm'
                : drawMode === 'mask'
                ? 'border-slate-400 bg-slate-900/80'
                : 'border-rose-500 bg-rose-500/20'
            }`}
            style={{
              left: `${Math.min(dragState.startPctX, dragState.currentPctX)}%`,
              top: `${Math.min(dragState.startPctY, dragState.currentPctY)}%`,
              width: `${Math.abs(dragState.currentPctX - dragState.startPctX)}%`,
              height: `${Math.abs(dragState.currentPctY - dragState.startPctY)}%`,
            }}
          >
            <div
              className={`absolute -top-5 left-0 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow ${
                drawMode === 'blur'
                  ? 'bg-amber-600'
                  : drawMode === 'globalBlur'
                  ? 'bg-purple-600'
                  : drawMode === 'mask'
                  ? 'bg-slate-700'
                  : 'bg-rose-600'
              }`}
            >
              {Math.round(Math.abs(dragState.currentPctX - dragState.startPctX))}% ×{' '}
              {Math.round(Math.abs(dragState.currentPctY - dragState.startPctY))}%
            </div>
          </div>
        )}

        {/* SVG Cursor Pointer (Movable Arrow) */}
        {showCursor && effectiveCursor && (
          <div
            className="group/cursor absolute z-40 select-none touch-none"
            style={{
              left: `${effectiveCursor.x}%`,
              top: `${effectiveCursor.y}%`,
              transform: 'translate(-16.67%, -8.33%)',
              cursor: readOnly
                ? 'default'
                : dragState.type === 'drag_cursor'
                ? 'grabbing'
                : 'grab',
            }}
            onPointerDown={handleCursorPointerDown}
            onPointerMove={handleCursorPointerMove}
            onPointerUp={handleCursorPointerUp}
            title={cursorTooltip}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-7 h-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] pointer-events-none filter transition-transform group-hover/cursor:scale-110 active:scale-95"
              aria-hidden="true"
            >
              <path
                d="M4 2l15 9.5-6.5 1.6 3.7 6.9-3 1.6-3.7-6.9L4.5 19z"
                fill="#ffffff"
                stroke="#111111"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* Hover Tooltip Pill */}
            {!readOnly && (
              <div className="absolute left-6 top-0 bg-slate-950/95 text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-lg border border-slate-700 whitespace-nowrap opacity-0 group-hover/cursor:opacity-100 transition-opacity pointer-events-none z-50">
                {cursorTooltip}
              </div>
            )}
          </div>
        )}

        {/* Overlay Children (extra overlays, hints, etc.) */}
        {overlayChildren}
      </div>
    </div>
  );
};
