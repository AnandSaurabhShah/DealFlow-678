import { useState } from 'react'
import Icon from '../components/Icon'
import QuoteTable from '../components/QuoteTable'

const filters = ['All', 'Draft', 'Negotiation', 'Approval', 'Confirmed']

export default function QuotationsPage({ quotes, onNavigate, onDelete }) {
  const [filter, setFilter] = useState('All')
  const visible = filter === 'All' ? quotes : quotes.filter(quote => quote.status === filter)
  return <section className="min-h-[500px] rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 overflow-x-auto p-4"><div className="flex min-w-max gap-1">{filters.map(item => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-[11px] ${filter === item ? 'bg-violet-100 font-semibold text-violet-700' : 'text-slate-500 hover:bg-slate-50'}`}>{item}<span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[9px]">{item === 'All' ? quotes.length : quotes.filter(quote => quote.status === item).length}</span></button>)}</div><button className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold"><Icon name="search" />Filter</button></div><QuoteTable quotes={visible} onSelect={() => onNavigate('builder')} onDelete={onDelete} /></section>
}
