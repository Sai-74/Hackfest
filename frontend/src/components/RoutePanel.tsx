import React, { useState } from 'react';
import type { RouteResponse } from '../types/route';
import { Zap, Snowflake, Clock, Route, Thermometer, Sun, Info, ChevronUp, ChevronDown, Check } from 'lucide-react';

interface RoutePanelProps {
  routeData: RouteResponse;
  selectedRouteType: 'cooler' | 'fastest';
  onSelectRouteType: (type: 'cooler' | 'fastest') => void;
  onClear: () => void;
}

export const RoutePanel: React.FC<RoutePanelProps> = ({
  routeData,
  selectedRouteType,
  onSelectRouteType,
  onClear,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const { fastest, cooler, heat_source, heat_source_description } = routeData;
  const activeRoute = selectedRouteType === 'cooler' ? cooler : fastest;

  // Comparison metrics between fastest and cooler
  const timeDiffMin = Number((cooler.stats.duration_min - fastest.stats.duration_min).toFixed(1));
  const distDiffM = Math.round(cooler.stats.distance_m - fastest.stats.distance_m);
  
  // Heat reduction percentage
  let heatReductionPct = 0;
  if (fastest.stats.avg_heat_score > 0) {
    heatReductionPct = Math.round(
      ((fastest.stats.avg_heat_score - cooler.stats.avg_heat_score) / fastest.stats.avg_heat_score) * 100
    );
  }

  // Shade increase percentage points
  const shadeDiffPct = Math.round((cooler.stats.avg_shade_fraction - fastest.stats.avg_shade_fraction) * 100);

  return (
    <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 text-slate-100">
      {/* Header Bar / Collapse Handle */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/60 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-xs tracking-wide uppercase text-slate-300">
            Route Comparison
          </span>
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 rounded-full text-slate-400 hover:text-cyan-300 hover:bg-slate-700/50 transition-colors"
            title="Heat metric info"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-slate-400 hover:text-rose-400 px-2 py-0.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Metric Explanation Banner (collapsible) */}
      {showInfo && (
        <div className="p-3 bg-cyan-950/70 border-b border-cyan-800/60 text-xs text-cyan-200 leading-relaxed">
          <div className="font-semibold mb-1 flex items-center gap-1.5 text-cyan-300">
            <Info className="w-3.5 h-3.5 text-cyan-400" /> Metric Source: {heat_source === 'utci' ? 'Daytime UTCI Raster' : '3D Building Shadows'}
          </div>
          <p className="text-[11px]">{heat_source_description}</p>
          <div className="mt-1 text-[10px] text-cyan-300/80">
            {heat_source === 'utci'
              ? 'Heat score (0 to 1) is normalized from calibrated Universal Thermal Climate Index values across campus edges.'
              : 'Relative sun exposure score (0 to 1) is derived from 1 - average shade fraction computed with Astral solar azimuth/elevation.'}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`p-3 sm:p-4 space-y-3 ${isExpanded ? 'block' : 'hidden sm:block'}`}>
        {/* Route Objective Selector Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Cooler Route Card */}
          <button
            type="button"
            onClick={() => onSelectRouteType('cooler')}
            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
              selectedRouteType === 'cooler'
                ? 'bg-gradient-to-br from-emerald-950/80 to-cyan-950/80 border-cyan-500/80 shadow-lg shadow-cyan-950/50 ring-2 ring-cyan-500/30'
                : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                <Snowflake className="w-4 h-4 text-cyan-400" /> Cooler Route
              </span>
              {selectedRouteType === 'cooler' && (
                <div className="w-4 h-4 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center text-[10px]">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-white">
                {cooler.stats.duration_min}
              </span>
              <span className="text-xs text-slate-400 font-medium">min</span>
            </div>

            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-cyan-300 font-medium">
              <Sun className="w-3 h-3 text-amber-300" />
              <span>{Math.round(cooler.stats.avg_shade_fraction * 100)}% Shaded</span>
            </div>

            {/* Cyan bottom indicator line matching map color */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-400" />
          </button>

          {/* Fastest Route Card */}
          <button
            type="button"
            onClick={() => onSelectRouteType('fastest')}
            className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
              selectedRouteType === 'fastest'
                ? 'bg-gradient-to-br from-amber-950/70 to-slate-900 border-amber-500/80 shadow-lg shadow-amber-950/40 ring-2 ring-amber-500/30'
                : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Zap className="w-4 h-4 text-amber-400" /> Fastest Route
              </span>
              {selectedRouteType === 'fastest' && (
                <div className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px]">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-white">
                {fastest.stats.duration_min}
              </span>
              <span className="text-xs text-slate-400 font-medium">min</span>
            </div>

            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-300 font-medium">
              <Sun className="w-3 h-3 text-amber-400" />
              <span>{Math.round(fastest.stats.avg_shade_fraction * 100)}% Shaded</span>
            </div>

            {/* Amber bottom indicator line matching map color */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
          </button>
        </div>

        {/* Trade-off summary banner */}
        <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700/70 flex items-center justify-between text-xs">
          <span className="text-slate-300 text-[11px] leading-tight">
            {heatReductionPct > 0 ? (
              <>
                <strong className="text-cyan-300">{heatReductionPct}% cooler</strong> for{' '}
                {timeDiffMin > 0 ? `+${timeDiffMin} min (${distDiffM > 0 ? `+${distDiffM}m` : 'same distance'})` : 'same time!'}
              </>
            ) : shadeDiffPct > 0 ? (
              <>
                <strong className="text-cyan-300">+{shadeDiffPct}% more shade</strong> with{' '}
                {timeDiffMin > 0 ? `+${timeDiffMin} min` : 'no extra time'}
              </>
            ) : (
              <span className="text-slate-400">Both objectives selected identical optimal path.</span>
            )}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-700 text-slate-200">
            {activeRoute.stats.distance_m} m
          </span>
        </div>

        {/* Selected Route Detailed Statistics */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-slate-800/40 p-2 rounded-xl border border-slate-700/40 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-slate-400 mb-0.5">
              <Clock className="w-3 h-3 text-slate-300" /> Est. Time
            </div>
            <div className="text-sm font-bold text-white">{activeRoute.stats.duration_min} min</div>
          </div>

          <div className="bg-slate-800/40 p-2 rounded-xl border border-slate-700/40 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-slate-400 mb-0.5">
              <Route className="w-3 h-3 text-slate-300" /> Distance
            </div>
            <div className="text-sm font-bold text-white">{activeRoute.stats.distance_m} m</div>
          </div>

          <div className="bg-slate-800/40 p-2 rounded-xl border border-slate-700/40 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-slate-400 mb-0.5">
              <Thermometer className="w-3 h-3 text-cyan-400" /> {heat_source === 'utci' ? 'Avg UTCI' : 'Heat Score'}
            </div>
            <div className="text-sm font-bold text-cyan-300">
              {activeRoute.stats.avg_utci_deg_c !== null
                ? `${activeRoute.stats.avg_utci_deg_c}°C`
                : `${(activeRoute.stats.avg_heat_score * 100).toFixed(0)}%`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
