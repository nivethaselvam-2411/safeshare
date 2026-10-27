import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });
api.interceptors.request.use((c) => { const t = localStorage.getItem('ss_token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401 && !location.pathname.startsWith('/login') && !location.pathname.startsWith('/s/')) {
    localStorage.removeItem('ss_token'); location.href = '/login';
  }
  return Promise.reject(e);
});
export const errMsg = async (e) => {
  const d = e.response?.data;
  if (d instanceof Blob) { try { return JSON.parse(await d.text()).message; } catch { /* fallthrough */ } }
  return d?.message || 'Could not reach the server';
};
export async function saveBlob(url, filename, method = 'get', body) {
  const res = await api.request({ url, method, data: body, responseType: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(res.data); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const fmtSize = (b = 0) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
export const fmtDate = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export const ago = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`;
};
export default api;
