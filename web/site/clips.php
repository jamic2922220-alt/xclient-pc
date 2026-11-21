<?php
/* X CLIENT o'yinchilari ulashgan kliplar (menyu -> Demo -> "Ulashish"). ?v=<id> - bitta klip katta oynada */
header('Content-Type: text/html; charset=utf-8');
function c_rd() {
    $s = @file_get_contents(__DIR__ . '/xc_data/clips.php');
    if ($s === false) return array();
    $j = json_decode(substr($s, strlen("<?php exit; ?>\n")), true);
    return is_array($j) ? $j : array();
}
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function ago($t) {
    $d = time() - $t;
    if ($d < 3600) return max(1, (int)($d / 60)) . ' daq. oldin';
    if ($d < 86400) return (int)($d / 3600) . ' soat oldin';
    return date('d.m.Y', $t);
}
$all = array();
foreach (c_rd() as $c) if (isset($c['id']) && preg_match('/^[a-f0-9]{12}$/', $c['id']) && is_file(__DIR__ . '/clips/' . $c['id'] . '.mp4')) $all[] = $c;
$v = isset($_GET['v']) ? preg_replace('/[^a-f0-9]/', '', (string)$_GET['v']) : '';
$cur = null;
foreach ($all as $c) if ($c['id'] === $v) $cur = $c;
$host = 'https://mmb.boost-top.com';
$title = $cur ? $cur['name'] . ' — X CLIENT klip' : 'X CLIENT kliplar';
?><!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($title) ?></title>
<?php if ($cur): ?>
<meta property="og:title" content="<?= h($title) ?>"><meta property="og:type" content="video.other">
<meta property="og:video" content="<?= h($host . '/clips/' . $cur['id'] . '.mp4') ?>"><meta property="og:video:type" content="video/mp4">
<?php endif; ?>
<style>
:root { --bg: #0d0a10; --card: #17121b; --line: #2a2026; --fg: #f1ecef; --mut: #8f8590; --red: #ff3b3b; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 "Segoe UI", system-ui, sans-serif; }
.w { max-width: 1100px; margin: 0 auto; padding: 24px max(16px, env(safe-area-inset-left, 0px)); }
header { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
header img { width: 44px; height: 44px; }
header b { font-size: 22px; letter-spacing: 1px; } header b span { color: var(--red); }
header a.dl { margin-left: auto; color: #fff; background: var(--red); padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 600; }
.big { background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; margin-bottom: 26px; }
.big video { width: 100%; max-height: 70vh; background: #000; display: block; }
.big .m { padding: 12px 16px; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color: var(--red); margin: 0 0 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.c { background: var(--card); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; color: inherit; text-decoration: none; }
.c:hover { border-color: var(--red); }
.c video { width: 100%; aspect-ratio: 16 / 9; background: #000; display: block; object-fit: cover; }
.c .m { padding: 8px 10px; min-width: 0; }
.n { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mut { color: var(--mut); font-size: 13px; }
.empty { color: var(--mut); padding: 40px 0; text-align: center; }
</style></head><body><div class="w">
<header><img src="logo.png" alt=""><b><span>X</span> CLIENT · kliplar</b><a class="dl" href="yuklab.html">X CLIENT yuklab olish</a></header>
<?php if ($cur): ?>
<div class="big"><video src="clips/<?= h($cur['id']) ?>.mp4" controls autoplay playsinline preload="metadata"></video>
<div class="m"><div class="n"><?= h($cur['name']) ?></div><div class="mut"><?= h(($cur['srv'] !== '' ? $cur['srv'] . ' · ' : '') . ago($cur['t'])) ?></div></div></div>
<?php endif; ?>
<h2>So'nggi kliplar</h2>
<?php if (!$all): ?><div class="empty">Hali klip yo'q. O'yinda F9 yoki F10 bilan yozing va menyudagi "Ulashish" tugmasini bosing.</div><?php else: ?>
<div class="grid">
<?php foreach (array_slice($all, 0, 60) as $c): ?>
<a class="c" href="?v=<?= h($c['id']) ?>"><video src="clips/<?= h($c['id']) ?>.mp4#t=1" preload="metadata" muted playsinline></video>
<div class="m"><div class="n"><?= h($c['name']) ?></div><div class="mut"><?= h(($c['sec'] ? floor($c['sec'] / 60) . ':' . str_pad($c['sec'] % 60, 2, '0', STR_PAD_LEFT) . ' · ' : '') . ago($c['t'])) ?></div></div></a>
<?php endforeach; ?>
</div>
<?php endif; ?>
</div></body></html>
