<?php
/* =====================================================================
 *  X CLIENT — serverlar davlati va bayrog'i
 *  geo.php?ips=1.2.3.4,5.6.7.8:27015   ->  {"1.2.3.4":"uz","5.6.7.8":"ru"}
 *  geo.php?flag=uz                      ->  bayroq rasmi (boost-top.com/media/flags/uz.gif)
 *  Davlat ip-api.com dan olinadi va xc_data/geo.php ga 30 kunga saqlanadi.
 *  Tekshirish: geo.php?ips=157.22.130.26&debug=1
 * ===================================================================== */
define('GEO_CACHE', __DIR__ . '/xc_data/geo.php');
define('FLAG_DIR', __DIR__ . '/xc_data/flags');

/* bitta IP soatiga $max ta tashqi so'rov (sayt boshqa xizmatlarga "spam" qilib, bloklanib qolmasin) */
function ip_quota($tag, $max) {
    $d = __DIR__ . '/xc_data/rl'; @mkdir($d, 0755, true);
    $f = $d . '/' . $tag . substr(sha1(isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : ''), 0, 20) . '.txt';
    $n = is_file($f) && time() - filemtime($f) < 3600 ? (int)@file_get_contents($f) : 0;
    if ($n >= $max) return false;
    $t = $n ? filemtime($f) : time(); @file_put_contents($f, $n + 1); @touch($f, $t);
    return true;
}
function http_get($url, $post = null, &$info = null) {
    $info = '';
    if (!function_exists('curl_init')) {
        $ctx = $post === null ? null : stream_context_create(array('http' => array('method' => 'POST', 'header' => "Content-Type: application/json\r\n", 'content' => $post, 'timeout' => 8)));
        $d = @file_get_contents($url, false, $ctx); $info = $d === false ? 'xato' : 'ok'; return $d === false ? '' : $d;
    }
    $c = curl_init($url);
    $o = array(CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0, CURLOPT_USERAGENT => 'Mozilla/5.0 XClient-geo');
    if ($post !== null) { $o[CURLOPT_POST] = true; $o[CURLOPT_POSTFIELDS] = $post; $o[CURLOPT_HTTPHEADER] = array('Content-Type: application/json'); }
    curl_setopt_array($c, $o);
    $d = curl_exec($c);
    $info = 'http ' . curl_getinfo($c, CURLINFO_HTTP_CODE) . ' ' . curl_getinfo($c, CURLINFO_CONTENT_TYPE) . ($d === false ? ' ' . curl_error($c) : '');
    $code = curl_getinfo($c, CURLINFO_HTTP_CODE);
    curl_close($c);
    return ($d === false || $code != 200) ? '' : $d;
}

/* ---------- bayroq rasmi ---------- */
if (isset($_GET['flag'])) {
    $cc = strtolower($_GET['flag']);
    if (!preg_match('/^[a-z]{2}$/', $cc)) { header('HTTP/1.1 404 Not Found'); exit; }
    $send = function ($f, $type) { header('Content-Type: ' . $type); header('Cache-Control: public, max-age=2592000'); readfile($f); exit; };
    foreach (array('gif' => 'image/gif', 'png' => 'image/png') as $ext => $type) {
        if (is_file(FLAG_DIR . "/$cc.$ext")) $send(FLAG_DIR . "/$cc.$ext", $type);
        foreach (array(__DIR__ . '/../media/flags', __DIR__ . '/media/flags') as $dir) if (is_file("$dir/$cc.$ext")) $send("$dir/$cc.$ext", $type);
    }
    @mkdir(FLAG_DIR, 0755, true);
    foreach (array(array("https://boost-top.com/media/flags/$cc.gif", 'gif', 'image/gif'), array("https://flagcdn.com/16x12/$cc.png", 'png', 'image/png')) as $src) {
        $d = http_get($src[0], null, $i);
        if ($d && strlen($d) > 40 && @getimagesizefromstring($d)) { file_put_contents(FLAG_DIR . "/$cc.{$src[1]}", $d, LOCK_EX); $send(FLAG_DIR . "/$cc.{$src[1]}", $src[2]); }
    }
    header('HTTP/1.1 404 Not Found');
    exit;
}

/* ---------- IP -> davlat ---------- */
$DEBUG = isset($_GET['debug']);
header(($DEBUG ? 'Content-Type: text/plain' : 'Content-Type: application/json') . '; charset=utf-8');
header('Cache-Control: no-store');
$raw = isset($_POST['ips']) ? $_POST['ips'] : (isset($_GET['ips']) ? $_GET['ips'] : '');
$ips = array();
foreach (explode(',', $raw) as $x) {
    $h = preg_replace('/:\d+$/', '', trim($x));
    if ($h === '' || count($ips) >= 400) continue;
    if (!preg_match('/^\d{1,3}(\.\d{1,3}){3}$/', $h)) continue;        // faqat IP: domen nomlarini yechish serverni band qiladi
    if (!in_array($h, $ips)) $ips[] = $h;
}
$cache = array();
if (is_file(GEO_CACHE)) { $c = json_decode(substr(file_get_contents(GEO_CACHE), 15), true); if (is_array($c)) $cache = $c; }
$now = time(); $need = array();
foreach ($ips as $h) if (!isset($cache[$h]) || $now - $cache[$h][1] > ($cache[$h][0] === '' ? 86400 : 30 * 86400)) $need[] = $h;
$dbg = 'So\'ralgan: ' . count($ips) . ', keshda yo\'q: ' . count($need) . "\n";
if ($need && ip_quota('geo', 30)) {
    foreach (array_chunk(array_slice($need, 0, 100), 100) as $chunk) {       // bir so'rovda ko'pi bilan 100 ta yangi IP   // ip-api.com: bir so'rovda 100 tagacha
        $q = array();
        foreach ($chunk as $h) $q[] = array('query' => $h, 'fields' => 'countryCode,query');
        $res = json_decode(http_get('http://ip-api.com/batch', json_encode($q), $info), true);
        $dbg .= 'ip-api.com -> ' . $info . "\n";
        if (!is_array($res)) break;
        foreach ($chunk as $k => $h) $cache[$h] = array(isset($res[$k]['countryCode']) ? strtolower($res[$k]['countryCode']) : '', $now);
    }
    if (count($cache) > 5000) $cache = array_slice($cache, -4000, null, true);
    @mkdir(dirname(GEO_CACHE), 0755, true);
    @file_put_contents(GEO_CACHE, "<?php exit; ?>\n" . json_encode($cache), LOCK_EX);
}
$out = array();
foreach ($ips as $h) if (!empty($cache[$h][0])) $out[$h] = $cache[$h][0];
if ($DEBUG) { echo $dbg . "\nNATIJA: " . json_encode($out) . "\n"; exit; }
echo json_encode((object)$out);
