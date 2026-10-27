import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Eye, History, Share2, Link2, Copy, RotateCcw, UploadCloud, ChevronLeft, KeyRound, Hash, X, Ban } from 'lucide-react';
import api, { errMsg, saveBlob, fmtSize, fmtDate, ago } from '../api';
import { FileIcon, Modal, Pill, toast } from '../components/ui';

const TEXTY = /^(text\/|application\/json)/;

export default function FileDetail() {
  const { id } = useParams(); const [f, setF] = useState(null); const [err, setErr] = useState('');
  const [tab, setTab] = useState('versions'); const [preview, setPreview] = useState(null); const [activity, setActivity] = useState([]);
  const verInput = useRef(); const [note, setNote] = useState('');
  const load = useCallback(async () => {
    try { const r = await api.get(`/files/${id}`); setF(r.data); if (r.data.access.role === 'owner') api.get(`/files/${id}/activity`).then((a) => setActivity(a.data)); }
    catch (e) { setErr(await errMsg(e)); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); load(); } catch (e) { toast(await errMsg(e), true); } };

  if (err) return <div className="empty"><h4>{err}</h4><Link className="btn" to="/files">Back to files</Link></div>;
  if (!f) return <div className="splash"><div className="spinner" /></div>;
  const owner = f.access.role === 'owner', canEdit = f.access.role !== 'viewer';

  const openPreview = async (version) => {
    try {
      const r = await api.get(`/files/${id}/preview`, { params: { version }, responseType: 'blob' });
      const isText = TEXTY.test(f.mimeType || '');
      setPreview({ version, type: r.data.type, url: isText ? null : URL.createObjectURL(r.data), text: isText ? await r.data.text() : null });
    } catch (e) { toast(await errMsg(e), true); }
  };
  const uploadVersion = async (file) => {
    const fd = new FormData(); fd.append('file', file); fd.append('note', note || 'New version');
    await run(() => api.post(`/files/${id}/versions`, fd), 'New version saved'); setNote('');
  };

  return (
    <>
      <Link to={owner ? '/files' : '/shared'} className="back"><ChevronLeft size={16} />Back</Link>
      <header className="detail-h">
        <FileIcon name={f.name} size={30} />
        <div className="grow"><h1>{f.name}</h1><p>Owned by {f.owner.name} · version {f.currentVersion} · {fmtSize(f.size)} · updated {ago(f.updatedAt)}</p></div>
        <i className={'role big ' + f.access.role}>{f.access.role}{f.access.expiresAt && ` until ${fmtDate(f.access.expiresAt)}`}</i>
        <button className="btn" onClick={() => openPreview()}><Eye size={17} />Preview</button>
        {f.access.canDownload ? <button className="btn primary" onClick={() => saveBlob(`/files/${id}/download`, f.name).catch(async (e) => toast(await errMsg(e), true))}><Download size={17} />Download</button>
          : <span className="viewonly"><Ban size={15} />View only</span>}
      </header>

      <div className="enc-card"><KeyRound size={19} />
        <div><b>Encrypted with AES-256-GCM</b><small>Each version has its own random key, wrapped by the server master key. If the stored bytes are altered, decryption fails.</small></div>
        <code title="SHA-256 of current version"><Hash size={13} />{f.versions[0]?.checksum.slice(0, 16)}…</code></div>

      <div className="tabs">
        <button className={tab === 'versions' ? 'on' : ''} onClick={() => setTab('versions')}><History size={16} />Versions <em>{f.versionCount}</em></button>
        {owner && <><button className={tab === 'access' ? 'on' : ''} onClick={() => setTab('access')}><Share2 size={16} />Access <em>{f.permissions.length}</em></button>
          <button className={tab === 'links' ? 'on' : ''} onClick={() => setTab('links')}><Link2 size={16} />Links <em>{f.links.filter((l) => !l.revoked).length}</em></button>
          <button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>Activity</button></>}
      </div>

      {tab === 'versions' && <section className="panel">
        {canEdit && <div className="ver-up"><input placeholder="What changed? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" onClick={() => verInput.current.click()}><UploadCloud size={17} />Upload new version</button>
          <input ref={verInput} type="file" hidden onChange={(e) => { e.target.files[0] && uploadVersion(e.target.files[0]); e.target.value = ''; }} /></div>}
        <div className="timeline">{f.versions.map((v) => (
          <div className={'tl' + (v.number === f.currentVersion ? ' cur' : '')} key={v.number}><i />
            <div className="grow"><b>Version {v.number}{v.number === f.currentVersion && <span className="tag">current</span>}</b>
              <p>{v.note} · {v.uploadedBy?.name} · {fmtDate(v.uploadedAt)} · {fmtSize(v.size)}</p><code>sha256 {v.checksum.slice(0, 24)}…</code></div>
            <button className="icon-btn" title="Preview this version" onClick={() => openPreview(v.number)}><Eye size={17} /></button>
            {f.access.canDownload && <button className="icon-btn" title="Download this version" onClick={() => saveBlob(`/files/${id}/download?version=${v.number}`, f.name)}><Download size={17} /></button>}
            {canEdit && v.number !== f.currentVersion && <button className="btn sm" onClick={() => run(() => api.post(`/files/${id}/versions/${v.number}/restore`), `Version ${v.number} restored as the latest`)}><RotateCcw size={14} />Restore</button>}
          </div>))}</div></section>}

      {tab === 'access' && owner && <AccessPanel f={f} run={run} id={id} />}
      {tab === 'links' && owner && <LinksPanel f={f} run={run} id={id} />}
      {tab === 'activity' && owner && <section className="panel">{activity.length === 0 ? <p className="muted">No activity yet.</p> : activity.map((e) => (
        <div className="row" key={e._id}><div className="grow"><b>{e.userName}</b> <Pill action={e.action} />
          {e.details && Object.keys(e.details).length > 0 && <small className="muted"> {Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(', ')}</small>}</div><small>{fmtDate(e.createdAt)}</small></div>))}</section>}

      {preview && <Modal wide title={`${f.name} (v${preview.version || f.currentVersion})`} onClose={() => { preview.url && URL.revokeObjectURL(preview.url); setPreview(null); }}>
        {preview.text != null ? <pre className="pre">{preview.text}</pre> : preview.type.startsWith('image/') ? <img className="pimg" src={preview.url} alt={f.name} /> : <iframe className="pframe" title="preview" src={preview.url} />}</Modal>}
    </>
  );
}

function AccessPanel({ f, run, id }) {
  const [form, setForm] = useState({ email: '', role: 'viewer', canDownload: false, expiresAt: '' });
  return (
    <section className="panel">
      <form className="share-form" onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/files/${id}/share`, { ...form, expiresAt: form.expiresAt || undefined }), 'Access updated').then(() => setForm({ ...form, email: '' })); }}>
        <input type="email" required placeholder="Colleague's email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="viewer">Viewer</option><option value="editor">Editor</option></select>
        {form.role === 'viewer' && <label className="chk"><input type="checkbox" checked={form.canDownload} onChange={(e) => setForm({ ...form, canDownload: e.target.checked })} />Can download</label>}
        <label className="chk">Expires<input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
        <button className="btn primary">Share</button>
      </form>
      <p className="hint">Viewers can open the file. Editors can also upload and restore versions, and always download. Only you can share, delete, or manage links.</p>
      {f.permissions.length === 0 ? <p className="muted">Only you can open this file.</p> : f.permissions.map((p) => (
        <div className="row" key={p.user._id}><div className="avatar sm">{p.user.name[0]}</div>
          <div className="grow"><b>{p.user.name}</b><small>{p.user.email}</small></div>
          <i className={'role ' + p.role}>{p.role}{p.role === 'viewer' && !p.canDownload ? ', view only' : ''}</i>
          {p.expiresAt && <small className="warn">expires {fmtDate(p.expiresAt)}</small>}
          <button className="icon-btn danger" title="Remove access" onClick={() => run(() => api.delete(`/files/${id}/share/${p.user._id}`), 'Access removed')}><X size={17} /></button></div>))}
    </section>
  );
}

function LinksPanel({ f, run, id }) {
  const [form, setForm] = useState({ password: '', expiresInHours: 24, maxDownloads: '' });
  const url = (t) => `${location.origin}/s/${t}`;
  return (
    <section className="panel">
      <form className="share-form" onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/files/${id}/links`, form), 'Share link created'); }}>
        <label className="chk">Valid for<select value={form.expiresInHours} onChange={(e) => setForm({ ...form, expiresInHours: e.target.value })}>
          <option value={1}>1 hour</option><option value={24}>24 hours</option><option value={168}>7 days</option><option value={720}>30 days</option></select></label>
        <input type="password" placeholder="Password (optional)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <input type="number" min="1" placeholder="Max downloads" value={form.maxDownloads} onChange={(e) => setForm({ ...form, maxDownloads: e.target.value })} />
        <button className="btn primary">Create link</button>
      </form>
      <p className="hint">Anyone with a link can download the current version, even without an account. Use a password and a download limit for sensitive files.</p>
      {f.links.length === 0 ? <p className="muted">No links yet.</p> : f.links.map((l) => (
        <div className={'row' + (l.revoked ? ' dim' : '')} key={l.token}>
          <Link2 size={17} className="muted" /><div className="grow"><b className="mono">{url(l.token).replace(/(.{38}).+/, '$1…')}</b>
            <small>{l.revoked ? 'Revoked' : `Expires ${fmtDate(l.expiresAt)}`} · {l.downloads}{l.maxDownloads ? `/${l.maxDownloads}` : ''} downloads{l.hasPassword && ' · password protected'}</small></div>
          {!l.revoked && <><button className="icon-btn" title="Copy link" onClick={() => { navigator.clipboard.writeText(url(l.token)); toast('Link copied'); }}><Copy size={17} /></button>
            <button className="btn sm danger-o" onClick={() => run(() => api.delete(`/files/${id}/links/${l.token}`), 'Link revoked')}>Revoke</button></>}</div>))}
    </section>
  );
}
