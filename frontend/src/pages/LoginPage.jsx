import { useState } from 'react'
import Brand from '../components/Brand'
import Icon from '../components/Icon'

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: 'arjun@dealflow360.io', password: 'password', role: 'Sales Rep' })
  const update = event => setForm({ ...form, [event.target.name]: event.target.value })
  const submit = event => { event.preventDefault(); onLogin({ name: form.name || 'Arjun Mehta', email: form.email, role: form.role }) }

  return <main className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
    <section className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_65%_20%,#493d8b_0,transparent_27%),linear-gradient(145deg,#151331,#221d4b)] p-12 text-white lg:flex lg:flex-col">
      <Brand/><div className="my-auto max-w-xl"><span className="text-[10px] font-bold tracking-[.2em] text-violet-200">THE MODERN REVENUE WORKSPACE</span><h1 className="my-5 font-display text-5xl font-bold leading-[1.08] tracking-[-.055em] xl:text-6xl">Close the right deals.<br/><em className="not-italic text-coral">Protect every margin.</em></h1><p className="max-w-lg text-base leading-relaxed text-violet-100/70">One intelligent workspace for quotes, approvals, fulfillment, and customer negotiation.</p><div className="mt-11 flex gap-12">{[['28%','faster approvals'],['4.6×','deal visibility'],['12%','margin protected']].map(([value,label]) => <div className="flex flex-col" key={label}><strong className="font-display text-2xl">{value}</strong><span className="mt-1 text-[10px] text-violet-100/55">{label}</span></div>)}</div></div><p className="max-w-md text-[11px] leading-relaxed text-violet-100/45">“Finally, a sales workflow that understands how complex B2B deals actually close.”</p>
    </section>
    <section className="grid min-h-screen place-items-center bg-white px-5 py-8 sm:px-10"><div className="w-full max-w-[390px]"><div className="mb-10 lg:hidden"><Brand dark={false}/></div><span className="text-[10px] font-bold tracking-[.2em] text-coral">WELCOME TO DEALFLOW360</span><h2 className="mb-1.5 mt-3 font-display text-3xl font-bold tracking-tight text-slate-900">{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h2><p className="text-xs text-slate-400">{mode === 'login' ? 'Sign in to continue managing your deals.' : 'Set up your profile to start building better deals.'}</p>
      <form className="mt-7 space-y-4" onSubmit={submit}>{mode === 'signup' && <Field label="Full name" name="name" value={form.name} onChange={update}/>}<Field label="Work email" name="email" type="email" value={form.email} onChange={update}/><Field label="Password" name="password" type="password" value={form.password} onChange={update}/>{mode === 'signup' && <label className="block text-[11px] font-semibold">Role<select name="role" value={form.role} onChange={update} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-3 outline-none focus:border-violet-500"><option>Sales Rep</option><option>Sales Manager</option><option>Finance</option><option>Admin</option></select></label>}<button className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700">{mode === 'login' ? 'Sign in to workspace' : 'Create account'}<Icon name="arrow"/></button></form>
      <p className="mt-5 text-center text-xs text-slate-400">{mode === 'login' ? 'New to DealFlow360?' : 'Already have an account?'} <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="border-0 bg-transparent font-semibold text-violet-600">{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p><div className="mt-8 rounded-lg bg-violet-50 p-3 text-[10px] text-slate-500"><span className="mr-2 rounded bg-violet-600 px-1.5 py-1 text-white">Demo</span>Use the pre-filled credentials to explore the frontend.</div>
    </div></section>
  </main>
}

function Field({ label, ...props }) {
  return <label className="block text-[11px] font-semibold">{label}<input required {...props} className="mt-1.5 block w-full rounded-lg border border-slate-200 p-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"/></label>
}
