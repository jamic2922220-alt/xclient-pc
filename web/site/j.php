<?php
/* X CLIENT: serverga bir bosishda kirish havolasi (Telegram bot "Kirish" tugmasi): mmb.boost-top.com/j.php?s=IP:PORT
 * Sahifa xclient://connect/IP:PORT ni ochadi - X CLIENT (1.0.180+) o'zi ishga tushib, serverga ulanadi.
 * X CLIENT o'rnatilmagan bo'lsa - yuklab olish havolasi va IP (nusxalash uchun). */
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
$s = isset($_GET['s']) ? trim((string)$_GET['s']) : '';
if (!preg_match('/^[A-Za-z0-9.\-]{3,64}:\d{2,5}$/', $s)) $s = '';
function h($x) { return htmlspecialchars((string)$x, ENT_QUOTES, 'UTF-8'); }
$url = $s !== '' ? 'xclient://connect/' . $s : '';
?><!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>X CLIENT — serverga kirish</title>
<style>
:root{--bg:#141117;--card:#1e1a22;--fg:#f2eef5;--mut:#a59cae;--acc:#e5333f}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,Segoe UI,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.c{background:var(--card);border-radius:16px;padding:28px 24px;max-width:440px;width:100%;text-align:center;box-shadow:0 10px 40px #0008}
h1{font-size:22px;margin:0 0 6px}.m{color:var(--mut);font-size:14px}
.ip{font:700 22px ui-monospace,Consolas,monospace;margin:18px 0;padding:12px;border-radius:10px;background:#0006;letter-spacing:.5px;word-break:break-all}
a.b,button{display:block;width:100%;box-sizing:border-box;padding:14px;border-radius:10px;border:0;font:600 16px system-ui,Arial;text-decoration:none;cursor:pointer;margin-top:10px}
.p{background:var(--acc);color:#fff}.s{background:#ffffff14;color:var(--fg)}
</style></head><body><div class="c">
<?php if ($s === ''): ?>
<h1>Manzil noto'g'ri</h1><p class="m">Havola buzilgan. Telegram botda «🎮 Serverlar» ni qayta bosing.</p>
<?php else: ?>
<h1>X CLIENT ochilmoqda...</h1>
<p class="m">Brauzer «X CLIENT ni ochish» deb so'rasa - <b>Ochish / Открыть</b> ni bosing.</p>
<div class="ip" id="ip"><?= h($s) ?></div>
<a class="b p" href="<?= h($url) ?>">▶ Serverga kirish</a>
<button class="s" id="cp" type="button">IP ni nusxalash</button>
<p class="m" style="margin-top:18px">X CLIENT yo'qmi yoki ochilmadimi? <a href="https://cssborka.uz/xclient" style="color:#ff6b75">Yuklab oling</a> (bepul) yoki o'yin konsoliga yozing:<br><code>connect <?= h($s) ?></code></p>
<script>
setTimeout(function(){ location.href = <?= json_encode($url) ?>; }, 300);
document.getElementById('cp').onclick = function () {
  var t = <?= json_encode($s) ?>, b = this;
  function ok(){ b.textContent = 'Nusxalandi ✓'; }
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, function(){}); else { var r = document.createRange(); r.selectNode(document.getElementById('ip')); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); ok(); }
};
</script>
<?php endif; ?>
</div></body></html>
