import Brand from './Brand'
import Icon from './Icon'

function getNavItems(role) {
  const items = [['quotations', 'file', 'Quotations']]
  if (['REP', 'ADMIN'].includes(role)) items.push(['fulfillment', 'truck', 'Fulfillment'])
  if (['REP', 'ADMIN'].includes(role)) items.push(['billing', 'receipt', 'Billing'])
  if (['REP', 'ADMIN'].includes(role)) items.push(['builder', 'plus', 'Create quotation'])
  if (['MANAGER', 'FINANCE'].includes(role)) items.push(['approvals', 'shield', 'Approval Center'])
  if (role === 'ADMIN') items.push(['config', 'box', 'Configuration'])
  return items
}

function Sidebar({ page, onNavigate, user, onLogout }) {
  const initials = user.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
  return <aside className="fixed inset-y-0 left-0 z-20 flex w-[74px] flex-col bg-ink px-3 py-7 text-slate-400 md:w-[244px] md:px-[18px]">
    <div className="mx-auto mb-10 md:mx-2"><Brand /></div>
    <nav className="space-y-1">{getNavItems(user.role).map(([id, icon, label]) => <button key={id} onClick={() => onNavigate(id)} className={`flex w-full items-center justify-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition md:justify-start ${page === id ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}><Icon name={icon} /><span className="hidden flex-1 md:block">{label}</span></button>)}</nav>
    <button onClick={onLogout} title="Sign out" className="mt-auto flex w-full items-center gap-2.5 border-t border-white/10 pt-4 text-left"><span className="grid size-9 place-items-center rounded-[10px] bg-violet-100 text-[11px] font-bold text-violet-700">{initials}</span><span className="hidden min-w-0 flex-1 flex-col md:flex"><strong className="truncate text-xs text-white">{user.name}</strong><small className="text-[10px]">{user.role}</small></span><Icon name="logout" className="hidden md:block" /></button>
  </aside>
}

function Header({ page, onNavigate, user }) {
  const titles = { quotations: 'Quotations', builder: 'Quotation builder', negotiation: 'Customer negotiation', approvals: 'Approval Center', fulfillment: 'Fulfillment', billing: 'Billing', config: 'Configuration' }
  const subtitles = { negotiation: 'Shared commercial conversation', fulfillment: 'Warehouse allocation workspace', billing: 'One-time and recurring charges', approvals: 'Discount governance workspace' }
  return <header className="sticky top-0 z-10 flex min-h-[82px] items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-9"><div><h1 className="font-display text-[22px] font-bold text-slate-900">{titles[page]}</h1><p className="mt-1 text-xs text-slate-400">{subtitles[page] || 'Sales operations workspace'}</p></div>{['REP', 'ADMIN'].includes(user.role) && page !== 'builder' && <button onClick={() => onNavigate('builder')} className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700"><Icon name="plus" /><span>New quotation</span></button>}</header>
}

export default function AppShell({ page, onNavigate, user, onLogout, children }) {
  return <div className="min-h-screen bg-slate-50"><Sidebar page={page} onNavigate={onNavigate} user={user} onLogout={onLogout} /><main className="ml-[74px] min-h-screen md:ml-[244px]"><Header page={page} onNavigate={onNavigate} user={user} /><div className="mx-auto max-w-[1500px] p-4 sm:p-7 lg:px-8">{children}</div></main></div>
}
