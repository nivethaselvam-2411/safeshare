import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';
const Ctx = createContext();
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem('ss_token')) return setReady(true);
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => localStorage.removeItem('ss_token')).finally(() => setReady(true));
  }, []);
  const finish = (d) => { localStorage.setItem('ss_token', d.token); setUser(d.user); };
  const login = async (email, password) => finish((await api.post('/auth/login', { email, password })).data);
  const register = async (name, email, password) => finish((await api.post('/auth/register', { name, email, password })).data);
  const logout = () => { localStorage.removeItem('ss_token'); setUser(null); };
  return <Ctx.Provider value={{ user, ready, login, register, logout }}>{children}</Ctx.Provider>;
}
