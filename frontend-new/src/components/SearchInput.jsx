import Icon from './Icon'

export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return <label className={`relative block ${className}`}>
    <span className="sr-only">Search</span>
    <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
    <input type="search" maxLength={100} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-[11px] outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" />
    {value && <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base text-slate-400 hover:text-slate-700">×</button>}
  </label>
}
