import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Files, Share2, History, Link2, ShieldAlert, HardDrive, ScrollText } from 'lucide-react';
import api, { fmtSize, ago } from '../api';
import { useAuth } from '../auth';
import { FileIcon, Pill } from '../components/ui';

export default function Dashboard() {
  const { user } = useAuth(); const [s, setS] = useState(null); const [recent, setRecent] = useState([]); const [log, setLog] = useState([]);
  useEffect(() => {
    api.get('/stats').then((r) => setS(r.data));
    api.get('/files').then((r) => setRecent(r.data.slice(0, 5)));
    api.get('/audit?limit=6').then((r) => setLog(r.data.items));
  }, []);
  if (!s) return <div className="splash"><div className="spinner" /></div>;
  const max = Math.max(1, ...s.activity.map((a) => a.count));
  const cards = [[Files, 'Files you own', s.files], [Share2, 'Shared with you', s.shared], [History, 'Stored versions', s.versions],
    [Link2, 'Live share links', s.links], [HardDrive, 'Encrypted storage', fmtSize(s.storage)], [ShieldAlert, 'Blocked attempts (7d)', s.denied]];
  return (
    <>
      <header className="page-h"><div><h1>Good to see you, {user.name.split(' ')[0]}</h1><p>Here is what is happening with your documents.</p></div>
        <Link className="btn primary" to="/files?upload=1">Upload a file</Link></header>
      <div className="stat-grid">
        {cards.map(([I, l, v]) => <div className="stat" key={l}><I size={19} /><b>{v}</b><span>{l}</span></div>)}
      </div>
      {s.org && <div className="org-strip"><b>Organisation</b><span>{s.org.users} people</span><span>{s.org.files} files</span>
        <span>{s.org.events} audit events</span><span className={s.org.failedLogins ? 'warn' : ''}>{s.org.failedLogins} failed sign-ins this week</span></div>}
      <div className="grid-2">
        <section className="panel"><h3>Activity, last 7 days</h3>
          <div className="bars">{s.activity.map((a) => (
            <div key={a.day} className="bar"><span className="bar-n">{a.count}</span><i style={{ height: `${(a.count / max) * 100}%` }} /><small>{a.day}</small></div>))}</div>
        </section>
        <section className="panel"><h3>Recent files</h3>
          {recent.length === 0 ? <p className="muted">Nothing uploaded yet.</p> : recent.map((f) => (
            <Link to={`/files/${f._id}`} className="row" key={f._id}><FileIcon name={f.name} /><div className="grow"><b>{f.name}</b><small>v{f.currentVersion} · {fmtSize(f.size)}</small></div><small>{ago(f.updatedAt)}</small></Link>))}
        </section>
      </div>
      <section className="panel"><div className="panel-h"><h3>Latest events</h3><Link to="/audit">Open full log</Link></div>
        {log.map((e) => (<div className="row" key={e._id}><ScrollText size={17} className="muted" /><div className="grow"><b>{e.userName}</b> <Pill action={e.action} /> {e.fileName && <span className="muted">{e.fileName}</span>}</div><small>{ago(e.createdAt)}</small></div>))}
      </section>
    </>
  );
}
