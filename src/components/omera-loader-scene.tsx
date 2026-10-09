"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const AMBIENT_DOTS = [
  { top: "18%", left: "22%", size: 4, delay: 0 },
  { top: "28%", right: "18%", size: 3, delay: 0.6 },
  { top: "68%", left: "12%", size: 5, delay: 1 },
  { top: "72%", right: "22%", size: 3, delay: 0.3 },
  { top: "48%", right: "10%", size: 4, delay: 1.2 },
] as const;

export function OmeraLoaderScene({ progress }: { progress: number }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#050505]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.06) 0%, transparent 55%), #050505",
        }}
      />

      {AMBIENT_DOTS.map((dot, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white/40"
          style={{
            width: dot.size,
            height: dot.size,
            top: dot.top,
            left: "left" in dot ? dot.left : undefined,
            right: "right" in dot ? dot.right : undefined,
          }}
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            delay: dot.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center px-8">
        <div className="relative mb-8 flex h-40 w-40 items-center justify-center">
          <motion.div
            className="absolute h-[140px] w-[140px] rounded-full border-[1.5px] border-white/30"
            animate={{ scale: [0.8, 1.85], opacity: [0, 0.35, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.8, ease: "easeOut" }}
          />
          <motion.div
            className="absolute h-[140px] w-[140px] rounded-full border-[1.5px] border-white/20"
            animate={{ scale: [0.8, 2.05], opacity: [0, 0.2, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 1.6, ease: "easeOut" }}
          />

          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 40, damping: 6 }}
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full"
            >
              <Image
                src="/vilatech-icon.svg"
                alt=""
                width={96}
                height={96}
                className="brightness-0 invert"
                priority
              />
            </motion.div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="font-serif text-3xl tracking-[0.2em] text-white md:text-4xl"
        >
          Omera
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          className="mt-2 text-xs font-medium tracking-[0.28em] text-white/45 uppercase"
        >
          A product of VILATECH
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-12 w-[80%] max-w-xs"
        >
          <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-white/40 via-white to-white/40"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-center font-mono text-[10px] tracking-widest text-white/35">
            {Math.round(progress)}%
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-12 flex items-center gap-3 px-4 text-center"
      >
        <div className="h-px w-8 bg-white/10" />
        <p className="text-[11px] font-medium tracking-[0.2em] text-white/25 uppercase">
          Designed to Think
        </p>
        <div className="h-px w-8 bg-white/10" />
      </motion.div>
    </div>
  );
}
