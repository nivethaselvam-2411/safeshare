import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { UploadCloud, Search, Trash2, RotateCcw, Share2, FolderOpen, Loader2 } from 'lucide-react';
import api, { errMsg, fmtSize, ago } from '../api';
import { Empty, FileIcon, Modal, toast } from '../components/ui';

const TITLES = { mine: ['My files', 'Documents you own.'], shared: ['Shared with me', 'Documents others have given you access to.'], trash: ['Trash', 'Deleted files stay here until you remove them for good.'] };

export default function Files({ scope }) {
  const [files, setFiles] = useState(null); const [q, setQ] = useState(''); const [params, setParams] = useSearchParams();
  const [drag, setDrag] = useState(false); const [up, setUp] = useState(null); const input = useRef();
  const load = useCallback(() => api.get('/files', { params: { scope, q } }).then((r) => setFiles(r.data)), [scope, q]);
  useEffect(() => { setFiles(null); const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  useEffect(() => { if (params.get('upload')) { input.current?.click(); setParams({}); } }, [params, setParams]);

  const upload = async (list) => {
    for (const file of list) {
      const fd = new FormData(); fd.append('file', file); setUp(file.name);
      try { await api.post('/files', fd); toast(`${file.name} encrypted and saved`); } catch (e) { toast(await errMsg(e), true); }
    }
    setUp(null); load();
  };
  const act = async (fn, msg) => { try { await fn(); toast(msg); load(); } catch (e) { toast(await errMsg(e), true); } };
  const [confirm, setConfirm] = useState(null);

  return (
    <div onDragOver={(e) => { if (scope === 'mine') { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (scope === 'mine') upload([...e.dataTransfer.files]); }}>
      <header className="page-h"><div><h1>{TITLES[scope][0]}</h1><p>{TITLES[scope][1]}</p></div>
        {scope === 'mine' && <><button className="btn primary" onClick={() => input.current.click()}><UploadCloud size={17} />Upload files</button>
          <input ref={input} type="file" multiple hidden onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }} /></>}</header>
      <div className="search"><Search size={17} /><input placeholder="Search by file name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {scope === 'mine' && <div className={'drop' + (drag ? ' on' : '')}>{up ? <><Loader2 className="spin" size={18} />Encrypting {up}…</> : <><UploadCloud size={18} />Drop files here. They are encrypted before they are stored.</>}</div>}
      {!files ? <div className="splash"><div className="spinner" /></div> : files.length === 0 ? (
        <Empty icon={FolderOpen} title={scope === 'trash' ? 'Trash is empty' : q ? 'No files match that search' : scope === 'shared' ? 'Nothing shared with you yet' : 'No files yet'}
          text={scope === 'mine' ? 'Upload your first document to start sharing it securely.' : 'Files will appear here.'} />
      ) : (
        <div className="table">
          <div className="tr th"><span>Name</span><span>Owner</span><span>Your access</span><span>Size</span><span>Updated</span><span /></div>
          {files.map((f) => (
            <div className="tr" key={f._id}>
              <span className="name">{scope === 'trash' ? <><FileIcon name={f.name} /><b>{f.name}</b></> : <Link to={`/files/${f._id}`}><FileIcon name={f.name} /><b>{f.name}</b></Link>}
                <small>v{f.currentVersion}{f.sharedCount > 0 && <> · <Share2 size={11} /> {f.sharedCount}</>}</small></span>
              <span>{f.owner.name}</span>
              <span><i className={'role ' + f.access.role}>{f.access.role}{f.access.role === 'viewer' && !f.access.canDownload ? ', view only' : ''}</i></span>
              <span>{fmtSize(f.size)}</span><span>{ago(f.updatedAt)}</span>
              <span className="acts">{scope === 'trash' ? <>
                <button className="icon-btn" title="Restore" onClick={() => act(() => api.post(`/files/${f._id}/restore`), 'File restored')}><RotateCcw size={17} /></button>
                <button className="icon-btn danger" title="Delete forever" onClick={() => setConfirm(f)}><Trash2 size={17} /></button></>
                : f.access.role === 'owner' && <button className="icon-btn" title="Move to trash" onClick={() => act(() => api.delete(`/files/${f._id}`), 'Moved to trash')}><Trash2 size={17} /></button>}</span>
            </div>))}
        </div>)}
      {confirm && <Modal title="Delete forever?" onClose={() => setConfirm(null)}>
        <p className="muted">This permanently destroys the encrypted data for <b>{confirm.name}</b> and all {confirm.versionCount} versions. It cannot be undone.</p>
        <div className="modal-f"><button className="btn" onClick={() => setConfirm(null)}>Keep file</button>
          <button className="btn danger" onClick={() => { act(() => api.delete(`/files/${confirm._id}/permanent`), 'File permanently deleted'); setConfirm(null); }}>Delete forever</button></div></Modal>}
    </div>
  );
}
