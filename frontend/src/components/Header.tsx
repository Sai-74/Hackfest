import { Footprints, Bike, ThermometerSun, ShieldCheck } from 'lucide-react';
import type { TransportMode } from '../types/route';

interface HeaderProps {
  mode: TransportMode;
  onModeChange: (mode: TransportMode) => void;
  activeHeatSource?: string;
  isCalculating?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  mode,
  onModeChange,
  activeHeatSource,
  isCalculating,
}) => {
  return (
    <header className="absolute top-3 left-3 right-3 z-20 flex flex-col sm:flex-row items-center justify-between gap-2.5 pointer-events-none">
      {/* Brand & Pilot Badge */}
      <div className="bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-lg border border-slate-700/60 flex items-center gap-2.5 pointer-events-auto">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center shadow-md shadow-cyan-500/20">
          <ThermometerSun className="w-5 h-5 text-slate-950" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-base tracking-tight leading-none text-slate-100">CoolRoute</h1>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              Pilot
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium leading-tight">
            Ravenshaw University, Cuttack
          </p>
        </div>
      </div>

      {/* Mode Selector & Status */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Walking / Cycling Toggle */}
        <div className="bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-slate-700/60 flex items-center">
          <button
            type="button"
            onClick={() => onModeChange('walk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${mode === 'walk'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            <Footprints className="w-4 h-4" />
            <span>Walking</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('bike')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${mode === 'bike'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            <Bike className="w-4 h-4" />
            <span>Cycling</span>
          </button>
        </div>

        {/* Heat Source Pill */}
        {activeHeatSource && (
          <div className="hidden md:flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg border border-slate-700/60 text-xs text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-[11px]">
              {activeHeatSource === 'utci' ? 'UTCI Thermal' : 'Shadow Shade'}
            </span>
            {isCalculating && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping ml-1" />
            )}
          </div>
        )}
      </div>
    </header>
  );
};
