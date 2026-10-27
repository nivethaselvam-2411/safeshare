import { useEffect, useState } from 'react';
import { File, FileText, FileImage, FileSpreadsheet, FileJson, X, CheckCircle2, AlertTriangle } from 'lucide-react';

export function FileIcon({ name = '', size = 22 }) {
  const e = name.split('.').pop().toLowerCase();
  const [Icon, c] = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(e) ? [FileImage, '#0f9d8a']
    : ['csv', 'xlsx', 'xls'].includes(e) ? [FileSpreadsheet, '#1f9d55'] : ['json'].includes(e) ? [FileJson, '#d98a00']
    : ['pdf'].includes(e) ? [FileText, '#d6455d'] : ['md', 'txt', 'doc', 'docx'].includes(e) ? [FileText, '#4a5af0'] : [File, '#6b7390'];
  return <span className="ficon" style={{ color: c, background: c + '1a' }}><Icon size={size} /></span>;
}
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', h); return () => removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <header><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
        {children}
      </div>
    </div>
  );
}
let push; export const toast = (msg, bad) => push?.({ msg, bad, id: Math.random() });
export function Toaster() {
  const [list, setList] = useState([]);
  useEffect(() => { push = (t) => { setList((l) => [...l, t]); setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 3800); }; return () => { push = null; }; }, []);
  return <div className="toasts">{list.map((t) => <div key={t.id} className={'toast' + (t.bad ? ' bad' : '')}>{t.bad ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}{t.msg}</div>)}</div>;
}
export const Empty = ({ icon: I, title, text, children }) => (
  <div className="empty"><I size={34} /><h4>{title}</h4><p>{text}</p>{children}</div>
);
export const ACTIONS = {
  'auth.login': ['Signed in', 'ok'], 'auth.register': ['Created account', 'ok'], 'auth.login_failed': ['Failed sign-in', 'bad'],
  'file.upload': ['Uploaded & encrypted', 'ok'], 'file.view': ['Opened file', 'mute'], 'file.download': ['Downloaded', 'info'],
  'file.version_upload': ['Added new version', 'ok'], 'file.version_restore': ['Restored version', 'info'],
  'file.share': ['Shared access', 'info'], 'file.unshare': ['Removed access', 'warn'], 'link.create': ['Created share link', 'info'],
  'link.revoke': ['Revoked share link', 'warn'], 'link.download': ['Link download', 'info'], 'link.bad_password': ['Wrong link password', 'bad'],
  'file.trash': ['Moved to trash', 'warn'], 'file.restore': ['Restored from trash', 'ok'], 'file.delete': ['Permanently deleted', 'bad'],
  'access.denied': ['Access denied', 'bad'], 'admin.user_update': ['Updated a user', 'warn'],
};
export const Pill = ({ action }) => { const [t, k] = ACTIONS[action] || [action, 'mute']; return <span className={'pill ' + k}>{t}</span>; };
