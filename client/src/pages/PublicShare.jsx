import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Download, ShieldCheck, TimerOff } from 'lucide-react';
import api, { errMsg, saveBlob, fmtSize, fmtDate } from '../api';
import { FileIcon } from '../components/ui';

export default function PublicShare() {
  const { token } = useParams(); const [info, setInfo] = useState(null); const [err, setErr] = useState(''); const [pw, setPw] = useState(''); const [msg, setMsg] = useState(''); const [done, setDone] = useState(false);
  useEffect(() => { api.get(`/public/${token}`).then((r) => setInfo(r.data)).catch(async (e) => setErr(await errMsg(e))); }, [token]);
  const go = async (e) => { e.preventDefault(); setMsg(''); try { await saveBlob(`/public/${token}/download`, info.name, 'post', { password: pw }); setDone(true); } catch (x) { setMsg(await errMsg(x)); } };
  return (
    <div className="public"><div className="public-card">
      <div className="brand"><ShieldCheck size={22} /><span>SafeShare</span></div>
      {err ? <div className="empty"><TimerOff size={34} /><h4>{err}</h4><p>Ask the sender to create a new link.</p></div> : !info ? <div className="spinner" /> : (
        <form onSubmit={go}>
          <FileIcon name={info.name} size={32} /><h2>{info.name}</h2>
          <p className="muted">{info.sharedBy} shared this file with you · {fmtSize(info.size)}<br />Link expires {fmtDate(info.expiresAt)}{info.remaining != null && ` · ${info.remaining} download${info.remaining === 1 ? '' : 's'} left`}</p>
          {info.hasPassword && <label><span><Lock size={14} /> This link is password protected</span><input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Link password" /></label>}
          {msg && <div className="form-err">{msg}</div>}
          <button className="btn primary lg"><Download size={18} />Download file</button>
          {done && <p className="ok-note">Download started. This access was recorded in the owner's activity log.</p>}
        </form>)}
    </div></div>
  );
}
