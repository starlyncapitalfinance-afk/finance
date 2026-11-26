/* Save/share a generated file. In the APK (Capacitor) uses Filesystem+Share
   (browser downloads don't work inside the webview); on web does a download. */
async function saveOrShare(filename, base64, mime) {
  const native = window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
  if (native && Capacitor.Plugins && Capacitor.Plugins.Filesystem) {
    try {
      const { Filesystem, Share } = Capacitor.Plugins;
      await Filesystem.writeFile({ path: filename, data: base64, directory: 'CACHE' });
      const { uri } = await Filesystem.getUri({ path: filename, directory: 'CACHE' });
      if (Share && Share.share) {
        try { await Share.share({ title: filename, url: uri }); } catch (e) {}
      }
      return true;
    } catch (e) { /* fall through to web download */ }
  }
  // web download
  try {
    const bin = atob(base64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch (e) { return false; }
}
window.saveOrShare = saveOrShare;
