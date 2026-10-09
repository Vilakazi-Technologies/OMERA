"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { OmeraLoaderScene } from "@/components/omera-loader-scene";

const PRELOADER_KEY = "omera-intro-seen";
const MIN_DURATION_MS = 3800;

export function OmeraPreloaderGate({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PRELOADER_KEY)) {
        setReady(true);
        return;
      }
    } catch {
      setReady(true);
      return;
    }
    setShow(true);
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="fixed inset-0 z-[100000] bg-[#050505]" aria-hidden />;
  }

  return (
    <>
      {children}
      <AnimatePresence>
        {show && (
          <OmeraPreloader
            onDone={() => {
              try {
                sessionStorage.setItem(PRELOADER_KEY, "1");
              } catch {
                /* ignore */
              }
              setShow(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function OmeraPreloader({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const minTimer = setTimeout(() => setMinElapsed(true), MIN_DURATION_MS);
    const interval = setInterval(() => {
      setProgress((p) => Math.min(100, p + 1.5 + Math.random() * 2.5));
    }, 50);
    return () => {
      clearTimeout(minTimer);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (minElapsed && progress >= 95) {
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [minElapsed, progress]);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          key="omera-loader"
          className="fixed inset-0 z-[100000]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <OmeraLoaderScene progress={progress} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
