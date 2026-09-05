import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { login, signup } from '../api/auth'
import { toast } from 'sonner'
import { getApiError } from '../api/client'
import Brand from '../components/Brand'
import Icon from '../components/Icon'
import { useAuthStore } from '../store/authStore'

const initialForm = { name: '', email: 'rep@dealflow360.test', password: 'Rep12345!', role: 'REP' }

export default function LoginPage() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(initialForm)
  const setSession = useAuthStore(state => state.setSession)
  const authMutation = useMutation({
    mutationFn: values => mode === 'login'
      ? login({ email: values.email, password: values.password })
      : signup(values),
    onSuccess: session => {
      setSession(session)
      toast.success(mode === 'login' ? 'Signed in successfully.' : 'Team account created successfully.')
    },
  })
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  const submit = event => { event.preventDefault(); authMutation.mutate(form) }
  const switchMode = () => { authMutation.reset(); setMode(current => current === 'login' ? 'signup' : 'login') }

  return <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
    <section className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_65%_20%,#493d8b_0,transparent_27%),linear-gradient(145deg,#151331,#221d4b)] p-12 text-white lg:flex lg:flex-col">
      <Brand />
      <div className="my-auto max-w-xl">
        <span className="text-[10px] font-bold tracking-[.2em] text-violet-200">DEALFLOW360</span>
        <h1 className="my-5 font-display text-5xl font-bold leading-[1.08] tracking-[-.055em] xl:text-6xl">Build clear quotes.<br /><em className="not-italic text-coral">Keep every deal moving.</em></h1>
        <p className="max-w-lg text-base leading-relaxed text-violet-100/70">Configure your sales catalog, prepare quotations, and confirm commercial terms in one workspace.</p>
      </div>
      <p className="text-[11px] text-violet-100/45">MVP 1 · Configuration and quotations</p>
    </section>
    <section className="grid min-h-screen place-items-center bg-white px-5 py-8 sm:px-10">
      <div className="w-full max-w-[390px]">
        <div className="mb-10 lg:hidden"><Brand dark={false} /></div>
        <span className="text-[10px] font-bold tracking-[.2em] text-coral">WELCOME TO DEALFLOW360</span>
        <h2 className="mb-1.5 mt-3 font-display text-3xl font-bold tracking-tight text-slate-900">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="text-xs text-slate-400">{mode === 'login' ? 'Sign in with your configured account.' : 'Admins are provisioned by the system.'}</p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          {mode === 'signup' && <Field label="Full name" name="name" value={form.name} onChange={update} />}
          <Field label="Work email" name="email" type="email" value={form.email} onChange={update} />
          <Field label="Password" name="password" type="password" minLength="8" value={form.password} onChange={update} />
          {mode === 'signup' && <label className="block text-[11px] font-semibold">Role<select name="role" value={form.role} onChange={update} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-3 outline-none focus:border-violet-500"><option value="REP">Sales Rep</option><option value="MANAGER">Sales Manager</option><option value="FINANCE">Finance</option></select></label>}
          {authMutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{getApiError(authMutation.error, 'Unable to authenticate')}</p>}
          <button disabled={authMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">{authMutation.isPending ? 'Please wait…' : mode === 'login' ? 'Sign in to workspace' : 'Create account'}{!authMutation.isPending && <Icon name="arrow" />}</button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-400">{mode === 'login' ? 'Need a team account?' : 'Already have an account?'}{' '}<button type="button" onClick={switchMode} className="border-0 bg-transparent font-semibold text-violet-600">{mode === 'login' ? 'Create one' : 'Sign in'}</button></p>
        <div className="mt-8 rounded-lg bg-violet-50 p-3 text-[10px] leading-relaxed text-slate-500"><span className="mr-2 rounded bg-violet-600 px-1.5 py-1 text-white">Demo</span>Seeded rep: rep@dealflow360.test / Rep12345!</div>
      </div>
    </section>
  </main>
}

function Field({ label, ...props }) {
  return <label className="block text-[11px] font-semibold">{label}<input required {...props} className="mt-1.5 block w-full rounded-lg border border-slate-200 p-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
}
