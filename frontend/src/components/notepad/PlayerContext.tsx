"use client";
/**
 * Media player state shared by the transcript, summary timestamps and the bottom player bar.
 *
 * Real speech-to-text/recordings are out of scope, so when a meeting has no `media_url` the
 * player runs a *virtual clock* (requestAnimationFrame advancing `currentMs` at `rate`).
 * With a media URL it drives a hidden <audio> element instead. Either way consumers only see
 * { currentMs, playing, rate, seek, toggle, skip, setRate }.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface PlayerState {
  currentMs: number;
  durationMs: number;
  playing: boolean;
  rate: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (ms: number, opts?: { play?: boolean }) => void;
  skip: (deltaMs: number) => void;
  setRate: (rate: number) => void;
}

const PlayerCtx = createContext<PlayerState | null>(null);

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

export const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlayerProvider({ durationMs, mediaUrl, children }: { durationMs: number; mediaUrl?: string | null; children: ReactNode }) {
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const audio = useRef<HTMLAudioElement | null>(null);
  const clock = useRef({ ms: 0, last: 0, raf: 0 });

  // --- virtual clock --------------------------------------------------------
  useEffect(() => {
    if (mediaUrl || !playing) return;
    const c = clock.current;
    c.last = performance.now();
    const tick = (now: number) => {
      c.ms = Math.min(durationMs, c.ms + (now - c.last) * rate);
      c.last = now;
      setCurrentMs(c.ms);
      if (c.ms >= durationMs) {
        setPlaying(false);
        return;
      }
      c.raf = requestAnimationFrame(tick);
    };
    c.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(c.raf);
  }, [playing, rate, durationMs, mediaUrl]);

  // --- real audio element -----------------------------------------------------
  useEffect(() => {
    if (!mediaUrl) return;
    const el = new Audio(mediaUrl);
    audio.current = el;
    const onTime = () => setCurrentMs(el.currentTime * 1000);
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
      audio.current = null;
    };
  }, [mediaUrl]);

  const seek = useCallback(
    (ms: number, opts?: { play?: boolean }) => {
      const clamped = Math.max(0, Math.min(durationMs, ms));
      clock.current.ms = clamped;
      clock.current.last = performance.now();
      if (audio.current) audio.current.currentTime = clamped / 1000;
      setCurrentMs(clamped);
      if (opts?.play) {
        setPlaying(true);
        void audio.current?.play();
      }
    },
    [durationMs],
  );

  const play = useCallback(() => {
    if (clock.current.ms >= durationMs) seek(0);
    setPlaying(true);
    void audio.current?.play();
  }, [durationMs, seek]);
  const pause = useCallback(() => {
    setPlaying(false);
    audio.current?.pause();
  }, []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, play, pause]);
  const skip = useCallback((delta: number) => seek(clock.current.ms + delta), [seek]);
  const setRate = useCallback((r: number) => {
    setRateState(r);
    if (audio.current) audio.current.playbackRate = r;
  }, []);

  const value = useMemo(
    () => ({ currentMs, durationMs, playing, rate, play, pause, toggle, seek, skip, setRate }),
    [currentMs, durationMs, playing, rate, play, pause, toggle, seek, skip, setRate],
  );
  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

/** Index of the segment playing at `ms` (last segment whose start <= ms), via binary search. */
export function activeSegmentIndex(starts: number[], ms: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid]! <= ms) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
