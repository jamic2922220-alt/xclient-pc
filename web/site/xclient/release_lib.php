<?php
/* X CLIENT — yangilanish (release) yordamchilari: xclient/api.php va admin.php ishlatadi.
 * Yangi build GitHub Actions'da yig'iladi va dist-<vetka> ga joylanadi (manifest.txt + XClient.exe + xc_theme).
 * Bu yerda shu vetkaning oxirgi commit'i olinadi va fayllar o'sha commit manzilidan (o'zgarmaydigan) beriladi. */
if (!defined('XC_DIR')) define('XC_DIR', dirname(__DIR__) . '/xc_data');
if (!defined('XC_GUARD')) define('XC_GUARD', "<?php exit; ?>\n");
define('XC_REPO', 'jamic2922220-alt/xclient-pc');

function rel_rd($name, $def) {
    $f = XC_DIR . '/' . $name . '.php';
    if (!is_file($f)) return $def;
    $d = json_decode(substr((string)@file_get_contents($f), strlen(XC_GUARD)), true);
    return is_array($d) ? $d : $def;
}
function rel_wr($name, $data) { @mkdir(XC_DIR, 0755, true); @file_put_contents(XC_DIR . '/' . $name . '.php', XC_GUARD . json_encode($data), LOCK_EX); }

function rel_http($url) {
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0, CURLOPT_USERAGENT => 'XClient-release',
            CURLOPT_HTTPHEADER => array('Accept: application/vnd.github+json')));
        $d = curl_exec($c); $code = curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
        return ($d === false || $code != 200) ? '' : $d;
    }
    $ctx = stream_context_create(array('http' => array('timeout' => 8, 'header' => "User-Agent: XClient-release\r\nAccept: application/vnd.github+json\r\n")));
    $d = @file_get_contents($url, false, $ctx);
    return $d === false ? '' : $d;
}

/* GitHub'dagi oxirgi build (5 daqiqa keshlanadi): {build, version, sha, base, t, date} yoki null */
function rel_latest($ch, $force = false) {
    $ch = $ch === 'beta' ? 'beta' : 'stable';
    $c = rel_rd('gh_' . $ch, null);
    if (!$force && $c && time() - $c['chk'] < 300) return empty($c['build']) ? null : $c;
    $j = json_decode(rel_http('https://api.github.com/repos/' . XC_REPO . '/commits/dist-' . $ch), true);
    $sha = isset($j['sha']) && preg_match('/^[0-9a-f]{40}$/', $j['sha']) ? $j['sha'] : '';
    if ($sha === '') { if ($c) { $c['chk'] = time(); rel_wr('gh_' . $ch, $c); } return $c && !empty($c['build']) ? $c : null; }
    if ($c && $c['sha'] === $sha) { $c['chk'] = time(); rel_wr('gh_' . $ch, $c); return $c; }
    $base = 'https://raw.githubusercontent.com/' . XC_REPO . '/' . $sha;
    $b = (int)trim(rel_http($base . '/bt_build.txt'));
    $v = preg_replace('/[^\w.\-]/', '', trim(rel_http($base . '/xclient_version.txt')));
    if ($b <= 0) return $c && !empty($c['build']) ? $c : null;
    $n = array('build' => $b, 'version' => $v !== '' ? $v : '1.0.' . $b, 'sha' => $sha, 'base' => $base, 'chk' => time(),
        'date' => isset($j['commit']['committer']['date']) ? strtotime($j['commit']['committer']['date']) : time());
    rel_wr('gh_' . $ch, $n);
    /* tarix - orqaga qaytarish uchun */
    $h = rel_rd('rel_hist', array());
    $h[$n['build']] = array('build' => $n['build'], 'version' => $n['version'], 'base' => $base, 'ch' => $ch, 'date' => $n['date']);
    krsort($h); rel_wr('rel_hist', array_slice($h, 0, 30, true));
    return $n;
}

/* Shu vetkadagi o'yinchilarga hozir beriladigan build: {build, version, base, min, msg, mode} */
function rel_current($ch) {
    $ch = $ch === 'beta' ? 'beta' : 'stable';
    $cfg = rel_rd('release', array());
    $r = isset($cfg[$ch]) ? $cfg[$ch] : array();
    $mode = isset($r['mode']) ? $r['mode'] : 'auto';
    $out = array('mode' => $mode, 'min' => isset($r['min']) ? (int)$r['min'] : 0, 'msg' => isset($r['msg']) ? $r['msg'] : '', 'build' => 0, 'version' => '', 'base' => '');
    if ($mode === 'pause') return $out;
    if ($mode === 'manual' && !empty($r['base'])) { $out['build'] = (int)$r['build']; $out['version'] = $r['version']; $out['base'] = $r['base']; return $out; }
    /* avto: vetkaning oxirgisi; beta eskirib qolgan bo'lsa - stable yangirog'i beriladi */
    $l = rel_latest($ch);
    if ($ch === 'beta') { $s = rel_latest('stable'); if ($s && (!$l || $s['build'] > $l['build'])) $l = $s; }
    if ($l) { $out['build'] = $l['build']; $out['version'] = $l['version']; $out['base'] = $l['base']; }
    return $out;
}
