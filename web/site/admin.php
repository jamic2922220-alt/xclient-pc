<?php
/* =====================================================================
 *  X CLIENT — admin panel (mmb.boost-top.com/admin.php)
 *  NextClient (o'yin menyusini ochganlar) va X CLIENT (XClient.exe orqali kirganlar) alohida hisoblanadi.
 *  Bo'limlar: Infopanel, O'yinchilar, O'rnatishlar, Akkauntlar, E'lonlar, Xatolar, Yangilanishlar, Paketlar, Telegram, API, Sozlamalar.
 *  Birinchi kirishda parol o'rnatiladi: kod xc_data/ADMIN_KOD.php faylida (FastPanel'da oching).
 *  PHP 5.6+ / 7 / 8. Ma'lumotlar: xc_data/*.php (brauzerdan o'qib bo'lmaydi).
 * ===================================================================== */
@date_default_timezone_set('Asia/Tashkent');
define('XC_DIR', __DIR__ . '/xc_data');
define('XC_GUARD', "<?php exit; ?>\n");
define('PACKS_DIR', __DIR__ . '/packs');
define('NDIRECT', 'http://nextcs.boost-top.com/admin');
define('PER_PAGE', 25);
require_once __DIR__ . '/xclient/release_lib.php';

function rd($name, $def) {
    $f = XC_DIR . '/' . $name . '.php';
    if (!is_file($f)) return $def;
    $j = json_decode(substr((string)@file_get_contents($f), strlen(XC_GUARD)), true);
    return is_array($j) ? $j : $def;
}
function wr($name, $data) { @mkdir(dirname(XC_DIR . '/' . $name), 0755, true); @file_put_contents(XC_DIR . '/' . $name . '.php', XC_GUARD . json_encode($data), LOCK_EX); }
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function g($k, $d = '') { return isset($_GET[$k]) ? (string)$_GET[$k] : $d; }
function pp($k, $d = '') { return isset($_POST[$k]) ? (is_array($_POST[$k]) ? $_POST[$k] : trim((string)$_POST[$k])) : $d; }
function rnd($n) { return bin2hex(function_exists('random_bytes') ? random_bytes($n) : openssl_random_pseudo_bytes($n)); }
function dt($t) { return $t ? date('d.m.Y H:i', $t) : '—'; }
function ago($t) {
    if (!$t) return '—';
    $d = time() - $t;
    if ($d < 120) return 'hozir';
    if ($d < 3600) return floor($d / 60) . ' daq oldin';
    if ($d < 86400) return floor($d / 3600) . ' soat oldin';
    if ($d < 7 * 86400) return floor($d / 86400) . ' kun oldin';
    return date('d.m.Y', $t);
}
function flag($cc) { return preg_match('/^[a-z]{2}$/', (string)$cc) ? '<img class="flg" src="geo.php?flag=' . $cc . '" alt="" title="' . strtoupper($cc) . '">' : ''; }
function size_h($b) { return $b > 1048576 ? round($b / 1048576, 1) . ' MB' : ($b > 1024 ? round($b / 1024) . ' KB' : $b . ' B'); }
function day($date) { return rd('daily/' . $date, array('d' => array(), 'n' => array(), 'm' => array(), 'mn' => array())); }
function cnt($a) { return is_array($a) ? count($a) : 0; }
function hw_class($o) {
    if (empty($o['hw'])) return "noma'lum";
    $hw = $o['hw']; $weak = preg_match('/intel.*(hd|gma|uhd)|sis |via /i', $hw['gpu']);
    if ($hw['ram'] < 3500 || $hw['cpu'] <= 2 || ($weak && $hw['ram'] < 6000)) return 'kuchsiz';
    if ($hw['ram'] >= 8000 && $hw['cpu'] >= 4 && !$weak) return 'kuchli';
    return "o'rtacha";
}
function all_of($dir) {
    $out = array();
    foreach ((array)glob(XC_DIR . '/' . $dir . '/*.php') as $f) { $id = basename($f, '.php'); $o = rd($dir . '/' . $id, null); if ($o) { if (!isset($o['id'])) $o['id'] = $id; $out[] = $o; } }
    return $out;
}
$CFG = rd('config', array());
function cfg_save() { global $CFG; wr('config', $CFG); }

/* ---------- API (kalit bilan, sessiyasiz): admin.php?api=stats&key=... ---------- */
if (isset($_GET['api'])) {
    header('Content-Type: application/json; charset=utf-8');
    $ok = false;
    foreach ((array)(isset($CFG['api']) ? $CFG['api'] : array()) as $k) if (hash_equals($k['k'], g('key'))) $ok = true;
    if (!$ok) { http_response_code(403); echo json_encode(array('ok' => false, 'err' => 'key')); exit; }
    $days = max(1, min(90, (int)g('days', 7))); $ser = array();
    for ($i = $days - 1; $i >= 0; $i--) { $d = date('Y-m-d', strtotime("-$i day")); $x = day($d); $ser[] = array('date' => $d, 'xclient' => cnt($x['d']), 'xclient_new' => cnt($x['n']), 'nextclient' => cnt($x['m']), 'nextclient_new' => cnt($x['mn'])); }
    echo json_encode(array('ok' => true, 'installs' => count(glob(XC_DIR . '/dev/*.php')), 'nextclient_devices' => count((array)glob(XC_DIR . '/nc/*.php')), 'accounts' => count((array)glob(XC_DIR . '/users/*.php')), 'days' => $ser));
    exit;
}

session_start();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
@mkdir(XC_DIR, 0755, true);
function csrf() { if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = rnd(16); return $_SESSION['csrf']; }
function csrf_in() { return '<input type="hidden" name="csrf" value="' . csrf() . '">'; }
function csrf_ok() { return isset($_POST['csrf'], $_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $_POST['csrf']); }
function flash($m) { $_SESSION['flash'] = $m; }
function go($q) { header('Location: admin.php' . $q); exit; }
$adm = rd('admin', null);
$msg = '';

/* ---------- birinchi sozlash ---------- */
if (!$adm) {
    $kf = XC_DIR . '/ADMIN_KOD.php';
    if (!is_file($kf)) @file_put_contents($kf, XC_GUARD . "Admin panel kodi: " . str_pad((string)(function_exists('random_int') ? random_int(0, 99999999) : mt_rand(0, 99999999)), 8, '0', STR_PAD_LEFT) . "\n");
    preg_match('/(\d{8})/', (string)@file_get_contents($kf), $km);
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!$km || !hash_equals($km[1], pp('code'))) $msg = 'Kod noto\'g\'ri';
        elseif (strlen(pp('pass')) < 8) $msg = 'Parol kamida 8 belgi bo\'lsin';
        else { wr('admin', array('pass' => password_hash(pp('pass'), PASSWORD_DEFAULT))); @unlink($kf); session_regenerate_id(true); $_SESSION['adm'] = 1; go(''); }
    }
    head('Sozlash');
    echo '<div class="login"><h1><span>X</span> CLIENT</h1><p class="mut">Birinchi kirish. FastPanel\'da <b>mmb/xc_data/ADMIN_KOD.php</b> faylini oching, undagi 8 xonali kodni yozing va panel parolini o\'ylab toping.</p>'
        . ($msg ? '<div class="err">' . h($msg) . '</div>' : '')
        . '<form method="post"><input name="code" placeholder="8 xonali kod" autocomplete="off"><input name="pass" type="password" placeholder="Yangi parol (8+ belgi)"><button class="btn red">Saqlash va kirish</button></form></div>';
    foot(); exit;
}
/* ---------- kirish ---------- */
if (g('logout')) { $_SESSION = array(); session_destroy(); go(''); }
if (empty($_SESSION['adm'])) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $lk = rd('admin_lock', array('n' => 0, 't' => 0));
        if ($lk['n'] >= 5 && time() - $lk['t'] < 600) $msg = 'Ko\'p urinish. 10 daqiqadan keyin qayta urinib ko\'ring';
        elseif (password_verify(pp('pass'), $adm['pass'])) { wr('admin_lock', array('n' => 0, 't' => 0)); session_regenerate_id(true); $_SESSION['adm'] = 1; go(''); }
        else { usleep(700000); wr('admin_lock', array('n' => $lk['n'] + 1, 't' => time())); $msg = 'Parol noto\'g\'ri'; }
    }
    head('Kirish');
    echo '<div class="login"><h1><span>X</span> CLIENT</h1><p class="mut">Admin panel</p>' . ($msg ? '<div class="err">' . h($msg) . '</div>' : '')
        . '<form method="post"><input name="pass" type="password" placeholder="Parol" autofocus><button class="btn red">Kirish</button></form></div>';
    foot(); exit;
}

/* ---------- amallar (POST) ---------- */
$P = g('p', 'dash');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) go('?p=' . urlencode($P));
    $act = pp('act');
    $safeId = function ($s) { return preg_replace('/[^A-Za-z0-9_\-]/', '', (string)$s); };
    if ($act === 'dev_del') {
        foreach ((array)pp('ids', array()) as $id) { $id = $safeId($id); if ($id !== '') @unlink(XC_DIR . '/dev/' . $id . '.php'); }
        flash("O'chirildi"); go('?p=installs');
    }
    if ($act === 'player_del') {
        $src = pp('src') === 'nc' ? 'nc' : 'dev'; @unlink(XC_DIR . '/' . $src . '/' . $safeId(pp('id')) . '.php');
        flash("O'yinchi o'chirildi"); go('?p=players&src=' . ($src === 'nc' ? 'nc' : 'xc'));
    }
    if ($act === 'acc_vip' || $act === 'acc_pass' || $act === 'acc_del') {
        $l = strtolower($safeId(pp('login'))); $u = rd('users/' . $l, null);
        if ($u && $act === 'acc_vip') { $u['vip'] = empty($u['vip']); wr('users/' . $l, $u); flash($l . ': VIP ' . ($u['vip'] ? 'berildi' : 'olindi')); }
        if ($u && $act === 'acc_pass') { $np = substr(rnd(6), 0, 10); $u['pass'] = password_hash($np, PASSWORD_DEFAULT); $u['pwchanged'] = time(); wr('users/' . $l, $u); flash($l . ' uchun yangi parol: ' . $np . '  (o\'yinchiga yuboring)'); }
        if ($u && $act === 'acc_del') { @unlink(XC_DIR . '/users/' . $l . '.php'); flash($l . " o'chirildi"); }
        go('?p=accounts&q=' . urlencode(g('q')));
    }
    if ($act === 'ann_add' && pp('text') !== '') {
        $a = rd('announce', array());
        array_unshift($a, array('id' => substr(rnd(4), 0, 8), 'text' => mb_substr(pp('text'), 0, 400, 'UTF-8'), 'type' => in_array(pp('type'), array('info', 'warn', 'promo')) ? pp('type') : 'info',
            't' => time(), 'until' => (int)pp('days') > 0 ? time() + 86400 * (int)pp('days') : 0));
        wr('announce', array_slice($a, 0, 30)); flash("E'lon qo'shildi - o'yinchilar menyusida 5 daqiqa ichida chiqadi"); go('?p=ann');
    }
    if ($act === 'ann_del') { $a = array(); foreach (rd('announce', array()) as $x) if ($x['id'] !== pp('id')) $a[] = $x; wr('announce', $a); flash("E'lon o'chirildi"); go('?p=ann'); }
    if ($act === 'rep_del') { @unlink(XC_DIR . '/reports/' . basename($safeId(pp('id'))) . '.php'); flash("O'chirildi"); go('?p=reports'); }
    if ($act === 'pack_new') {
        $id = strtolower(preg_replace('/[^a-z0-9_\-]/i', '', pp('id')));
        if ($id === '') { flash('Paket nomi: lotin harflar, raqam, _ yoki -'); go('?p=packs'); }
        @mkdir(PACKS_DIR . '/' . $id . '/files', 0755, true);
        @file_put_contents(PACKS_DIR . '/' . $id . '/pack.json', json_encode(array('name' => pp('name') !== '' ? pp('name') : $id, 'desc' => pp('desc'), 'type' => pp('type'))));
        flash("Paket yaratildi: " . $id); go('?p=packs&id=' . $id);
    }
    if ($act === 'pack_up') {
        $id = strtolower(preg_replace('/[^a-z0-9_\-]/i', '', pp('id')));
        $rel = trim(str_replace('\\', '/', pp('path')), '/');
        if ($rel === '' && isset($_FILES['f']['name'])) $rel = 'cstrike/' . basename($_FILES['f']['name']);
        if (!is_dir(PACKS_DIR . '/' . $id) || strpos($rel, '..') !== false || !preg_match('#^[A-Za-z0-9_\-./ ]+$#', $rel) || empty($_FILES['f']['tmp_name']) || !is_uploaded_file($_FILES['f']['tmp_name'])) { flash('Fayl yuklanmadi (yo\'l yoki fayl noto\'g\'ri)'); go('?p=packs&id=' . $id); }
        if (preg_match('/\.(php\d?|phtml|phar|htaccess|cgi|pl|sh)$/i', $rel)) { flash('Bu turdagi faylni yuklab bo\'lmaydi'); go('?p=packs&id=' . $id); }
        $dst = PACKS_DIR . '/' . $id . '/files/' . $rel;
        @mkdir(dirname($dst), 0755, true);
        move_uploaded_file($_FILES['f']['tmp_name'], $dst);
        flash('Yuklandi: ' . $rel); go('?p=packs&id=' . $id);
    }
    if ($act === 'pack_rm') {
        $id = strtolower(preg_replace('/[^a-z0-9_\-]/i', '', pp('id'))); $rel = pp('path');
        if ($id !== '' && $rel !== '' && strpos($rel, '..') === false) @unlink(PACKS_DIR . '/' . $id . '/files/' . $rel);
        go('?p=packs&id=' . $id);
    }
    if ($act === 'pack_del') {
        $id = strtolower(preg_replace('/[^a-z0-9_\-]/i', '', pp('id')));
        if ($id !== '') { $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(PACKS_DIR . '/' . $id, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST); foreach ($it as $f) { $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname()); } @rmdir(PACKS_DIR . '/' . $id); }
        flash("Paket o'chirildi"); go('?p=packs');
    }
    if ($act === 'rel_save') {
        $ch = pp('ch') === 'beta' ? 'beta' : 'stable'; $cfg = rel_rd('release', array()); $r = isset($cfg[$ch]) ? $cfg[$ch] : array();
        $r['mode'] = in_array(pp('mode'), array('auto', 'manual', 'pause')) ? pp('mode') : 'auto';
        $r['min'] = max(0, (int)pp('min')); $r['msg'] = mb_substr(str_replace(array("\r", "\n"), ' ', pp('msg')), 0, 200, 'UTF-8');
        if ($r['mode'] === 'manual' && empty($r['base'])) { $l = rel_latest($ch); if ($l) { $r['build'] = $l['build']; $r['version'] = $l['version']; $r['base'] = $l['base']; } }
        $cfg[$ch] = $r; rel_wr('release', $cfg); flash($ch . ': saqlandi ✓'); go('?p=upd');
    }
    if ($act === 'rel_pin') {
        $ch = pp('ch') === 'beta' ? 'beta' : 'stable'; $h = rel_rd('rel_hist', array()); $b = (int)pp('build');
        if (isset($h[$b])) { $cfg = rel_rd('release', array()); $r = isset($cfg[$ch]) ? $cfg[$ch] : array();
            $r['mode'] = 'manual'; $r['build'] = $b; $r['version'] = $h[$b]['version']; $r['base'] = $h[$b]['base']; $cfg[$ch] = $r; rel_wr('release', $cfg);
            flash($ch . ': hamma o\'yinchilarga build ' . $b . ' beriladi ✓'); }
        go('?p=upd');
    }
    if ($act === 'acc_msg' && pp('text') !== '') {
        $l = strtolower($safeId(pp('login'))); $u = rd('users/' . $l, null);
        if ($u) { if (empty($u['msgs'])) $u['msgs'] = array(); $u['msgs'][] = array('t' => time(), 'text' => mb_substr(pp('text'), 0, 500, 'UTF-8')); $u['msgs'] = array_slice($u['msgs'], -10); wr('users/' . $l, $u);
            flash($l . ' ga xabar yuborildi - menyuni ochganda (1 daqiqa ichida) ko\'radi'); }
        go(pp('back') === 'online' ? '?p=online' : '?p=accounts&q=' . urlencode(g('q')));
    }
    if ($act === 'wn_save') {
        $items = array(); foreach (preg_split('/\r?\n/', (string)pp('items')) as $x) { $x = trim($x); if ($x !== '') $items[] = mb_substr($x, 0, 300, 'UTF-8'); }
        wr('whatsnew', $items ? array('id' => substr(rnd(4), 0, 8), 'title' => mb_substr(pp('title'), 0, 80, 'UTF-8'), 'ver' => mb_substr(pp('ver'), 0, 40, 'UTF-8'), 'items' => array_slice($items, 0, 20), 't' => time()) : null);
        flash($items ? '"Nima yangi" saqlandi - har o\'yinchida bir marta chiqadi' : '"Nima yangi" o\'chirildi'); go('?p=upd');
    }
    if ($act === 'rel_check') { rel_latest('stable', true); rel_latest('beta', true); flash('GitHub tekshirildi'); go('?p=upd'); }
    if ($act === 'pack_all') {
        $id = strtolower(preg_replace('/[^a-z0-9_\-]/i', '', pp('id'))); $f = PACKS_DIR . '/' . $id . '/pack.json';
        if ($id !== '' && is_dir(PACKS_DIR . '/' . $id)) {
            $m = json_decode((string)@file_get_contents($f), true); if (!is_array($m)) $m = array('name' => $id);
            if (pp('do') === 'on') { $m['all'] = true; if (empty($m['ver'])) $m['ver'] = 1; flash('Paket endi HAMMA o\'yinchilarga o\'rnatiladi (XCLauncher.exe ochilganda)'); }
            if (pp('do') === 'off') { $m['all'] = false; flash('Paket majburiy emas - o\'yinchilarda olib tashlanadi'); }
            if (pp('do') === 'bump') { $m['ver'] = (isset($m['ver']) ? (int)$m['ver'] : 1) + 1; flash('Versiya ' . $m['ver'] . ' - hammada qayta o\'rnatiladi'); }
            @file_put_contents($f, json_encode($m));
        }
        go('?p=packs&id=' . $id);
    }
    if ($act === 'tg_save') {
        $CFG['tg_token'] = preg_replace('/[^A-Za-z0-9:_\-]/', '', pp('token')); $CFG['tg_chat'] = preg_replace('/[^0-9\-@A-Za-z_]/', '', pp('chat'));
        $CFG['tg_ev'] = array(); foreach (array('install', 'account', 'report') as $e) $CFG['tg_ev'][$e] = pp('ev_' . $e) ? 1 : 0;
        cfg_save(); flash('Telegram sozlamalari saqlandi'); go('?p=tg');
    }
    if ($act === 'tg_test') {
        $ctx = stream_context_create(array('http' => array('method' => 'POST', 'timeout' => 5, 'ignore_errors' => true, 'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query(array('chat_id' => isset($CFG['tg_chat']) ? $CFG['tg_chat'] : '', 'text' => "X CLIENT admin: sinov xabari ✓")))));
        $r = json_decode((string)@file_get_contents('https://api.telegram.org/bot' . (isset($CFG['tg_token']) ? $CFG['tg_token'] : '') . '/sendMessage', false, $ctx), true);
        flash(!empty($r['ok']) ? 'Sinov xabari yuborildi ✓' : 'Yuborilmadi: ' . (isset($r['description']) ? $r['description'] : 'token yoki chat id noto\'g\'ri')); go('?p=tg');
    }
    if ($act === 'api_new') { if (!isset($CFG['api'])) $CFG['api'] = array(); $CFG['api'][] = array('k' => rnd(20), 'name' => mb_substr(pp('name') !== '' ? pp('name') : 'Kalit', 0, 40, 'UTF-8'), 't' => time()); cfg_save(); flash('Yangi API kalit yaratildi'); go('?p=api'); }
    if ($act === 'api_del') { $n = array(); foreach ((array)$CFG['api'] as $k) if ($k['k'] !== pp('k')) $n[] = $k; $CFG['api'] = $n; cfg_save(); flash("Kalit o'chirildi"); go('?p=api'); }
    if ($act === 'pass') {
        if (!password_verify(pp('old'), $adm['pass'])) flash('Eski parol noto\'g\'ri');
        elseif (strlen(pp('new')) < 8) flash('Yangi parol kamida 8 belgi');
        else { $adm['pass'] = password_hash(pp('new'), PASSWORD_DEFAULT); wr('admin', $adm); flash('Parol almashtirildi ✓'); }
        go('?p=settings');
    }
    if ($act === 'clean_days') {
        $keep = max(30, (int)pp('keep')); $n = 0;
        foreach ((array)glob(XC_DIR . '/daily/*.php') as $f) if (basename($f, '.php') < date('Y-m-d', strtotime("-$keep day"))) { @unlink($f); $n++; }
        flash($n . " ta eski kun o'chirildi"); go('?p=settings');
    }
    go('?p=' . urlencode($P));
}

/* ---------- CSV ---------- */
if ($P === 'installs' && g('csv')) {
    header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="xclient-installs-' . date('Ymd') . '.csv"');
    echo "\xEF\xBB\xBFUID;IP;Davlat;Versiya;Windows;Ekran;RAM MB;CPU;GPU;Hamkor;O'rnatilgan;Oxirgi\n";
    foreach (all_of('dev') as $o) echo implode(';', array($o['id'], isset($o['ip']) ? $o['ip'] : '', isset($o['cc']) ? strtoupper($o['cc']) : '', isset($o['ver']) ? $o['ver'] : '', isset($o['os']) ? $o['os'] : '', isset($o['res']) ? $o['res'] : '',
        isset($o['hw']['ram']) ? $o['hw']['ram'] : '', isset($o['hw']['cpu']) ? $o['hw']['cpu'] : '', isset($o['hw']['gpu']) ? str_replace(';', ',', $o['hw']['gpu']) : '', isset($o['pt']) ? $o['pt'] : '', dt(isset($o['first']) ? $o['first'] : 0), dt(isset($o['seen']) ? $o['seen'] : 0))) . "\n";
    exit;
}

/* ---------- sahifa ---------- */
$NAV = array('dash' => array('Infopanel', '⌂'), 'online' => array('Onlayn', '●'), 'players' => array("O'yinchilar", '☺'), 'installs' => array("O'rnatishlar", '↓'), 'accounts' => array('Akkauntlar', '✉'),
    'ann' => array("E'lonlar", '!'), 'reports' => array('Xatolar', '⚠'), 'upd' => array('Yangilanishlar', '⟳'), 'packs' => array('Paketlar', '▤'), 'tg' => array('Telegram', '➤'), 'api' => array('API', '⌘'), 'settings' => array('Sozlamalar', '⚙'));
$devCount = count((array)glob(XC_DIR . '/dev/*.php')); $ncCount = count((array)glob(XC_DIR . '/nc/*.php')); $accCount = count((array)glob(XC_DIR . '/users/*.php')); $repCount = count((array)glob(XC_DIR . '/reports/*.php'));
$badge = array('players' => $devCount + $ncCount, 'installs' => $devCount, 'accounts' => $accCount, 'reports' => $repCount);
head(isset($NAV[$P]) ? $NAV[$P][0] : 'Admin');
echo '<div class="side"><div class="brand"><span>X</span> CLIENT<small>admin panel</small></div>';
foreach ($NAV as $k => $n) echo '<a href="?p=' . $k . '" class="' . ($P === $k || ($P === 'player' && $k === 'players') || ($P === 'report' && $k === 'reports') ? 'on' : '') . '"><i>' . $n[1] . '</i>' . h($n[0]) . (!empty($badge[$k]) ? '<em>' . $badge[$k] . '</em>' : '') . '</a>';
echo '<div class="sep"></div><a href="' . NDIRECT . '" target="_blank"><i>↗</i>NextClient (nDirect)</a><a href="?logout=1" class="out"><i>⏻</i>Chiqish</a></div><div class="main">';
if (!empty($_SESSION['flash'])) { echo '<div class="flash">' . h($_SESSION['flash']) . '</div>'; unset($_SESSION['flash']); }

/* ===== INFOPANEL ===== */
if ($P === 'dash') {
    $range = g('r', 'w'); $days = $range === 'q' ? 90 : ($range === 'm' ? 30 : 7);
    $src = g('s', 'xc') === 'nc' ? 'nc' : 'xc';
    $ser = array();
    for ($i = max($days, 14) - 1; $i >= 0; $i--) { $ts = strtotime("-$i day"); $x = day(date('Y-m-d', $ts)); $ser[] = array('l' => date('d.m', $ts), 'xc' => cnt($x['d']), 'xn' => cnt($x['n']), 'nc' => cnt($x['m']), 'nn' => cnt($x['mn'])); }
    $t = $ser[count($ser) - 1]; $y = $ser[count($ser) - 2]; $last14 = array_slice($ser, -14);
    $users = all_of('users'); $online = 0; foreach ($users as $u) if (!empty($u['seen']) && time() - $u['seen'] < 150) $online++;
    $card = function ($cls, $val, $title, $prev, $key) use ($last14) {
        $d = $val - $prev; $tr = $d > 0 ? '<span class="up">' . $d . ' ko\'p, kechagidan ↗</span>' : ($d < 0 ? '<span class="dn">' . (-$d) . ' kam, kechagidan ↘</span>' : '<span class="mut">kechagidek</span>');
        $sp = ''; if ($key) { $mx = 1; foreach ($last14 as $s) $mx = max($mx, $s[$key]); $pts = array(); foreach ($last14 as $i => $s) $pts[] = round($i * 200 / 13) . ',' . round(34 - 30 * $s[$key] / $mx); $sp = '<svg class="spark" viewBox="0 0 200 36" preserveAspectRatio="none"><polyline points="' . implode(' ', $pts) . '"/></svg>'; }
        return '<div class="card ' . $cls . '"><span class="ct">' . $title . '</span><b>' . $val . '</b>' . ($prev === null ? '' : $tr) . $sp . '</div>';
    };
    echo '<h1>Infopanel</h1><div class="cards">'
        . $card('xc', $t['xc'], 'X CLIENT o\'yinchilar bugun', $y['xc'], 'xc')
        . $card('nc', $t['nc'], 'NextClient o\'yinchilar bugun', $y['nc'], 'nc')
        . $card('xc', $t['xn'], 'X CLIENT o\'rnatishlar bugun', $y['xn'], 'xn')
        . $card('nc', $t['nn'], 'NextClient yangi o\'yinchilar bugun', $y['nn'], 'nn')
        . '<div class="card"><span class="ct">Hozir onlayn</span><b>' . $online . '</b><span class="mut">akkaunt bilan, menyu yoki serverda</span></div>'
        . '<div class="card"><span class="ct">Jami</span><b>' . $devCount . '</b><span class="mut">X CLIENT o\'rnatish · ' . $ncCount . ' NextClient · ' . $accCount . ' akkaunt</span></div></div>';
    $ser = array_slice($ser, -$days);
    // chiziqli grafik: Unikal / Yangi / Eski
    $ku = $src === 'nc' ? 'nc' : 'xc'; $kn = $src === 'nc' ? 'nn' : 'xn';
    $lines = array(array('Unikal', '#4a90e2', array()), array('Yangi', '#34d058', array()), array('Eski', '#f5a623', array()));
    foreach ($ser as $s) { $lines[0][2][] = $s[$ku]; $lines[1][2][] = $s[$kn]; $lines[2][2][] = max(0, $s[$ku] - $s[$kn]); }
    echo '<div class="panel"><div class="ph">Unikal o\'yinchilar grafigi'
        . '<span class="seg"><a href="?r=' . $range . '&s=xc" class="' . ($src === 'xc' ? 'on' : '') . '">X CLIENT</a><a href="?r=' . $range . '&s=nc" class="' . ($src === 'nc' ? 'on' : '') . '">NextClient</a></span>'
        . '<span class="seg r">' . implode('', array_map(function ($r) use ($range, $src) { $n = array('w' => 'Hafta', 'm' => 'Oy', 'q' => '3 oy'); return '<a href="?r=' . $r . '&s=' . $src . '" class="' . ($r === $range ? 'on' : '') . '">' . $n[$r] . '</a>'; }, array('w', 'm', 'q'))) . '</span></div>'
        . line_chart($ser, $lines) . '</div>';
    // ustunli: X CLIENT va NextClient
    echo '<div class="panel"><div class="ph">NextClient va X CLIENT <span class="lg"><i style="background:#3d86df"></i>NextClient <i style="background:#c84bdc"></i>X CLIENT</span></div>' . bar_chart($ser) . '</div>';
    // diagrammalar
    $devs = all_of('dev'); $ncs = all_of('nc');
    $agg = function ($list, $fn) { $r = array(); foreach ($list as $o) { $k = $fn($o); if ($k === '' || $k === null) $k = "noma'lum"; $r[$k] = (isset($r[$k]) ? $r[$k] : 0) + 1; } arsort($r); return $r; };
    $cc = function ($o) { return isset($o['cc']) && $o['cc'] !== '' ? strtoupper($o['cc']) : ''; };
    echo '<div class="grid3">'
        . '<div class="panel"><div class="ph">Davlatlar · X CLIENT</div>' . pie($agg($devs, $cc), true) . '</div>'
        . '<div class="panel"><div class="ph">Davlatlar · NextClient</div>' . pie($agg($ncs, $cc), true) . '</div>'
        . '<div class="panel"><div class="ph">X CLIENT versiyalari</div>' . pie($agg($devs, function ($o) { return isset($o['ver']) ? 'v' . $o['ver'] : ''; })) . '</div>'
        . '<div class="panel"><div class="ph">Windows</div>' . pie($agg($devs, function ($o) { return isset($o['os']) && is_string($o['os']) ? $o['os'] : ''; })) . '</div>'
        . '<div class="panel"><div class="ph">Ekran o\'lchami</div>' . pie($agg(array_merge($devs, $ncs), function ($o) { return isset($o['res']) ? $o['res'] : ''; })) . '</div>'
        . '<div class="panel"><div class="ph">Kompyuter quvvati</div>' . pie($agg($devs, 'hw_class')) . '</div>'
        . '<div class="panel"><div class="ph">Hamkorlar</div>' . pie($agg($devs, function ($o) { return isset($o['pt']) ? $o['pt'] : ''; })) . '</div>'
        . '<div class="panel"><div class="ph">Vetka</div>' . pie($agg($devs, function ($o) { return isset($o['ch']) ? $o['ch'] : ''; })) . '</div>'
        . '<div class="panel"><div class="ph">Videokartalar</div>' . pie($agg($devs, function ($o) { return isset($o['hw']['gpu']) ? $o['hw']['gpu'] : ''; })) . '</div>'
        . '</div>';
}

/* ===== O'YINCHILAR ===== */
if ($P === 'players') {
    $src = g('src', 'xc') === 'nc' ? 'nc' : 'xc'; $q = g('q');
    $list = all_of($src === 'nc' ? 'nc' : 'dev');
    $nickByIp = array(); if ($src === 'xc') foreach (all_of('nc') as $n) if (!empty($n['nick']) && !empty($n['ip'])) $nickByIp[$n['ip']] = $n['nick'];
    foreach ($list as &$o) { if ($src === 'xc' && empty($o['nick']) && !empty($o['ip']) && isset($nickByIp[$o['ip']])) $o['nick'] = $nickByIp[$o['ip']]; } unset($o);
    if ($q !== '') $list = array_values(array_filter($list, function ($o) use ($q) { return stripos($o['id'] . ' ' . (isset($o['nick']) ? $o['nick'] : '') . ' ' . (isset($o['ip']) ? $o['ip'] : ''), $q) !== false; }));
    $sort = g('sort', 'first');
    usort($list, function ($a, $b) use ($sort) { $x = isset($a[$sort]) ? $a[$sort] : 0; $y = isset($b[$sort]) ? $b[$sort] : 0; return $x == $y ? 0 : ($x < $y ? 1 : -1); });
    echo '<h1>O\'yinchilar</h1><div class="panel"><div class="ph"><span class="seg"><a href="?p=players&src=xc" class="' . ($src === 'xc' ? 'on' : '') . '">X CLIENT <em>' . $devCount . '</em></a><a href="?p=players&src=nc" class="' . ($src === 'nc' ? 'on' : '') . '">NextClient <em>' . $ncCount . '</em></a></span>'
        . '<form class="srch r"><input type="hidden" name="p" value="players"><input type="hidden" name="src" value="' . $src . '"><input name="q" value="' . h($q) . '" placeholder="UID, nik yoki IP..."><button class="btn">Qidirish</button></form></div>';
    $pg = pager(count($list)); $rows = array_slice($list, $pg['off'], PER_PAGE);
    $sl = function ($k, $t) use ($src, $q, $sort) { return '<a href="?p=players&src=' . $src . '&q=' . urlencode($q) . '&sort=' . $k . '"' . ($sort === $k ? ' class="on"' : '') . '>' . $t . ($sort === $k ? ' ↓' : '') . '</a>'; };
    echo '<table class="list"><tr><th>UID</th><th>Nik</th><th>IP manzil</th><th>Davlat</th><th>' . ($src === 'xc' ? 'Versiya' : 'Faol kunlar') . '</th><th>' . $sl('first', "Qo'shilgan") . '</th><th>' . $sl('seen', 'Yangilangan') . '</th><th></th></tr>';
    foreach ($rows as $o) {
        echo '<tr><td class="mono">' . h(strtoupper($o['id'])) . '</td><td>' . h(isset($o['nick']) ? $o['nick'] : '—') . '</td><td>' . h(isset($o['ip']) ? $o['ip'] : '—') . '</td><td>' . flag(isset($o['cc']) ? $o['cc'] : '') . ' ' . h(isset($o['cc']) ? strtoupper($o['cc']) : '') . '</td>'
            . '<td>' . ($src === 'xc' ? 'v' . h(isset($o['ver']) ? $o['ver'] : '?') : (int)(isset($o['days']) ? $o['days'] : 0)) . '</td><td>' . dt(isset($o['first']) ? $o['first'] : 0) . '</td><td>' . ago(isset($o['seen']) ? $o['seen'] : 0) . '</td>'
            . '<td class="r"><a class="lnk" href="?p=player&src=' . $src . '&id=' . urlencode($o['id']) . '">◉ Ko\'rish</a></td></tr>';
    }
    if (!$rows) echo '<tr><td colspan="8" class="mut">Hali o\'yinchi yo\'q</td></tr>';
    echo '</table>' . $pg['html'] . '</div>';
}
if ($P === 'player') {
    $src = g('src') === 'nc' ? 'nc' : 'xc'; $id = preg_replace('/[^A-Za-z0-9_\-]/', '', g('id'));
    $o = rd(($src === 'nc' ? 'nc/' : 'dev/') . $id, null);
    if (!$o) echo '<h1>Topilmadi</h1>';
    else {
        $hw = isset($o['hw']) ? $o['hw'] : null;
        $row = function ($k, $v) { return '<div class="kv"><span>' . $k . '</span><b>' . $v . '</b></div>'; };
        echo '<div class="crumb"><a href="?p=players&src=' . $src . '">O\'yinchilar</a> › ' . h(strtoupper($id)) . '</div><h1>' . ($src === 'xc' ? 'X CLIENT' : 'NextClient') . ' o\'yinchi</h1><div class="grid2">'
            . '<div class="panel"><div class="ph">Asosiy ma\'lumot</div>' . $row('UID', '<span class="mono">' . h(strtoupper($id)) . '</span>') . $row('IP manzil', h(isset($o['ip']) ? $o['ip'] : '—'))
            . $row('Nik', h(isset($o['nick']) ? $o['nick'] : '—')) . $row('Davlat', flag(isset($o['cc']) ? $o['cc'] : '') . ' ' . h(isset($o['cc']) ? strtoupper($o['cc']) : '—'))
            . ($src === 'xc' ? $row('Hamkor', h(isset($o['pt']) ? $o['pt'] : '—')) . $row('Vetka', h(isset($o['ch']) ? $o['ch'] : '—')) : '') . '</div>'
            . '<div class="panel"><div class="ph">Batafsil</div>' . $row('Ekran o\'lchami', h(isset($o['res']) ? $o['res'] : '—'))
            . ($src === 'xc' ? $row('X CLIENT versiyasi', 'v' . h(isset($o['ver']) ? $o['ver'] : '?')) . $row('Windows', h(isset($o['os']) ? $o['os'] : '—'))
                . $row('Kompyuter', $hw ? h(round($hw['ram'] / 1024) . ' GB RAM · ' . $hw['cpu'] . ' yadro · ' . $hw['gpu']) . ' <span class="tag">' . h(hw_class($o)) . '</span>' : '—')
                . $row('Ishga tushirishlar', (int)(isset($o['runs']) ? $o['runs'] : 0)) . $row('Kesh', (int)(isset($o['cachemb']) ? $o['cachemb'] : 0) . ' MB')
                . $row('Sozlamalar', h(implode(' · ', array_filter(array(!empty($o['beta']) ? 'beta' : '', !empty($o['prio']) ? 'tezlashtirish' : '', !empty($o['shots']) ? 'skrinshotlar' : '', !empty($o['packs']) ? 'paketlar: ' . $o['packs'] : '', !empty($o['spray']) ? 'spray' : '')))) ?: '—')
              : $row('Menyu versiyasi', h(isset($o['ver']) ? $o['ver'] : '—')) . $row('Faol kunlar', (int)(isset($o['days']) ? $o['days'] : 0)))
            . $row("Qo'shilgan", dt(isset($o['first']) ? $o['first'] : 0)) . $row('Yangilangan', dt(isset($o['seen']) ? $o['seen'] : 0)) . '</div></div>'
            . '<form method="post" onsubmit="return confirm(\'O\\\'chirilsinmi?\')">' . csrf_in() . '<input type="hidden" name="act" value="player_del"><input type="hidden" name="src" value="' . $src . '"><input type="hidden" name="id" value="' . h($id) . '"><button class="btn out">O\'yinchini o\'chirish</button></form>';
    }
}

/* ===== O'RNATISHLAR ===== */
if ($P === 'installs') {
    $list = all_of('dev'); $q = g('q');
    if ($q !== '') $list = array_values(array_filter($list, function ($o) use ($q) { return stripos($o['id'] . ' ' . (isset($o['ip']) ? $o['ip'] : '') . ' ' . (isset($o['pt']) ? $o['pt'] : ''), $q) !== false; }));
    usort($list, function ($a, $b) { return (isset($b['first']) ? $b['first'] : 0) - (isset($a['first']) ? $a['first'] : 0); });
    $pg = pager(count($list)); $rows = array_slice($list, $pg['off'], PER_PAGE);
    echo '<h1>O\'rnatishlar</h1><div class="panel"><div class="ph"><form class="srch"><input type="hidden" name="p" value="installs"><input name="q" value="' . h($q) . '" placeholder="UID, IP yoki hamkor..."><button class="btn">Qidirish</button></form><a class="btn r" href="?p=installs&csv=1">⇩ CSV yuklab olish</a></div>'
        . '<form method="post" onsubmit="return confirm(\'Belgilanganlar o\\\'chirilsinmi?\')">' . csrf_in() . '<input type="hidden" name="act" value="dev_del"><table class="list"><tr><th><input type="checkbox" onclick="var c=document.querySelectorAll(\'.ck\');for(var i=0;i<c.length;i++)c[i].checked=this.checked"></th><th>UID</th><th>Hamkor</th><th>Davlat</th><th>Versiya</th><th>Sana</th><th></th></tr>';
    foreach ($rows as $o) echo '<tr><td><input class="ck" type="checkbox" name="ids[]" value="' . h($o['id']) . '"></td><td class="mono">' . h(strtoupper($o['id'])) . '</td><td>' . h(isset($o['pt']) ? $o['pt'] : '—') . '</td><td>' . flag(isset($o['cc']) ? $o['cc'] : '') . '</td><td>v' . h(isset($o['ver']) ? $o['ver'] : '?') . '</td><td>' . dt(isset($o['first']) ? $o['first'] : 0) . '</td><td class="r"><a class="lnk" href="?p=player&src=xc&id=' . urlencode($o['id']) . '">◉ Ko\'rish</a></td></tr>';
    if (!$rows) echo '<tr><td colspan="7" class="mut">Hali o\'rnatish yo\'q</td></tr>';
    echo '</table><button class="btn out" style="margin-top:12px">🗑 Belgilanganlarni o\'chirish</button></form>' . $pg['html'] . '</div>';
}

/* ===== AKKAUNTLAR ===== */
if ($P === 'accounts') {
    $q = g('q'); $list = all_of('users');
    if ($q !== '') $list = array_values(array_filter($list, function ($u) use ($q) { return stripos($u['login'] . ' ' . $u['name'] . ' ' . (isset($u['email']) ? $u['email'] : '') . ' ' . $u['id'], $q) !== false; }));
    usort($list, function ($a, $b) { return (isset($b['seen']) ? $b['seen'] : 0) - (isset($a['seen']) ? $a['seen'] : 0); });
    $pg = pager(count($list)); $rows = array_slice($list, $pg['off'], PER_PAGE);
    echo '<h1>Akkauntlar</h1><div class="panel"><div class="ph"><form class="srch"><input type="hidden" name="p" value="accounts"><input name="q" value="' . h($q) . '" placeholder="Login, nom, email yoki ID..."><button class="btn">Qidirish</button></form></div>'
        . '<table class="list"><tr><th>Login</th><th>Nom</th><th>ID</th><th>Email</th><th>Daraja</th><th>O\'yin vaqti</th><th>Kompyuter</th><th>Oxirgi faollik</th><th>VIP</th><th></th></tr>';
    foreach ($rows as $u) {
        $on = !empty($u['seen']) && time() - $u['seen'] < 150;
        $f = function ($act, $label, $cls, $conf) use ($u, $q) { return '<form method="post" class="inl"' . ($conf ? ' onsubmit="return confirm(\'' . $conf . '\')"' : '') . '>' . csrf_in() . '<input type="hidden" name="act" value="' . $act . '"><input type="hidden" name="login" value="' . h($u['login']) . '"><button class="' . $cls . '">' . $label . '</button></form>'; };
        echo '<tr><td>' . ($on ? '<i class="dot"></i>' : '') . h($u['login']) . '</td><td>' . h($u['name']) . '</td><td class="mut">' . h($u['id']) . '</td><td>' . h(isset($u['email']) ? $u['email'] : '') . '</td>'
            . '<td>' . ((int)floor($u['xp'] / 1000) + 1) . '</td><td>' . round($u['xp'] / 60, 1) . ' soat</td><td>' . cnt(isset($u['devices']) ? $u['devices'] : null) . '</td><td>' . ago(isset($u['seen']) ? $u['seen'] : 0) . ($on && !empty($u['server']) ? '<br><small class="mut">' . h($u['server']) . '</small>' : '') . '</td>'
            . '<td>' . $f('acc_vip', !empty($u['vip']) ? 'VIP' : '—', 'tg' . (!empty($u['vip']) ? ' on' : ''), '') . '</td>'
            . '<td class="r">' . msg_form($u['login'], 'accounts') . ' ' . $f('acc_pass', 'Parol tiklash', 'lnk', 'Yangi parol yaratilsinmi?') . ' ' . $f('acc_del', "O'chirish", 'lnk red', "Akkaunt butunlay o\\'chirilsinmi?") . '</td></tr>';
    }
    if (!$rows) echo '<tr><td colspan="10" class="mut">Akkaunt topilmadi</td></tr>';
    echo '</table>' . $pg['html'] . '</div>';
}

/* ===== ONLAYN ===== */
if ($P === 'online') {
    $by = array(); $menu = array(); $n = 0;
    foreach (all_of('users') as $u) {
        if (empty($u['seen']) || time() - $u['seen'] >= 150) continue;
        $n++;
        if (!empty($u['server'])) $by[$u['server']][] = $u; else $menu[] = $u;
    }
    uasort($by, function ($a, $b) { return count($b) - count($a); });
    $dev = 0; foreach ((array)glob(XC_DIR . '/dev/*.php') as $f) if (time() - filemtime($f) < 900) $dev++;
    echo '<h1>Onlayn</h1><div class="cards"><div class="card xc"><b>' . $n . '</b><span class="ct">Akkaunt bilan onlayn</span></div><div class="card nc"><b>' . count($by) . '</b><span class="ct">Serverlarda</span></div><div class="card"><b>' . count($menu) . '</b><span class="ct">Menyuda</span></div><div class="card"><b>' . $dev . '</b><span class="ct">XCLauncher 15 daqiqada ochilgan</span></div></div>';
    $row = function ($u) { return '<tr><td><i class="dot"></i>' . h($u['name']) . ' <small class="mut">' . h($u['login']) . '</small></td><td>' . (!empty($u['map']) ? h($u['map']) : '—') . '</td><td>' . ((int)floor($u['xp'] / 1000) + 1) . '-daraja</td><td class="r">' . msg_form($u['login'], 'online') . '</td></tr>'; };
    foreach ($by as $srv => $us) {
        echo '<div class="panel"><div class="ph">' . h($srv) . ' <span class="mut">· ' . count($us) . ' o\'yinchi</span> <a class="lnk r" href="steam://connect/' . h($srv) . '">Ulanish</a></div><table class="list"><tr><th>O\'yinchi</th><th>Xarita</th><th>Daraja</th><th></th></tr>';
        foreach ($us as $u) echo $row($u);
        echo '</table></div>';
    }
    if ($menu) { echo '<div class="panel"><div class="ph">Bosh menyuda</div><table class="list"><tr><th>O\'yinchi</th><th>Xarita</th><th>Daraja</th><th></th></tr>'; foreach ($menu as $u) echo $row($u); echo '</table></div>'; }
    if (!$n) echo '<div class="panel mut">Hozir akkaunt bilan kirgan hech kim onlayn emas. (Akkauntsiz o\'ynayotganlar bu yerda ko\'rinmaydi.)</div>';
    echo '<div class="mut small">Har daqiqada yangilanadi. Sahifani yangilang (F5).</div>';
}

/* ===== E'LONLAR ===== */
if ($P === 'ann') {
    echo '<h1>E\'lonlar</h1><div class="panel"><div class="ph">Yangi e\'lon</div><form method="post" class="frm">' . csrf_in() . '<input type="hidden" name="act" value="ann_add">'
        . '<textarea name="text" maxlength="400" placeholder="Masalan: Bugun 20:00 da UZB ARENA serverida turnir! Sovrin - 1 oy VIP"></textarea>'
        . '<div class="row"><select name="type"><option value="info">Ma\'lumot (ko\'k)</option><option value="promo">Aksiya (qizil)</option><option value="warn">Ogohlantirish (sariq)</option></select>'
        . '<select name="days"><option value="1">1 kun</option><option value="3">3 kun</option><option value="7" selected>7 kun</option><option value="30">30 kun</option><option value="0">Muddatsiz</option></select><button class="btn red">E\'lon qilish</button></div>'
        . '<div class="mut small">E\'lon barcha o\'yinchilarning X CLIENT menyusida, o\'ng tomonda chiqadi. O\'yinchi uni yopishi mumkin.</div></form></div>';
    echo '<div class="panel"><div class="ph">Barcha e\'lonlar</div><table class="list"><tr><th>Matn</th><th>Turi</th><th>Qo\'shilgan</th><th>Muddati</th><th></th></tr>';
    foreach (rd('announce', array()) as $a) echo '<tr><td style="white-space:normal">' . h($a['text']) . '</td><td><span class="tag ' . h($a['type']) . '">' . h($a['type']) . '</span></td><td>' . dt($a['t']) . '</td><td>' . ($a['until'] ? ($a['until'] < time() ? '<span class="dn">tugagan</span>' : dt($a['until'])) : 'muddatsiz') . '</td>'
        . '<td class="r"><form method="post" class="inl">' . csrf_in() . '<input type="hidden" name="act" value="ann_del"><input type="hidden" name="id" value="' . h($a['id']) . '"><button class="lnk red">O\'chirish</button></form></td></tr>';
    echo '</table></div>';
}

/* ===== XATOLAR ===== */
if ($P === 'reports' || $P === 'report') {
    if ($P === 'report') {
        $id = preg_replace('/[^A-Za-z0-9_\-]/', '', g('id')); $r = rd('reports/' . $id, null);
        echo '<div class="crumb"><a href="?p=reports">Xatolar</a> › ' . h($id) . '</div>';
        if ($r) echo '<h1>Xatolik haqida xabar</h1><div class="panel"><div class="kv"><span>Kimdan</span><b>' . h($r['who']) . '</b></div><div class="kv"><span>Versiya</span><b>' . h($r['ver']) . '</b></div><div class="kv"><span>Sana</span><b>' . dt($r['t']) . '</b></div></div><div class="panel"><div class="ph">Konsol logi</div><pre>' . h($r['log']) . '</pre></div>';
    } else {
        $files = (array)glob(XC_DIR . '/reports/*.php'); rsort($files);
        echo '<h1>Xatolar</h1><div class="panel"><table class="list"><tr><th>Sana</th><th>Kimdan</th><th>Versiya</th><th>Hajm</th><th></th></tr>';
        foreach (array_slice($files, 0, 200) as $f) { $id = basename($f, '.php'); $r = rd('reports/' . $id, array());
            echo '<tr><td>' . dt(isset($r['t']) ? $r['t'] : 0) . '</td><td>' . h(isset($r['who']) ? $r['who'] : '') . '</td><td>' . h(isset($r['ver']) ? $r['ver'] : '') . '</td><td>' . size_h(filesize($f)) . '</td>'
                . '<td class="r"><a class="lnk" href="?p=report&id=' . urlencode($id) . '">◉ Ko\'rish</a> <form method="post" class="inl">' . csrf_in() . '<input type="hidden" name="act" value="rep_del"><input type="hidden" name="id" value="' . h($id) . '"><button class="lnk red">O\'chirish</button></form></td></tr>'; }
        if (!$files) echo '<tr><td colspan="5" class="mut">Xabar yo\'q - o\'yinchilar Sozlamalar > Tizim > "Xatolik haqida xabar" orqali yuboradi</td></tr>';
        echo '</table></div>';
    }
}

/* ===== PAKETLAR ===== */
if ($P === 'packs') {
    @mkdir(PACKS_DIR, 0755, true);
    $id = strtolower(preg_replace('/[^a-z0-9_\-]/i', '', g('id')));
    $files_of = function ($dir, $rel = '') use (&$files_of) { $o = array(); foreach ((array)@scandir($dir) as $f) { if ($f === '.' || $f === '..' || $f === '') continue; if (is_dir("$dir/$f")) $o = array_merge($o, $files_of("$dir/$f", $rel . $f . '/')); else $o[] = array($rel . $f, filesize("$dir/$f")); } return $o; };
    echo '<h1>Paketlar</h1><div class="mut" style="margin:-8px 0 16px">Paketdagi fayllar o\'yinchi menyuda (Sozlamalar > Kontent) yoqqanda XCLauncher.exe orqali o\'yin papkasiga o\'rnatiladi. Ovozlar, modellar, NextClient yangilanishi va boshqalar.</div><div class="grid2"><div class="panel"><div class="ph">Paketlar ro\'yxati</div><table class="list">';
    foreach ((array)@scandir(PACKS_DIR) as $p) { if (!preg_match('/^[a-z0-9_\-]+$/', $p) || !is_dir(PACKS_DIR . "/$p/files")) continue;
        $m = json_decode((string)@file_get_contents(PACKS_DIR . "/$p/pack.json"), true); $fl = $files_of(PACKS_DIR . "/$p/files"); $sz = 0; foreach ($fl as $x) $sz += $x[1];
        echo '<tr class="' . ($p === $id ? 'sel' : '') . '"><td><a href="?p=packs&id=' . $p . '"><b>' . h(isset($m['name']) ? $m['name'] : $p) . '</b></a><br><small class="mut">' . h($p) . ' · ' . count($fl) . ' fayl · ' . size_h($sz) . '</small></td></tr>'; }
    echo '</table><div class="ph" style="margin-top:16px">Yangi paket</div><form method="post" class="frm">' . csrf_in() . '<input type="hidden" name="act" value="pack_new"><input name="id" placeholder="paket_id (masalan sound_pro)"><input name="name" placeholder="Nomi (menyuda ko\'rinadi)"><input name="desc" placeholder="Qisqacha tavsif"><button class="btn red">Yaratish</button></form></div>';
    if ($id !== '' && is_dir(PACKS_DIR . "/$id")) {
        $fl = $files_of(PACKS_DIR . "/$id/files");
        echo '<div class="panel"><div class="ph">' . h($id) . ' — fayllar</div><form method="post" enctype="multipart/form-data" class="frm">' . csrf_in() . '<input type="hidden" name="act" value="pack_up"><input type="hidden" name="id" value="' . h($id) . '">'
            . '<input name="path" placeholder="O\'yin papkasidagi yo\'li: cstrike/sound/weapons/ak47-1.wav"><input type="file" name="f"><button class="btn red">Yuklash</button>'
            . '<div class="mut small">Bitta fayl hajmi chegarasi: ' . h(ini_get('upload_max_filesize')) . '. Katta fayllarni FastPanel orqali mmb/packs/' . h($id) . '/files/ ga yuklang.</div></form><table class="list">';
        foreach ($fl as $x) echo '<tr><td class="mono">' . h($x[0]) . '</td><td>' . size_h($x[1]) . '</td><td class="r"><form method="post" class="inl">' . csrf_in() . '<input type="hidden" name="act" value="pack_rm"><input type="hidden" name="id" value="' . h($id) . '"><input type="hidden" name="path" value="' . h($x[0]) . '"><button class="lnk red">O\'chirish</button></form></td></tr>';
        if (!$fl) echo '<tr><td class="mut">Hali fayl yo\'q</td></tr>';
        $pm = json_decode((string)@file_get_contents(PACKS_DIR . "/$id/pack.json"), true); $pall = !empty($pm['all']); $pv = isset($pm['ver']) ? (int)$pm['ver'] : 1;
        $pb = function ($do, $t, $cls) use ($id) { return '<form method="post" class="inl">' . csrf_in() . '<input type="hidden" name="act" value="pack_all"><input type="hidden" name="id" value="' . h($id) . '"><input type="hidden" name="do" value="' . $do . '"><button class="btn ' . $cls . '">' . $t . '</button></form> '; };
        echo '</table><div class="ph" style="margin-top:16px">Kimga o\'rnatiladi</div>'
            . ($pall ? '<p><b style="color:#3fb950">HAMMA o\'yinchilarga</b> · versiya ' . $pv . '</p>' . $pb('bump', 'Fayllarni yangiladim - hammaga qayta tarqatish', 'red') . $pb('off', 'Majburiy emas qilish', 'out')
                     : '<p class="mut">Faqat menyuda (Sozlamalar > Kontent) o\'zi yoqqanlarga.</p>' . $pb('on', 'Hamma o\'yinchilarga o\'rnatish', 'red'))
            . '<div class="mut small" style="margin-top:6px">Sborka yangilanishi: fayllarni shu paketga yuklang → "Hamma o\'yinchilarga" → keyin har o\'zgartirganda "qayta tarqatish". O\'yinchi XCLauncher.exe ni ochganda yuklab oladi; paket o\'chirilsa asl fayllar qaytariladi.</div>'
            . '<form method="post" onsubmit="return confirm(\'Paket butunlay o\\\'chirilsinmi?\')" style="margin-top:12px">' . csrf_in() . '<input type="hidden" name="act" value="pack_del"><input type="hidden" name="id" value="' . h($id) . '"><button class="btn out">Paketni o\'chirish</button></form></div>';
    } else echo '<div class="panel mut">Chapdan paketni tanlang yoki yangisini yarating.</div>';
    echo '</div>';
}

/* ===== YANGILANISHLAR ===== */
if ($P === 'upd') {
    $cfg = rel_rd('release', array()); $hist = rel_rd('rel_hist', array());
    $vers = array(); foreach (all_of('dev') as $o) { $k = isset($o['ver']) && $o['ver'] !== '' ? $o['ver'] : "noma'lum"; $vers[$k] = (isset($vers[$k]) ? $vers[$k] : 0) + 1; } arsort($vers);
    echo '<h1>Yangilanishlar</h1><div class="mut" style="margin:-8px 0 16px">XCLauncher.exe har ochilganda shu yerdan so\'raydi va yangi build bo\'lsa o\'zgargan fayllarni (XCLauncher.exe, dizayn xc_theme) o\'zi yuklab oladi.'
        . ' Yangi build: GitHub Actions → "X CLIENT CS 1.6 PC" → Run workflow (stable). O\'yin fayllari (sborka) uchun - <a href="?p=packs">Paketlar</a> → "Hamma o\'yinchilarga".</div>'
        . '<form method="post" style="margin-bottom:12px">' . csrf_in() . '<input type="hidden" name="act" value="rel_check"><button class="btn">GitHub\'ni hozir tekshirish</button></form><div class="grid2">';
    foreach (array('stable' => 'Stable (hamma)', 'beta' => 'Beta (sinov)') as $ch => $title) {
        $l = rel_latest($ch); $cur = rel_current($ch); $r = isset($cfg[$ch]) ? $cfg[$ch] : array(); $mode = isset($r['mode']) ? $r['mode'] : 'auto';
        $opt = function ($v, $t) use ($mode) { return '<option value="' . $v . '"' . ($mode === $v ? ' selected' : '') . '>' . $t . '</option>'; };
        echo '<div class="panel"><div class="ph">' . $title . '</div>'
            . '<div class="kv"><span>GitHub\'dagi oxirgi build</span><b>' . ($l ? $l['build'] . ' · v' . h($l['version']) . ' · ' . dt($l['date']) : '— (GitHub javob bermadi)') . '</b></div>'
            . '<div class="kv"><span>O\'yinchilarga berilmoqda</span><b>' . ($cur['build'] ? 'build ' . $cur['build'] . ' · v' . h($cur['version']) : ($mode === 'pause' ? 'to\'xtatilgan' : '—')) . '</b></div>'
            . '<form method="post" class="frm" style="margin-top:10px">' . csrf_in() . '<input type="hidden" name="act" value="rel_save"><input type="hidden" name="ch" value="' . $ch . '">'
            . '<label>Rejim</label><select name="mode">' . $opt('auto', 'Avto - GitHub\'dagi oxirgisi darhol hammaga') . $opt('manual', 'Qo\'lda - tanlangan build (pastdan)') . $opt('pause', 'To\'xtatish - hech kim yangilanmaydi') . '</select>'
            . '<label>Majburiy minimal build (bundan eski bo\'lsa, "Avto yangilash" o\'chiq bo\'lsa ham yangilanadi; 0 = yo\'q)</label><input name="min" type="number" min="0" value="' . (isset($r['min']) ? (int)$r['min'] : 0) . '">'
            . '<label>Ochilishda xabar oynasi (bo\'sh = yo\'q; har ochilganda chiqadi)</label><input name="msg" value="' . h(isset($r['msg']) ? $r['msg'] : '') . '" maxlength="200">'
            . '<button class="btn red">Saqlash</button></form></div>';
    }
    echo '</div><div class="grid2"><div class="panel"><div class="ph">Buildlar tarixi (orqaga qaytarish)</div><table class="list"><tr><th>Build</th><th>Versiya</th><th>Vetka</th><th>Sana</th><th></th></tr>';
    foreach ($hist as $b => $x) {
        echo '<tr><td><b>' . (int)$b . '</b></td><td>v' . h($x['version']) . '</td><td>' . h($x['ch']) . '</td><td>' . dt($x['date']) . '</td><td class="r">';
        foreach (array('stable', 'beta') as $ch) echo '<form method="post" class="inl" onsubmit="return confirm(\'' . $ch . ' o\\\'yinchilariga build ' . (int)$b . ' berilsinmi?\')">' . csrf_in() . '<input type="hidden" name="act" value="rel_pin"><input type="hidden" name="ch" value="' . $ch . '"><input type="hidden" name="build" value="' . (int)$b . '"><button class="lnk">→ ' . $ch . '</button></form> ';
        echo '</td></tr>';
    }
    if (!$hist) echo '<tr><td colspan="5" class="mut">Hali yo\'q - GitHub\'da build bo\'lganda shu yerda paydo bo\'ladi</td></tr>';
    echo '</table></div><div class="panel"><div class="ph">O\'yinchilardagi versiyalar</div>' . pie($vers) . '</div></div>';
    $wn = rd('whatsnew', null);
    echo '<div class="panel"><div class="ph">"Nima yangi" oynasi</div><div class="mut small" style="margin-bottom:8px">Yangilanishdan keyin har o\'yinchining menyusida bir marta chiqadi. Har qatorga bitta yangilik. Bo\'sh qoldirib saqlasangiz - o\'chadi.</div>'
        . '<form method="post" class="frm">' . csrf_in() . '<input type="hidden" name="act" value="wn_save"><div class="row"><input name="title" value="' . h($wn ? $wn['title'] : '') . '" placeholder="Sarlavha (masalan: X CLIENT yangilandi!)"><input name="ver" value="' . h($wn ? $wn['ver'] : '') . '" placeholder="Versiya (masalan: v1.0.46)"></div>'
        . '<textarea name="items" rows="7" placeholder="Menyu ovozlari qo\'shildi&#10;Pritsel eng kichik o\'lchami (x1)&#10;Kunlik vazifalar va XP">' . h($wn ? implode("\n", $wn['items']) : '') . '</textarea><button class="btn red">Saqlash va tarqatish</button>'
        . ($wn ? ' <span class="mut small">Oxirgi: ' . dt($wn['t']) . '</span>' : '') . '</form></div>';
}

/* ===== TELEGRAM ===== */
if ($P === 'tg') {
    $ev = isset($CFG['tg_ev']) ? $CFG['tg_ev'] : array('install' => 1, 'account' => 1, 'report' => 1);
    $ck = function ($k, $t) use ($ev) { return '<label class="chk"><input type="checkbox" name="ev_' . $k . '" value="1"' . (!empty($ev[$k]) ? ' checked' : '') . '> ' . $t . '</label>'; };
    echo '<h1>Telegram xabarnomalar</h1><div class="grid2"><div class="panel"><div class="ph">Sozlash</div><form method="post" class="frm">' . csrf_in() . '<input type="hidden" name="act" value="tg_save">'
        . '<label>Bot token</label><input name="token" value="' . h(isset($CFG['tg_token']) ? $CFG['tg_token'] : '') . '" placeholder="123456:ABC-DEF...">'
        . '<label>Chat ID (siz yoki guruh)</label><input name="chat" value="' . h(isset($CFG['tg_chat']) ? $CFG['tg_chat'] : '') . '" placeholder="123456789 yoki -100...">'
        . $ck('install', 'Yangi X CLIENT o\'rnatish') . $ck('account', 'Yangi akkaunt') . $ck('report', 'Xatolik haqida xabar')
        . '<button class="btn red">Saqlash</button></form><form method="post" style="margin-top:10px">' . csrf_in() . '<input type="hidden" name="act" value="tg_test"><button class="btn">Sinov xabarini yuborish</button></form></div>'
        . '<div class="panel"><div class="ph">Qanday ulash</div><ol class="help"><li>Telegram\'da <b>@BotFather</b> ga yozing → <b>/newbot</b> → bot nomini bering. U <b>token</b> beradi.</li><li>Yaratilgan botingizga <b>/start</b> yozing.</li><li><b>@userinfobot</b> ga yozing - u sizning <b>Chat ID</b> raqamingizni beradi.</li><li>Ikkalasini shu yerga yozib, Saqlash va "Sinov xabari"ni bosing.</li></ol></div></div>';
}

/* ===== API ===== */
if ($P === 'api') {
    $base = 'http://' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'mmb.boost-top.com') . '/admin.php';
    echo '<h1>API kalitlari</h1><div class="panel"><div class="ph">Kalitlar <form method="post" class="inl r">' . csrf_in() . '<input type="hidden" name="act" value="api_new"><input name="name" placeholder="Nomi (masalan: boost-top sayt)"><button class="btn red">Yaratish</button></form></div><table class="list"><tr><th>Nomi</th><th>Kalit</th><th>Yaratilgan</th><th></th></tr>';
    foreach ((array)(isset($CFG['api']) ? $CFG['api'] : array()) as $k) echo '<tr><td>' . h($k['name']) . '</td><td class="mono">' . h($k['k']) . '</td><td>' . dt($k['t']) . '</td><td class="r"><form method="post" class="inl" onsubmit="return confirm(\'O\\\'chirilsinmi?\')">' . csrf_in() . '<input type="hidden" name="act" value="api_del"><input type="hidden" name="k" value="' . h($k['k']) . '"><button class="lnk red">O\'chirish</button></form></td></tr>';
    echo '</table></div><div class="panel"><div class="ph">API hujjati</div><p>Statistika (JSON):</p><pre>GET ' . h($base) . '?api=stats&amp;key=KALIT&amp;days=7</pre>'
        . '<p>Javob: <code>installs</code> (jami X CLIENT), <code>nextclient_devices</code>, <code>accounts</code>, <code>days[]</code> - har kun uchun <code>xclient</code>, <code>xclient_new</code>, <code>nextclient</code>, <code>nextclient_new</code>.</p>'
        . '<p class="mut">Masalan, boost-top.com saytida "X CLIENT o\'yinchilari: 125" deb chiqarish uchun.</p></div>';
}

/* ===== SOZLAMALAR ===== */
if ($P === 'settings') {
    $sz = 0; $n = 0; foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(XC_DIR, FilesystemIterator::SKIP_DOTS)) as $f) { $sz += $f->getSize(); $n++; }
    echo '<h1>Sozlamalar</h1><div class="grid2"><div class="panel"><div class="ph">Admin parolini almashtirish</div><form method="post" class="frm">' . csrf_in() . '<input type="hidden" name="act" value="pass"><input type="password" name="old" placeholder="Eski parol"><input type="password" name="new" placeholder="Yangi parol (8+ belgi)"><button class="btn red">Almashtirish</button></form></div>'
        . '<div class="panel"><div class="ph">Ma\'lumotlar</div><div class="kv"><span>xc_data hajmi</span><b>' . size_h($sz) . ' · ' . $n . ' fayl</b></div><div class="kv"><span>PHP</span><b>' . h(PHP_VERSION) . '</b></div>'
        . '<form method="post" class="frm" style="margin-top:10px">' . csrf_in() . '<input type="hidden" name="act" value="clean_days"><div class="row"><select name="keep"><option value="90">90 kundan eski</option><option value="180">180 kundan eski</option><option value="365" selected>1 yildan eski</option></select><button class="btn">Kunlik statistikani tozalash</button></div></form></div></div>';
}
echo '</div>';
foot();

/* ===================================================================== yordamchi chizish funksiyalari */
function msg_form($login, $back) {
    return '<form method="post" class="inl msgf" onsubmit="var t=prompt(\'' . h($login) . ' ga xabar (menyusida chiqadi):\');if(!t)return false;this.text.value=t;">' . csrf_in()
        . '<input type="hidden" name="act" value="acc_msg"><input type="hidden" name="login" value="' . h($login) . '"><input type="hidden" name="back" value="' . $back . '"><input type="hidden" name="text" value=""><button class="lnk">✉ Xabar</button></form>';
}
function pager($total) {
    $pages = max(1, (int)ceil($total / PER_PAGE)); $cur = max(1, min($pages, (int)g('pg', 1)));
    $q = $_GET; $html = '<div class="pager"><span class="mut">Ko\'rsatilgan: ' . min($total, ($cur - 1) * PER_PAGE + 1) . '–' . min($total, $cur * PER_PAGE) . ' / ' . $total . '</span>';
    if ($pages > 1) for ($i = 1; $i <= $pages; $i++) { if ($i > 2 && $i < $pages - 1 && abs($i - $cur) > 2) { if ($i == 3 || $i == $pages - 2) $html .= '<span>…</span>'; continue; } $q['pg'] = $i; $html .= '<a href="?' . h(http_build_query($q)) . '" class="' . ($i == $cur ? 'on' : '') . '">' . $i . '</a>'; }
    return array('off' => ($cur - 1) * PER_PAGE, 'html' => $html . '</div>');
}
function axis_top($max) { $step = $max <= 5 ? 1 : ($max <= 12 ? 2 : ($max <= 30 ? 5 : ceil($max / 6 / 10) * 10)); return array(max($step, ceil($max / $step) * $step), $step); }
function line_chart($ser, $lines) {
    $W = 1100; $H = 300; $L = 40; $B = 28; $max = 1; foreach ($lines as $l) foreach ($l[2] as $v) $max = max($max, $v);
    list($top, $step) = axis_top($max); $n = count($ser); $dx = ($W - $L - 20) / max(1, $n - 1);
    $s = ''; for ($v = 0; $v <= $top; $v += $step) { $y = $H - $B - ($H - $B - 12) * $v / $top; $s .= '<line x1="' . $L . '" x2="' . $W . '" y1="' . $y . '" y2="' . $y . '" class="g"/><text x="' . ($L - 10) . '" y="' . ($y + 4) . '" class="ax" text-anchor="end">' . $v . '</text>'; }
    foreach ($ser as $i => $p) if ($i % max(1, (int)round($n / 10)) === 0 || $i === $n - 1) $s .= '<text x="' . ($L + 10 + $dx * $i) . '" y="' . ($H - 8) . '" class="ax" text-anchor="middle">' . $p['l'] . '</text>';
    foreach (array_reverse($lines) as $l) {           // Unikal oxirida chiziladi - ustida ko'rinsin
        $pts = array(); foreach ($l[2] as $i => $v) $pts[] = array($L + 10 + $dx * $i, $H - $B - ($H - $B - 12) * $v / $top);
        $d = 'M' . round($pts[0][0], 1) . ',' . round($pts[0][1], 1);
        for ($i = 1; $i < count($pts); $i++) { $cx = ($pts[$i - 1][0] + $pts[$i][0]) / 2; $d .= ' C' . round($cx, 1) . ',' . round($pts[$i - 1][1], 1) . ' ' . round($cx, 1) . ',' . round($pts[$i][1], 1) . ' ' . round($pts[$i][0], 1) . ',' . round($pts[$i][1], 1); }
        $s .= '<path d="' . $d . '" fill="none" stroke="' . $l[1] . '" stroke-width="2.5"/>';
        foreach ($pts as $i => $p) $s .= '<circle cx="' . round($p[0], 1) . '" cy="' . round($p[1], 1) . '" r="' . ($n > 40 ? 2 : 3.5) . '" fill="' . $l[1] . '" data-v="' . $l[2][$i] . '" data-l="' . $ser[$i]['l'] . ' · ' . $l[0] . '"/>';
    }
    $lg = ''; foreach ($lines as $l) $lg .= '<i style="background:' . $l[1] . '"></i>' . $l[0] . ' ';
    return '<div class="chart"><svg viewBox="0 0 ' . $W . ' ' . $H . '" preserveAspectRatio="none">' . $s . '</svg><div class="tip"></div></div><div class="lg c">' . $lg . '</div>';
}
function bar_chart($ser) {
    $W = 1100; $H = 280; $L = 40; $B = 26; $max = 1; foreach ($ser as $s) $max = max($max, $s['nc'], $s['xc']);
    list($top, $step) = axis_top($max); $cw = ($W - $L) / count($ser); $bw = min(26, $cw * 0.32); $svg = '';
    for ($v = 0; $v <= $top; $v += $step) { $y = $H - $B - ($H - $B - 10) * $v / $top; $svg .= '<line x1="' . $L . '" x2="' . $W . '" y1="' . $y . '" y2="' . $y . '" class="g"/><text x="' . ($L - 10) . '" y="' . ($y + 4) . '" class="ax" text-anchor="end">' . $v . '</text>'; }
    foreach ($ser as $i => $s) {
        $cx = $L + $cw * $i + $cw / 2;
        foreach (array(array('nc', 'NextClient', -$bw - 2, '#3d86df'), array('xc', 'X CLIENT', 2, '#c84bdc')) as $k) {
            $hg = ($H - $B - 10) * $s[$k[0]] / $top;
            if ($s[$k[0]] > 0) $svg .= '<rect x="' . round($cx + $k[2], 1) . '" y="' . round($H - $B - $hg, 1) . '" width="' . round($bw, 1) . '" height="' . round(max(2, $hg), 1) . '" rx="3" fill="' . $k[3] . '" data-v="' . $s[$k[0]] . '" data-l="' . $s['l'] . ' · ' . $k[1] . '"/>';
        }
        if ($i % max(1, (int)round(count($ser) / 10)) === 0 || $i === count($ser) - 1) $svg .= '<text x="' . round($cx, 1) . '" y="' . ($H - 6) . '" class="ax" text-anchor="middle">' . $s['l'] . '</text>';
    }
    return '<div class="chart"><svg viewBox="0 0 ' . $W . ' ' . $H . '" preserveAspectRatio="none">' . $svg . '</svg><div class="tip"></div></div>';
}
function pie($data, $flags = false) {
    $tot = array_sum($data); if (!$tot) return '<div class="mut small">Hali ma\'lumot yo\'q</div>';
    $cols = array('#f5c542', '#a86fd0', '#3d9be9', '#f08c4a', '#3fbfb0', '#e5484d', '#7cc95b', '#8a8fa0', '#d46fb0', '#5a6cf0');
    if (count($data) > 9) { $rest = array_sum(array_slice($data, 9)); $data = array_slice($data, 0, 9, true); $data['boshqa'] = $rest; }
    $a = -M_PI / 2; $s = ''; $lg = ''; $i = 0;
    foreach ($data as $k => $v) {
        $c = $cols[$i++ % count($cols)]; $b = $a + 2 * M_PI * $v / $tot;
        if ($v == $tot) $s .= '<circle cx="100" cy="100" r="90" fill="' . $c . '" data-v="' . $v . '" data-l="' . h($k) . '"/>';
        else $s .= '<path d="M100,100 L' . round(100 + 90 * cos($a), 2) . ',' . round(100 + 90 * sin($a), 2) . ' A90,90 0 ' . ($b - $a > M_PI ? 1 : 0) . ',1 ' . round(100 + 90 * cos($b), 2) . ',' . round(100 + 90 * sin($b), 2) . ' Z" fill="' . $c . '" stroke="#1c1f26" stroke-width="2" data-v="' . $v . '" data-l="' . h($k) . ' · ' . round(100 * $v / $tot) . '%"/>';
        $lg .= '<span><i style="background:' . $c . '"></i>' . ($flags ? flag(strtolower($k)) : '') . h($k) . ' <b>' . $v . '</b></span>';
        $a = $b;
    }
    return '<div class="pie chart"><svg viewBox="0 0 200 200">' . $s . '</svg><div class="tip"></div></div><div class="plg">' . $lg . '</div>';
}
function head($t) {
    echo '<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>X CLIENT admin · ' . h($t) . '</title><style>
*{box-sizing:border-box}body{margin:0;background:#15171c;color:#e6e8ee;font:14px/1.45 "Segoe UI",Tahoma,Arial,sans-serif}a{color:#8ab4ff;text-decoration:none}
h1{font-size:26px;margin:0 0 18px}.mut{color:#8b90a0}.small{font-size:12px;margin-top:8px}.r{margin-left:auto;text-align:right}.mono{font-family:Consolas,monospace;font-size:12.5px}
.side{position:fixed;left:0;top:0;bottom:0;width:230px;background:#1a1d23;border-right:1px solid #2a2e38;padding:18px 12px;overflow-y:auto}
.brand{font:900 21px "Arial Black",Arial;letter-spacing:2px;padding:0 10px 18px}.brand span,.login h1 span{color:#ff3b3b}.brand small{display:block;font:12px Tahoma;color:#8b90a0;letter-spacing:0;margin-top:2px}
.side a{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;color:#c9cdd8;margin-bottom:2px}.side a:hover{background:#22262e}.side a.on{background:#2a1518;color:#ff7a7a}
.side a i{font-style:normal;width:18px;text-align:center;opacity:.8}.side a em{margin-left:auto;font-style:normal;font-size:11px;background:#3a2a18;color:#f5b84a;border-radius:9px;padding:1px 8px}.side .sep{height:1px;background:#2a2e38;margin:12px 6px}.side a.out{color:#ff7a7a}
.main{margin-left:230px;padding:26px 30px;max-width:1500px}@media(max-width:800px){.side{position:static;width:auto}.main{margin:0;padding:16px}}
.flash{background:#1f3a2a;border:1px solid #2f6a45;color:#9be8b9;border-radius:10px;padding:10px 14px;margin-bottom:16px;white-space:pre-wrap}
.crumb{color:#8b90a0;margin-bottom:6px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin-bottom:18px}
.card{position:relative;background:#1c1f26;border:1px solid #2a2e38;border-radius:12px;padding:16px 16px 40px;display:flex;flex-direction:column;gap:3px;overflow:hidden}.card .ct{font-size:13px;color:#aab}.card b{font-size:32px;line-height:38px}
.card.nc{border-color:#2f5fa8}.card.nc b{color:#4a90e2}.card.xc{border-color:#7a2f8f}.card.xc b{color:#d466e6}.card .spark{position:absolute;left:0;right:0;bottom:0;width:100%;height:34px}.card .spark polyline{fill:none;stroke-width:2}.card.nc polyline{stroke:#3d86df}.card.xc polyline{stroke:#c84bdc}.card:not(.nc):not(.xc){padding-bottom:16px}
.up{color:#3ccf8e;font-size:13px}.dn{color:#f5a623;font-size:13px}
.panel{background:#1c1f26;border:1px solid #2a2e38;border-radius:12px;padding:18px;margin-bottom:18px;overflow:auto}
.ph{font-weight:600;font-size:15px;margin-bottom:12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.seg{display:inline-flex;background:#15171c;border:1px solid #2a2e38;border-radius:8px;padding:2px;font-weight:400}.seg a{padding:5px 12px;border-radius:6px;color:#aab;font-size:13px}.seg a.on{background:#2a2e38;color:#fff}.seg em{font-style:normal;font-size:11px;color:#8b90a0;margin-left:4px}
.lg{font-weight:400;font-size:12px;color:#aab}.lg.c{text-align:center;margin-top:6px}.lg i,.plg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 5px 0 12px}
.chart{position:relative}.chart svg{width:100%;height:300px;display:block}.g{stroke:#2a2e38;stroke-dasharray:3 4}.ax{fill:#6f7585;font-size:11px}.chart [data-v]:hover{stroke:#fff;stroke-width:1.5}
.tip{position:absolute;display:none;pointer-events:none;background:#23262e;border:1px solid #3a3f4c;border-radius:8px;padding:6px 10px;font-size:13px;white-space:nowrap;z-index:5}.tip b{font-size:16px;margin-right:6px}.tip i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}.grid3{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px}@media(max-width:900px){.grid2{grid-template-columns:1fr}}
.pie{display:flex;justify-content:center}.pie svg{width:190px;height:190px}.plg{display:flex;flex-wrap:wrap;gap:4px 0;justify-content:center;margin-top:10px;font-size:12px;color:#c9cdd8}.plg span{white-space:nowrap}.plg b{color:#8b90a0;font-weight:400;margin-right:4px}
table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #262a33;text-align:left;vertical-align:middle}th{color:#8b90a0;font-weight:500;font-size:12px;white-space:nowrap}th a{color:#8b90a0}th a.on{color:#fff}
.list td{white-space:nowrap}tr.sel td{background:#22262e}.dot{display:inline-block;width:8px;height:8px;border-radius:4px;background:#3ccf8e;margin-right:6px}
.flg{width:18px;height:12px;vertical-align:middle;margin-right:4px;border-radius:2px}
.kv{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #262a33}.kv span{color:#8b90a0}.kv b{font-weight:500;text-align:right}
.tag{display:inline-block;font-size:11px;padding:1px 8px;border-radius:9px;background:#2a2e38;color:#c9cdd8}.tag.promo{background:#4a1b1f;color:#ff8a8a}.tag.warn{background:#4a3a14;color:#ffc46a}.tag.info{background:#1b2f4a;color:#8ab4ff}
.btn{display:inline-block;background:#262a33;border:1px solid #3a3f4c;color:#e6e8ee;border-radius:8px;padding:8px 14px;font-size:13.5px;cursor:pointer;font-family:inherit}.btn:hover{background:#2f343f}.btn.red{background:#e5383d;border-color:#ff5a5f;color:#fff}.btn.out{border-color:#7a2a2e;color:#ff7a7a;background:transparent}
.lnk{background:none;border:0;color:#8ab4ff;cursor:pointer;font:inherit;padding:0}.lnk.red{color:#ff7a7a}
.tg{background:#262a33;border:1px solid #3a3f4c;color:#aab;border-radius:6px;padding:3px 10px;cursor:pointer}.tg.on{background:#5a4510;border-color:#d6a520;color:#ffd24a}
form.inl{display:inline}.srch{display:flex;gap:8px}.srch input{min-width:260px}
input,select,textarea{background:#15171c;border:1px solid #3a3f4c;color:#fff;border-radius:8px;padding:9px 12px;font:inherit}textarea{width:100%;min-height:90px}
.frm{display:flex;flex-direction:column;gap:10px}.frm label{color:#aab;font-size:13px;margin-bottom:-6px}.frm .row{display:flex;gap:10px;flex-wrap:wrap}.chk{display:flex;gap:8px;align-items:center;color:#c9cdd8!important;margin:0!important}
.pager{display:flex;gap:6px;align-items:center;margin-top:14px;flex-wrap:wrap}.pager a{padding:5px 11px;border:1px solid #2a2e38;border-radius:6px;color:#c9cdd8}.pager a.on{background:#2a1518;border-color:#7a2a2e;color:#ff7a7a}.pager .mut{margin-right:auto}
pre{background:#121418;border:1px solid #262a33;border-radius:8px;padding:12px;overflow:auto;max-height:600px;font-size:12px;white-space:pre-wrap}code{background:#262a33;border-radius:4px;padding:1px 5px}
.help li{margin-bottom:8px;color:#c9cdd8}
.login{max-width:400px;margin:12vh auto;background:#1c1f26;border:1px solid #2a2e38;border-radius:14px;padding:28px}.login h1{font:900 26px "Arial Black",Arial;margin:0 0 8px}.login form{display:flex;flex-direction:column;gap:10px;margin-top:16px}
.err{background:#4a1b1f;color:#ff9a9a;border-radius:8px;padding:8px 12px;margin-top:10px}
</style></head><body>';
}
function foot() {
    echo '<script>(function(){var cs=document.querySelectorAll(".chart");for(var j=0;j<cs.length;j++)(function(c){var t=c.querySelector(".tip");
c.addEventListener("mousemove",function(e){var r=e.target;if(!r.getAttribute||!r.getAttribute("data-v")){t.style.display="none";return;}
var b=c.getBoundingClientRect();t.innerHTML="<i style=\"background:"+(r.getAttribute("fill")||"#888")+"\"></i><b>"+r.getAttribute("data-v")+"</b>"+r.getAttribute("data-l");
t.style.display="block";var x=e.clientX-b.left+14;if(x+t.offsetWidth>b.width)x=e.clientX-b.left-t.offsetWidth-10;t.style.left=x+"px";t.style.top=(e.clientY-b.top-44)+"px";});
c.addEventListener("mouseleave",function(){t.style.display="none";});})(cs[j]);})();</script></body></html>';
}
