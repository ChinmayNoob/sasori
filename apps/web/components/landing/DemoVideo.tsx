"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Play, Pause, Maximize, Minimize } from "lucide-react";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const resetHideTimer = useCallback(() => {
    clearTimeout(hideTimer.current);
    setShowControls(true);
    if (isPlaying && !seeking) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [isPlaying, seeking]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
      setShowControls(true);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  }, []);

  const seek = useCallback((clientX: number) => {
    const bar = progressRef.current;
    const video = videoRef.current;
    if (!bar || !video || !video.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    setProgress(ratio * 100);
    setCurrentTime(video.currentTime);
  }, []);

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setSeeking(true);
      seek(e.clientX);
    },
    [seek],
  );

  const handleProgressTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setSeeking(true);
      seek(e.touches[0].clientX);
    },
    [seek],
  );

  useEffect(() => {
    if (!seeking) return;
    const onMouseMove = (e: MouseEvent) => seek(e.clientX);
    const onTouchMove = (e: TouchEvent) => seek(e.touches[0].clientX);
    const onEnd = () => setSeeking(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }, [seeking, seek]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (!seeking && video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
        setCurrentTime(video.currentTime);
      }
    };
    const onLoaded = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [seeking]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative group"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && !seeking && setShowControls(false)}
    >
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-auto"
      >
        <source src="/videos/sasori.mp4" type="video/mp4" />
      </video>

      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity"
          aria-label="Play video"
        >
          <div className="flex items-center justify-center size-16 rounded-full bg-white/90 backdrop-blur-sm shadow-float border border-stone-200/60">
            <Play className="size-6 text-sand-900 ml-0.5" fill="currentColor" />
          </div>
        </button>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent pt-10 pb-3 px-4 flex flex-col gap-2.5 transition-opacity duration-300 ${
          showControls || seeking || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          ref={progressRef}
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressTouchStart}
          className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/bar hover:h-2 transition-[height]"
        >
          <div
            className="absolute left-0 top-0 h-full bg-white/90 rounded-full"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 size-3.5 bg-white rounded-full shadow-md opacity-0 group-hover/bar:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="flex items-center justify-center size-8 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="size-3.5 text-white" fill="white" />
              ) : (
                <Play className="size-3.5 text-white ml-0.5" fill="white" />
              )}
            </button>
            <span className="text-white/80 text-xs font-light tracking-wide tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="flex items-center justify-center size-8 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="size-3.5 text-white" />
            ) : (
              <Maximize className="size-3.5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
