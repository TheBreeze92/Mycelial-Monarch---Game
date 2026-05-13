/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dna, 
  Wind, 
  Skull, 
  Activity, 
  Sparkles, 
  ChevronRight, 
  Zap, 
  ShieldAlert,
  Ghost,
  Volume2,
  VolumeX,
  Award,
  Trophy,
  Leaf,
  RefreshCcw,
  TrendingUp,
  Eye,
  BookOpen
} from 'lucide-react';
import { audioService } from './services/audioService';

// --- DESIGN TOKENS ---
const TOKENS = {
  colors: {
    bg: '#0d0d0d',
    surface: '#1a1a1a',
    panel: '#262626',
    border: '#333333',
    accentRed: '#ff0000',
    accentCyan: '#00ffff',
    text: '#d1d1d1',
    muted: '#666666',
  },
  formula: {
    cost: (base: number, count: number) => Math.floor(base * Math.pow(1.15, count)),
  }
};

// --- TYPES ---
interface Upgrade {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  type: 'click' | 'auto' | 'thrall';
  value: number;
  icon: React.ElementType;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: (state: { rot: number, inventory: Record<string, number>, isShockActive: boolean, secretActions: Record<string, number> }) => boolean;
  secret?: boolean;
}

interface TemporaryBoost {
  id: string;
  multiplier: number;
  remaining: number; // in seconds
  name: string;
}

interface PrestigeUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  multiplier: number;
  type: 'global' | 'click' | 'thrall' | 'auto' | 'thrall_growth' | 'visual';
  icon: React.ElementType;
}

const UPGRADES: Upgrade[] = [
  { 
    id: 'hyphae', 
    name: 'Fungal Hyphae', 
    description: 'Bury tendrils deep into the earth. Generates Rot automatically.', 
    baseCost: 300, 
    type: 'auto', 
    value: 2.5, 
    icon: Dna 
  },
  { 
    id: 'calcification', 
    name: 'Ossified Growth', 
    description: 'Hardened fungal plates. Clicks yield more Rot.', 
    baseCost: 750, 
    type: 'click', 
    value: 1.5, 
    icon: ShieldAlert 
  },
  { 
    id: 'spore_cyst', 
    name: 'Spore Cysts', 
    description: 'Rupturing nodes that aerosolize decay.', 
    baseCost: 800, 
    type: 'auto', 
    value: 5, 
    icon: Sparkles 
  },
  { 
    id: 'spore_winds', 
    name: 'Spore Winds', 
    description: 'Automating the infection of the graveyard outside.', 
    baseCost: 2500, 
    type: 'auto', 
    value: 15, 
    icon: Wind 
  },
  { 
    id: 'thrall_binding', 
    name: 'Thrall Binding', 
    description: 'Animates the fallen to carry the contagion.', 
    baseCost: 5000, 
    type: 'thrall', 
    value: 0.1, 
    icon: Ghost 
  },
  { 
    id: 'thrall_command', 
    name: 'Thrall Command', 
    description: 'Direct the hive mind. Increases thrall generation efficiency.', 
    baseCost: 12000, 
    type: 'thrall', 
    value: 0.1, 
    icon: Ghost 
  },
  { 
    id: 'necro_mycelium', 
    name: 'Necro-Mycelium', 
    description: 'Feed upon the old to grow the new.', 
    baseCost: 45000, 
    type: 'auto', 
    value: 150, 
    icon: Skull 
  }
];

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'million_rot',
    name: 'The Millionth Maw',
    description: 'Amass 1,000,000 White Rot.',
    condition: ({ rot }) => rot >= 1000000
  },
  {
    id: 'hyphal_master',
    name: 'Hyphal Overlord',
    description: 'Reach Level 25 in Fungal Hyphae.',
    condition: ({ inventory }) => (inventory['hyphae'] || 0) >= 25
  },
  {
    id: 'shock_triggered',
    name: 'Thoracic Breach',
    description: 'Trigger the System Shock milestone.',
    condition: ({ isShockActive }) => isShockActive
  },
  {
    id: 'all_upgrades',
    name: 'Total Contagion',
    description: 'Purchase at least one of every upgrade.',
    condition: ({ inventory, isShockActive }) => {
      const required = isShockActive ? UPGRADES.map(u => u.id) : UPGRADES.filter(u => u.type !== 'thrall').map(u => u.id);
      return required.every(id => (inventory[id] || 0) > 0);
    }
  },
  {
    id: 'scholar_decay',
    name: 'Scholar of Decay',
    description: 'You poked the Visceral Log until it spoke back.',
    secret: true,
    condition: ({ secretActions }) => (secretActions['log_clicks'] || 0) >= 13
  },
  {
    id: 'vitals_sync',
    name: 'Resonant Vitals',
    description: 'Synced your rhythm with the Monarch\'s heart.',
    secret: true,
    condition: ({ secretActions }) => (secretActions['vitals_clicks'] || 0) >= 7
  }
];

const PRESTIGE_UPGRADES: PrestigeUpgrade[] = [
  {
    id: 'primal_strain',
    name: 'Primal Strain',
    description: '+25% Global Rot generation.',
    cost: 10,
    multiplier: 0.25,
    type: 'global',
    icon: TrendingUp
  },
  {
    id: 'virulent_clicks',
    name: 'Virulent Clicks',
    description: '+50% Click efficiency.',
    cost: 25,
    multiplier: 0.50,
    type: 'click',
    icon: Zap
  },
  {
    id: 'spore_potency',
    name: 'Spore Potency',
    description: '+100% Thrall contribution.',
    cost: 100,
    multiplier: 1.0,
    type: 'thrall',
    icon: Sparkles
  },
  {
    id: 'rapid_metabolism',
    name: 'Rapid Metabolism',
    description: '+20% Auto-generation value.',
    cost: 50,
    multiplier: 0.20,
    type: 'auto',
    icon: Activity
  },
  {
    id: 'bioluminescent_pulse',
    name: 'Bioluminescent Pulse',
    description: '+15% Global Rot & Unlocks special glow.',
    cost: 75,
    multiplier: 0.15,
    type: 'visual',
    icon: Eye
  },
  {
    id: 'thrall_saturation',
    name: 'Thrall Saturation',
    description: '+50% Thrall generation speed.',
    cost: 150,
    multiplier: 0.50,
    type: 'thrall_growth',
    icon: Ghost
  }
];

const LORE_STAGES = [
  "A single spore finds purchase in the Monarch's heavy lungs.",
  "Hyphae knit through the thoracic wall. Repurposed muscle twitches.",
  "The crown is a relic; the skull beneath is now our fertile nursery.",
  "The cathedral-tomb vibrates. We are the choir in the calculated walls.",
  "Spore winds carry our intent to the graveyard. The fallen join the Bloom.",
  "The earth outside is porous, yielding to the iridescent crawl of decay.",
  "The citadel has become a hive. One pulse, one collective hunger.",
  "Geography fails. The mountain itself swells with our collective breath.",
  "The ego is a memory. We are the Bloom. We are the end of the dynasty."
];

// --- SUB-COMPONENTS ---

const MainStage = ({ 
  rot, 
  onVeinClick, 
  isShockActive,
  visualLevel,
  syncStreak,
  lastClickPower,
  thralls
}: { 
  rot: number, 
  onVeinClick: (power: number) => void, 
  isShockActive: boolean,
  visualLevel: number,
  syncStreak: number,
  lastClickPower: number,
  thralls: number
}) => {
  const [ripples, setRipples] = useState<{ id: number, x: number, y: number }[]>([]);
  const [floats, setFloats] = useState<{ id: number, x: number, y: number, value: string, isSync: boolean }[]>([]);

  const handleRipple = (e: React.MouseEvent) => {
    onVeinClick(0);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const now = Date.now();
    const cyclePos = (now % 1000) / 1000;
    const isSync = cyclePos < 0.2 || cyclePos > 0.8;
    const id = now + Math.random();
    
    if (isSync) {
      setRipples(prev => [...prev.slice(-5), { id, x, y }]);
      setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 1000);
    }

    setFloats(prev => [...prev.slice(-10), { id, x, y: y - 20, value: lastClickPower.toLocaleString(), isSync }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1000);
  };

  const accentColor = isShockActive ? TOKENS.colors.accentCyan : TOKENS.colors.accentRed;
  
  return (
    <div className={`flex flex-col items-center flex-1 h-full p-8 relative overflow-hidden bg-[#0d0d0d] charcoal-grain`}>
      {/* resonance overload notification */}
      {syncStreak === 20 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 px-12 text-center"
        >
          <div className="hand-drawn-border-lg bg-black/80 p-8 shadow-[0_0_50px_rgba(245,158,11,0.3)] border-amber-500">
            <h2 className="text-2xl font-serif text-amber-500 uppercase tracking-tight mb-4 animate-jitter">Resonance Overload</h2>
            <p className="text-[10px] text-white/60 tracking-widest font-mono">10X GLOBAL MULTIPLIER ACTIVATED</p>
          </div>
        </motion.div>
      )}

      {/* Floating Combat Text */}
      <AnimatePresence>
        {floats.map(f => (
          <motion.div
            key={f.id}
            initial={{ y: f.y, x: f.x, opacity: 1, scale: f.isSync ? 2 : 1 }}
            animate={{ y: f.y - 100, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`absolute pointer-events-none font-bold z-40 ${f.isSync ? 'text-amber-400 text-2xl font-serif' : 'text-white text-sm font-mono'}`}
            style={{ left: f.x, top: f.y }}
          >
            +{f.value}
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {ripples.map(r => (
          <motion.div
            key={r.id}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`absolute pointer-events-none rounded-full border-4 z-30 ${isShockActive ? 'border-cyan-400' : 'border-red-500'}`}
            style={{ 
              left: r.x, 
              top: r.y, 
              width: '40px', 
              height: '40px',
              marginLeft: '-20px',
              marginTop: '-20px'
            }}
          />
        ))}
      </AnimatePresence>

      {/* Thrall Swarm Visuals */}
      {isShockActive && (
        <div className="absolute inset-0 pointer-events-none z-0">
          {Array.from({ length: Math.min(Math.floor(thralls / 10), 50) }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * 100 + "%", 
                y: Math.random() * 100 + "%" 
              }}
              animate={{ 
                x: [null, Math.random() * 100 + "%"],
                y: [null, Math.random() * 100 + "%"],
                opacity: [1, 0, 1]
              }}
              transition={{ 
                duration: 2 + Math.random() * 4, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="absolute w-2 h-2 bg-cyan-400/50 shadow-[0_0_4px_#00ffff]"
              style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}
            />
          ))}
        </div>
      )}

      {/* Top Progress Bar */}
      <div className="absolute top-0 w-full h-4 bg-decay-panel hand-drawn-border border-none shadow-none">
        <motion.div 
          className="h-full bg-decay-accent-cyan shadow-[0_0_15px_#00ffff] bioluminescent-cyan"
          animate={{ width: `${Math.min((rot / 10000) * 100, 100)}%` }}
        />
      </div>

      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center z-20 w-64">
        <div className={`text-[10px] font-serif italic transition-colors ${syncStreak === 20 ? 'text-amber-500' : 'text-white/30 text-[8px]'}`}>
          {syncStreak === 20 ? 'RESONANCE PEAK' : 'NEURAL SYNC'}
        </div>
        <div className="h-2 w-full bg-black hand-drawn-border mt-1">
          {syncStreak > 0 && (
            <motion.div 
              className={`h-full ${syncStreak === 20 ? 'bg-amber-400 bioluminescent-cyan shadow-[0_0_8px_#fbbf24]' : 'bg-white/20'}`}
              initial={{ width: 0 }}
              animate={{ width: `${(syncStreak / 20) * 100}%` }}
            />
          )}
        </div>
      </div>

      <div className="text-center mb-12 z-10 mt-16">
        <motion.h1 
          key={rot}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className={`text-6xl font-mono mb-4 transition-colors duration-1000 ${isShockActive ? 'text-decay-accent-cyan bioluminescent-cyan' : 'text-decay-accent-red bioluminescent-red'}`}
        >
          {rot.toLocaleString()}
        </motion.h1>
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] uppercase font-serif tracking-wide text-decay-text-muted">White Rot</div>
          {syncStreak > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-4 py-1 hand-drawn-border border-amber-500/20"
            >
              SYNC: x{syncStreak}
            </motion.div>
          )}
        </div>
      </div>

      <div className="relative group cursor-pointer mt-8" onClick={handleRipple}>
        {/* Organic SVG Vein */}
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            filter: [
              `drop-shadow(0 0 10px ${accentColor}44)`,
              `drop-shadow(0 0 25px ${accentColor}88)`,
              `drop-shadow(0 0 10px ${accentColor}44)`
            ]
          }}
          transition={{ duration: 1.0, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10"
        >
          <svg width="280" height="280" viewBox="0 0 200 200" className={isShockActive ? "bioluminescent-cyan" : "bioluminescent-red"}>
            <motion.path
              d="M100,20 C120,20 140,30 150,50 C160,70 170,90 150,120 C130,150 120,180 100,180 C80,180 70,150 50,120 C30,90 40,70 50,50 C60,30 80,20 100,20 Z"
              fill={accentColor}
              fillOpacity="0.8"
              stroke="white"
              strokeWidth="2"
              animate={{
                d: [
                  "M100,25 C125,25 145,35 155,55 C165,75 175,95 155,125 C135,155 125,175 100,175 C75,175 65,155 45,125 C25,100 35,75 45,55 C55,35 75,25 100,25 Z",
                  "M105,20 C130,15 150,30 160,50 C170,70 180,100 160,130 C140,160 130,190 105,185 C80,180 70,160 50,130 C30,100 40,70 50,50 C60,30 80,25 105,20 Z",
                  "M100,25 C125,25 145,35 155,55 C165,75 175,95 155,125 C135,155 125,175 100,175 C75,175 65,155 45,125 C25,100 35,75 45,55 C55,35 75,25 100,25 Z"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Inner pulsating node */}
            <motion.circle
              cx="100" cy="100" r="10"
              fill="white"
              animate={{ r: [10, 15, 10], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
            {/* Tendrils */}
            <path d="M50,120 L20,150" stroke={accentColor} strokeWidth="4" />
            <path d="M150,120 L180,150" stroke={accentColor} strokeWidth="4" />
            <path d="M100,20 L100,5" stroke={accentColor} strokeWidth="4" />
          </svg>
        </motion.div>
      </div>

      <div className="mt-12 w-full max-w-sm z-10 space-y-4">
        <div className="flex justify-between text-[10px] font-mono">
          <span>SYSTEM BREACH</span>
          <span className="text-decay-accent-cyan">{Math.min(Math.floor((rot / 10000) * 100), 100)}%</span>
        </div>
        <div className="h-4 w-full bg-black hand-drawn-border">
          <motion.div 
            className="h-full bg-decay-accent-cyan bioluminescent-cyan"
            animate={{ width: `${Math.min((rot / 10000) * 100, 100)}%` }}
          />
        </div>
        <div className="text-center font-serif italic text-xs leading-relaxed text-decay-text-muted px-4">
          {!isShockActive ? "Feed the thoracic wall. Breach the King." : "The Mycelium has claimed the throne. Spreads iridescent decay."}
        </div>
      </div>

      <div className="absolute bottom-0 w-full p-6 bg-black hand-drawn-border border-x-0 border-b-0 flex justify-center gap-16 z-20">
        <div className="text-center">
          <div className="text-[8px] font-serif text-decay-text-muted mb-1 uppercase">Yield</div>
          <div className="text-sm font-mono text-white">1.0 / CLICK</div>
        </div>
        <div className="text-center">
          <div className="text-[8px] font-serif text-decay-text-muted mb-1 uppercase">Load</div>
          <div className="text-sm font-mono text-cyan-400">{(rot/10000 * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
};

const UpgradePanel = ({ 
  rot, 
  thralls,
  inventory, 
  onBuy, 
  isShockActive,
  currentLore
}: { 
  rot: number, 
  thralls: number,
  inventory: Record<string, number>, 
  onBuy: (u: Upgrade) => void,
  isShockActive: boolean,
  currentLore: string
}) => {
  return (
    <div className="w-80 h-full bg-[#0d0d0d] flex flex-col p-5 overflow-hidden hand-drawn-border-lg border-y-0 border-r-0 charcoal-grain">
      <h2 className={`text-[10px] font-serif uppercase mb-6 border-b-2 pb-3 flex items-center gap-3 ${isShockActive ? 'text-decay-accent-cyan border-cyan-500/20' : 'text-decay-accent-red border-red-500/20'}`}>
        <div className={`w-3 h-3 ${isShockActive ? 'bg-decay-accent-cyan bioluminescent-cyan' : 'bg-decay-accent-red bioluminescent-red'}`}></div>
        Hyphal Structures
      </h2>
      
      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
        {UPGRADES.map((upgrade) => {
          const count = inventory[upgrade.id] || 0;
          const cost = TOKENS.formula.cost(upgrade.baseCost, count);
          const canAfford = rot >= cost;
          
          if (upgrade.type === 'thrall' && !isShockActive) return null;

          return (
            <div key={upgrade.id} className={`p-4 bg-black hand-drawn-border transition-all ${canAfford ? 'border-white/20 group' : 'border-white/5 opacity-50'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-white text-[11px] font-serif uppercase leading-tight">{upgrade.name}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 ${isShockActive ? 'text-decay-accent-cyan' : 'text-decay-accent-red'}`}>Lv.{count}</span>
              </div>
              <p className="text-[11px] font-serif italic text-decay-text-muted mb-4 leading-relaxed">{upgrade.description}</p>
              <div className="flex justify-between items-center">
                <span className={`text-[10px] font-mono ${canAfford ? isShockActive ? 'text-decay-accent-cyan' : 'text-red-500' : 'text-decay-text-muted'}`}>
                  {cost.toLocaleString()}
                </span>
                <button 
                  disabled={!canAfford}
                  onClick={() => onBuy(upgrade)}
                  className={`px-4 py-1 text-[10px] font-serif uppercase border-2 transition-all ${
                    canAfford 
                      ? `bg-white/5 border-white/20 cursor-pointer ${isShockActive ? 'hover:bg-decay-accent-cyan/20 hover:border-decay-accent-cyan' : 'hover:bg-decay-accent-red/20 hover:border-decay-accent-red'}` 
                      : 'bg-black border-white/5 cursor-not-allowed text-decay-text-muted'
                  }`}
                >
                  ABSORB
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-6 border-t-2 border-white/5">
        <div className="text-[8px] font-serif text-decay-text-muted mb-2 uppercase">Visceral Log</div>
        <div className="text-[11px] font-serif italic h-16 overflow-hidden opacity-60 leading-relaxed">
          {currentLore}
        </div>
      </div>
    </div>
  );
};

const AchievementSection = ({ 
  achievements, 
  isShockActive 
}: { 
  achievements: string[], 
  isShockActive: boolean 
}) => {
  const visibleAchievements = ACHIEVEMENTS.filter(ach => !ach.secret || achievements.includes(ach.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center font-serif uppercase text-[8px] opacity-40 mb-2">
        <span>Trophies</span>
        <span className="font-mono">{achievements.length} / {ACHIEVEMENTS.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 max-h-64 overflow-y-auto custom-scrollbar pr-1">
        {visibleAchievements.map(ach => {
          const isUnlocked = achievements.includes(ach.id);
          return (
            <div 
              key={ach.id} 
              className={`p-3 hand-drawn-border transition-all flex items-center gap-4 ${
                isUnlocked 
                  ? isShockActive 
                    ? 'border-decay-accent-cyan/50 bg-decay-accent-cyan/10 text-white' 
                    : 'border-decay-accent-red/50 bg-decay-accent-red/10 text-white' 
                  : 'opacity-30 grayscale border-white/5'
              } ${ach.secret && isUnlocked ? 'animate-jitter' : ''}`}
            >
              <div className={`p-2 ${isUnlocked ? isShockActive ? 'text-decay-accent-cyan bioluminescent-cyan' : 'text-decay-accent-red bioluminescent-red' : 'text-white/20'}`}>
                {isUnlocked ? <Award className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-serif truncate leading-tight flex items-center gap-2 uppercase">
                  {ach.name}
                  {ach.secret && isUnlocked && <span className="text-[8px] font-mono text-amber-500 animate-pulse">SECRET</span>}
                </div>
                <div className="text-[10px] font-serif opacity-60 leading-relaxed italic mt-1">{ach.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PrestigePanel = ({ 
  essence, 
  lifetimeEssence,
  prestigeInventory, 
  onBuy, 
  isShockActive,
  onBloom,
  rot
}: { 
  essence: number, 
  lifetimeEssence: number,
  prestigeInventory: Record<string, number>, 
  onBuy: (u: PrestigeUpgrade) => void,
  isShockActive: boolean,
  onBloom: () => void,
  rot: number
}) => {
  const bloomYield = Math.floor(Math.sqrt(rot / 10000) * 5);
  const nextMilestone = [10, 50, 100].find(m => lifetimeEssence < m) || 100;
  
  return (
    <div className="space-y-8">
      {/* Evolutionary Progress */}
      <div className="px-3 pb-6 border-b-2 border-white/5">
        <div className="flex justify-between items-center font-serif text-[8px] text-amber-500/60 mb-3">
          <span>PEAK</span>
          <span className="font-mono">{lifetimeEssence}Σ</span>
        </div>
        <div className="h-3 w-full bg-black hand-drawn-border p-0.5">
          <motion.div 
            className="h-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
            animate={{ width: `${Math.min((lifetimeEssence / nextMilestone) * 100, 100)}%` }}
          />
        </div>
        <div className="mt-4 space-y-3">
          {[
            { m: 10, label: 'Luminescent Spores', active: '+1 Glow' },
            { m: 50, label: 'Global Permeation', active: '+15% Rot' },
            { m: 100, label: 'Synaptic Drive', active: '+25% Click' }
          ].map(item => (
            <div key={item.m} className={`flex justify-between items-center font-serif text-[8px] uppercase ${lifetimeEssence >= item.m ? 'text-amber-500' : 'text-white/10'}`}>
              <span>{item.label}</span>
              <span className="font-mono">{lifetimeEssence >= item.m ? item.active : 'LOCKED'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 bg-black hand-drawn-border-lg border-amber-500/30 text-center space-y-6">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[8px] font-serif text-decay-text-muted uppercase">Essence</span>
          <span className="text-3xl font-mono text-amber-400 flex items-center gap-3">
            <Leaf className="w-6 h-6" /> {essence.toLocaleString()}
          </span>
        </div>

        <button 
          onClick={onBloom}
          disabled={rot < 10000}
          className={`w-full py-4 px-4 font-serif uppercase text-[10px] border-4 transition-all flex items-center justify-center gap-3 ${
            rot >= 10000 
              ? 'bg-amber-500/10 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black cursor-pointer'
              : 'bg-black border-white/10 text-decay-text-muted cursor-not-allowed'
          }`}
        >
          <RefreshCcw className="w-4 h-4" /> Spore Bloom
        </button>
        <p className="text-[8px] font-serif uppercase opacity-40 leading-relaxed">
          {rot >= 10000 
            ? `SACRIFICE FOR ${bloomYield.toLocaleString()} ESSENCE`
            : `REACH 10,000 ROT`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {PRESTIGE_UPGRADES.map(upgrade => {
          const count = prestigeInventory[upgrade.id] || 0;
          const cost = upgrade.cost * (count + 1);
          const canAfford = essence >= cost;

          return (
            <button 
              key={upgrade.id}
              disabled={!canAfford}
              onClick={() => onBuy(upgrade)}
              className={`p-4 hand-drawn-border text-left transition-all ${
                canAfford 
                  ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500' 
                  : 'bg-black opacity-40 cursor-not-allowed border-white/5'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-serif text-amber-200 uppercase">{upgrade.name}</span>
                <span className="text-[9px] font-mono text-amber-500">Lv.{count}</span>
              </div>
              <p className="text-[11px] font-serif italic text-decay-text-muted mb-4 leading-relaxed">{upgrade.description}</p>
              <div className="text-[10px] font-mono text-white/80">
                {cost.toLocaleString()} Σ
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SwarmPanel = ({
  thralls,
  inventory,
  prestigeMultipliers,
  isShockActive
}: {
  thralls: number,
  inventory: Record<string, number>,
  prestigeMultipliers: any,
  isShockActive: boolean
}) => {
  const bindingCount = inventory['thrall_binding'] || 0;
  const commandCount = inventory['thrall_command'] || 0;
  const thrallEfficiency = (bindingCount * 1.5) + (commandCount * 3.0);
  const growthRate = (bindingCount + commandCount) * 0.05 * (prestigeMultipliers?.thrallGrowth || 1);
  const currentBonus = (1 + (thrallEfficiency * (thralls / 20))) * (prestigeMultipliers?.thrall || 1);

  if (!isShockActive) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-20 charcoal-grain grayscale">
        <Ghost size={64} className="mb-6 text-white" />
        <h3 className="text-[10px] font-serif uppercase mb-4">Hive Offline</h3>
        <p className="text-[11px] font-serif italic leading-relaxed">Reach 10,000 Rot to animate the King's remains.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8">
      {/* Primary Counter */}
      <div className="p-5 bg-black hand-drawn-border-lg border-cyan-500/30 relative overflow-hidden group">
        <div className="relative z-10">
          <p className="text-[8px] font-serif text-cyan-400/60 mb-3 uppercase">Active Thralls</p>
          <div className="flex items-baseline gap-3">
            <h3 className="text-4xl font-mono text-cyan-400 bioluminescent-cyan">
              {Math.floor(thralls).toLocaleString()}
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-3 text-[10px] text-cyan-400 font-mono">
            <TrendingUp size={14} />
            <span className="font-mono">+{growthRate.toFixed(2)} / sec</span>
          </div>
        </div>
        <Ghost className="absolute -bottom-8 -right-8 w-32 h-32 opacity-10 rotate-12 transition-transform duration-1000 group-hover:rotate-0" />
      </div>

      {/* Global Multiplier Card */}
      <div className="p-5 bg-black hand-drawn-border-lg border-amber-500/30">
        <p className="text-[8px] font-serif text-amber-500/60 mb-4 uppercase">Parasitic Load</p>
        <div className="flex justify-between items-center mb-6">
          <div className="text-3xl font-mono text-amber-500 italic">
            x{currentBonus.toFixed(2)}
          </div>
          <div className="text-right">
            <div className="text-[7px] font-serif opacity-40 uppercase">Eff.</div>
            <div className="text-xs font-mono">{(thrallEfficiency * 100).toFixed(0)}%</div>
          </div>
        </div>
        <div className="h-2 w-full bg-black hand-drawn-border p-0.5">
          <motion.div 
            className="h-full bg-amber-500 shadow-[0_0_8px_#fbbf24]"
            animate={{ width: `${Math.min((currentBonus / 10) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Breakdown Stats */}
      <div className="grid grid-cols-1 gap-3">
        <div className="p-4 bg-black hand-drawn-border flex justify-between items-center font-serif text-[8px]">
          <span className="text-white/40 uppercase">Bindings</span>
          <span className="text-cyan-400 font-mono">Lv.{bindingCount}</span>
        </div>
        <div className="p-4 bg-black hand-drawn-border flex justify-between items-center font-serif text-[8px]">
          <span className="text-white/40 uppercase">Logic</span>
          <span className="text-cyan-400 font-mono">Lv.{commandCount}</span>
        </div>
      </div>

      {/* Lore */}
      <div className="p-5 bg-black hand-drawn-border space-y-4">
        <div className="flex items-center gap-3 font-serif text-[8px] text-cyan-400 uppercase">
          <BookOpen size={12} />
          <span>Archives of the Fallen</span>
        </div>
        <p className="text-[11px] font-serif italic leading-relaxed text-decay-text-muted">
          "The Thralls are not mere puppets, but echoes of the Old Kingdom's vanguard. When the Spore first breached the Citadel, it did not kill; it repurposed. They exist in the 'Between-State'—neither living soul nor dead matter, but a loyal extension of our parasitic reaches."
        </p>
      </div>
    </div>
  );
};

const EgoDissolutionSequence = ({ 
  rot, 
  onDissolve 
}: { 
  rot: number, 
  onDissolve: () => void 
}) => {
  const [stage, setStage] = useState(0);
  const stages = [
    "The Monarch's body is no longer a cage; it is a cradle.",
    "The cathedral-tomb echoes with the heartbeat of the hive.",
    "The graveyard of the old world blooms with iridescent life.",
    "The mountain itself swells with our collective breath.",
    "All geography fails. All boundaries dissolve. We are the Bloom."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStage(s => Math.min(s + 1, stages.length));
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 text-center overflow-hidden charcoal-grain">
      {/* Pixelated Background Effect */}
      <motion.div 
        className="absolute inset-0 pointer-events-none z-0"
        animate={{ scale: [1, 0.1] }}
        transition={{ duration: 25, ease: "linear" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,255,255,0.15)_0%,_transparent_70%)]" />
        <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(0deg,_transparent,_transparent_2px,_rgba(0,255,255,0.1)_2.1px)]" />
      </motion.div>

      <div className="max-w-xl space-y-16 relative z-10">
        <AnimatePresence mode="wait">
          {stage < stages.length && (
            <motion.p
              key={stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 2 }}
              className="text-xl md:text-2xl font-serif italic text-white/90 leading-relaxed drop-shadow-[0_0_10px_rgba(0,255,255,0.4)]"
            >
              "{stages[stage]}"
            </motion.p>
          )}
        </AnimatePresence>

        {stage === stages.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 3 }}
            className="space-y-12"
          >
            <div className="w-1 h-32 bg-cyan-500/30 mx-auto bioluminescent-cyan" />
            
            <button
              onClick={onDissolve}
              className="group relative px-16 py-6 hand-drawn-border-lg border-cyan-500 bg-black overflow-hidden hover:bg-cyan-500/20 transition-all"
            >
              <span className="relative text-[10px] font-serif text-cyan-400 group-hover:text-white transition-colors uppercase">
                Dissolve Ego
              </span>
            </button>

            <p className="text-[10px] font-mono text-decay-text-muted animate-jitter">
              VIRULENCE PEAK: {rot.toLocaleString()}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const GameStartMenu = ({ 
  overgrown, 
  virulence,
  onStart 
}: { 
  overgrown: boolean, 
  virulence: number,
  onStart: () => void 
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#0d0d0d] flex flex-col items-center justify-center p-8 charcoal-grain">
      {overgrown && (
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-cyan-400 font-serif italic text-[10px]"
              animate={{ 
                x: [Math.random() * 100 + "%", Math.random() * 100 + "%"],
                y: [Math.random() * 100 + "%", Math.random() * 100 + "%"],
                opacity: [0, 0.5, 0]
              }}
              transition={{ duration: 10, repeat: Infinity }}
            >
              ASCENDED
            </motion.div>
          ))}
        </div>
      )}

      <div className="max-w-md w-full text-center space-y-12 relative z-10 px-6 py-12 hand-drawn-border-lg bg-black/80">
        <div className="space-y-4">
          <motion.h1 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`text-4xl font-serif ${overgrown ? 'text-decay-accent-cyan bioluminescent-cyan' : 'text-decay-accent-red bioluminescent-red'}`}
          >
            MYCELIAL<br />MONARCH
          </motion.h1>
          <p className="text-[10px] font-serif text-white/40 uppercase tracking-widest mt-4">
            {overgrown ? "Legacy of the Bloom" : "The Spore's Awakening"}
          </p>
        </div>

        <button
          onClick={onStart}
          className={`px-12 py-4 hand-drawn-border-lg transition-all group relative ${
            overgrown 
              ? 'border-decay-accent-cyan text-cyan-400 hover:bg-cyan-500/10' 
              : 'border-decay-accent-red text-red-600 hover:bg-red-600/10'
          }`}
        >
          <span className="relative text-[10px] font-serif uppercase tracking-widest">
            Begin the Decay
          </span>
        </button>

        {overgrown && (
          <div className="space-y-4 pt-4">
            <p className="text-[11px] font-serif italic text-cyan-400/60 leading-relaxed max-w-xs mx-auto">
              "The thoracic wall remains porous from your last cycle. The infection remembers your touch."
            </p>
            <div className="text-[10px] font-mono text-amber-500">
              VIRULENCE: {virulence.toFixed(2)}x
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


const Dashboard = ({ 
  rot, 
  thralls,
  cps, 
  decayRate,
  isShockActive,
  isMuted,
  onToggleMute,
  achievements,
  essence,
  lifetimeEssence,
  prestigeInventory,
  onBuyPrestige,
  onBloom,
  onSecretAction,
  boosts,
  inventory,
  syncStreak,
  prestigeMultipliers,
  currentLore
}: { 
  rot: number,
  thralls: number,
  cps: number,
  decayRate: number,
  isShockActive: boolean,
  isMuted: boolean,
  onToggleMute: () => void,
  achievements: string[],
  essence: number,
  lifetimeEssence: number,
  prestigeInventory: Record<string, number>,
  onBuyPrestige: (u: PrestigeUpgrade) => void,
  onBloom: () => void,
  onSecretAction: (key: string) => void,
  boosts: TemporaryBoost[],
  inventory: Record<string, number>,
  syncStreak: number,
  prestigeMultipliers: any,
  currentLore: string
}) => {
  const netRate = cps - decayRate;
  const isLosingRot = netRate < 0;

  const [activeTab, setActiveTab] = useState<'vitals' | 'swarm' | 'evolution'>('vitals');

  return (
    <div className="w-80 h-full bg-[#0d0d0d] flex flex-col border-r-4 border-black overflow-hidden charcoal-grain relative z-20">
      {/* Header & Global Mute */}
      <div className="p-6 flex justify-between items-center border-b-4 border-black bg-black/40">
        <h2 
          onClick={() => onSecretAction('vitals_clicks')}
          className={`text-[12px] font-serif uppercase cursor-pointer transition-all ${isShockActive ? 'text-decay-accent-cyan bioluminescent-cyan' : 'text-decay-accent-red hover:text-white'}`}
        >
          {isShockActive ? 'Breach' : 'Core'}
        </h2>
        <button 
          onClick={onToggleMute}
          className="p-2 hand-drawn-border border-white/10 hover:border-white/40 transition-colors text-decay-text-muted hover:text-white"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Tab Selectors */}
      <div className="flex bg-black border-b-4 border-black px-1 gap-1 py-1">
        {[
          { id: 'vitals', label: 'Vitals', icon: Activity },
          { id: 'swarm', label: 'Swarm', icon: Ghost },
          { id: 'evolution', label: 'Evolve', icon: RefreshCcw }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 flex flex-col items-center gap-2 transition-all border-b-4 cursor-pointer ${
              activeTab === tab.id 
                ? isShockActive ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-red-500 bg-red-500/10 text-red-500'
                : 'border-transparent text-white/20 hover:bg-white/5'
            }`}
          >
            <tab.icon size={16} />
            <span className="text-[9px] font-serif uppercase tracking-tight">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-8">
        {activeTab === 'vitals' && (
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[8px] font-serif text-decay-text-muted uppercase">Growth Rate</p>
                  <div className={`text-sm font-mono ${isLosingRot ? 'text-amber-500 animate-pulse' : isShockActive ? 'text-decay-accent-cyan' : 'text-decay-accent-red'}`}>
                    {isLosingRot ? '' : '+'}{netRate.toFixed(1)}/s
                  </div>
                </div>
                {boosts.length > 0 && (
                  <div className="text-right">
                    <p className="text-[8px] font-serif text-amber-500 animate-pulse uppercase">BOOST x{boosts.reduce((acc, b) => acc * b.multiplier, 1).toFixed(1)}</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-black hand-drawn-border">
                <div className="flex justify-between items-center font-serif text-[8px] opacity-40 mb-2 uppercase">
                  <span>Decay</span>
                  <span className="font-mono">-{decayRate.toFixed(1)}/s</span>
                </div>
                <div className="h-2 w-full bg-decay-panel hand-drawn-border border-none p-0.5">
                   <motion.div 
                     className="h-full bg-amber-900/60"
                     animate={{ width: `${Math.min((decayRate / Math.max(1, cps)) * 100, 100)}%` }}
                   />
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div 
                  onClick={() => setActiveTab('swarm')}
                  className={`p-4 transition-all duration-500 hand-drawn-border-lg border-2 group relative overflow-hidden cursor-pointer hover:bg-white/5 ${isShockActive ? 'bg-cyan-500/5 border-cyan-500/30' : 'bg-black border-white/5 opacity-40 grayscale'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[8px] font-serif text-cyan-400 group-hover:text-white mb-2 uppercase">Hive Mind</p>
                      <p className={`text-2xl font-mono flex items-center gap-3 ${isShockActive ? 'text-cyan-400 bioluminescent-cyan' : 'text-white/40'}`}>
                        <Ghost size={20} />
                        {Math.floor(thralls).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-black hand-drawn-border border-none p-0.5">
                    <motion.div 
                      className={`h-full ${isShockActive ? 'bg-cyan-500/40' : 'bg-white/10'}`}
                      animate={{ width: `${(thralls % 1000) / 10}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-black hand-drawn-border">
                    <p className="text-[8px] font-serif opacity-40 mb-2 uppercase">Status</p>
                    <p className={`text-[10px] font-serif uppercase ${isShockActive ? 'text-decay-accent-cyan bioluminescent-cyan' : 'text-white/40'}`}>
                      {isShockActive ? 'BREACH' : 'STABLE'}
                    </p>
                  </div>
                  <div className="p-4 bg-black hand-drawn-border">
                    <p className="text-[8px] font-serif opacity-40 mb-2 uppercase">Streak</p>
                    <p className={`text-sm font-mono ${syncStreak >= 10 ? 'text-amber-500 animate-jitter' : 'text-white/60'}`}>{syncStreak}</p>
                  </div>
                </div>
              </div>
            </div>

            <div 
              className="p-5 bg-black hand-drawn-border relative group cursor-pointer"
              onClick={() => onSecretAction('log_clicks')}
            >
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className={`text-[9px] font-serif mb-3 uppercase ${isShockActive ? 'text-decay-accent-cyan' : 'text-decay-accent-red'}`}>
                Visceral Log
              </div>
              <div className="text-[12px] font-serif italic text-decay-text opacity-70 leading-relaxed">
                {currentLore}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'swarm' && (
          <SwarmPanel 
            thralls={thralls}
            inventory={inventory}
            prestigeMultipliers={prestigeMultipliers}
            isShockActive={isShockActive}
          />
        )}

        {activeTab === 'evolution' && (
          <div className="space-y-12">
            <div>
              <h3 className="text-[10px] font-serif opacity-40 mb-6 uppercase">Evolutionary Bloom</h3>
              <PrestigePanel 
                essence={essence} 
                lifetimeEssence={lifetimeEssence}
                prestigeInventory={prestigeInventory} 
                onBuy={onBuyPrestige} 
                isShockActive={isShockActive}
                onBloom={onBloom}
                rot={rot}
              />
            </div>

            <div>
              <h3 className="text-[10px] font-serif opacity-40 mb-6 uppercase">Milestones</h3>
              <AchievementSection achievements={achievements} isShockActive={isShockActive} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [rot, setRot] = useState(() => Number(localStorage.getItem('mm_rot')) || 0);
  const [thralls, setThralls] = useState(() => Number(localStorage.getItem('mm_thralls')) || 0);
  const [inventory, setInventory] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('mm_inventory') || '{}');
    } catch {
      return {};
    }
  });
  const [isShockActive, setIsShockActive] = useState(() => localStorage.getItem('mm_isShockActive') === 'true');
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [achievements, setAchievements] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mm_achievements') || '[]');
    } catch {
      return [];
    }
  });
  const [essence, setEssence] = useState(() => Number(localStorage.getItem('mm_essence')) || 0);
  const [lifetimeEssence, setLifetimeEssence] = useState(() => Number(localStorage.getItem('mm_lifetimeEssence')) || 0);
  const [prestigeInventory, setPrestigeInventory] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('mm_prestigeInventory') || '{}');
    } catch {
      return {};
    }
  });
  const [secretActions, setSecretActions] = useState<Record<string, number>>({});
  const [boosts, setBoosts] = useState<TemporaryBoost[]>([]);
  const [syncStreak, setSyncStreak] = useState(0);
  const [syncDecayTimer, setSyncDecayTimer] = useState(0);
  const [lastClickPower, setLastClickPower] = useState(1);

  // endgame states
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('mm_sessionStartTime');
    return saved ? Number(saved) : null;
  });
  const [isEgoDissolutionReady, setIsEgoDissolutionReady] = useState(false);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'dissolving' | 'terminal'>('menu');
  const [hasCompletedBefore, setHasCompletedBefore] = useState(false);
  const [virulenceMultiplier, setVirulenceMultiplier] = useState(() => Number(localStorage.getItem('mm_virulenceMultiplier')) || 1);

  const currentLore = useMemo(() => {
    if (rot >= 1000000) return LORE_STAGES[8];
    if (rot >= 250000) return LORE_STAGES[7];
    if (thralls >= 5000) return LORE_STAGES[6];
    if (thralls >= 1000) return LORE_STAGES[5];
    if (inventory['spore_winds'] > 0) return LORE_STAGES[4];
    if (isShockActive) return LORE_STAGES[3];
    if (rot >= 2500) return LORE_STAGES[2];
    if (rot >= 300) return LORE_STAGES[1];
    return LORE_STAGES[0];
  }, [rot, thralls, inventory, isShockActive]);

  // Periodic Save Effect
  useEffect(() => {
    const saveTimer = setInterval(() => {
      localStorage.setItem('mm_rot', rot.toString());
      localStorage.setItem('mm_thralls', thralls.toString());
      localStorage.setItem('mm_inventory', JSON.stringify(inventory));
      localStorage.setItem('mm_isShockActive', isShockActive.toString());
      localStorage.setItem('mm_achievements', JSON.stringify(achievements));
      localStorage.setItem('mm_essence', essence.toString());
      localStorage.setItem('mm_lifetimeEssence', lifetimeEssence.toString());
      localStorage.setItem('mm_prestigeInventory', JSON.stringify(prestigeInventory));
      localStorage.setItem('mm_virulenceMultiplier', virulenceMultiplier.toString());
      if (sessionStartTime) {
        localStorage.setItem('mm_sessionStartTime', sessionStartTime.toString());
      }
    }, 7000); // Save every 7 seconds

    return () => clearInterval(saveTimer);
  }, [rot, thralls, inventory, isShockActive, achievements, essence, lifetimeEssence, prestigeInventory, virulenceMultiplier, sessionStartTime]);

  useEffect(() => {
    if (isShockActive) {
      document.body.classList.add('shock-active');
    }
  }, [isShockActive]);

  useEffect(() => {
    const completed = localStorage.getItem('mycelial_monarch_completed') === 'true';
    if (completed) {
      setHasCompletedBefore(true);
      const val = localStorage.getItem('mycelial_monarch_virulence');
      if (val) {
        const v = Math.min(Math.max(parseFloat(val) / 1000000, 1.0), 3.0);
        setVirulenceMultiplier(v);
      }
    }
  }, []);

  // Derived Multipliers
  const prestigeMultipliers = useMemo(() => {
    let global = 1;
    let click = 1;
    let thrall = 1;
    let auto = 1;
    let thrallGrowth = 1;
    let visualLevel = 0;

    const resonanceMult = 1 + (syncStreak * 0.1); // Up to 2x at 10 stack, etc.
    global *= resonanceMult;

    // Evolutionary Milestones
    if (lifetimeEssence >= 50) global *= 1.15; // +15% Global
    if (lifetimeEssence >= 10) visualLevel += 1;

    const boostMult = boosts.reduce((acc, b) => acc * b.multiplier, 1);
    global *= boostMult;

    Object.entries(prestigeInventory).forEach(([id, level]) => {
      const upgrade = PRESTIGE_UPGRADES.find(u => u.id === id);
      if (upgrade) {
        const amt = Number(level);
        const mult = Number(upgrade.multiplier);
        
        if (upgrade.type === 'global') global += mult * amt;
        if (upgrade.type === 'click') click += mult * amt;
        if (upgrade.type === 'thrall') thrall += mult * amt;
        if (upgrade.type === 'auto') auto += mult * amt;
        if (upgrade.type === 'thrall_growth') thrallGrowth += mult * amt;
        if (upgrade.type === 'visual') {
          global += mult * amt;
          visualLevel += amt;
        }
      }
    });

    return { global, click, thrall, auto, thrallGrowth, visualLevel };
  }, [prestigeInventory]);

  // Derived Stats
  const clickPower = useMemo(() => {
    const calc = inventory['calcification'] || 0;
    let power = (1 + (calc * 5)) * prestigeMultipliers.click;
    if (lifetimeEssence >= 100) power *= 1.25; // +25% Click Power
    return power * virulenceMultiplier;
  }, [inventory, prestigeMultipliers, lifetimeEssence, virulenceMultiplier]);

  const cps = useMemo(() => {
    let base = 0;
    const hyphae = inventory['hyphae'] || 0;
    const cyst = inventory['spore_cyst'] || 0;
    const winds = inventory['spore_winds'] || 0;
    const necro = inventory['necro_mycelium'] || 0;
    
    base += hyphae * 2.5;
    base += cyst * 8;
    base += winds * 15;
    base += necro * 150;
    
    base *= prestigeMultipliers.auto;
    
    // Thrall Multiplier
    if (isShockActive) {
      const binding = inventory['thrall_binding'] || 0;
      const command = inventory['thrall_command'] || 0;
      const thrallEfficiency = (binding * 1.5) + (command * 3.0);
      const thrallBonus = (1 + (thrallEfficiency * (thralls / 20))) * prestigeMultipliers.thrall;
      base *= thrallBonus;
    }
    
    return base * prestigeMultipliers.global * virulenceMultiplier;
  }, [inventory, isShockActive, thralls, prestigeMultipliers, virulenceMultiplier]);

  // Actions
  const decayRate = 0;

  const netRate = cps - decayRate;

  // Actions
  const handleVeinClick = useCallback(() => {
    if (!isAudioStarted) {
      audioService.startDrone(isShockActive);
      setIsAudioStarted(true);
    }

    if (sessionStartTime === null) {
      setSessionStartTime(Date.now());
    }

    // Neural Resonance Check
    const now = Date.now();
    const cyclePos = (now % 1000) / 1000; // 1s visual pulse
    const onBeat = cyclePos < 0.2 || cyclePos > 0.8; // Peak window

    let payoffPower = clickPower;
    if (onBeat) {
      // Scaling payoff: each streak level adds more power. Cap multiplier at x5.
      const currentStreak = Math.min(syncStreak + 1, 8); // Adjusted internal streak to match x5 roughly (1 + 8*0.5 = 5)
      payoffPower *= Math.min(1 + syncStreak * 0.5, 5); 
      
      setSyncStreak(prev => {
        const next = Math.min(prev + 1, 20);
        if (next === 20 && prev < 20) {
          setBoosts(current => [
            ...current,
            { id: 'resonance_overload_' + Date.now(), multiplier: 10, remaining: 20, name: 'Resonance Overload' }
          ]);
          audioService.playAchievement();
        }
        return next;
      });
      setSyncDecayTimer(2);
    } else {
      setSyncStreak(0);
    }

    setRot(prev => prev + payoffPower);
    setLastClickPower(payoffPower);
    audioService.playClick();
  }, [clickPower, isAudioStarted, isShockActive]);

  const handleBuy = useCallback((upgrade: Upgrade) => {
    const count = inventory[upgrade.id] || 0;
    const cost = TOKENS.formula.cost(upgrade.baseCost, count);
    
    if (rot >= cost) {
      setRot(prev => prev - cost);
      setInventory(prev => ({
        ...prev,
        [upgrade.id]: count + 1
      }));
      audioService.playUpgrade();
    }
  }, [inventory, rot]);

  const toggleMute = useCallback(() => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    audioService.setMute(newMute);
  }, [isMuted]);

  const handleBloom = useCallback(() => {
    if (rot < 10000) return;
    
    const yieldAmount = Math.floor(Math.sqrt(rot / 10000) * 5);
    setEssence(prev => prev + yieldAmount);
    setLifetimeEssence(prev => prev + yieldAmount);
    setSessionStartTime(Date.now());
    
    // Reset Progress
    setRot(0);
    setThralls(0);
    setInventory({});
    setIsShockActive(false);
    setSecretActions({});
    setBoosts([]);
    document.body.classList.remove('shock-active');
    
    audioService.playShock();
  }, [rot]);

  const handleSecretAction = useCallback((key: string) => {
    setSecretActions(prev => {
      const count = (prev[key] || 0) + 1;
      
      // Special Boost Trigger
      if (key === 'vitals_clicks' && count === 7) {
        setBoosts(current => [
          ...current,
          { id: 'vitals_resonance_' + Date.now(), multiplier: 3, remaining: 60, name: 'Vitals Resonance' }
        ]);
        audioService.playAchievement();
      }

      return { ...prev, [key]: count };
    });
  }, []);

  const handleBuyPrestige = useCallback((upgrade: PrestigeUpgrade) => {
    const count = prestigeInventory[upgrade.id] || 0;
    const cost = upgrade.cost * (count + 1);
    
    if (essence >= cost) {
      setEssence(prev => prev - cost);
      setPrestigeInventory(prev => ({
        ...prev,
        [upgrade.id]: count + 1
      }));
      audioService.playAchievement();
    }
  }, [prestigeInventory, essence]);

  // Game Loop
  useEffect(() => {
    const ticker = setInterval(() => {
      if (gameState !== 'playing') return;

      setRot(prev => {
        const next = prev + (cps / 10) - (decayRate / 10);
        return Math.max(0, next);
      });
      
      // Auto-Thrall growth
      const thrallSource = (inventory['thrall_binding'] || 0) + (inventory['thrall_command'] || 0);
      if (isShockActive && thrallSource > 0) {
        const growthRate = (thrallSource * 0.05) * prestigeMultipliers.thrallGrowth;
        setThralls(prev => prev + growthRate);
      }

      // Sync Decay
      setSyncDecayTimer(prev => {
        const next = Math.max(0, prev - 0.1);
        if (next === 0) setSyncStreak(0);
        return next;
      });

      // Boost Decay
      setBoosts(prev => prev.map(b => ({ ...b, remaining: b.remaining - 0.1 })).filter(b => b.remaining > 0));
    }, 100);

    return () => clearInterval(ticker);
  }, [cps, decayRate, isShockActive, inventory, prestigeMultipliers.thrallGrowth, gameState]);

  // Endgame Timer
  useEffect(() => {
    if (sessionStartTime && gameState === 'playing') {
      const timer = setInterval(() => {
        const elapsed = Date.now() - sessionStartTime;
        if (elapsed > 3600000) { // 60 minutes
          setIsEgoDissolutionReady(true);
          setGameState('dissolving');
          clearInterval(timer);
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [sessionStartTime, gameState]);

  const handleFinalDissolution = () => {
    localStorage.setItem('mycelial_monarch_completed', 'true');
    localStorage.setItem('mycelial_monarch_virulence', rot.toString());
    setGameState('terminal');
  };

  // Milestone Watcher
  useEffect(() => {
    // Aligned threshold to 10,000 to match the UI progress bar and original Phase 1 math
    if (rot >= 10000 && !isShockActive) { 
      setIsShockActive(true);
      document.body.classList.add('shock-active');
      audioService.playShock();
      if (isAudioStarted) {
        audioService.startDrone(true);
      }
    }
  }, [rot, isShockActive, isAudioStarted]);

  useEffect(() => {
    ACHIEVEMENTS.forEach(ach => {
      if (!achievements.includes(ach.id) && ach.condition({ rot, inventory, isShockActive, secretActions })) {
        setAchievements(prev => [...prev, ach.id]);
        audioService.playAchievement();
      }
    });
  }, [rot, inventory, isShockActive, achievements, secretActions]);

  // UI Setup
  if (gameState === 'terminal') {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center p-8 transition-opacity duration-[5000ms]">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 10 }}
          className="text-black text-[12px] uppercase tracking-[1em] font-serif"
        >
          Dissolution Complete. You Are Ascended.
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full select-none">
      <AnimatePresence>
        {gameState === 'menu' && (
          <GameStartMenu 
            overgrown={hasCompletedBefore} 
            virulence={virulenceMultiplier}
            onStart={() => {
              setGameState('playing');
              setRot(0);
              setThralls(0);
              setInventory({});
              setIsShockActive(false);
              setSecretActions({});
              setBoosts([]);
              document.body.classList.remove('shock-active');
              setSessionStartTime(Date.now());
            }} 
          />
        )}
        {gameState === 'dissolving' && (
          <EgoDissolutionSequence rot={rot} onDissolve={handleFinalDissolution} />
        )}
        {isShockActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 pointer-events-none z-50 border-[10px] border-shock-accent/10 mix-blend-overlay animate-pulse"
          />
        )}
      </AnimatePresence>

      <div className="bg-decay-bg flex w-full h-full divide-x-4 divide-black overflow-hidden">
        { (rot >= 300 || Object.keys(inventory).length > 0 || lifetimeEssence > 0) && (
          <Dashboard 
            rot={Math.floor(rot)} 
            thralls={Math.floor(thralls)}
            cps={cps} 
            decayRate={decayRate}
            isShockActive={isShockActive}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            achievements={achievements}
            essence={essence}
            lifetimeEssence={lifetimeEssence}
            prestigeInventory={prestigeInventory}
            onBuyPrestige={handleBuyPrestige}
            onBloom={handleBloom}
            onSecretAction={handleSecretAction}
            boosts={boosts}
            inventory={inventory}
            syncStreak={syncStreak}
            prestigeMultipliers={prestigeMultipliers}
            currentLore={currentLore}
          />
        )}
        
        <main className="relative h-full flex-1">
          {lifetimeEssence >= 100 && (
            <motion.div 
              animate={{ 
                opacity: [0.02, 0.08, 0.02],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="fixed inset-0 pointer-events-none bg-cyan-500/10 z-0"
            />
          )}
          <MainStage 
            rot={Math.floor(rot)} 
            onVeinClick={handleVeinClick} 
            isShockActive={isShockActive} 
            visualLevel={prestigeMultipliers.visualLevel}
            syncStreak={syncStreak}
            lastClickPower={lastClickPower}
            thralls={thralls}
          />
        </main>

        { (rot >= 300 || Object.keys(inventory).length > 0 || lifetimeEssence > 0) && (
          <UpgradePanel 
            rot={Math.floor(rot)} 
            thralls={Math.floor(thralls)}
            inventory={inventory} 
            onBuy={handleBuy} 
            isShockActive={isShockActive} 
            currentLore={currentLore}
          />
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.05);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
}
