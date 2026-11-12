<?php
/* =====================================================================
 *  O'yin xulosasi - ulashish sahifasi: mmb.boost-top.com/g.php?g=<id>
 *  Telegram/Instagram'da havola karta rasmi (gcard.php), sarlavha va "cssborka.uz/xclient" bilan ko'rinadi.
 *  Sahifada: karta, "X CLIENT ni yuklab olish" (cssborka.uz/xclient) va taklif kodi (ulashgan o'yinchining logini).
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
$id = preg_replace('/[^a-f0-9]/', '', isset($_GET['g']) ? (string)$_GET['g'] : '');
$g = strlen($id) === 12 ? rd('gs/' . $id, null) : null;
if (!$g) { header('HTTP/1.1 404 Not Found'); echo 'Topilmadi'; exit; }
$k = (int)$g['k']; $d = (int)$g['d']; $kd = $d ? round($k / $d, 2) : $k;
$host = 'https://' . (isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^a-z0-9.\-:]/i', '', $_SERVER['HTTP_HOST']) : 'mmb.boost-top.com');
$img = $host . '/gcard.php?g=' . $id;
$dl = 'https://cssborka.uz/xclient';
$title = $g['name'] . ': ' . $k . ' kill · K/D ' . $kd . ' — X CLIENT · CS 1.6';
$desc = 'Bepul CS 1.6 launcher: aniq tegish, lagsiz, botlar va LAN. Yuklab olish: cssborka.uz/xclient';
$ref = strtolower(preg_replace('/[^A-Za-z0-9_]/', '', isset($g['login']) ? $g['login'] : ''));
?><!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= h($title) ?></title>
<meta property="og:title" content="<?= h($title) ?>"><meta property="og:description" content="<?= h($desc) ?>">
<meta property="og:image" content="<?= h($img) ?>"><meta property="og:image:width" content="1080"><meta property="og:image:height" content="1080">
<meta property="og:url" content="<?= h($host . '/g.php?g=' . $id) ?>"><meta property="og:site_name" content="cssborka.uz/xclient">
<meta name="twitter:card" content="summary_large_image">
<style>
body{margin:0;background:#0d0a0e;color:#eee;font:16px/1.5 system-ui,Segoe UI,Arial,sans-serif;padding:16px}
.w{max-width:560px;margin:0 auto;text-align:center}
img.c{width:100%;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.6)}
a.b{display:block;margin:18px 0 10px;padding:16px;border-radius:12px;background:#e33;color:#fff;font-weight:800;font-size:20px;text-decoration:none}
.code{display:inline-block;margin-top:6px;padding:8px 16px;border:1px dashed #ff9a39;border-radius:8px;color:#ffcf9a;font-size:20px;font-weight:700;user-select:all}
p{color:#c9b7bd}
</style></head><body><div class="w">
<img class="c" src="<?= h($img) ?>" alt="<?= h($title) ?>">
<a class="b" href="<?= h($dl) ?>">X CLIENT ni bepul yuklab olish — cssborka.uz/xclient</a>
<p>CS 1.6 uchun launcher: aniq tegish, lagni o'zi tuzatadi, botlar bilan mashq, do'stlar bilan LAN, F10 video, F11 skrinshot.</p>
<?php if ($ref !== ''): ?><p>Taklif kodi (kiritsangiz ikkalangiz ham XP olasiz):<br><span class="code"><?= h($ref) ?></span></p><?php endif; ?>
</div></body></html>
