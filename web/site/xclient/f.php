<?php
/* X CLIENT — yangilanish fayllari zaxira manbasi (mmb.boost-top.com/xclient/f.php?s=<commit>&p=<yo'l>)
 * Windows 7 (va eski TLS) GitHub / jsDelivr ga ulana olmaydi - launcher bu yerdan oladi.
 * Faqat shu repo'ning release tarixidagi (rel_hist) commit'laridan, raw.githubusercontent.com dan olinib, diskda keshlanadi.
 * Launcher har bir faylni manifest.txt dagi SHA-256 bilan tekshiradi. */
require __DIR__ . '/release_lib.php';
$sha = isset($_GET['s']) ? (string)$_GET['s'] : '';
$p = isset($_GET['p']) ? ltrim(str_replace('\\', '/', (string)$_GET['p']), '/') : '';
function bad($c) { http_response_code($c); header('Content-Type: text/plain'); echo $c; exit; }
if (!preg_match('/^[0-9a-f]{40}$/', $sha) || $p === '' || strlen($p) > 200 || strpos($p, '..') !== false || !preg_match('#^[A-Za-z0-9_\-./ ]+$#', $p)) bad(400);
/* faqat bizning releaselar */
$ok = false;
foreach (rel_rd('rel_hist', array()) as $h) if (isset($h['base']) && substr($h['base'], -40) === $sha) { $ok = true; break; }
if (!$ok) foreach (array('stable', 'beta') as $c) { $l = rel_rd('gh_' . $c, null); if ($l && isset($l['sha']) && $l['sha'] === $sha) $ok = true; }
if (!$ok) bad(404);
$dir = XC_DIR . '/relcache/' . $sha;
$f = $dir . '/' . str_replace('/', '__', $p);
if (!is_file($f)) {
    $url = 'https://raw.githubusercontent.com/' . XC_REPO . '/' . $sha . '/' . str_replace('%2F', '/', rawurlencode($p));
    $data = '';
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 120, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_USERAGENT => 'XClient-mirror'));
        $data = curl_exec($c); $code = curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
        if ($data === false || $code != 200) $data = '';
    } else {
        $d = @file_get_contents($url); $data = $d === false ? '' : $d;
    }
    if ($data === '' || strlen($data) > 80 * 1048576) bad(404);
    @mkdir($dir, 0755, true);
    /* eski commit keshlari: 5 tadan ko'p bo'lsa eng eskisi o'chadi */
    $all = glob(XC_DIR . '/relcache/*', GLOB_ONLYDIR); if (count($all) > 5) { usort($all, function ($a, $b) { return filemtime($a) - filemtime($b); }); foreach (array_slice($all, 0, count($all) - 5) as $o) { array_map('unlink', glob($o . '/*')); @rmdir($o); } }
    $tmp = $f . '.' . mt_rand() . '.tmp';
    if (@file_put_contents($tmp, $data) !== false) @rename($tmp, $f);
    if (!is_file($f)) { header('Content-Type: application/octet-stream'); header('Content-Length: ' . strlen($data)); echo $data; exit; }
}
header('Content-Type: application/octet-stream');
header('Content-Length: ' . filesize($f));
header('Cache-Control: public, max-age=86400');
readfile($f);
