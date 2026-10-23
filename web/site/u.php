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
$ACH = array('k100' => '100 kill', 'k1000' => '1000 kill', 'k5000' => 'Afsona', 'best30' => 'Mashina', 'g100' => 'Faxriy', 't10h' => '10 soat', 't50h' => '50 soat', 'awp100' => 'AWP ustasi', 'ak500' => 'AK qiroli', 'knife10' => 'Pichoq', 'deagle100' => 'Deagle', 'fr5' => 'Do\'stona', 'ref3' => 'Taklifchi', 'champ' => 'Chempion', 'clan' => 'Klan', 'k10000' => 'Qiyomat', 'best50' => 'Terminator', 'g500' => 'Veteran', 't100h' => '100 soat', 'fr20' => 'Mashhur', 'streak7' => 'Sodiq', 'srv10' => 'Sayyoh', 'wall10' => 'Sevimli');
function ago_uz($t) { if (!$t) return 'uzoq vaqt oldin'; $d = time() - $t; if ($d < 150) return 'hozir onlayn'; if ($d < 3600) return floor($d / 60) . ' daqiqa oldin'; if ($d < 86400) return floor($d / 3600) . ' soat oldin'; return floor($d / 86400) . ' kun oldin'; }
$seen = isset($u['seen']) ? (int)$u['seen'] : 0; $online = $seen && time() - $seen < 150;
$wall = isset($u['wall']) ? array_reverse(array_slice($u['wall'], -5)) : array();
$hours = round((int)@$st['t'] / 3600, 1);
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
.st{display:flex;gap:8px;margin:16px 0 6px}.st div{flex:1;min-width:0;padding:10px 4px;background:#1b1418;border:1px solid #3a2a30;border-radius:10px;color:#c9b7bd;font-size:13px}.st b{display:block;font-size:22px;color:#fff}
.act{margin:8px 0}.on{color:#3ccf4e}h3{margin:20px 0 8px;text-align:left;color:#ff9a39;font-size:15px;letter-spacing:1px;text-transform:uppercase}
.ach{text-align:left}.ach span{display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border:1px solid #6a5420;border-radius:14px;color:#ffd27a;font-size:13px}
.wl{text-align:left;padding:8px 12px;margin-bottom:6px;background:#1b1418;border-left:3px solid #e33;border-radius:4px}.wl small{color:#8f7d84}.wl div{color:#ddd;margin-top:2px}
</style></head><body><div class="w">
<img class="c" src="<?= h($card) ?>" alt="<?= h($u['name']) ?>">
<div class="st"><div><b><?= $k ?></b>kill</div><div><b><?= $kd ?></b>K/D</div><div><b><?= (int)@$st['g'] ?></b>o'yin</div><div><b><?= $hours ?></b>soat</div></div>
<p class="act"><?= $online ? '<span class="on">●</span> Hozir onlayn' . (!empty($u['server']) ? ' - serverda o\'ynayapti' : '') : 'Oxirgi faollik: ' . h(ago_uz($seen)) ?><?= !empty($u['clan']['tag']) ? ' · klan <b>[' . h($u['clan']['tag']) . ']</b>' : '' ?> · <?= $lvl ?>-daraja</p>
<?php if (!empty($u['ach'])): ?><h3>Yutuqlar (<?= count($u['ach']) ?>)</h3><div class="ach"><?php foreach ($u['ach'] as $id => $t) echo '<span>★ ' . h(isset($ACH[$id]) ? $ACH[$id] : $id) . '</span>'; ?></div><?php endif; ?>
<?php if ($wall): ?><h3>Devor</h3><?php foreach ($wall as $w) echo '<div class="wl"><b>' . h($w['name']) . '</b> <small>' . h(ago_uz($w['t'])) . '</small><div>' . h($w['text']) . '</div></div>'; ?><?php endif; ?>
<a class="b" href="https://cssborka.uz/xclient/">X CLIENT ni bepul yuklab olish</a>
<p>Ro'yxatdan o'tgach menyuda <b>Sozlamalar → Akkaunt → Taklif kodi</b> ga shu kodni yozing - ikkalangiz ham XP olasiz:</p>
<div class="code"><?= h($u['login']) ?></div>
</div></body></html>
