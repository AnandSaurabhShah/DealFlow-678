import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { useCustomerAuthStore } from '../store/customerAuthStore'

export default function CustomerPortalHomePage() {
  const [quotationId, setQuotationId] = useState('')
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  const customer = useCustomerAuthStore(state => state.customer)
  const submit = event => { event.preventDefault(); navigate(`/portal/quotations/${quotationId.trim()}`) }
  return <section className="mx-auto max-w-2xl pt-10 text-center">
    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Icon name="file" size={22} /></span>
    <h1 className="mt-5 font-display text-3xl font-bold text-slate-900">Open a quotation</h1>
    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Follow the quotation link shared by your DealFlow representative, or enter its ID below.</p>
    <form onSubmit={submit} className="mx-auto mt-7 flex max-w-xl gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <input required value={quotationId} onChange={event => setQuotationId(event.target.value)} placeholder="Quotation ID" className="min-w-0 flex-1 rounded-lg px-3 text-xs outline-none" />
      <button className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-xs font-semibold text-white hover:bg-violet-700">Open <Icon name="arrow" size={15} /></button>
    </form>
    <div className="mx-auto mt-5 max-w-xl rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"><p className="text-[9px] font-bold tracking-widest text-slate-400">YOUR CUSTOMER ACCOUNT ID</p><p className="mt-1 text-xs text-slate-500">If a representative is linking a new quotation to your new account, share this ID with them.</p><div className="mt-3 flex gap-2"><input aria-label="Customer account ID" readOnly value={customer.id} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-[10px] text-slate-700" /><button type="button" onClick={async () => { await navigator.clipboard.writeText(customer.id); setCopied(true) }} className="rounded-lg border border-slate-200 px-3 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">{copied ? 'Copied' : 'Copy ID'}</button></div></div>
  </section>
}
