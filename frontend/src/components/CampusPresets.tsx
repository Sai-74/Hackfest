import { CAMPUS_PRESETS } from '../constants/campus';
import type { CampusPreset } from '../types/route';
import { MapPin } from 'lucide-react';

interface CampusPresetsProps {
  onSelectPreset: (preset: CampusPreset) => void;
  activePresetId?: string | null;
}

export const CampusPresets: React.FC<CampusPresetsProps> = ({
  onSelectPreset,
  activePresetId,
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 px-1">
        <MapPin className="w-3 h-3 text-cyan-400" /> Demo Presets:
      </span>
      {CAMPUS_PRESETS.map((preset) => {
        const isActive = activePresetId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset)}
            className={`shrink-0 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
              isActive
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700/50'
            }`}
          >
            {preset.name}
          </button>
        );
      })}
    </div>
  );
};
