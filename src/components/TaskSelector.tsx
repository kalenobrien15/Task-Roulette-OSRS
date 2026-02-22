"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

const STORAGE_KEY = "task-selector-entries";

// Slot dimensions
const SLOT_HEIGHT = 142;
const SLOT_GAP = 4;
const SLOT_STEP = SLOT_HEIGHT + SLOT_GAP;

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
  // reelOffset: how many slots we've scrolled (increases each tick)
  const [reelOffset, setReelOffset] = useState(0);
  // transitionDuration: ms for the CSS transition on each step
  const [transitionDuration, setTransitionDuration] = useState(60);
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState("");
  const spinIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(60);
  const elapsedRef = useRef(0);
  const reelOffsetRef = useRef(0);

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

    speedRef.current = 60;
    elapsedRef.current = 0;
    const totalDuration = 3500;

    const tick = () => {
      const speed = speedRef.current;

      // Advance reel by 1 slot
      reelOffsetRef.current += 1;
      setReelOffset(reelOffsetRef.current);
      setTransitionDuration(speed);

      elapsedRef.current += speed;

      // Gradually slow down
      if (elapsedRef.current > totalDuration * 0.6) {
        speedRef.current = Math.min(speedRef.current + 30, 400);
      } else if (elapsedRef.current > totalDuration * 0.3) {
        speedRef.current = Math.min(speedRef.current + 10, 200);
      }

      if (elapsedRef.current < totalDuration) {
        spinIntervalRef.current = setTimeout(tick, speedRef.current);
      } else {
        // Land on a random final index
        const finalIndex = Math.floor(Math.random() * tasks.length);
        // Adjust reelOffset so that the center slot lands on finalIndex
        // Center slot index = reelOffsetRef.current mod tasks.length
        // We want: (reelOffsetRef.current + adjustment) mod tasks.length === finalIndex
        const currentMod = ((reelOffsetRef.current % tasks.length) + tasks.length) % tasks.length;
        let adjustment = (finalIndex - currentMod + tasks.length) % tasks.length;
        if (adjustment === 0) adjustment = tasks.length; // always scroll at least one more
        reelOffsetRef.current += adjustment;
        setReelOffset(reelOffsetRef.current);
        setTransitionDuration(speedRef.current);

        setTimeout(() => {
          setWinner(tasks[finalIndex]);
          setIsSpinning(false);
        }, speedRef.current + 50);
      }
    };

    spinIntervalRef.current = setTimeout(tick, speedRef.current);
  }, [tasks]);

  // Cleanup on unmount
  useEffect(() => {
    const ref = spinIntervalRef;
    return () => {
      if (ref.current) clearTimeout(ref.current);
    };
  }, []);

  const hasStarted = tasks.length > 0 && (isSpinning || winner !== null);

  // Build the visible reel slots.
  // We show 3 slots: offsets -1, 0, +1 relative to reelOffset.
  // The reel is a tall column that we translate upward.
  // We render a window of 5 slots centered on reelOffset to ensure smooth scrolling.
  // The translateY moves the reel so the center slot is visible in the middle.
  //
  // Strategy: render a fixed set of slots around the current position.
  // We'll render slots at indices: reelOffset-2, reelOffset-1, reelOffset, reelOffset+1, reelOffset+2
  // The container clips to show only 3 slots (prev, center, next).
  // translateY shifts so that slot at reelOffset is in the center position.

  const RENDER_SLOTS = 5; // render 5 slots: 2 above, center, 2 below
  const VISIBLE_SLOTS = 3; // show 3 slots in the viewport

  // The viewport height shows 3 slots
  const viewportHeight = VISIBLE_SLOTS * SLOT_HEIGHT + (VISIBLE_SLOTS - 1) * SLOT_GAP;

  // The reel column height for RENDER_SLOTS slots
  const reelHeight = RENDER_SLOTS * SLOT_HEIGHT + (RENDER_SLOTS - 1) * SLOT_GAP;

  // translateY: position the reel so the center slot (index 2 in the 5-slot render) aligns with the center of the viewport
  // Center of viewport = SLOT_STEP (one slot from top, since we show 3 slots: 0, 1, 2)
  // Center slot in reel = index 2 → top = 2 * SLOT_STEP
  // We want reel's center slot top to align with viewport's center slot top (= SLOT_STEP)
  // So translateY = -(2 * SLOT_STEP - SLOT_STEP) = -SLOT_STEP
  // But we also animate: each tick adds SLOT_STEP to the translation to scroll up by one slot
  // We use CSS transition on the reel's translateY.
  //
  // Actually: we render 5 slots at fixed positions (0..4 * SLOT_STEP).
  // The slot at render-index 2 is the "center" slot.
  // We want it to appear at viewport y = SLOT_STEP (the middle of 3 visible slots).
  // So the reel's top should be at: SLOT_STEP - 2*SLOT_STEP = -SLOT_STEP
  // This is a static offset; the scrolling animation is handled differently.
  //
  // Better approach: use a continuously growing translateY.
  // Each tick, reelOffset increases by 1. We translate the reel by -reelOffset * SLOT_STEP.
  // We render enough slots so the visible window always has content.
  // We render slots from (reelOffset - 2) to (reelOffset + 2) in task-index space.
  // Their positions in the reel column are at fixed y = (i - (reelOffset-2)) * SLOT_STEP.
  // The reel column starts at y=0 in its own coordinate space.
  // We want slot at render-index 2 (= reelOffset) to appear at viewport center (y = SLOT_STEP).
  // translateY = SLOT_STEP - 2*SLOT_STEP = -SLOT_STEP (static, since we re-render each tick).
  //
  // Since we re-render the reel slots each tick (they're always centered on reelOffset),
  // the CSS transition on translateY won't animate between ticks — the reel content shifts.
  // To get the scrolling animation, we need to NOT re-center the reel each tick.
  //
  // FINAL APPROACH:
  // - Render a large number of slots (e.g., 200) starting from index 0.
  // - translateY = -reelOffset * SLOT_STEP + SLOT_STEP (to center the current slot)
  // - CSS transition animates the translateY change each tick.
  // - Task at slot i = tasks[i % tasks.length]
  // - This gives true slot machine scrolling.

  const TOTAL_RENDER_SLOTS = Math.max(200, reelOffset + 10);

  // translateY: slot at reelOffset should be at viewport center (y = SLOT_STEP from viewport top)
  // Slot reelOffset top in reel = reelOffset * SLOT_STEP
  // We want it at viewport y = SLOT_STEP
  // So reel top = SLOT_STEP - reelOffset * SLOT_STEP
  const translateY = SLOT_STEP - reelOffset * SLOT_STEP;

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
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 519,
            height: reelHeight,
            transform: `translateY(${translateY}px)`,
            transition: `transform ${transitionDuration}ms linear`,
            display: "flex",
            flexDirection: "column",
            gap: SLOT_GAP,
          }}
        >
          {Array.from({ length: TOTAL_RENDER_SLOTS }, (_, i) => {
            const taskIndex = i % (tasks.length || 1);
            const task = tasks.length > 0 ? tasks[taskIndex] : null;
            const isCenter = i === reelOffset;

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
                  priority={isCenter}
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
                  {isCenter && !hasStarted
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
                    setReelOffset(0);
                    reelOffsetRef.current = 0;
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
