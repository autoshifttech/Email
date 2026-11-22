"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { PipFace } from "./pip";

type Kind = "success" | "error" | "info";
type ToastFn = (kind: Kind, text: string) => void;
type UndoFn = (text: string, onUndo: () => void) => void;

const ToastCtx = createContext<ToastFn>(() => {});
const UndoCtx = createContext<UndoFn>(() => {});

/** Speech-bubble toast from the top (Pip talks while it shows) + undo snackbar above the dock. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<{ id: number; kind: Kind; text: string } | null>(null);
  const [show, setShow] = useState(false);
  const [undo, setUndo] = useState<{ id: number; text: string; fn: () => void } | null>(null);
  const timer = useRef(0), undoTimer = useRef(0);

  const push = useCallback<ToastFn>((kind, text) => {
    clearTimeout(timer.current);
    setShow(false);
    requestAnimationFrame(() => {
      setT({ id: Date.now(), kind, text });
      requestAnimationFrame(() => setShow(true));
      window.dispatchEvent(new Event("mb:toast"));
    });
    timer.current = window.setTimeout(() => setShow(false), kind === "error" ? 6000 : 3200);
  }, []);

  const showUndo = useCallback<UndoFn>((text, fn) => {
    clearTimeout(undoTimer.current);
    setUndo({ id: Date.now(), text, fn });
    undoTimer.current = window.setTimeout(() => setUndo(null), 6000);
  }, []);

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(undoTimer.current); }, []);

  return (
    <ToastCtx.Provider value={push}>
      <UndoCtx.Provider value={showUndo}>
        {children}
        <div className={`toast ${show ? "show" : ""} ${t?.kind === "error" ? "err" : ""}`} role="status" aria-live="polite" onClick={() => setShow(false)}>
          {t && <><PipFace className="tface" /><span>{t.text}</span></>}
        </div>
        <div className={`xundo ${undo ? "show" : ""}`} role="status" aria-live="polite">
          <span>{undo?.text}</span>
          <button type="button" onClick={() => { undo?.fn(); setUndo(null); }}>Undo</button>
          <span key={undo?.id} className="xundo-bar" />
        </div>
      </UndoCtx.Provider>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
export const useUndo = () => useContext(UndoCtx);
