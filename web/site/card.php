<?php
/* =====================================================================
 *  O'yinchi profil kartasi (PNG 1080x1080): card.php?u=login
 *  Telegram/Instagram'ga ulashish uchun: daraja, kill, K/D, sevimli qurol, yutuqlar, klan.
 *  u.php sahifasi shu rasmni og:image qiladi - Telegram'da havola rasm bilan ko'rinadi.
 *  Shrift: img/card.otf (Inter, SIL Open Font License 1.1). Natija 30 daqiqa keshlanadi.
 * ===================================================================== */
define('XC_DIR', __DIR__ . '/xc_data');
define('XC_GUARD', "<?php exit; ?>\n");
function rd($name, $def) {
    $f = XC_DIR . '/' . $name . '.php';
    if (!is_file($f)) return $def;
    $j = json_decode(substr((string)@file_get_contents($f), strlen(XC_GUARD)), true);
    return is_array($j) ? $j : $def;
}
$login = strtolower(preg_replace('/[^A-Za-z0-9_]/', '', isset($_GET['u']) ? $_GET['u'] : ''));
$u = $login !== '' ? rd('users/' . $login, null) : null;
if (!$u || !function_exists('imagecreatetruecolor')) { header('HTTP/1.1 404 Not Found'); exit; }

@mkdir(XC_DIR . '/cards', 0755, true);
$cache = XC_DIR . '/cards/' . $login . '.png';
header('Content-Type: image/png');
header('Cache-Control: public, max-age=1800');
if (is_file($cache) && time() - filemtime($cache) < 1800) { readfile($cache); exit; }

$st = isset($u['st']) ? $u['st'] : array();
$k = (int)@$st['k']; $d = (int)@$st['d']; $kd = $d ? round($k / $d, 2) : $k;
$lvl = (int)floor((int)$u['xp'] / 1000) + 1;
$wpn = isset($st['wpn']) ? $st['wpn'] : array(); arsort($wpn); $fav = $wpn ? key($wpn) : '—';
$ach = isset($u['ach']) ? count($u['ach']) : 0;
$hours = round((int)@$st['t'] / 3600, 1);
$ch = rd('champ', array()); $isChamp = !empty($ch['login']) && $ch['login'] === $login;

$W = 1080; $H = 1080;
$im = imagecreatetruecolor($W, $H);
imagealphablending($im, true);
$font = __DIR__ . '/img/card.otf';
$c = function ($r, $g, $b, $a = 0) use ($im) { return imagecolorallocatealpha($im, $r, $g, $b, $a); };
// fon: qorong'i + qizil nur
for ($y = 0; $y < $H; $y++) { $t = $y / $H; imageline($im, 0, $y, $W, $y, $c((int)(22 - 10 * $t), (int)(10 - 4 * $t), (int)(14 - 6 * $t))); }
for ($r = 520; $r > 0; $r -= 8) imagefilledellipse($im, 860, 160, $r * 2, $r * 2, $c(200, 30, 40, 126));
imagefilledrectangle($im, 0, 0, 14, $H, $c(255, 59, 59));
$txt = function ($size, $x, $y, $col, $s, $center = false) use ($im, $font, $W) {
    if (!is_file($font)) { imagestring($im, 5, $center ? $W / 2 - strlen($s) * 4 : $x, $y - 14, $s, $col); return; }
    if ($center) { $b = imagettfbbox($size, 0, $font, $s); $x = (int)(($W - ($b[2] - $b[0])) / 2); }
    imagettftext($im, $size, 0, $x, $y, $col, $font, $s);
};
$white = $c(255, 255, 255); $red = $c(255, 59, 59); $org = $c(255, 154, 57); $mut = $c(200, 185, 192); $gold = $c(255, 205, 80);
$logo = @imagecreatefrompng(__DIR__ . '/spray_logo.png');
if ($logo) { imagecopyresampled($im, $logo, 70, 60, 0, 0, 120, 112, imagesx($logo), imagesy($logo)); imagedestroy($logo); }
$txt(40, 210, 135, $white, 'X CLIENT'); $txt(24, 212, 172, $red, 'COUNTER-STRIKE 1.6');
$name = (isset($u['clan']['tag']) ? '[' . $u['clan']['tag'] . '] ' : '') . $u['name'];
$txt(78, 70, 330, $white, mb_substr($name, 0, 18, 'UTF-8'));
$txt(30, 74, 390, $isChamp ? $gold : $org, ($isChamp ? 'HAFTA CHEMPIONI · ' : '') . $lvl . '-daraja · ID ' . $u['id']);
// 4 ta katta raqam
$box = function ($x, $y, $val, $lab) use ($im, $c, $txt, $white, $mut) {
    imagefilledrectangle($im, $x, $y, $x + 450, $y + 190, $c(255, 255, 255, 118));
    imagerectangle($im, $x, $y, $x + 450, $y + 190, $c(255, 90, 90, 90));
    $txt(72, $x + 34, $y + 110, $white, (string)$val);
    $txt(24, $x + 38, $y + 160, $mut, $lab);
};
$box(70, 450, $k, 'KILL'); $box(560, 450, $kd, 'K/D');
$box(70, 670, $hours . ' soat', "O'YNAGAN VAQT"); $box(560, 670, $fav, 'SEVIMLI QUROL');
$txt(28, 74, 935, $mut, 'Yutuqlar: ' . $ach . ' · Eng zo\'r o\'yin: ' . (int)@$st['best'] . ' kill');
imagefilledrectangle($im, 0, 980, $W, $H, $c(255, 59, 59));
$txt(34, 0, 1043, $white, 'cssborka.uz/xclient  ·  taklif kodi: ' . $u['login'], true);
imagepng($im, $cache, 6);
imagedestroy($im);
readfile($cache);
