/* bootstrap */
(async () => {
  await Core.openDB();
  Core.Auth.load();
  UI.mount();
  if (Sync.configured()) Sync.run();
})();
