// Apply the saved theme before first paint (no flash). Kept as a file for the CSP.
try {
  var t = localStorage.getItem('fuel:theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch {
  // storage unavailable: follow the system theme
}
