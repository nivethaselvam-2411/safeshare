import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldX, Loader2 } from 'lucide-react';
import api, { fmtDate } from '../api';
import { useAuth } from '../auth';
import { Pill } from '../components/ui';

const FILTERS = [['', 'All events'], ['file', 'Files'], ['auth', 'Sign-ins'], ['link', 'Share links'], ['access', 'Denied access'], ['admin', 'Admin']];
export default function Audit() {
  const { user } = useAuth(); const [data, setData] = useState(null); const [action, setAction] = useState(''); const [page, setPage] = useState(1);
  const [chain, setChain] = useState(null); const [checking, setChecking] = useState(false);
  useEffect(() => { api.get('/audit', { params: { action, page } }).then((r) => setData(r.data)); }, [action, page]);
  const verify = async () => { setChecking(true); setChain(null); await new Promise((r) => setTimeout(r, 700)); setChain((await api.get('/audit/verify')).data); setChecking(false); };
  return (
    <>
      <header className="page-h"><div><h1>Activity log</h1><p>{user.role === 'admin' ? 'Every event across the organisation.' : 'Your actions, plus everything that happens to files you own.'}</p></div>
        {user.role === 'admin' && <button className="btn" onClick={verify} disabled={checking}>{checking ? <Loader2 className="spin" size={17} /> : <ShieldCheck size={17} />}Verify log integrity</button>}</header>
      {chain && <div className={'chain ' + (chain.valid ? 'ok' : 'bad')}>{chain.valid ? <ShieldCheck size={20} /> : <ShieldX size={20} />}
        {chain.valid ? `All ${chain.checked} entries check out. The hash chain is unbroken, so no entry has been edited or removed.` : `Tampering detected at entry #${chain.brokenAt}. Entries before it are intact.`}</div>}
      <div className="chips">{FILTERS.map(([v, l]) => <button key={v} className={action === v ? 'on' : ''} onClick={() => { setAction(v); setPage(1); }}>{l}</button>)}</div>
      {!data ? <div className="splash"><div className="spinner" /></div> : (
        <div className="table log">
          <div className="tr th"><span>When</span><span>Who</span><span>Event</span><span>File</span><span>Details</span><span>IP</span></div>
          {data.items.map((e) => (
            <div className="tr" key={e._id}><span><small>{fmtDate(e.createdAt)}</small></span><span><b>{e.userName}</b></span><span><Pill action={e.action} /></span>
              <span>{e.fileName || '-'}</span><span className="det">{Object.entries(e.details || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '-'}</span><span className="mono">{e.ip?.replace('::ffff:', '') || '-'}</span></div>))}
          {data.items.length === 0 && <p className="muted pad">No events match this filter.</p>}
        </div>)}
      {data?.pages > 1 && <div className="pager"><button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {data.pages}</span>
        <button className="btn sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </>
  );
}
