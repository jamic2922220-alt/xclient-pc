<?php
/* =====================================================================
 *  O'yin xulosasi kartasi (PNG 1080x1080): gcard.php?g=<id>
 *  Menyudagi "O'yin xulosasi" -> "Ulashish": raqamlar saytdagi o'yin yozuvidan (xc_api.php gsshare), menyu aytganidan emas.
 *  Telegram kanalga shu rasm yuboriladi. Shrift: img/card.otf (card.php bilan bir xil).
 * ===================================================================== */
define('XC_DIR', __DIR__ . '/xc_data');
define('XC_GUARD', "<?php exit; ?>\n");
function rd($name, $def) {
    $f = XC_DIR . '/' . $name . '.php';
    if (!is_file($f)) return $def;
    $j = json_decode(substr((string)@file_get_contents($f), strlen(XC_GUARD)), true);
    return is_array($j) ? $j : $def;
}
$id = preg_replace('/[^a-f0-9]/', '', isset($_GET['g']) ? (string)$_GET['g'] : '');
$g = strlen($id) === 12 ? rd('gs/' . $id, null) : null;
if (!$g || !function_exists('imagecreatetruecolor')) { header('HTTP/1.1 404 Not Found'); exit; }

@mkdir(XC_DIR . '/gcards', 0755, true);
$cache = XC_DIR . '/gcards/' . $id . '.png';
header('Content-Type: image/png');
header('Cache-Control: public, max-age=86400');
if (is_file($cache)) { readfile($cache); exit; }

$k = (int)$g['k']; $d = (int)$g['d']; $kd = $d ? round($k / $d, 2) : $k; $hs = $k ? round((int)$g['h'] * 100 / $k) : 0;
$W = 1080; $H = 1080;
$im = imagecreatetruecolor($W, $H);
imagealphablending($im, true);
$font = __DIR__ . '/img/card.otf';
$c = function ($r, $gg, $b, $a = 0) use ($im) { return imagecolorallocatealpha($im, $r, $gg, $b, $a); };
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
$txt(40, 210, 135, $white, 'X CLIENT'); $txt(24, 212, 172, $red, "O'YIN XULOSASI");
$txt(72, 70, 320, $white, mb_substr($g['name'], 0, 18, 'UTF-8'));
$where = trim(mb_substr($g['srv'], 0, 34, 'UTF-8') . ($g['map'] !== '' ? ' · ' . $g['map'] : ''));
$txt(28, 74, 378, $org, ($where !== '' ? $where . ' · ' : '') . max(1, round($g['t'] / 60)) . ' daqiqa');
$box = function ($x, $y, $val, $lab) use ($im, $c, $txt, $white, $mut) {
    imagefilledrectangle($im, $x, $y, $x + 450, $y + 190, $c(255, 255, 255, 118));
    imagerectangle($im, $x, $y, $x + 450, $y + 190, $c(255, 90, 90, 90));
    $txt(72, $x + 34, $y + 110, $white, (string)$val);
    $txt(24, $x + 38, $y + 160, $mut, $lab);
};
$box(70, 430, $k, 'KILL'); $box(560, 430, $d, "O'LIM");
$box(70, 650, $kd, 'K/D'); $box(560, 650, $hs . '%', 'HEADSHOT');
$line = 'Eng uzun seriya: ' . (int)$g['bs'] . ($g['a'] ? ' · Assist: ' . (int)$g['a'] : '') . ($g['fav'] !== '' ? ' · ' . $g['fav'] : '');
$txt(30, 74, 915, ($k >= 25 || $kd >= 2) ? $gold : $mut, $line);
imagefilledrectangle($im, 0, 980, $W, $H, $c(255, 59, 59));
$txt(34, 0, 1043, $white, 'cssborka.uz/xclient  ·  X CLIENT bilan o\'ynang', true);
imagepng($im, $cache, 6);
imagedestroy($im);
readfile($cache);
