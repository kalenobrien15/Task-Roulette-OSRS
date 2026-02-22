"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

const STORAGE_KEY = "task-selector-entries";

// Slot dimensions
const SLOT_HEIGHT = 142;
const SLOT_GAP = 4;
const SLOT_STEP = SLOT_HEIGHT + SLOT_GAP; // 146px per slot

// How many full cycles to render in the reel
// We spin through SPIN_CYCLES full loops before landing
const SPIN_CYCLES = 5;
// Extra cycles rendered after the landing slot so the reel has content below
const EXTRA_CYCLES = 1;

function loadTasksFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

export default function TaskSelector() {
  const [tasks, setTasks] = useState<string[]>(loadTasksFromStorage);
  const [newTask, setNewTask] = useState("");
  const [showManage, setShowManage] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState("");

  // translateY for the reel column (in px, negative = scrolled up)
  const [translateY, setTranslateY] = useState(0);
  // CSS transition string — empty string = instant (no animation)
  const [transition, setTransition] = useState("none");

  // The reel key forces a full re-render of the reel between spins
  // so we can reset position instantly without a visible jump
  const [reelKey, setReelKey] = useState(0);

  // Which slot index (in the rendered reel) is the target for this spin
  const targetSlotRef = useRef(0);
  // The finalIndex into tasks[] for the current spin
  const finalIndexRef = useRef(0);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    const trimmed = newTask.trim();
    if (!trimmed) {
      setError("Please enter a task name.");
      return;
    }
    if (tasks.includes(trimmed)) {
      setError("That task already exists.");
      return;
    }
    setTasks((prev) => [...prev, trimmed]);
    setNewTask("");
    setError("");
    setWinner(null);
  };

  const removeTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
    setWinner(null);
  };

  const spin = useCallback(() => {
    if (tasks.length < 2) {
      setError("Add at least 2 tasks to spin!");
      return;
    }
    setError("");
    setWinner(null);
    setIsSpinning(true);

    // Pick the winner now
    const finalIndex = Math.floor(Math.random() * tasks.length);
    finalIndexRef.current = finalIndex;

    // The target slot in the rendered reel:
    // We spin through SPIN_CYCLES full loops, then land on finalIndex in the next cycle.
    // targetSlot = SPIN_CYCLES * tasks.length + finalIndex
    const targetSlot = SPIN_CYCLES * tasks.length + finalIndex;
    targetSlotRef.current = targetSlot;

    // The translateY that centers the target slot in the viewport:
    // Slot at index i has its top at i * SLOT_STEP.
    // We want it at viewport y = SLOT_STEP (center of 3-slot viewport).
    // So reel top = SLOT_STEP - targetSlot * SLOT_STEP
    const targetTranslateY = SLOT_STEP - targetSlot * SLOT_STEP;

    // Step 1: Reset reel to position 0 instantly (no transition), then on next frame start the spin
    // We increment reelKey to force a fresh reel render starting at translateY = 0
    setReelKey((k) => k + 1);
    setTranslateY(0);
    setTransition("none");

    // Step 2: On next frame, kick off the spin animation
    // Use a two-frame delay to ensure the DOM has updated with the reset position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Randomize total spin duration slightly for variety: 3.5–5s
        const duration = 3500 + Math.random() * 1500;

        // Custom cubic-bezier: fast start, very slow end (slot machine feel)
        // This easing accelerates quickly then decelerates dramatically at the end
        setTransition(`transform ${duration}ms cubic-bezier(0.12, 0.8, 0.2, 1.0)`);
        setTranslateY(targetTranslateY);
      });
    });
  }, [tasks]);

  // Handle transition end — announce winner
  const handleTransitionEnd = useCallback(() => {
    if (!isSpinning) return;
    setWinner(tasks[finalIndexRef.current]);
    setIsSpinning(false);
  }, [isSpinning, tasks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // nothing to clean up with CSS transitions
    };
  }, []);

  // Build the reel: (SPIN_CYCLES + EXTRA_CYCLES + 1) * tasks.length slots
  // +1 for the initial "slot 0" that's visible before spinning
  const totalSlots = tasks.length > 0
    ? (SPIN_CYCLES + EXTRA_CYCLES + 1) * tasks.length
    : 3; // fallback for empty state

  const VISIBLE_SLOTS = 3;
  const viewportHeight = VISIBLE_SLOTS * SLOT_HEIGHT + (VISIBLE_SLOTS - 1) * SLOT_GAP;

  const hasStarted = tasks.length > 0 && (isSpinning || winner !== null);

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center py-10 px-4">
      {/* Title */}
      <h1 className="text-5xl font-black text-yellow-400 mb-2 tracking-widest uppercase drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]">
        Task Roulette
      </h1>
      <p className="text-yellow-600 text-sm mb-10 tracking-widest uppercase">
        Spin to decide your fate
      </p>

      {/* Slot machine reel viewport */}
      <div
        className="relative mb-8"
        style={{
          width: 519,
          height: viewportHeight,
          overflow: "hidden",
        }}
      >
        {/* Fade masks at top and bottom */}
        <div
          className="absolute inset-x-0 top-0 z-10 pointer-events-none"
          style={{
            height: SLOT_HEIGHT,
            background: "linear-gradient(to bottom, rgba(10,10,10,0.85) 0%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
          style={{
            height: SLOT_HEIGHT,
            background: "linear-gradient(to top, rgba(10,10,10,0.85) 0%, transparent 100%)",
          }}
        />

        {/* Scrolling reel */}
        <div
          key={reelKey}
          onTransitionEnd={handleTransitionEnd}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 519,
            transform: `translateY(${translateY}px)`,
            transition: transition,
            display: "flex",
            flexDirection: "column",
            gap: SLOT_GAP,
            willChange: "transform",
          }}
        >
          {Array.from({ length: totalSlots }, (_, i) => {
            const taskIndex = tasks.length > 0 ? i % tasks.length : 0;
            const task = tasks.length > 0 ? tasks[taskIndex] : null;
            // Show placeholder text only in slot 0 before spinning
            const isSlotZero = i === 0;

            return (
              <div
                key={i}
                style={{
                  width: 519,
                  height: SLOT_HEIGHT,
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {/* Chatbox background */}
                <Image
                  src="/chatbox.png"
                  alt="Dialogue box"
                  width={519}
                  height={142}
                  style={{ imageRendering: "pixelated", position: "absolute", top: 0, left: 0 }}
                  priority={isSlotZero}
                />
                {/* Task text */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'RuneScape Quill 8', 'Courier New', monospace",
                    fontSize: 16,
                    color: "#000",
                    paddingLeft: 24,
                    paddingRight: 24,
                    boxSizing: "border-box",
                    textAlign: "center",
                  }}
                >
                  {isSlotZero && !hasStarted
                    ? tasks.length === 0
                      ? "Add tasks below to begin."
                      : "Press Spin to decide your fate!"
                    : task ?? ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Winner announcement */}
      {winner && !isSpinning && (
        <div className="mb-6 text-center">
          <p className="text-yellow-300 text-lg font-bold tracking-widest uppercase animate-bounce">
            🎰 Your task is chosen! 🎰
          </p>
        </div>
      )}

      {/* Spin Button */}
      <button
        onClick={spin}
        disabled={isSpinning || tasks.length < 2}
        className="mb-10 px-12 py-4 bg-yellow-500 hover:bg-yellow-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-neutral-950 font-black text-xl uppercase tracking-widest rounded-full shadow-[0_0_30px_rgba(250,204,21,0.4)] hover:shadow-[0_0_50px_rgba(250,204,21,0.7)] transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isSpinning ? "Spinning..." : "🎰 Spin!"}
      </button>

      {/* Task List */}
      <div className="w-full max-w-lg mb-6">
        <h2 className="text-yellow-500 font-bold text-sm uppercase tracking-widest mb-3">
          Tasks ({tasks.length})
        </h2>

        {tasks.length === 0 ? (
          <p className="text-neutral-600 text-sm text-center py-6">
            No tasks yet. Add one below!
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((task, i) => (
              <div
                key={i}
                className="relative rounded-xl overflow-hidden border border-yellow-900/60 shadow-md"
              >
                {/* Parchment/stone texture background */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse at 30% 40%, #2a2000 0%, #1a1400 40%, #0f0d00 100%)",
                  }}
                />
                {/* Grain texture overlay */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                    backgroundSize: "150px 150px",
                  }}
                />
                {/* Gold shimmer line at top */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-600/60 to-transparent" />
                {/* Gold shimmer line at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-900/60 to-transparent" />

                <div className="relative z-10 flex items-center justify-between px-4 py-3">
                  <span className="text-yellow-400 font-bold tracking-wide text-sm">
                    {task}
                  </span>
                  <span className="text-yellow-800 text-xs font-mono">
                    #{i + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Task Input */}
      <div className="w-full max-w-lg mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTask}
            onChange={(e) => {
              setNewTask(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Enter a task..."
            className="flex-1 bg-neutral-900 border border-yellow-900 focus:border-yellow-500 text-yellow-300 placeholder-yellow-900 rounded-xl px-4 py-3 outline-none transition-colors text-sm font-medium"
          />
          <button
            onClick={addTask}
            className="px-5 py-3 bg-yellow-600 hover:bg-yellow-500 text-neutral-950 font-black rounded-xl transition-colors text-sm uppercase tracking-wider"
          >
            Add
          </button>
        </div>
        {error && (
          <p className="text-red-400 text-xs mt-2 ml-1">{error}</p>
        )}
      </div>

      {/* Manage Tasks Button */}
      <button
        onClick={() => setShowManage(true)}
        className="text-yellow-700 hover:text-yellow-500 text-sm underline underline-offset-4 transition-colors"
      >
        Manage / Remove Tasks
      </button>

      {/* Manage Modal */}
      {showManage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-yellow-700 rounded-2xl w-full max-w-md shadow-[0_0_60px_rgba(250,204,21,0.2)]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-yellow-900">
              <h2 className="text-yellow-400 font-black text-lg uppercase tracking-widest">
                Manage Tasks
              </h2>
              <button
                onClick={() => setShowManage(false)}
                className="text-yellow-700 hover:text-yellow-400 text-2xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {tasks.length === 0 ? (
                <p className="text-neutral-600 text-sm text-center py-8">
                  No tasks to manage.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {tasks.map((task, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3"
                    >
                      <span className="text-yellow-400 text-sm font-medium flex-1 mr-3">
                        {task}
                      </span>
                      <button
                        onClick={() => removeTask(i)}
                        className="text-red-500 hover:text-red-400 hover:bg-red-950 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-yellow-900 flex justify-between items-center">
              {tasks.length > 0 && (
                <button
                  onClick={() => {
                    setTasks([]);
                    setWinner(null);
                    setTranslateY(0);
                    setTransition("none");
                    setReelKey((k) => k + 1);
                  }}
                  className="text-red-600 hover:text-red-400 text-xs uppercase tracking-wider font-bold transition-colors"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setShowManage(false)}
                className="ml-auto px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-neutral-950 font-black rounded-xl text-sm uppercase tracking-wider transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
