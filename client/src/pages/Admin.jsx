import { useEffect, useState, useCallback } from 'react';
import api, { errMsg, fmtDate } from '../api';
import { toast } from '../components/ui';

export default function Admin() {
  const [users, setUsers] = useState(null);
  const load = useCallback(() => api.get('/users').then((r) => setUsers(r.data)), []);
  useEffect(() => { load(); }, [load]);
  const patch = async (u, body, msg) => { try { await api.patch(`/users/${u._id}`, body); toast(msg); load(); } catch (e) { toast(await errMsg(e), true); } };
  if (!users) return <div className="splash"><div className="spinner" /></div>;
  return (
    <>
      <header className="page-h"><div><h1>People</h1><p>Manage who can sign in. Admins manage accounts and read the audit log, but cannot open other people's files.</p></div></header>
      <div className="table users">
        <div className="tr th"><span>Person</span><span>Role</span><span>Files</span><span>Last sign-in</span><span>Status</span><span /></div>
        {users.map((u) => (
          <div className="tr" key={u._id}>
            <span className="name"><div className="avatar sm">{u.name[0]}</div><span><b>{u.name}</b><small>{u.email}</small></span></span>
            <span><i className={'role ' + (u.role === 'admin' ? 'owner' : 'viewer')}>{u.role}</i></span><span>{u.files}</span>
            <span><small>{u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'Never'}</small></span>
            <span><i className={'role ' + (u.disabled ? 'off' : 'editor')}>{u.disabled ? 'disabled' : 'active'}</i></span>
            <span className="acts">
              <button className="btn sm" onClick={() => patch(u, { role: u.role === 'admin' ? 'member' : 'admin' }, `${u.name} is now ${u.role === 'admin' ? 'a member' : 'an admin'}`)}>{u.role === 'admin' ? 'Make member' : 'Make admin'}</button>
              <button className={'btn sm ' + (u.disabled ? '' : 'danger-o')} onClick={() => patch(u, { disabled: !u.disabled }, u.disabled ? 'Account enabled' : 'Account disabled')}>{u.disabled ? 'Enable' : 'Disable'}</button></span>
          </div>))}
      </div>
    </>
  );
}
