import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-sky-500 selection:text-white">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sky-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse"></div>
        <div className="absolute top-40 -left-40 w-96 h-96 bg-rose-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-screen">
        <header className="mb-16 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
            VoiceCare
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto font-light">
            AI-Powered Multilingual Hospital Reception System
          </p>
        </header>

        {/* Portal Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Kiosk Card */}
          <div 
            className="group relative rounded-3xl p-8 cursor-pointer transition-all duration-500 overflow-hidden backdrop-blur-md border bg-slate-800/40 border-slate-700 hover:bg-slate-800/60 hover:border-sky-500/50 hover:shadow-[0_0_40px_-10px_rgba(14,165,233,0.3)] hover:transform hover:scale-105"
            onClick={() => navigate('/kiosk')}
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
              <svg className="w-24 h-24 text-sky-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            </div>
            <h2 className="text-3xl font-bold mb-4 text-white">Patient Kiosk</h2>
            <p className="text-slate-400 mb-8 max-w-[80%]">Self-service multilingual voice registration for walk-in patients.</p>
            <button className="px-6 py-3 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white font-medium hover:from-sky-400 hover:to-blue-500 transition-all duration-300 shadow-lg shadow-sky-500/25 pointer-events-none">
              Launch Kiosk
            </button>
          </div>

          {/* Doctor Dashboard Card */}
          <div 
            className="group relative rounded-3xl p-8 cursor-pointer transition-all duration-500 overflow-hidden backdrop-blur-md border bg-slate-800/40 border-slate-700 hover:bg-slate-800/60 hover:border-emerald-500/50 hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] hover:transform hover:scale-105"
            onClick={() => navigate('/doctor')}
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
              <svg className="w-24 h-24 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h-2v5H6v2h2v5h2v-5h2v-2z"/></svg>
            </div>
            <h2 className="text-3xl font-bold mb-4 text-white">Doctor Dashboard</h2>
            <p className="text-slate-400 mb-8 max-w-[80%]">Review structured medical histories prior to consultation.</p>
            <button className="px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium hover:from-emerald-400 hover:to-teal-500 transition-all duration-300 shadow-lg shadow-emerald-500/25 pointer-events-none">
              Open Dashboard
            </button>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-sm text-slate-400">
          <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50">
            <span className="block text-2xl mb-2">🗣️</span> Voice-First
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50">
            <span className="block text-2xl mb-2">🌐</span> Multilingual
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50">
            <span className="block text-2xl mb-2">📄</span> Automated Reports
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50">
            <span className="block text-2xl mb-2">🔒</span> 100% Local AI
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
