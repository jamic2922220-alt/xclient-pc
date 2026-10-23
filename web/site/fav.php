<?php
/* =====================================================================
 *  X CLIENT — "Sevimlilar" (GM) tarifini olgan serverlar
 *  boost-top.com/mmb/fav.php  ->  window.BOOST_FAV = [{"ip":"1.2.3.4:27015"}, ...];
 *
 *  Saytdagi xizmatlar sahifasidan "XIZMAT  GM  Sevimlilar" jadvalini o'qiydi
 *  (keyingi XIZMAT blokigacha bo'lgan IP:port lar). Natija 5 daqiqa keshlanadi.
 *  Tekshirish: fav.php?debug=1  - sahifa o'qildimi, "Sevimlilar" topildimi ko'rsatadi.
 * ===================================================================== */
// debug rejimi kesh'ni chetlab o'tadi va sahifa parchalarini ko'rsatadi - faqat admin panelga kirgan bo'lsa
if (isset($_GET['debug'])) { @session_start(); if (empty($_SESSION['adm'])) { unset($_GET['debug'], $_GET['url']); } }
$DEBUG = isset($_GET['debug']);
header(($DEBUG ? 'Content-Type: text/plain' : 'Content-Type: application/javascript') . '; charset=utf-8');
header('Cache-Control: no-store');

// xizmatlar (TOP / BOOST / VIP / Sevimlilar) jadvallari turgan sahifa(lar) - birinchi ishlagani olinadi
$PAGES  = array('https://boost-top.com/listing/', 'https://boost-top.com/', 'http://boost-top.com/', 'https://www.boost-top.com/');
// tekshirish uchun boshqa sahifa: fav.php?debug=1&url=https://boost-top.com/...
if (isset($_GET['debug'], $_GET['url']) && preg_match('#^https?://(www\.)?boost-top\.com/#i', $_GET['url'])) $PAGES = array($_GET['url']);
$MARKER = '/sevimli|избранн|favorit|game ?menu/iu';      // jadval sarlavhasi
$CACHE  = __DIR__ . '/xc_data/fav_cache2.php';
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

$SVC = array();                                                        // /listing/ dagi barcha xizmatlar: top, boost, vip, gamemenu, ...
function parse_fav($html, $MARKER, $IPRE, &$dbg) {
    global $SVC;
    $list = array();
    if (preg_match_all('#<section\b[^>]*data-service\s*=\s*["\']?([\w-]+)[^>]*>(.*?)</section>#is', $html, $all, PREG_SET_ORDER)) {
        foreach ($all as $sec) {
            $k = strtolower($sec[1]);
            if (!isset($SVC[$k])) $SVC[$k] = array();
            if (preg_match_all('#data-address\s*=\s*["\']([\d.]+(?::\d{2,5})?)["\']#i', $sec[2], $m))
                foreach ($m[1] as $ip) { if (strpos($ip, ':') === false) $ip .= ':27015'; if (!in_array($ip, $SVC[$k])) $SVC[$k][] = $ip; }
        }
        foreach ($SVC as $k => $v) $dbg .= 'Xizmat ' . $k . ': ' . implode(', ', $v) . "\n";
    }
    // A) /listing/ sahifasi: <section class="boost-listing-section" data-service="gamemenu"> ... <tr data-address="IP:port">
    if (preg_match_all('#<section\b[^>]*data-service\s*=\s*["\']?(?:gamemenu|favorites)\b[^>]*>(.*?)</section>#is', $html, $secs)) {
        foreach ($secs[1] as $sec)
            if (preg_match_all('#data-address\s*=\s*["\']([\d.]+(?::\d{2,5})?)["\']#i', $sec, $m))
                foreach ($m[1] as $ip) { if (strpos($ip, ':') === false) $ip .= ':27015'; if (!in_array($ip, $list)) $list[] = $ip; }
        $dbg .= 'Sevimlilar bo\'limi (section gamemenu): ' . count($secs[1]) . ' ta, serverlar: ' . count($list) . "\n";
        return $list;                                                   // bo'lim bor - bo'sh bo'lsa ham shu to'g'ri javob
    }
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

// sahifada haqiqiy (skript/CSS dan tashqari) <tr data-service="gamemenu"> jadvali bormi
function has_gm_table($html) {
    $h = preg_replace('#<(style|script)\b.*?</\1>#is', ' ', $html);
    if (preg_match('#<section\b[^>]*data-service\s*=\s*["\']?gamemenu\b#i', $h)) return true;
    return (bool)preg_match('#<tr\b[^>]*data-service\s*=\s*["\']?(?:gamemenu|favorites)\b#i', $h);
}
// bosh sahifadagi ichki havolalar (jadval qaysi sahifada ekanini o'zimiz topamiz)
function site_links($html, $base) {
    $out = array(); $pri = array();
    if (!preg_match_all('#href\s*=\s*["\']([^"\'\#]+)["\']#i', $html, $m)) return $out;
    foreach ($m[1] as $u) {
        $u = html_entity_decode(trim($u), ENT_QUOTES, 'UTF-8');
        if (preg_match('#^https?://(www\.)?boost-top\.com(/.*)?$#i', $u, $mm)) $u = isset($mm[2]) && $mm[2] !== '' ? $mm[2] : '/';
        if ($u === '' || $u[0] !== '/' || substr($u, 0, 2) === '//') continue;
        if (preg_match('#^/servers/|^/media/|^/templates/|\.(css|js|png|jpe?g|gif|svg|ico|webp|zip|rar|exe|txt|xml)(\?|$)|logout|login|register|lang=#i', $u)) continue;
        $full = rtrim($base, '/') . $u;
        if (in_array($full, $out) || in_array($full, $pri)) continue;
        if (preg_match('#servic|privileg|xizmat|uslug|tarif|price|buy|shop|vip|gm|game|favor|sevimli|izbran|page=#i', $u)) $pri[] = $full; else $out[] = $full;
    }
    return array_merge($pri, $out);
}

$list = null; $dbg = '';
$PAGEF = __DIR__ . '/xc_data/fav_page.php';                            // jadval topilgan sahifa (eslab qolinadi)
if (!$DEBUG && is_file($CACHE) && time() - filemtime($CACHE) < 300) {
    $c = json_decode(substr(file_get_contents($CACHE), 15), true);
    if (is_array($c) && isset($c['fav'])) { $list = $c['fav']; $SVC = (array)$c['svc']; }
}
if (!is_array($list)) {
    $list = array(); $got = false; $t0 = time();
    $known = is_file($PAGEF) ? trim(substr(file_get_contents($PAGEF), 15)) : '';
    if ($known && !isset($_GET['url'])) array_unshift($PAGES, $known);
    $home = ''; $homeUrl = '';
    foreach ($PAGES as $u) {
        $html = fetch_page($u, '', $info);
        $dbg .= $u . ' -> ' . $info . ', ' . strlen($html) . " bayt\n";
        if (strlen($html) < 500) continue;
        $got = true;
        if (!$home && $u !== $known) { $home = $html; $homeUrl = $u; }
        if (has_gm_table($html)) { $list = parse_fav($html, $MARKER, $IPRE, $dbg); if ($list) { $found = $u; break; } }
        else $dbg .= "  (bu sahifada Sevimlilar jadvali yo'q)\n";
        if ($home) break;                                               // https/http/www bir xil - bittasi yetadi
    }
    // bosh sahifada yo'q - saytdagi boshqa sahifalarni ko'rib chiqamiz (eng ko'pi 25 ta, 40 soniya)
    if (!$list && $home && !isset($_GET['url'])) {
        $base = preg_replace('#^(https?://[^/]+).*$#i', '$1', $homeUrl);
        $links = site_links($home, $base);
        $dbg .= "\nIchki havolalar: " . count($links) . " ta, tekshirilmoqda...\n";
        foreach (array_slice($links, 0, 25) as $u) {
            if (time() - $t0 > 40) { $dbg .= "vaqt tugadi\n"; break; }
            $html = fetch_page($u, '', $info);
            $ok = strlen($html) > 500 && has_gm_table($html);
            $dbg .= '  ' . $u . ' -> ' . $info . ', ' . strlen($html) . ' bayt' . ($ok ? '  <== JADVAL TOPILDI' : '') . "\n";
            if ($ok) { $list = parse_fav($html, $MARKER, $IPRE, $dbg); if ($list) { $found = $u; break; } }
        }
    }
    if (!empty($found)) {
        $dbg .= "\nJadval sahifasi: " . $found . "\n";
        @mkdir(dirname($PAGEF), 0755, true);
        if (!isset($_GET['url'])) @file_put_contents($PAGEF, "<?php exit; ?>\n" . $found, LOCK_EX);
    }
    if ($got && !$DEBUG) {
        @mkdir(dirname($CACHE), 0755, true);
        @file_put_contents($CACHE, "<?php exit; ?>\n" . json_encode(array('fav' => $list, 'svc' => $SVC)), LOCK_EX);
        if (!$list) @touch($CACHE, time() - 240);                       // bo'sh bo'lsa 1 daqiqadan keyin qayta urinadi
    }
}
if ($DEBUG) { echo $dbg . "\nNATIJA: " . json_encode($list) . "\n"; exit; }
$out = array();
foreach ($list as $ip) $out[] = array('ip' => $ip);
echo 'window.BOOST_SVC = ' . json_encode((object)$SVC) . ";\n";
echo 'window.BOOST_FAV = ' . json_encode($out) . ";\n";
