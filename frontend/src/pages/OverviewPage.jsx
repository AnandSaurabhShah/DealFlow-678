import Icon from '../components/Icon'
import QuoteTable from '../components/QuoteTable'

const stats = [
  { label: 'Open pipeline', value: '$148.2K', change: '+12.4%', sub: 'from last month', icon: 'trend', color: 'bg-violet-100 text-violet-600' },
  { label: 'Awaiting approval', value: '3', sub: '$42,680 in value', icon: 'clock', color: 'bg-amber-100 text-amber-600' },
  { label: 'Active quotations', value: '12', change: '+4', sub: 'this week', icon: 'file', color: 'bg-sky-100 text-sky-600' },
  { label: 'Win rate', value: '68%', change: '+5.2%', sub: 'from last month', icon: 'users', color: 'bg-emerald-100 text-emerald-600' },
]
const stages = [['Draft',34,3],['Sent',52,4],['Negotiation',82,3],['Approval',45,2],['Confirmed',68,4]]

function StatCard({ stat }) {
  return <article className="grid grid-cols-[44px_1fr] gap-x-3 rounded-xl border border-slate-200 bg-white p-[18px] shadow-sm"><div className={`row-span-3 grid size-[42px] place-items-center rounded-[10px] ${stat.color}`}><Icon name={stat.icon}/></div><div className="flex justify-between text-[11px] text-slate-400"><span>{stat.label}</span><button aria-label={`More ${stat.label} options`}>•••</button></div><strong className="my-1 font-display text-2xl">{stat.value}</strong><div className="flex items-center gap-1.5 text-[10px] text-slate-400">{stat.change && <b className="flex items-center text-emerald-600"><Icon name="trend" size={13}/>{stat.change}</b>}<span>{stat.sub}</span></div></article>
}

export default function OverviewPage({ quotes, onNavigate }) {
  return <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(stat => <StatCard key={stat.label} stat={stat}/>)}</section><section className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_.8fr]"><article className="rounded-xl border border-slate-200 bg-white shadow-sm"><PanelTitle title="Pipeline pulse" subtitle="Deal value by stage"><select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-500"><option>This month</option></select></PanelTitle><div className="flex h-56 px-5 pb-7"><div className="flex w-10 flex-col justify-between pb-6 text-[9px] text-slate-400"><span>$80k</span><span>$60k</span><span>$40k</span><span>$20k</span><span>$0</span></div><div className="flex flex-1 items-end justify-around border-b border-l border-slate-100 bg-[repeating-linear-gradient(to_bottom,#fff_0,#fff_24%,#eee_25%)]">{stages.map(([label,height,count],index) => <div className="relative flex h-full w-[16%] flex-col items-center justify-end" key={label}><span className="mb-1 text-[9px] text-slate-500">{count}</span><div style={{height:`${height}%`}} className={`w-8 rounded-t-md ${index === 2 ? 'bg-violet-600' : index === 4 ? 'bg-violet-400' : 'bg-violet-200'}`}/><span className="absolute -bottom-5 text-[9px] text-slate-500">{label}</span></div>)}</div></div></article>
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm"><PanelTitle title="Needs attention" subtitle="Deals requiring action"><span className="rounded-full bg-red-50 px-2 py-1 text-[10px] text-red-600">3</span></PanelTitle><div>{[['!','Approval waiting','Meridian Health · $18,740','2h','bg-red-50 text-red-600'],['↗','Discount above threshold','Northstar Labs · 18.5%','4h','bg-amber-50 text-amber-600'],['◷','Customer follow-up','Lumen & Co. · No reply in 5d','5d','bg-sky-50 text-sky-600']].map(([symbol,title,sub,time,color]) => <div className="mx-5 flex items-center gap-3 border-t border-slate-100 py-3" key={title}><span className={`grid size-8 place-items-center rounded-lg font-bold ${color}`}>{symbol}</span><p className="flex flex-1 flex-col text-[11px]"><strong>{title}</strong><small className="mt-1 text-[9px] text-slate-400">{sub}</small></p><span className="text-[9px] text-slate-400">{time}</span></div>)}</div><button className="mx-5 my-3 flex items-center gap-1 text-[10px] font-semibold text-violet-600">View all activity<Icon name="arrow"/></button></article></section>
    <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm"><PanelTitle title="Recent quotations" subtitle="Your latest deal activity"><button onClick={() => onNavigate('quotes')} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold">View all<Icon name="arrow"/></button></PanelTitle><QuoteTable quotes={quotes.slice(0,4)} onSelect={() => onNavigate('builder')} compact/></section></>
}

function PanelTitle({ title, subtitle, children }) {
  return <div className="flex items-center justify-between p-5"><div><h2 className="font-display text-[15px] font-bold">{title}</h2><p className="mt-1 text-[10px] text-slate-400">{subtitle}</p></div>{children}</div>
}
