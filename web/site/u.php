<?php
/* =====================================================================
 *  O'yinchi profili (ulashish uchun): mmb.boost-top.com/u.php?u=login
 *  Telegram/Instagram'da havola profil kartasi (card.php) rasmi bilan ko'rinadi.
 *  Pastda - X CLIENT ni yuklab olish va taklif kodi (yangi o'yinchi kiritsa, ikkalasi ham XP oladi).
 * ===================================================================== */
define('XC_DIR', __DIR__ . '/xc_data');
define('XC_GUARD', "<?php exit; ?>\n");
function rd($name, $def) {
    $f = XC_DIR . '/' . $name . '.php';
    if (!is_file($f)) return $def;
    $j = json_decode(substr((string)@file_get_contents($f), strlen(XC_GUARD)), true);
    return is_array($j) ? $j : $def;
}
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
$login = strtolower(preg_replace('/[^A-Za-z0-9_]/', '', isset($_GET['u']) ? $_GET['u'] : ''));
$u = $login !== '' ? rd('users/' . $login, null) : null;
if (!$u) { header('HTTP/1.1 404 Not Found'); echo 'Topilmadi'; exit; }
$st = isset($u['st']) ? $u['st'] : array();
$k = (int)@$st['k']; $d = (int)@$st['d']; $kd = $d ? round($k / $d, 2) : $k;
$lvl = (int)floor((int)$u['xp'] / 1000) + 1;
$host = 'http://' . (isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^a-z0-9.\-:]/i', '', $_SERVER['HTTP_HOST']) : 'mmb.boost-top.com');
$card = $host . '/card.php?u=' . $login . '&t=' . (int)(time() / 1800);
$title = $u['name'] . ' - X CLIENT · CS 1.6';
$desc = $k . ' kill · K/D ' . $kd . ' · ' . $lvl . '-daraja. X CLIENT ni bepul yuklab oling - taklif kodi: ' . $u['login'];
?><!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= h($title) ?></title>
<meta property="og:title" content="<?= h($title) ?>"><meta property="og:description" content="<?= h($desc) ?>">
<meta property="og:image" content="<?= h($card) ?>"><meta property="og:image:width" content="1080"><meta property="og:image:height" content="1080">
<meta name="twitter:card" content="summary_large_image">
<style>
body{margin:0;background:#0d0a0e;color:#eee;font:16px/1.5 system-ui,Segoe UI,Arial,sans-serif;padding:16px}
.w{max-width:560px;margin:0 auto;text-align:center}
img.c{width:100%;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.6)}
a.b{display:block;margin:18px 0 10px;padding:16px;border-radius:12px;background:#e33;color:#fff;font-weight:800;font-size:20px;text-decoration:none}
.code{display:inline-block;margin-top:6px;padding:8px 16px;border:1px dashed #ff9a39;border-radius:8px;color:#ffcf9a;font-size:20px;font-weight:700;user-select:all}
p{color:#c9b7bd}
</style></head><body><div class="w">
<img class="c" src="<?= h($card) ?>" alt="<?= h($u['name']) ?>">
<a class="b" href="https://cssborka.uz/xclient/">X CLIENT ni bepul yuklab olish</a>
<p>Ro'yxatdan o'tgach menyuda <b>Sozlamalar → Akkaunt → Taklif kodi</b> ga shu kodni yozing - ikkalangiz ham XP olasiz:</p>
<div class="code"><?= h($u['login']) ?></div>
</div></body></html>
