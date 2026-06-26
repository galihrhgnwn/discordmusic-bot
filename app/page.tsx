import Image from 'next/image';
import { ExternalLink, ShieldCheck, Activity, Box, Zap, Settings, Command } from 'lucide-react';
import LiveConsole from '../components/LiveConsole';

export default function Dashboard() {
  const inviteUrl = "https://discord.com/oauth2/authorize?client_id=1505788906992308246&scope=bot&permissions=8";
  
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 flex items-center justify-center opacity-30 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[128px]" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {/* Navigation / Header */}
        <header className="flex items-center justify-between mb-12 py-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/20 border border-white/10 ring-1 ring-white/5">
              <Image 
                src="https://files.catbox.moe/uefsn7.jpg" 
                alt="Aether's Bot Logo" 
                fill 
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight text-white flex items-center gap-2">
                Aether&apos;s
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-mono tracking-wider border border-indigo-500/20 uppercase inline-flex items-center mt-1">
                  v0.1.0
                </span>
              </h1>
              <p className="text-sm font-medium text-neutral-400">Management Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a 
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-5 py-2.5 bg-white text-black font-semibold rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] hover:scale-[1.02] transition-all active:scale-[0.98]"
            >
              <ExternalLink className="w-4 h-4 text-neutral-600 group-hover:text-black transition-colors" />
              Add to Server
            </a>
          </div>
        </header>

        {/* Stats / Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-xl p-5 relative overflow-hidden group hover:border-white/10 transition-colors">
             <div className="flex items-start justify-between">
               <div>
                 <p className="text-neutral-400 text-sm font-medium mb-1">Status</p>
                 <h3 className="text-2xl font-display font-semibold text-white flex items-center gap-2">
                   Online
                 </h3>
               </div>
               <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                 <Activity className="w-5 h-5 animate-pulse" />
               </div>
             </div>
          </div>
          
          <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-xl p-5 relative overflow-hidden group hover:border-white/10 transition-colors">
             <div className="flex items-start justify-between">
               <div>
                 <p className="text-neutral-400 text-sm font-medium mb-1">Modules</p>
                 <h3 className="text-2xl font-display font-semibold text-white">
                   Core + Music
                 </h3>
               </div>
               <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                 <Box className="w-5 h-5" />
               </div>
             </div>
          </div>

          <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-xl p-5 relative overflow-hidden group hover:border-white/10 transition-colors">
             <div className="flex items-start justify-between">
               <div>
                 <p className="text-neutral-400 text-sm font-medium mb-1">Latency</p>
                 <h3 className="text-2xl font-display font-semibold text-white">
                   ~14ms
                 </h3>
               </div>
               <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                 <Zap className="w-5 h-5" />
               </div>
             </div>
          </div>

          <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-xl p-5 relative overflow-hidden group hover:border-white/10 transition-colors">
             <div className="flex items-start justify-between">
               <div>
                 <p className="text-neutral-400 text-sm font-medium mb-1">Commands</p>
                 <h3 className="text-2xl font-display font-semibold text-white">
                   15+ Loaded
                 </h3>
               </div>
               <div className="p-2 bg-fuchsia-500/10 rounded-lg text-fuchsia-400">
                 <Command className="w-5 h-5" />
               </div>
             </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Console */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                Live System Console
              </h2>
              <LiveConsole />
            </div>
          </div>

          {/* Right Column - Server Settings Placeholder */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-neutral-400" />
                Instance Details
              </h2>
              <div className="bg-neutral-900/40 backdrop-blur-md border border-white/5 rounded-xl p-6">
                <div className="space-y-4">
                  
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-neutral-400">Environment</span>
                    <span className="text-sm font-mono text-neutral-200">Production</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-neutral-400">Node JS</span>
                    <span className="text-sm font-mono text-neutral-200">v22.x</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-neutral-400">Prefix</span>
                    <span className="text-sm font-mono bg-white/10 px-2 py-0.5 rounded text-neutral-200">!smusic</span>
                  </div>

                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-neutral-400">Uptime</span>
                    <span className="text-sm font-mono text-emerald-400">100%</span>
                  </div>

                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20">
              <h3 className="text-white font-medium mb-2">Bot Authorization</h3>
              <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
                Requires Administrator (8) permissions for full functionality, including voice channels and message management.
              </p>
              <a 
                href={inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex justify-center py-2 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium transition-colors text-sm"
              >
                Authenticate
              </a>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
