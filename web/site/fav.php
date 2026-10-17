<?php
/* =====================================================================
 *  X CLIENT — "Sevimlilar" (GM) tarifini olgan serverlar
 *  boost-top.com/mmb/fav.php  ->  window.BOOST_FAV = [{"ip":"1.2.3.4:27015"}, ...];
 *
 *  Saytdagi xizmatlar sahifasidan "XIZMAT  GM  Sevimlilar" jadvalini o'qiydi
 *  (keyingi XIZMAT blokigacha bo'lgan IP:port lar). Natija 5 daqiqa keshlanadi.
 *  Tekshirish: fav.php?debug=1  - sahifa o'qildimi, "Sevimlilar" topildimi ko'rsatadi.
 * ===================================================================== */
$DEBUG = isset($_GET['debug']);
header(($DEBUG ? 'Content-Type: text/plain' : 'Content-Type: application/javascript') . '; charset=utf-8');
header('Cache-Control: no-store');

// xizmatlar (TOP / BOOST / VIP / Sevimlilar) jadvallari turgan sahifa(lar) - birinchi ishlagani olinadi
$PAGES  = array('https://boost-top.com/', 'http://boost-top.com/', 'https://www.boost-top.com/');
// tekshirish uchun boshqa sahifa: fav.php?debug=1&url=https://boost-top.com/...
if (isset($_GET['debug'], $_GET['url']) && preg_match('#^https?://(www\.)?boost-top\.com/#i', $_GET['url'])) $PAGES = array($_GET['url']);
$MARKER = '/sevimli|избранн|favorit|game ?menu/iu';      // jadval sarlavhasi
$CACHE  = __DIR__ . '/xc_data/fav_cache.php';
$IPRE   = '/(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3}:\d{2,5})(?!\d)/';

function fetch_page($url, $host = '', &$info = null) {
    $info = '';
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        $h = array('Accept: text/html', 'Accept-Language: uz,ru;q=0.8');
        if ($host) $h[] = 'Host: ' . $host;
        curl_setopt_array($c, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 8,
            CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0, CURLOPT_HTTPHEADER => $h,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) XClient-fav'));
        $s = curl_exec($c);
        $info = 'http ' . curl_getinfo($c, CURLINFO_HTTP_CODE) . ($s === false ? ' xato: ' . curl_error($c) : '');
        curl_close($c);
        return $s === false ? '' : $s;
    }
    $s = @file_get_contents($url);
    $info = $s === false ? 'file_get_contents xato' : 'ok';
    return $s === false ? '' : $s;
}

function parse_fav($html, $MARKER, $IPRE, &$dbg) {
    $list = array();
    // 0) saytdagi "boost-privileges-table": har bir xizmat qatori <tr data-service="favorites"> ...
    if (preg_match_all('#<tr\b[^>]*data-service\s*=\s*["\']?(?:gamemenu|favorites|favourites|fav)\b[^>]*>(.*?)</tr>#is', $html, $rows)) {
        foreach ($rows[1] as $r) {
            if (preg_match_all('/(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{2,5}))?(?![\d.])/', $r, $m, PREG_SET_ORDER))
                foreach ($m as $x) { $ip = $x[1] . ':' . (isset($x[2]) && $x[2] !== '' ? $x[2] : '27015'); if (!in_array($ip, $list)) $list[] = $ip; }
        }
        $dbg .= 'data-service=gamemenu qatorlari: ' . count($rows[1]) . "\n";
        if ($rows[1]) $dbg .= 'Birinchi qator: ' . trim(preg_replace('/\s+/u', ' ', strip_tags(str_replace('<', ' <', $rows[1][0])))) . "\n";
        if ($list) return $list;
    } else $dbg .= "data-service=gamemenu qatorlari topilmadi\n";
    if (isset($_GET['debug'])) {
        if (preg_match_all('#data-service\s*=\s*["\']?([\w-]+)#i', $html, $sv)) {
            $c = array(); foreach (array_count_values($sv[1]) as $k => $n) $c[] = $k . ' x' . $n;
            $dbg .= 'data-service qiymatlari: ' . implode(', ', $c) . "\n";
        }
        if (preg_match_all('/(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}/', $html, $ips, PREG_OFFSET_CAPTURE)) {
            $dbg .= "\n--- IP ATROFIDAGI KOD (birinchi 3 ta) ---\n";
            foreach (array_slice($ips[0], 0, 3) as $h) $dbg .= '@' . $h[1] . ': ' . preg_replace('/\s+/u', ' ', substr($html, max(0, $h[1] - 600), 750)) . "\n\n";
        }
    }
    // 0b) jadval JS orqali chizilsa: skriptdagi {"service":"favorites", ... "ip":"..."} obyektlari
    $raw = preg_replace('#<style\b.*?</style>#is', ' ', $html);
    if (preg_match_all('#\{[^{}]*?["\']?(?:service|type|tariff|slug|key)["\']?\s*:\s*["\'](?:gamemenu|favorites|favourites|fav|gm)["\'][^{}]*\}#is', $raw, $objs)) {
        foreach ($objs[0] as $o)
            if (preg_match_all('/(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{2,5}))?(?![\d.])/', $o, $m, PREG_SET_ORDER))
                foreach ($m as $x) { $ip = $x[1] . ':' . (isset($x[2]) && $x[2] !== '' ? $x[2] : '27015'); if (!in_array($ip, $list)) $list[] = $ip; }
        $dbg .= 'JS obyektlar (favorites): ' . count($objs[0]) . "\n";
        if ($list) return $list;
    }
    if (isset($_GET['debug'])) {                                          // sahifa kodidan parchalar - qayerda turganini ko'rish uchun
        if (preg_match_all('/favorit|sevimli|gamemenu|privileges|befirst/iu', $raw, $hits, PREG_OFFSET_CAPTURE)) {
            $dbg .= "\n--- KODDAN PARCHALAR (" . count($hits[0]) . " ta) ---\n";
            $last = -1000;
            foreach (array_slice($hits[0], 0, 40) as $h) {
                if ($h[1] - $last < 500) continue;
                $last = $h[1];
                $dbg .= '@' . $h[1] . ': ' . preg_replace('/\s+/u', ' ', substr($raw, max(0, $h[1] - 250), 700)) . "\n\n";
            }
        }
        if (preg_match_all('#(?:fetch|ajax|getJSON|axios\.get|\.load)\s*\(\s*["\']([^"\']+)#i', $raw, $u)) $dbg .= 'AJAX manzillar: ' . implode(' , ', array_unique($u[1])) . "\n";
    }
    $html = preg_replace('#<(style|script)\b.*?</\1>#is', ' ', $html);      // CSS/JS dagi so'zlar adashtirmasin
    $text = preg_replace('/\s+/u', ' ', strip_tags(str_replace('<', ' <', $html)));
    $text = html_entity_decode($text, ENT_QUOTES, 'UTF-8');
    // 1) "XIZMAT" bloklariga bo'lamiz (katta-kichik harf farqsiz), sarlavhasida Sevimlilar bo'lganini olamiz
    $parts = preg_split('/xizmat/iu', $text);
    foreach ($parts as $p) {
        $head = mb_substr(trim($p), 0, 60, 'UTF-8');
        if (!preg_match($MARKER, $head)) continue;
        if (preg_match_all($IPRE, $p, $m)) foreach ($m[1] as $ip) if (!in_array($ip, $list)) $list[] = $ip;
    }
    // 2) topilmasa: "Sevimlilar" so'zidan keyingi qismdan keyingi jadval sarlavhasigacha
    if (!$list && preg_match($MARKER, $text, $mm, PREG_OFFSET_CAPTURE)) {
        $chunk = substr($text, $mm[0][1], 6000);
        $cut = preg_split('/xizmat|\bTOP\s*\d|\bBOOST\b|\bVIP\b|\bREKLAMA\b/iu', substr($chunk, 20), 2);
        if (preg_match_all($IPRE, substr($chunk, 0, 20) . $cut[0], $m)) foreach ($m[1] as $ip) if (!in_array($ip, $list)) $list[] = $ip;
    }
    $pos = preg_match($MARKER, $text, $mm, PREG_OFFSET_CAPTURE) ? $mm[0][1] : -1;
    $dbg .= 'Matn uzunligi: ' . strlen($text) . ', XIZMAT bloklari: ' . (count($parts) - 1) . ', "Sevimli" joyi: ' . $pos . "\n";
    if ($pos >= 0) $dbg .= "Atrofi:\n" . substr($text, max(0, $pos - 200), 900) . "\n";
    preg_match_all($IPRE, $text, $all);
    $dbg .= 'Sahifadagi jami IP lar: ' . count($all[1]) . "\n";
    return $list;
}

$list = null; $dbg = '';
if (!$DEBUG && is_file($CACHE) && time() - filemtime($CACHE) < 300) {
    $list = json_decode(substr(file_get_contents($CACHE), 15), true);
}
if (!is_array($list)) {
    $list = array(); $got = false;
    $tries = array();
    foreach ($PAGES as $u) $tries[] = array($u, '');
    $tries[] = array('http://127.0.0.1/', 'boost-top.com');              // sayt shu serverda - ichkaridan
    foreach ($tries as $t) {
        $html = fetch_page($t[0], $t[1], $info);
        $dbg .= $t[0] . ($t[1] ? ' (Host: ' . $t[1] . ')' : '') . ' -> ' . $info . ', ' . strlen($html) . " bayt\n";
        if (strlen($html) < 500) continue;
        $got = true;
        $list = parse_fav($html, $MARKER, $IPRE, $dbg);
        if ($list) break;
    }
    if ($got && !$DEBUG) {
        @mkdir(dirname($CACHE), 0755, true);
        @file_put_contents($CACHE, "<?php exit; ?>\n" . json_encode($list), LOCK_EX);
        if (!$list) @touch($CACHE, time() - 240);                       // bo'sh bo'lsa 1 daqiqadan keyin qayta urinadi
    }
}
if ($DEBUG) { echo $dbg . "\nNATIJA: " . json_encode($list) . "\n"; exit; }
$out = array();
foreach ($list as $ip) $out[] = array('ip' => $ip);
echo 'window.BOOST_FAV = ' . json_encode($out) . ";\n";
