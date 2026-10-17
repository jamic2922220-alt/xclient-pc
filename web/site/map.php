<?php
/* =====================================================================
 *  X CLIENT — xarita rasmi:  map.php?m=de_dust2  ->  JPEG
 *  Rasmlar boost-top.com saytining o'zidagi media/maps/cs16/ papkasidan olinadi
 *  (avval diskdan, bo'lmasa sayt orqali), topilmasa GameTracker'dan; xc_data/maps/ ga keshlanadi.
 *  Tekshirish: map.php?m=de_dust2&debug=1
 * ===================================================================== */
$m = isset($_GET['m']) ? strtolower(trim($_GET['m'])) : '';
if (!preg_match('/^[a-z0-9_\-\.]{2,40}$/', $m) || strpos($m, '..') !== false) { header('HTTP/1.1 404 Not Found'); exit; }
$CACHE = __DIR__ . '/xc_data/maps';
$TYPES = array('jpg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif');

function send($file, $type) {
    header('Content-Type: ' . $type);
    header('Cache-Control: public, max-age=604800');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}
// 1) kesh
if (!isset($_GET['debug'])) foreach ($TYPES as $ext => $type) if (is_file("$CACHE/$m.$ext")) send("$CACHE/$m.$ext", $type);
if (!isset($_GET['debug']) && is_file("$CACHE/$m.none") && time() - filemtime("$CACHE/$m.none") < 86400) { header('HTTP/1.1 404 Not Found'); exit; }
// 2) saytning diski (mmb papkasi sayt ichida bo'lsa)
if (!isset($_GET['debug'])) foreach (array(__DIR__ . '/../media/maps/cs16', __DIR__ . '/media/maps/cs16') as $dir)
    foreach ($TYPES as $ext => $type) if (is_file("$dir/$m.$ext")) send("$dir/$m.$ext", $type);
// 3) internetdan yuklab olib keshlaymiz: avval boost-top.com, keyin GameTracker (minglab CS 1.6 xaritalari)
@mkdir($CACHE, 0755, true);
$DEBUG = isset($_GET['debug']);
if ($DEBUG) header('Content-Type: text/html; charset=utf-8');
function grab($url, &$info) {
    $info = '';
    if (!function_exists('curl_init')) { $d = @file_get_contents($url); $info = $d === false ? 'xato' : 'ok'; return $d; }
    $c = curl_init($url);
    curl_setopt_array($c, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0, CURLOPT_USERAGENT => 'Mozilla/5.0 XClient-map'));
    $d = curl_exec($c);
    $code = curl_getinfo($c, CURLINFO_HTTP_CODE); $ct = (string)curl_getinfo($c, CURLINFO_CONTENT_TYPE);
    $info = 'http ' . $code . ' ' . $ct . ($d === false ? ' ' . curl_error($c) : '');
    curl_close($c);
    return ($code == 200 && stripos($ct, 'image/') === 0) ? $d : false;
}
// GameTracker yo'q xarita uchun "rasm yo'q" degan rasm qaytaradi - uni bir marta aniqlab, rad etamiz
function gt_blank() {
    global $CACHE;
    $f = $CACHE . '/_gt_blank.txt';
    if (is_file($f) && time() - filemtime($f) < 7 * 86400) return trim(file_get_contents($f));
    $d = grab('https://image.gametracker.com/images/maps/160x120/cs/zz_xclient_no_such_map_' . mt_rand(1000, 9999) . '.jpg', $i);
    $h = $d ? md5($d) : '-';
    @file_put_contents($f, $h);
    return $h;
}
$SRC = array(
    array("https://boost-top.com/media/maps/cs16/$m.jpg", 'jpg'),
    array("https://boost-top.com/media/maps/cs16/$m.png", 'png'),
    array("https://image.gametracker.com/images/maps/160x120/cs/$m.jpg", 'jpg', 'gt'),
);
foreach ($SRC as $src) {
    $data = grab($src[0], $info);
    $ok = $data && strlen($data) > 500 && strlen($data) < 3000000 && @getimagesizefromstring($data);
    if ($ok && isset($src[2]) && md5($data) === gt_blank()) { $ok = false; $info .= ' (rasm yo\'q belgisi)'; }
    if ($DEBUG) echo $src[0] . ' -> ' . $info . ($ok ? '  OK' : '') . "<br>\n";
    if ($ok) {
        @file_put_contents("$CACHE/$m.{$src[1]}", $data, LOCK_EX);
        if ($DEBUG) exit;
        send("$CACHE/$m.{$src[1]}", $TYPES[$src[1]]);
    }
}
if ($DEBUG) { echo 'Topilmadi'; exit; }
@touch("$CACHE/$m.none");                                 // rasm yo'q - bir kun qayta so'ramaymiz
header('HTTP/1.1 404 Not Found');
