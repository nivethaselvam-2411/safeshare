import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { useAuth } from '../auth';
import { errMsg } from '../api';

const SAMPLES = ['Salary-Bands-2026.xlsx', 'Board-Minutes-Oct.pdf', 'Vendor-NDA-signed.pdf', 'Acquisition-Term-Sheet.docx'];
const HEX = '0123456789abcdef';
// The memorable moment: a file name that is repeatedly sealed into ciphertext and opened again.
function CipherLine() {
  const [i, setI] = useState(0); const [text, setText] = useState(SAMPLES[0]); const [sealed, setSealed] = useState(false);
  useEffect(() => {
    const plain = SAMPLES[i]; let step = 0; let dir = 1; let timer;
    const render = () => {
      const n = Math.min(plain.length, Math.floor(step));
      const out = [...plain].map((c, k) => (dir === 1 ? (k < n ? HEX[Math.floor(Math.random() * 16)] : c) : (k < n ? c : HEX[Math.floor(Math.random() * 16)]))).join('');
      setText(out); setSealed(dir === 1 ? n >= plain.length : n < plain.length);
    };
    timer = setInterval(() => {
      step += 0.7; render();
      if (step > plain.length + 22) { step = 0; if (dir === -1) { dir = 1; setI((x) => (x + 1) % SAMPLES.length); clearInterval(timer); } else dir = -1; }
    }, 55);
    return () => clearInterval(timer);
  }, [i]);
  return (
    <div className="cipher">
      <div className={'cipher-state' + (sealed ? ' on' : '')}><Lock size={14} />{sealed ? 'Sealed with AES-256-GCM' : 'Opening for an authorised viewer'}</div>
      <div className="cipher-text">{text}</div>
    </div>
  );
}

export default function Auth({ register: isReg }) {
  const { user, login, register } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { isReg ? await register(f.name, f.email, f.password) : await login(f.email, f.password); nav('/'); }
    catch (x) { setErr(await errMsg(x)); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="brand light"><Lock size={24} /><span>SafeShare</span></div>
        <div>
          <h1>Share the document.<br />Keep the control.</h1>
          <p>Every file is encrypted before it touches disk. You decide who can open it, for how long, and you can see everything that happens to it.</p>
          <CipherLine />
        </div>
        <ul className="auth-facts">
          <li><b>AES-256</b> per-file keys</li><li><b>Roles</b> viewer, editor, owner</li><li><b>Versions</b> restore any time</li><li><b>Audit</b> tamper-evident log</li>
        </ul>
      </section>
      <section className="auth-form">
        <form onSubmit={submit}>
          <h2>{isReg ? 'Create your account' : 'Welcome back'}</h2>
          <p className="sub">{isReg ? 'The first account on a new install becomes the administrator.' : 'Sign in to open your files.'}</p>
          {isReg && <label>Full name<input value={f.name} onChange={set('name')} required autoComplete="name" /></label>}
          <label>Work email<input type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></label>
          <label>Password<input type="password" value={f.password} onChange={set('password')} required autoComplete={isReg ? 'new-password' : 'current-password'} placeholder={isReg ? '8+ characters, letters and numbers' : ''} /></label>
          {err && <div className="form-err" role="alert">{err}</div>}
          <button className="btn primary lg" disabled={busy}>{busy && <Loader2 className="spin" size={17} />}{isReg ? 'Create account' : 'Sign in'}</button>
          <p className="switch">{isReg ? <>Already have an account? <Link to="/login">Sign in</Link></> : <>New here? <Link to="/register">Create an account</Link></>}</p>
          {!isReg && <div className="demo-box"><b>Demo accounts</b>
            {[['admin@safeshare.com', 'Admin@123', 'Admin'], ['alice@safeshare.com', 'Pass@1234', 'Alice'], ['bob@safeshare.com', 'Pass@1234', 'Bob']].map(([e, p, n]) => (
              <button type="button" key={e} onClick={() => setF({ ...f, email: e, password: p })}>{n}<small>{e}</small></button>))}
          </div>}
        </form>
      </section>
    </div>
  );
}
