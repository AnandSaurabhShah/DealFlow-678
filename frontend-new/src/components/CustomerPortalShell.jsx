import { Link, useNavigate } from 'react-router-dom'
import Brand from './Brand'
import Icon from './Icon'

export default function CustomerPortalShell({ customer, onLogout, children }) {
  const navigate = useNavigate()
  return <div className="min-h-screen bg-[#f5f7fb]">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5">
        <Link to="/portal" aria-label="DealFlow360 customer portal"><Brand dark={false} /></Link>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block"><p className="text-xs font-semibold text-slate-800">{customer.name}</p><p className="text-[10px] text-slate-400">Customer portal</p></div>
          <button onClick={() => { onLogout(); navigate('/portal/login', { replace: true }) }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Icon name="logout" size={15} />Sign out</button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 py-7">{children}</main>
  </div>
}
