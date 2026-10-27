import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderLock, Share2, Trash2, ScrollText, Users, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth';

export default function Layout() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  const items = [
    ['/', 'Overview', LayoutDashboard, true], ['/files', 'My files', FolderLock], ['/shared', 'Shared with me', Share2],
    ['/trash', 'Trash', Trash2], ['/audit', 'Activity log', ScrollText], ...(user.role === 'admin' ? [['/admin', 'People', Users]] : []),
  ];
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><ShieldCheck size={26} /><span>SafeShare</span></div>
        <nav>
          {items.map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav' + (isActive ? ' on' : '')}><Icon size={18} />{label}</NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="seal"><ShieldCheck size={15} /> Files encrypted at rest</div>
          <div className="me">
            <div className="avatar">{user.name[0]}</div>
            <div className="me-t"><b>{user.name}</b><small>{user.role === 'admin' ? 'Administrator' : 'Member'}</small></div>
            <button className="icon-btn dark" title="Sign out" onClick={() => { logout(); nav('/login'); }}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
