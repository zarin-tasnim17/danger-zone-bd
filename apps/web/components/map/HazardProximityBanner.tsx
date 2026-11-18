'use client';

import React from 'react';
import { AlertTriangle, Volume2, VolumeX, X } from 'lucide-react';

export interface HazardProximityBannerItem {
  hazard: {
    id: string;
    title?: string;
    category: string;
    description?: string;
    locationName?: string;
  };
  distanceMeters: number;
  enteredAt: number;
}

export interface HazardProximityBannerProps {
  /** List of active nearby danger zone alerts, sorted ascending by distance (closest first). */
  alerts: HazardProximityBannerItem[];
  /** Audio mute status for proximity chimes. */
  isMuted: boolean;
  /** Callback invoked when the user toggles mute. */
  onToggleMute: () => void;
  /** Callback invoked when the user dismisses the active hazard banner. */
  onDismiss: (hazardId: string) => void;
  /** Optional custom Tailwind class names. */
  className?: string;
}

/**
 * Formats distance in meters for clear tactical HUD readability.
 */
export function formatBannerDistance(distanceMeters: number): string {
  if (distanceMeters <= 0) {
    return 'At hazard epicenter';
  }
  return `${Math.round(distanceMeters)}m away`;
}

/**
 * Visual HUD warning banner mounted on top of the interactive map viewport.
 * Provides real-time dynamic distance to the closest active hazard, category badge,
 * audio chime mute toggle, and manual dismissal.
 */
export default function HazardProximityBanner({
  alerts,
  isMuted,
  onToggleMute,
  onDismiss,
  className = '',
}: HazardProximityBannerProps) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const closest = alerts[0];
  const moreCount = Math.max(0, alerts.length - 1);
  const formattedDist = formatBannerDistance(closest.distanceMeters);
  const title = closest.hazard.title || closest.hazard.locationName || 'Active Danger Zone';
  const category = closest.hazard.category || 'Danger';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[450] w-[calc(100%-1.5rem)] max-w-lg transition-all duration-300 ease-out pointer-events-auto ${className}`}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/95 via-rose-950/95 to-red-900/95 border border-red-500/60 shadow-2xl backdrop-blur-md p-3 sm:p-4 text-white">
        {/* Animated warning accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-red-500 to-rose-400 animate-pulse" />

        <div className="flex items-start justify-between gap-3">
          {/* Pulsing Alert Icon */}
          <div className="relative shrink-0 mt-0.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-5 h-5 animate-pulse text-amber-300" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          </div>

          {/* Central Hazard Details */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/30 text-red-200 border border-red-400/40">
                {category}
              </span>
              <span className="font-mono text-xs font-black text-amber-300 px-2 py-0.5 rounded-md bg-black/40 border border-amber-400/30">
                {formattedDist}
              </span>
              {moreCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/50">
                  +{moreCount} more nearby
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-white tracking-tight truncate mt-1 leading-snug">
              {title}
            </h3>

            {closest.hazard.locationName && (
              <p className="text-[11px] text-red-200/80 truncate mt-0.5 font-medium">
                📍 {closest.hazard.locationName}
              </p>
            )}
          </div>

          {/* Controls: Mute Toggle and Dismiss */}
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute hazard alert audio' : 'Mute hazard alert audio'}
              title={isMuted ? 'Unmute audio chime' : 'Mute audio chime'}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer border border-white/10"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-300" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-300" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onDismiss(closest.hazard.id)}
              aria-label="Dismiss danger warning banner"
              title="Dismiss warning banner"
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
