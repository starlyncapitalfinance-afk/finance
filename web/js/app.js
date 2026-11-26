/* bootstrap */
window.THEMES = [
  { id: 'ocean',    name: 'Ocean',    brand: '#5B6CF0', accent: '#10B9A7' },
  { id: 'emerald',  name: 'Emerald',  brand: '#0F9D7A', accent: '#F59E0B' },
  { id: 'royal',    name: 'Royal',    brand: '#7C3AED', accent: '#EC4899' },
  { id: 'sunset',   name: 'Sunset',   brand: '#F97316', accent: '#E11D48' },
  { id: 'azure',    name: 'Azure',    brand: '#0EA5E9', accent: '#6366F1' },
  { id: 'midnight', name: 'Midnight', brand: '#6D83FF', accent: '#2DD4BF', dark: true },
];
window.getTheme = () => localStorage.getItem('jlg_theme') || 'ocean';
window.setTheme = (th) => {
  localStorage.setItem('jlg_theme', th);
  document.documentElement.dataset.theme = th;
};
// apply saved theme as early as possible to avoid a flash
try { document.documentElement.dataset.theme = window.getTheme(); } catch (e) {}

(async () => {
  await Core.openDB();
  Core.Auth.load();
  UI.mount();
  if (Sync.configured()) Sync.run();
})();
