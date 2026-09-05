import Brand from './Brand'
import Icon from './Icon'

const navItems = [['overview','grid','Overview'],['quotes','file','Quotations'],['builder','plus','Create quotation']]

function Sidebar({ page, onNavigate, user, onLogout }) {
  return <aside className="fixed inset-y-0 left-0 z-20 flex w-[74px] flex-col bg-ink px-3 py-7 text-slate-400 md:w-[244px] md:px-[18px]">
    <div className="mx-auto mb-10 md:mx-2"><Brand/></div>
    <nav className="space-y-1">{navItems.map(([id, icon, label]) => <button key={id} onClick={() => onNavigate(id)} className={`relative flex w-full items-center justify-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition md:justify-start ${page === id ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}><Icon name={icon}/><span className="hidden flex-1 md:block">{label}</span>{id === 'quotes' && <b className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[11px] md:block">5</b>}</button>)}</nav>
    <div className="mt-6 hidden border-t border-white/10 pt-5 md:block"><span className="px-3 text-[10px] tracking-[.15em] text-slate-600">MANAGE</span><button className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-white/5 hover:text-white"><Icon name="users"/> Customers</button><button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-white/5 hover:text-white"><Icon name="box"/> Products</button></div>
    <div className="mt-auto"><div className="mb-3 hidden rounded-xl bg-white/[.07] p-4 md:block"><span className="text-[9px] tracking-widest text-violet-300">GETTING STARTED</span><strong className="mt-2 block text-[13px] text-white">Your deal desk, simplified.</strong><p className="my-1.5 text-[11px] leading-relaxed">Explore the workspace with sample data.</p><div className="mt-3 h-1 rounded-full bg-white/10"><span className="block h-full w-3/5 rounded-full bg-coral"/></div></div><button onClick={onLogout} title="Sign out" className="flex w-full items-center gap-2.5 border-t border-white/10 pt-4 text-left"><span className="grid size-9 place-items-center rounded-[10px] bg-violet-100 text-[11px] font-bold text-violet-700">AM</span><span className="hidden flex-1 flex-col md:flex"><strong className="text-xs text-white">{user.name}</strong><small className="text-[10px]">{user.role}</small></span><Icon name="logout" className="hidden md:block"/></button></div>
  </aside>
}

function Header({ page, onNavigate }) {
  const title = page === 'builder' ? 'Create quotation' : page === 'quotes' ? 'Quotations' : 'Good morning, Arjun'
  return <header className="sticky top-0 z-10 flex h-[91px] items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-9"><div><h1 className="font-display text-[22px] font-bold text-slate-900">{title}</h1>{page === 'overview' && <p className="mt-1 text-xs text-slate-400">Here’s what’s moving across your pipeline today.</p>}</div><div className="flex items-center gap-2.5"><label className="hidden w-[250px] items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-slate-400 lg:flex"><Icon name="search"/><input className="w-full border-0 text-xs outline-none" aria-label="Search" placeholder="Search deals, customers..."/><kbd className="whitespace-nowrap rounded border border-slate-200 bg-slate-50 px-1 text-[9px]">⌘ K</kbd></label><button className="relative grid size-[38px] place-items-center rounded-lg border border-slate-200 bg-white" aria-label="Notifications"><Icon name="bell"/><i className="absolute right-2 top-1.5 size-1.5 rounded-full bg-coral ring-1 ring-white"/></button>{page !== 'builder' && <button onClick={() => onNavigate('builder')} className="flex size-[38px] items-center justify-center gap-2 rounded-lg bg-violet-600 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 sm:w-auto sm:px-4"><Icon name="plus"/><span className="hidden sm:inline">New quotation</span></button>}</div></header>
}

export default function AppShell({ page, onNavigate, user, onLogout, children }) {
  return <div className="min-h-screen bg-slate-50"><Sidebar page={page} onNavigate={onNavigate} user={user} onLogout={onLogout}/><main className="ml-[74px] min-h-screen md:ml-[244px]"><Header page={page} onNavigate={onNavigate}/><div className="mx-auto max-w-[1500px] p-4 sm:p-7 lg:px-8">{children}</div></main></div>
}
