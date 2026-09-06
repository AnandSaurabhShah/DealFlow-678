import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { configApi } from '../api/config'
import { getApiError } from '../api/client'
import Pagination from '../components/Pagination'
import SearchInput from '../components/SearchInput'
import { useAdminConfig, useConfigOptions } from '../hooks/useApiQueries'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { configEnumLabel, defaultConfigOptions } from '../lib/configEnums'
import { formatMoney } from '../lib/format'

const sections = {
  products: {
    label: 'Products',
    queryKey: 'products',
    create: configApi.createProduct,
    initial: { name: '', category: 'HARDWARE', price: '', unit: 'UNIT', tax: '0', description: '', billingType: 'ONE_TIME', billingCycle: 'MONTHLY' },
    fields: [
      ['name', 'Name'], ['category', 'Category', 'productCategories'], ['price', 'Price', 'number'],
      ['unit', 'Unit', 'productUnits'], ['tax', 'Tax %', 'number'], ['description', 'Description'],
      ['billingType', 'Billing type', 'billingType'], ['billingCycle', 'Billing cycle', 'billingCycle'],
    ],
  },
  priceLists: {
    label: 'Price lists',
    queryKey: 'priceLists',
    create: configApi.createPriceList,
    initial: { name: '', customerTier: 'STANDARD', currency: 'USD' },
    fields: [['name', 'Name'], ['customerTier', 'Customer tier', 'customerTiers'], ['currency', 'Currency', 'currencies']],
  },
  warehouses: {
    label: 'Warehouses',
    queryKey: 'warehouses',
    create: configApi.createWarehouse,
    initial: { name: '', location: '' },
    fields: [['name', 'Name'], ['location', 'Location']],
  },
  discountTiers: {
    label: 'Discount tiers',
    queryKey: 'discountTiers',
    create: configApi.createDiscountTier,
    initial: { tierName: '', maxDiscountPercent: '' },
    fields: [['tierName', 'Tier name'], ['maxDiscountPercent', 'Maximum discount %', 'number']],
  },
  users: {
    label: 'Users',
    queryKey: 'users',
    create: configApi.createUser,
    initial: { name: '', email: '', password: '', role: 'REP' },
    fields: [['name', 'Full name'], ['email', 'Work email', 'email'], ['password', 'Initial password', 'password'], ['role', 'Role', 'userRoles']],
  },
  customers: {
    label: 'Customers',
    queryKey: 'customers',
    create: configApi.createCustomer,
    initial: { name: '', email: '', password: '' },
    fields: [['name', 'Customer name'], ['email', 'Email', 'email'], ['password', 'Initial password', 'password']],
  },
}

const groupOptions = {
  products: [['none', 'No grouping'], ['category', 'Category'], ['billingType', 'Billing type']],
  priceLists: [['none', 'No grouping'], ['customerTier', 'Customer tier'], ['currency', 'Currency']],
  warehouses: [['none', 'No grouping'], ['location', 'Location']],
  discountTiers: [['none', 'No grouping'], ['maxDiscountPercent', 'Maximum discount']],
  users: [['none', 'No grouping'], ['role', 'Role']],
  customers: [['none', 'No grouping']],
}

export default function AdminConfigPage() {
  const [active, setActive] = useState('products')
  const [form, setForm] = useState(sections.products.initial)
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState('none')
  const debouncedSearch = useDebouncedValue(search)
  const queryClient = useQueryClient()
  const queries = useAdminConfig(active, page, pageSize, debouncedSearch)
  const optionsQuery = useConfigOptions()
  const configOptions = optionsQuery.data || defaultConfigOptions
  const section = sections[active]
  const query = queries[active]
  const createMutation = useMutation({
    mutationFn: values => section.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [section.queryKey] })
      setForm(section.initial)
      setPage(1)
      const message = `${section.label.slice(0, -1)} created.`
      setNotice(message)
      toast.success(message)
    },
  })

  const selectSection = key => {
    setActive(key)
    setForm(sections[key].initial)
    setNotice('')
    setSearch('')
    setGroupBy('none')
    setPage(1)
    createMutation.reset()
  }
  const submit = event => { event.preventDefault(); createMutation.mutate(form) }

  return <div className="grid items-start gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
    <aside className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">{Object.entries(sections).map(([key, item]) => <button key={key} onClick={() => selectSection(key)} className={`block w-full rounded-lg px-3 py-2.5 text-left text-xs ${active === key ? 'bg-violet-50 font-semibold text-violet-700' : 'text-slate-500 hover:bg-slate-50'}`}>{item.label}</button>)}</aside>
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5"><h2 className="font-display text-base font-bold">Add {section.label.toLowerCase().slice(0, -1)}</h2><p className="mt-1 text-[10px] text-slate-400">Configure the fields used by quotations and billing.</p></div><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{section.fields.map(([name, label, type = 'text']) => {
        if (name === 'billingCycle' && form.billingType !== 'RECURRING') return null
        if (type === 'billingType') return <SelectField key={name} label={label} name={name} value={form[name]} options={configOptions.billingTypes} onChange={value => setForm(current => ({ ...current, billingType: value }))} />
        if (type === 'billingCycle') return <SelectField key={name} label={label} name={name} value={form[name]} options={configOptions.billingCycles} onChange={value => setForm(current => ({ ...current, billingCycle: value }))} />
        if (configOptions[type]) return <SelectField key={name} label={label} name={name} value={form[name]} options={configOptions[type]} onChange={value => setForm(current => ({ ...current, [name]: value }))} />
        return <label key={name} className="text-[10px] font-semibold">{label}<input required={name !== 'description' && name !== 'location'} name={name} type={type} min={type === 'number' ? '0' : undefined} minLength={type === 'password' ? 8 : undefined} maxLength={type === 'password' ? 128 : undefined} step={type === 'number' ? '0.01' : undefined} value={form[name]} onChange={event => setForm(current => ({ ...current, [name]: event.target.value }))} className="mt-1.5 block w-full rounded-lg border border-slate-200 p-2.5 outline-none focus:border-violet-500" /></label>
      })}<div className="sm:col-span-2">{notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</p>}{createMutation.isError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{getApiError(createMutation.error, `Unable to create ${section.label.toLowerCase()}`)}</p>}<button disabled={createMutation.isPending} className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{createMutation.isPending ? 'Creating…' : `Create ${section.label.toLowerCase().slice(0, -1)}`}</button></div></form></section>
      <section className="min-h-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><h2 className="font-display text-base font-bold">{section.label}</h2><button onClick={() => query.refetch()} className="text-[10px] font-semibold text-violet-600">Refresh</button></div><div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4"><SearchInput value={search} onChange={value => { setSearch(value); setPage(1) }} placeholder={`Search ${section.label.toLowerCase()}…`} className="min-w-60 flex-1" /><label className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">GROUP BY<select value={groupBy} onChange={event => setGroupBy(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px] text-slate-700 outline-none focus:border-violet-500">{groupOptions[active].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{query.isLoading && <ConfigMessage>Loading…</ConfigMessage>}{query.isError && <ConfigMessage error>{getApiError(query.error, `Unable to load ${section.label.toLowerCase()}`)}</ConfigMessage>}{query.isSuccess && <><ConfigList type={active} items={query.data.items} groupBy={groupBy} /><Pagination pagination={query.data.pagination} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }} disabled={query.isFetching} /></>}</section>
    </div>
  </div>
}

function ConfigList({ type, items, groupBy }) {
  if (!items.length) return <ConfigMessage>No records configured yet.</ConfigMessage>
  if (groupBy === 'none') return <div className="divide-y divide-slate-100">{items.map(item => <ConfigRow key={item.id} type={type} item={item} />)}</div>
  const groups = items.reduce((result, item) => {
    const key = item[groupBy] || 'Not set'
    result[key] ||= []
    result[key].push(item)
    return result
  }, {})
  return <div className="bg-slate-50/60 p-4"><div className="grid items-start gap-4 lg:grid-cols-2">{Object.entries(groups).sort(([left], [right]) => left.localeCompare(right)).map(([group, records]) => <section key={group} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3"><strong className="text-[10px] uppercase tracking-wide text-slate-600">{configEnumLabel(group)}</strong><span className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-500 shadow-sm">{records.length}</span></header><div className="divide-y divide-slate-100">{records.map(item => <ConfigRow key={item.id} type={type} item={item} />)}</div></section>)}</div></div>
}

function ConfigRow({ type, item }) {
  return <div className="flex items-center justify-between gap-4 px-5 py-4 text-xs"><div><strong>{item.name || item.tierName}</strong><p className="mt-1 text-[10px] text-slate-400">{detail(type, item)}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] text-slate-600">{type === 'products' ? configEnumLabel(item.category) : type === 'warehouses' ? `${item._count.stockLevels} stock lines` : type === 'priceLists' ? item.currency : type === 'users' ? configEnumLabel(item.role) : type === 'customers' ? 'Portal customer' : 'active'}</span></div>
}

function detail(type, item) {
  if (type === 'products') return `${formatMoney(Number(item.price))} per ${configEnumLabel(item.unit)} · ${item.billingType === 'RECURRING' ? 'Monthly recurring' : 'One-time'} · ${item.tax}% tax`
  if (type === 'priceLists') return `Customer tier: ${configEnumLabel(item.customerTier)}`
  if (type === 'warehouses') return item.location || 'No location set'
  if (type === 'users' || type === 'customers') return item.email
  return `Maximum discount: ${item.maxDiscountPercent}%`
}

function SelectField({ label, name, value, options, onChange }) {
  return <label className="text-[10px] font-semibold">{label}<select name={name} value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-2.5 outline-none focus:border-violet-500">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

function ConfigMessage({ children, error = false }) {
  return <div role={error ? 'alert' : undefined} className={`grid min-h-52 place-items-center text-xs ${error ? 'text-red-600' : 'text-slate-400'}`}>{children}</div>
}
