"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

const STORAGE_KEY = "task-selector-entries";

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
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState("");
  const spinIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    let speed = 60; // ms between changes
    let elapsed = 0;
    const totalDuration = 3500; // ms total spin time
    let idx = 0;

    const tick = () => {
      idx = (idx + 1) % tasks.length;
      setCurrentIndex(idx);
      elapsed += speed;

      // Gradually slow down
      if (elapsed > totalDuration * 0.6) {
        speed = Math.min(speed + 30, 400);
      } else if (elapsed > totalDuration * 0.3) {
        speed = Math.min(speed + 10, 200);
      }

      if (elapsed < totalDuration) {
        spinIntervalRef.current = setTimeout(tick, speed);
      } else {
        // Land on final result
        const finalIndex = Math.floor(Math.random() * tasks.length);
        setCurrentIndex(finalIndex);
        setWinner(tasks[finalIndex]);
        setIsSpinning(false);
      }
    };

    spinIntervalRef.current = setTimeout(tick, speed);
  }, [tasks]);

  // Cleanup on unmount
  useEffect(() => {
    const ref = spinIntervalRef;
    return () => {
      if (ref.current) clearTimeout(ref.current);
    };
  }, []);

  // Helper: get task at offset from currentIndex (wrapping)
  const getTask = (offset: number): string | null => {
    if (tasks.length === 0) return null;
    return tasks[((currentIndex + offset) % tasks.length + tasks.length) % tasks.length];
  };

  // Slots: -1 (above), 0 (center), +1 (below)
  const slots = [
    { offset: -1, opacity: 0.35, textColor: "#555" },
    { offset: 0,  opacity: 1,    textColor: "#000" },
    { offset: 1,  opacity: 0.35, textColor: "#555" },
  ];

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

      {/* Stacked reel — 3 chatboxes, center is active */}
      <div className="relative mb-8 flex flex-col items-center gap-1" style={{ width: 519 }}>
        {slots.map(({ offset, opacity, textColor }) => {
          const task = getTask(offset);
          const isCenter = offset === 0;
          return (
            <div
              key={offset}
              className="relative"
              style={{ width: 519, height: 142, opacity }}
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
              {/* Task text — centered in the box */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'RuneScape Quill 8', 'Courier New', monospace",
                  fontSize: 16,
                  color: textColor,
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
                    setCurrentIndex(0);
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
