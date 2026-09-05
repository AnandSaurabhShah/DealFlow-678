import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { customerAuthApi } from '../api/portal'
import { getApiError } from '../api/client'
import Brand from '../components/Brand'
import Icon from '../components/Icon'
import { useCustomerAuthStore } from '../store/customerAuthStore'

const initialForm = { name: '', email: 'customer.a@dealflow360.test', password: 'Customer123!' }

export default function CustomerLoginPage() {
  const [form, setForm] = useState(initialForm)
  const setSession = useCustomerAuthStore(state => state.setSession)
  const navigate = useNavigate()
  const location = useLocation()
  const mode = location.pathname.endsWith('/signup') ? 'signup' : 'login'
  const auth = useMutation({
    mutationFn: values => mode === 'login' ? customerAuthApi.login(values) : customerAuthApi.signup(values),
    onSuccess: setSession,
  })
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  const submit = event => { event.preventDefault(); auth.mutate(form) }
  const switchMode = nextMode => { auth.reset(); navigate(`/portal/${nextMode}`) }

  return <main className="grid min-h-screen bg-[#f5f7fb] lg:grid-cols-[.9fr_1.1fr]">
    <section className="grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Brand dark={false} />
        <p className="mt-10 text-[10px] font-bold tracking-[.2em] text-coral">CUSTOMER PORTAL</p>
        <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label="Customer authentication">
          <button type="button" onClick={() => switchMode('login')} className={`rounded-lg px-3 py-2.5 text-xs font-semibold ${mode === 'login' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>Sign in</button>
          <button type="button" onClick={() => switchMode('signup')} className={`rounded-lg px-3 py-2.5 text-xs font-semibold ${mode === 'signup' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>Create account</button>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900">{mode === 'login' ? 'Review your quotation' : 'Create your portal account'}</h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">A secure space to discuss pricing and confirm your commercial terms.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === 'signup' && <Field label="Full name" name="name" value={form.name} onChange={update} />}
          <Field label="Email" name="email" type="email" value={form.email} onChange={update} />
          <Field label="Password" name="password" type="password" minLength="8" value={form.password} onChange={update} />
          {auth.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{getApiError(auth.error, 'Unable to authenticate')}</p>}
          <button disabled={auth.isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60">{auth.isPending ? 'Please wait…' : mode === 'login' ? 'Sign in to portal' : 'Create customer account'}{!auth.isPending && <Icon name="arrow" />}</button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-500">{mode === 'login' ? 'New to the portal?' : 'Already registered?'} <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')} className="font-semibold text-violet-600">{mode === 'login' ? 'Create account' : 'Sign in'}</button></p>
        <p className="mt-7 text-center text-[10px] text-slate-400">DealFlow team member? <Link className="font-semibold text-slate-600" to="/login">Internal sign in</Link></p>
      </div>
    </section>
    <section className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_30%_25%,#6d5bd0_0,transparent_30%),linear-gradient(145deg,#151331,#28205b)] p-14 text-white lg:flex lg:flex-col lg:justify-end">
      <div className="max-w-xl"><p className="text-[10px] font-bold tracking-[.2em] text-violet-200">ONE SHARED DEAL</p><h2 className="mt-5 font-display text-5xl font-bold leading-tight tracking-[-.05em]">Clear terms.<br /><span className="text-coral">Faster decisions.</span></h2><p className="mt-5 max-w-md text-sm leading-relaxed text-violet-100/70">Review every line, request a discount, and keep the full conversation attached to your quotation.</p></div>
    </section>
  </main>
}

function Field({ label, ...props }) {
  return <label className="block text-[11px] font-semibold text-slate-700">{label}<input required {...props} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
}
