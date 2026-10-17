<?php
/* =====================================================================
 *  X CLIENT — "Sevimlilar" (GM) tarifini olgan serverlar
 *  boost-top.com/mmb/fav.php  ->  window.BOOST_FAV = [{"ip":"1.2.3.4:27015"}, ...];
 *
 *  Saytdagi xizmatlar sahifasidan "XIZMAT  GM  Sevimlilar" jadvalini o'qiydi
 *  (keyingi XIZMAT blokigacha bo'lgan IP:port lar). Natija 5 daqiqa keshlanadi.
 *  Sahifa manzili o'zgarsa - $PAGE ni almashtiring.
 * ===================================================================== */
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store');

$PAGE   = 'https://boost-top.com/';          // xizmatlar (TOP / BOOST / VIP / Sevimlilar) jadvallari turgan sahifa
$MARKER = 'Sevimlilar';                       // jadval sarlavhasi
$CACHE  = __DIR__ . '/xc_data/fav_cache.php';

function fetch_page($url) {
    if (strpos($url, 'http') === 0 && function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 8,
            CURLOPT_SSL_VERIFYPEER => false, CURLOPT_USERAGENT => 'XClient-fav'));
        $s = curl_exec($c);
        curl_close($c);
        return $s === false ? '' : $s;
    }
    $s = @file_get_contents($url);
    return $s === false ? '' : $s;
}

$list = null;
if (is_file($CACHE) && time() - filemtime($CACHE) < 300) {
    $list = json_decode(substr(file_get_contents($CACHE), 15), true);
}
if (!is_array($list)) {
    $html = fetch_page($PAGE);
    $list = array();
    // "XIZMAT" bloklariga bo'lamiz va sarlavhasida Sevimlilar bo'lganini olamiz
    $text = preg_replace('/\s+/u', ' ', strip_tags(str_replace('<', ' <', $html)));
    $parts = preg_split('/XIZMAT/u', $text);
    foreach ($parts as $p) {
        $head = mb_substr(trim($p), 0, 40, 'UTF-8');
        if (mb_stripos($head, $MARKER, 0, 'UTF-8') === false) continue;
        if (preg_match_all('/\b(\d{1,3}(?:\.\d{1,3}){3}:\d{2,5})\b/', $p, $m)) {
            foreach ($m[1] as $ip) if (!in_array($ip, $list)) $list[] = $ip;
        }
    }
    if ($html !== '') {
        @mkdir(dirname($CACHE), 0755, true);
        @file_put_contents($CACHE, "<?php exit; ?>\n" . json_encode($list), LOCK_EX);
    }
}
$out = array();
foreach ($list as $ip) $out[] = array('ip' => $ip);
echo 'window.BOOST_FAV = ' . json_encode($out) . ";\n";
