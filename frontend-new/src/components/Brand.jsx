export default function Brand({ dark = true }) {
  return <div className={`flex items-center gap-2.5 font-display text-[19px] font-extrabold ${dark ? 'text-white' : 'text-slate-900'}`}>
    <span className="grid size-8 place-items-center rounded-[9px] bg-gradient-to-br from-violet-500 to-coral text-base text-white shadow-lg shadow-violet-500/20">D</span>
    <span>DealFlow<span className="text-coral">360</span></span>
  </div>
}
