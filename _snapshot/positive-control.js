// Positive-control fixture. Every line here is a token the detector MUST find.
// If the grep below reports fewer than one hit per distinct token, the detector
// is broken and a "clean" result on the real files means nothing.
const a = fetch('https://x.example/y');
const b = new XMLHttpRequest();
const c = new WebSocket('wss://x.example');
try { localStorage.setItem('k', 'v'); sessionStorage.clear(); } catch (e) {}
try { navigator.clipboard.writeText('z'); indexedDB.open('db'); } catch (e) {}
window.showOpenFilePicker && window.showOpenFilePicker();
navigator.serviceWorker.register('/sw.js');
document.cookie = 'sid=1';
eval('1+1');
new Function('return 1');
el.innerHTML = '<b>x</b>';
document.write('<p>');
setTimeout(fn, 10); setInterval(fn, 10);
alert('hi');
new Notification('hi');
const u = 'http://x.example/1';
const s = '<script src="http://x.example/e.js"><\/script>';
