"use client";

import React, { useEffect, useState } from "react";

export const THEME_PRESETS = [
  { id: "swiss-print", label: "Swiss Print (Light)" },
  { id: "neobrutal-yellow", label: "Neo-Brutalist Acid Yellow" },
  { id: "bauhaus-pop", label: "Bauhaus Primary Pop" },
  { id: "win98-classic", label: "Windows 98 Classic" },
  { id: "cyberpunk-volt", label: "Cyberpunk 2077 Volt" },
  { id: "caffeine-editorial", label: "Warm Espresso Editorial" },
  { id: "amber-crt", label: "Amber Phosphor CRT (1982)" },
  { id: "art-deco-gold", label: "Art Deco Noir & Gold" },
] as const;

const STORAGE_KEY = "domain-radar-theme-v2";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>("swiss-print");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && THEME_PRESETS.some((t) => t.id === saved)) {
        setTheme(saved);
        document.documentElement.setAttribute("data-theme", saved);
      }
    } catch {
      // ignore storage errors in restricted contexts
    }
  }, []);

  function applyTheme(nextId: string) {
    setTheme(nextId);
    document.documentElement.setAttribute("data-theme", nextId);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextId);
    } catch {
      // ignore
    }
  }

  function randomizeWild() {
    const others = THEME_PRESETS.filter((t) => t.id !== theme);
    const pick = others[Math.floor(Math.random() * others.length)] ?? THEME_PRESETS[0];
    applyTheme(pick.id);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Theme Picker"
        value={theme}
        onChange={(e) => applyTheme(e.target.value)}
        className="dr-input px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
      >
        {THEME_PRESETS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={randomizeWild}
        className="dr-btn-primary px-2.5 py-1.5 text-xs font-bold cursor-pointer hover:opacity-90"
      >
        Wild Theme
      </button>
    </div>
  );
}
