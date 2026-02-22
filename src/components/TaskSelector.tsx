"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

const STORAGE_KEY = "task-selector-entries";
const COMPLETED_STORAGE_KEY = "task-selector-completed";
const CREDITS_STORAGE_KEY = "task-selector-credits";
const STREAK_STORAGE_KEY = "task-selector-streak";

// Slot dimensions
const SLOT_HEIGHT = 142;
const SLOT_GAP = 4;
const SLOT_STEP = SLOT_HEIGHT + SLOT_GAP; // 146px per slot

// How many full cycles to render in the reel
// We spin through SPIN_CYCLES full loops before landing
const SPIN_CYCLES = 5;
// Extra cycles rendered after the landing slot so the reel has content below
const EXTRA_CYCLES = 1;

// Credit thresholds
const TASKS_PER_CREDIT = 5;       // every 5 completions → +1 credit
const STREAK_BONUS_THRESHOLD = 10; // 10 in a row without skipping → +1 bonus credit

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed as T;
    }
  } catch {
    // ignore parse errors
  }
  return fallback;
}

/** Play a short metronome-style tick using the Web Audio API */
function playTick(audioCtx: AudioContext) {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // Short, sharp click: high-ish frequency, very brief
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.04);

  gainNode.gain.setValueAtTime(0.18, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);

  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + 0.06);
}

export default function TaskSelector() {
  const [tasks, setTasks] = useState<string[]>(() =>
    loadFromStorage<string[]>(STORAGE_KEY, [])
  );
  const [completedTasks, setCompletedTasks] = useState<string[]>(() =>
    loadFromStorage<string[]>(COMPLETED_STORAGE_KEY, [])
  );
  // skipCredits: number of available skip credits
  const [skipCredits, setSkipCredits] = useState<number>(() =>
    loadFromStorage<number>(CREDITS_STORAGE_KEY, 3)
  );
  // streak: consecutive completions without skipping
  const [streak, setStreak] = useState<number>(() =>
    loadFromStorage<number>(STREAK_STORAGE_KEY, 0)
  );

  const [newTask, setNewTask] = useState("");
  const [showManage, setShowManage] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
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

  // Ref to the scrolling reel DOM element (for reading current transform)
  const reelRef = useRef<HTMLDivElement>(null);

  // Web Audio context — created lazily on first user interaction
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Track which slot was last centered (for tick detection)
  const lastCenteredSlotRef = useRef<number>(-1);
  // RAF handle for the tick loop
  const tickRafRef = useRef<number>(0);
  // Whether the tick loop should keep running
  const isSpinningRef = useRef(false);

  // Persist tasks to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Persist completed tasks
  useEffect(() => {
    localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(completedTasks));
  }, [completedTasks]);

  // Persist credits
  useEffect(() => {
    localStorage.setItem(CREDITS_STORAGE_KEY, JSON.stringify(skipCredits));
  }, [skipCredits]);

  // Persist streak
  useEffect(() => {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(streak));
  }, [streak]);

  /** Ensure AudioContext is created (must be after a user gesture) */
  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  /**
   * RAF loop that runs during a spin.
   * Reads the reel's current translateY via getComputedStyle, calculates
   * which slot is centered, and fires a tick whenever it changes.
   */
  const startTickLoop = useCallback(() => {
    const loop = () => {
      if (!isSpinningRef.current) return;

      const el = reelRef.current;
      if (el) {
        const style = window.getComputedStyle(el);
        const matrix = new DOMMatrix(style.transform);
        const currentY = matrix.m42; // translateY in px

        // Which slot index is currently centered in the viewport?
        // Center slot top = SLOT_STEP (second slot in 3-slot viewport)
        // Slot i top = currentY + i * SLOT_STEP
        // We want: currentY + i * SLOT_STEP ≈ SLOT_STEP
        // => i ≈ (SLOT_STEP - currentY) / SLOT_STEP
        const centeredSlot = Math.round((SLOT_STEP - currentY) / SLOT_STEP);

        if (centeredSlot !== lastCenteredSlotRef.current && centeredSlot >= 0) {
          lastCenteredSlotRef.current = centeredSlot;
          const ctx = audioCtxRef.current;
          if (ctx) playTick(ctx);
        }
      }

      tickRafRef.current = requestAnimationFrame(loop);
    };

    tickRafRef.current = requestAnimationFrame(loop);
  }, []);

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

  /**
   * Mark the current winner as completed:
   * - Remove from tasks list
   * - Add to completedTasks list
   * - Increment streak; award credits based on milestones
   */
  const completeTask = useCallback(() => {
    if (!winner) return;

    const completedTask = winner;
    const newTotalCompleted = completedTasks.length + 1;
    const newStreak = streak + 1;

    // Calculate credit awards
    let creditsToAdd = 0;
    // Every TASKS_PER_CREDIT completions → +1 credit
    if (newTotalCompleted % TASKS_PER_CREDIT === 0) {
      creditsToAdd += 1;
    }
    // Streak bonus: exactly STREAK_BONUS_THRESHOLD in a row → +1 bonus credit
    if (newStreak === STREAK_BONUS_THRESHOLD) {
      creditsToAdd += 1;
    }

    // Remove from active tasks
    setTasks((prev) => prev.filter((t) => t !== completedTask));
    // Add to completed list (newest first)
    setCompletedTasks((prev) => [completedTask, ...prev]);
    // Update streak
    setStreak(newStreak);
    // Award credits
    if (creditsToAdd > 0) {
      setSkipCredits((c) => c + creditsToAdd);
    }
    // Clear winner display
    setWinner(null);
    // Reset reel
    setTranslateY(0);
    setTransition("none");
    setReelKey((k) => k + 1);
  }, [winner, completedTasks.length, streak]);

  const spin = useCallback(() => {
    if (tasks.length < 2) {
      setError("Add at least 2 tasks to spin!");
      return;
    }
    if (skipCredits <= 0) {
      setError("No credits left! Complete tasks to earn more.");
      return;
    }
    // Spend 1 credit per spin
    setSkipCredits((c) => c - 1);
    setError("");
    setWinner(null);
    setIsSpinning(true);
    isSpinningRef.current = true;

    // Ensure audio context is ready (must be called from user gesture)
    ensureAudioCtx();

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
    lastCenteredSlotRef.current = -1;
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

        // Start the tick detection loop
        startTickLoop();
      });
    });
  }, [tasks, skipCredits, ensureAudioCtx, startTickLoop]);

  // Handle transition end — announce winner
  const handleTransitionEnd = useCallback(() => {
    if (!isSpinningRef.current) return;
    isSpinningRef.current = false;
    // Stop the tick loop
    cancelAnimationFrame(tickRafRef.current);
    setWinner(tasks[finalIndexRef.current]);
    setIsSpinning(false);
  }, [tasks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isSpinningRef.current = false;
      cancelAnimationFrame(tickRafRef.current);
    };
  }, []);

  const handleSkip = useCallback(() => {
    if (skipCredits <= 0) return;
    setStreak(0);
    // spin() deducts 1 credit and resets the reel internally
    spin();
  }, [skipCredits, spin]);

  // Build the reel: (SPIN_CYCLES + EXTRA_CYCLES + 1) * tasks.length slots
  // +1 for the initial "slot 0" that's visible before spinning
  const totalSlots = tasks.length > 0
    ? (SPIN_CYCLES + EXTRA_CYCLES + 1) * tasks.length
    : 3; // fallback for empty state

  const VISIBLE_SLOTS = 3;
  const viewportHeight = VISIBLE_SLOTS * SLOT_HEIGHT + (VISIBLE_SLOTS - 1) * SLOT_GAP;

  const hasStarted = tasks.length > 0 && (isSpinning || winner !== null);

  // Calculate total completed for credit milestone display
  const totalCompleted = completedTasks.length;
  const nextCreditAt = TASKS_PER_CREDIT - (totalCompleted % TASKS_PER_CREDIT);
  const progressToCredit = totalCompleted % TASKS_PER_CREDIT;

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center py-10 px-4">
      {/* Title */}
      <h1 className="text-5xl font-black text-yellow-400 mb-2 tracking-widest uppercase drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]">
        Task Roulette
      </h1>
      <p className="text-yellow-600 text-sm mb-4 tracking-widest uppercase">
        Spin to decide your fate
      </p>

      {/* Credits & Streak HUD */}
      <div className="flex items-center gap-6 mb-8">
        {/* Skip Credits */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.max(skipCredits, 3) }, (_, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                  i < skipCredits
                    ? "bg-yellow-400 border-yellow-300 shadow-[0_0_8px_rgba(250,204,21,0.8)]"
                    : "bg-neutral-800 border-neutral-700"
                }`}
              />
            ))}
          </div>
          <span className="text-yellow-700 text-xs mt-1 tracking-wider uppercase">
            {skipCredits} Skip {skipCredits === 1 ? "Credit" : "Credits"}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-yellow-900/50" />

        {/* Streak */}
        <div className="flex flex-col items-center">
          <span className="text-yellow-400 font-black text-xl leading-none">
            {streak}
          </span>
          <span className="text-yellow-700 text-xs mt-0.5 tracking-wider uppercase">
            Streak
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-yellow-900/50" />

        {/* Progress to next credit */}
        <div className="flex flex-col items-center">
          <div className="flex gap-0.5">
            {Array.from({ length: TASKS_PER_CREDIT }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-sm transition-all duration-300 ${
                  i < progressToCredit
                    ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"
                    : "bg-neutral-800 border border-neutral-700"
                }`}
              />
            ))}
          </div>
          <span className="text-yellow-700 text-xs mt-1 tracking-wider uppercase">
            {nextCreditAt} to next credit
          </span>
        </div>
      </div>

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

        {/* Center slot white glow highlight — sits above the reel, below the fade masks */}
        <div
          className="absolute inset-x-0 z-[5] pointer-events-none"
          style={{
            top: SLOT_STEP,
            height: SLOT_HEIGHT,
            boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.85), 0 0 24px 6px rgba(255,255,255,0.35)",
            borderRadius: 4,
          }}
        />

        {/* Scrolling reel */}
        <div
          key={reelKey}
          ref={reelRef}
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

      {/* Winner announcement + Complete / Skip actions */}
      {winner && !isSpinning && (
        <div className="mb-6 text-center flex flex-col items-center gap-3">
          <p className="text-yellow-300 text-lg font-bold tracking-widest uppercase animate-bounce">
            🎰 Your task is chosen! 🎰
          </p>
          <div className="flex items-center gap-3">
            {/* Complete task button */}
            <button
              onClick={completeTask}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-black text-sm uppercase tracking-widest rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_35px_rgba(34,197,94,0.7)] transition-all duration-200 active:scale-95"
            >
              <span className="text-lg">✅</span>
              Task Complete!
            </button>

            {/* Skip button — only shown when credits available */}
            {skipCredits > 0 && (
              <button
                onClick={handleSkip}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 border border-yellow-700 hover:border-yellow-500 text-yellow-400 font-black text-sm uppercase tracking-widest rounded-full transition-all duration-200 active:scale-95"
              >
                <span className="text-base">🎲</span>
                Skip ({skipCredits})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Spin Button */}
      <button
        onClick={spin}
        disabled={isSpinning || tasks.length < 2 || skipCredits <= 0}
        className="mb-10 px-12 py-4 bg-yellow-500 hover:bg-yellow-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-neutral-950 font-black text-xl uppercase tracking-widest rounded-full shadow-[0_0_30px_rgba(250,204,21,0.4)] hover:shadow-[0_0_50px_rgba(250,204,21,0.7)] transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isSpinning ? "Spinning..." : skipCredits <= 0 ? "No Credits!" : "🎰 Spin!"}
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

      {/* Completed Tasks Button */}
      <button
        onClick={() => setShowCompleted(true)}
        className="text-green-700 hover:text-green-500 text-sm underline underline-offset-4 transition-colors mb-2"
      >
        ✅ Completed Tasks ({completedTasks.length})
      </button>

      {/* Manage Tasks Button */}
      <button
        onClick={() => setShowManage(true)}
        className="text-yellow-700 hover:text-yellow-500 text-sm underline underline-offset-4 transition-colors"
      >
        Manage / Remove Tasks
      </button>

      {/* Completed Tasks Modal */}
      {showCompleted && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-green-700 rounded-2xl w-full max-w-md shadow-[0_0_60px_rgba(34,197,94,0.2)]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-green-900">
              <h2 className="text-green-400 font-black text-lg uppercase tracking-widest">
                ✅ Completed Tasks
              </h2>
              <button
                onClick={() => setShowCompleted(false)}
                className="text-green-700 hover:text-green-400 text-2xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* Stats bar */}
            <div className="px-6 py-3 border-b border-green-900/50 flex items-center gap-4 text-xs text-green-700 uppercase tracking-wider">
              <span>{completedTasks.length} completed</span>
              <span>·</span>
              <span>{skipCredits} skip credits</span>
              <span>·</span>
              <span>{streak} streak</span>
            </div>

            {/* Modal body */}
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {completedTasks.length === 0 ? (
                <p className="text-neutral-600 text-sm text-center py-8">
                  No completed tasks yet. Complete a task to see it here!
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {completedTasks.map((task, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-neutral-800 border border-green-900/50 rounded-xl px-4 py-3"
                    >
                      <span className="text-green-500 text-base flex-shrink-0">✅</span>
                      <span className="text-green-300 text-sm font-medium flex-1">
                        {task}
                      </span>
                      <span className="text-neutral-600 text-xs font-mono">
                        #{completedTasks.length - i}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-green-900 flex justify-between items-center">
              {completedTasks.length > 0 && (
                <button
                  onClick={() => {
                    setCompletedTasks([]);
                    setStreak(0);
                  }}
                  className="text-red-600 hover:text-red-400 text-xs uppercase tracking-wider font-bold transition-colors"
                >
                  Clear History
                </button>
              )}
              <button
                onClick={() => setShowCompleted(false)}
                className="ml-auto px-6 py-2 bg-green-700 hover:bg-green-600 text-white font-black rounded-xl text-sm uppercase tracking-wider transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
