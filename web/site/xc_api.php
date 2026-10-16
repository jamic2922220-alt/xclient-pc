<?php
/* =====================================================================
 *  X CLIENT — akkaunt API (boost-top.com/mmb/xc_api.php)
 *  O'yin ichidagi X CLIENT menyusi (index.html) shu fayl bilan ishlaydi:
 *  ro'yxatdan o'tish, kirish, profil, bulutga saqlash, do'stlar, haftalik TOP,
 *  o'yin vaqti (XP) va xatolik loglari.
 *
 *  Ma'lumotlar xc_data/ papkasida, har biri "<?php exit; ?>" bilan boshlanadigan
 *  .php fayllarda saqlanadi — brauzerdan o'qib bo'lmaydi. MySQL kerak emas.
 *  PHP 5.6+ / 7 / 8.
 * ===================================================================== */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

define('XC_DIR', __DIR__ . '/xc_data');
define('XC_GUARD', "<?php exit; ?>\n");
define('XP_PER_MIN', 1);          // har bir o'ynalgan daqiqa uchun XP
define('XP_PER_LEVEL', 1000);

function out($a) { echo json_encode($a); exit; }
function fail($code, $msg) { out(array('ok' => false, 'err' => $code, 'msg' => $msg)); }
function p($k, $def = '') { return isset($_POST[$k]) ? trim((string)$_POST[$k]) : (isset($_GET[$k]) ? trim((string)$_GET[$k]) : $def); }

function ensure_dir() {
    if (!is_dir(XC_DIR)) {
        @mkdir(XC_DIR, 0755, true);
        @mkdir(XC_DIR . '/users', 0755, true);
        @file_put_contents(XC_DIR . '/.htaccess', "Require all denied\nDeny from all\n");
        @file_put_contents(XC_DIR . '/index.html', '');
    }
    if (!is_dir(XC_DIR . '/users')) @mkdir(XC_DIR . '/users', 0755, true);
    if (!is_writable(XC_DIR)) fail('storage', 'xc_data papkasiga yozib bo\'lmadi (ruxsat 755 kerak)');
}
function rd($name, $def) {
    $f = XC_DIR . '/' . $name . '.php';
    if (!is_file($f)) return $def;
    $s = @file_get_contents($f);
    if ($s === false) return $def;
    $j = json_decode(substr($s, strlen(XC_GUARD)), true);
    return is_array($j) ? $j : $def;
}
function wr($name, $data) {
    $f = XC_DIR . '/' . $name . '.php';
    $tmp = $f . '.' . mt_rand() . '.tmp';
    file_put_contents($tmp, XC_GUARD . json_encode($data), LOCK_EX);
    @rename($tmp, $f);
}
/* butun yozish jarayonini bitta qulf ostida bajaramiz (bir vaqtda ikki so'rov) */
$LOCK = null;
function lock() {
    global $LOCK;
    $LOCK = fopen(XC_DIR . '/.lock', 'c');
    if ($LOCK) flock($LOCK, LOCK_EX);
}

function ukey($login) { return 'users/' . strtolower($login); }
function user($login) { return rd(ukey($login), null); }
function save_user($u) { wr(ukey($u['login']), $u); }
function week_id() { return date('o-W'); }

function auth() {
    $t = p('token');
    if (!preg_match('/^[a-f0-9]{40}$/', $t)) fail('auth', 'Qayta kiring');
    $tokens = rd('tokens', array());
    if (empty($tokens[$t])) fail('auth', 'Qayta kiring');
    $u = user($tokens[$t]);
    if (!$u) fail('auth', 'Qayta kiring');
    return $u;
}
function new_token($login) {
    $t = bin2hex(function_exists('random_bytes') ? random_bytes(20) : openssl_random_pseudo_bytes(20));
    $tokens = rd('tokens', array());
    $tokens[$t] = strtolower($login);
    wr('tokens', $tokens);
    return $t;
}
function level($xp) { return (int)floor($xp / XP_PER_LEVEL) + 1; }
function is_online($u) { return !empty($u['seen']) && time() - $u['seen'] < 150; }

/* profilni mijozga beriladigan ko'rinishi (parol xeshisiz) */
function pub($u, $full) {
    $r = array(
        'id' => $u['id'], 'login' => $u['login'], 'name' => $u['name'],
        'xp' => (int)$u['xp'], 'level' => level($u['xp']), 'lvlxp' => (int)$u['xp'] % XP_PER_LEVEL, 'lvlmax' => XP_PER_LEVEL,
        'vip' => !empty($u['vip']), 'online' => is_online($u),
        'server' => is_online($u) && !empty($u['server']) ? $u['server'] : '', 'map' => is_online($u) && !empty($u['map']) ? $u['map'] : '',
    );
    if ($full) {
        $r['email'] = isset($u['email']) ? preg_replace('/^(.).*(@.*)$/', '$1*****$2', $u['email']) : '';
        $r['tg'] = isset($u['tg']) ? $u['tg'] : '';
        $r['created'] = $u['created'];
        $r['pwchanged'] = isset($u['pwchanged']) ? $u['pwchanged'] : $u['created'];
        $r['cloud'] = isset($u['cloud']) ? $u['cloud'] : null;
        $r['cloudt'] = isset($u['cloudt']) ? $u['cloudt'] : 0;
        $r['devices'] = isset($u['devices']) ? count($u['devices']) : 0;
        $r['friends'] = isset($u['friends']) ? $u['friends'] : array();
        $r['week'] = (isset($u['wk']) && $u['wk'] === week_id()) ? (int)$u['wkxp'] : 0;
    }
    return $r;
}
function touch_device(&$u) {
    $d = p('device');
    if (!preg_match('/^[a-z0-9]{8,40}$/', $d)) return;
    if (!isset($u['devices'])) $u['devices'] = array();
    $u['devices'][$d] = time();
}

ensure_dir();
$a = p('a');

switch ($a) {

case 'register':
    $login = p('login'); $pass = p('pass'); $email = p('email');
    if (!preg_match('/^[A-Za-z0-9_]{3,20}$/', $login)) fail('login', 'Login 3-20 belgi: harf, raqam, _');
    if (strlen($pass) < 6) fail('pass', 'Parol kamida 6 belgi');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('email', 'Email noto\'g\'ri');
    lock();
    if (user($login)) fail('exists', 'Bu login band');
    $meta = rd('meta', array('next' => 100001));
    $u = array(
        'id' => 'X-' . $meta['next'], 'login' => $login, 'name' => $login, 'email' => $email,
        'pass' => password_hash($pass, PASSWORD_DEFAULT), 'xp' => 0, 'vip' => true,
        'created' => time(), 'pwchanged' => time(), 'friends' => array(), 'seen' => 0,
    );
    $meta['next']++;
    wr('meta', $meta);
    touch_device($u);
    save_user($u);
    out(array('ok' => true, 'token' => new_token($login), 'me' => pub($u, true)));

case 'login':
    $login = p('login'); $pass = p('pass');
    if (strpos($login, '@') !== false) {                 // email bilan kirish
        foreach (glob(XC_DIR . '/users/*.php') as $f) {
            $x = rd('users/' . basename($f, '.php'), null);
            if ($x && isset($x['email']) && strcasecmp($x['email'], $login) === 0) { $login = $x['login']; break; }
        }
    }
    if (!preg_match('/^[A-Za-z0-9_]{3,20}$/', $login)) fail('bad', 'Login yoki parol noto\'g\'ri');
    lock();
    $u = user($login);
    if (!$u || !password_verify($pass, $u['pass'])) { usleep(400000); fail('bad', 'Login yoki parol noto\'g\'ri'); }
    touch_device($u);
    save_user($u);
    out(array('ok' => true, 'token' => new_token($u['login']), 'me' => pub($u, true)));

case 'me':
    $u = auth();
    out(array('ok' => true, 'me' => pub($u, true)));

case 'logout':
    lock();
    $tokens = rd('tokens', array());
    unset($tokens[p('token')]);
    wr('tokens', $tokens);
    out(array('ok' => true));

case 'save':                                             // bulutga saqlash: sozlamalar, tugmalar, sevimlilar
    lock();
    $u = auth();
    $c = json_decode(p('cloud'), true);
    if (!is_array($c) || strlen(p('cloud')) > 60000) fail('bad', 'Ma\'lumot noto\'g\'ri');
    $u['cloud'] = $c; $u['cloudt'] = time();
    touch_device($u);
    save_user($u);
    out(array('ok' => true, 'cloudt' => $u['cloudt'], 'devices' => count($u['devices'])));

case 'profile':                                          // nom / email / parol
    lock();
    $u = auth();
    $name = p('name');
    if ($name !== '') {
        $name = preg_replace('/["\\\\;]/', '', $name);
        if (mb_strlen($name, 'UTF-8') < 2 || mb_strlen($name, 'UTF-8') > 24) fail('name', 'Nom 2-24 belgi');
        $u['name'] = $name;
    }
    $email = p('email');
    if ($email !== '') { if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('email', 'Email noto\'g\'ri'); $u['email'] = $email; }
    if (p('newpass') !== '') {
        if (!password_verify(p('oldpass'), $u['pass'])) fail('pass', 'Eski parol noto\'g\'ri');
        if (strlen(p('newpass')) < 6) fail('pass', 'Parol kamida 6 belgi');
        $u['pass'] = password_hash(p('newpass'), PASSWORD_DEFAULT); $u['pwchanged'] = time();
    }
    save_user($u);
    out(array('ok' => true, 'me' => pub($u, true)));

case 'ping':                                             // har daqiqada: onlayn holat + o'yin vaqti (XP)
    lock();
    $u = auth();
    $srv = p('server'); $map = p('map');
    $now = time();
    if ($srv !== '' && preg_match('/^[\w.\-]+:\d+$/', $srv)) {
        $last = isset($u['seen']) ? $u['seen'] : 0;
        if (!empty($u['server']) && $u['server'] === $srv && $now - $last >= 50 && $now - $last <= 180) {
            $u['xp'] = (int)$u['xp'] + XP_PER_MIN;
            if (!isset($u['wk']) || $u['wk'] !== week_id()) { $u['wk'] = week_id(); $u['wkxp'] = 0; }
            $u['wkxp'] = (int)$u['wkxp'] + XP_PER_MIN;
        }
        $u['server'] = $srv; $u['map'] = substr(preg_replace('/[^\w\-]/', '', $map), 0, 40);
    } else { $u['server'] = ''; $u['map'] = ''; }
    $u['seen'] = $now;
    save_user($u);
    out(array('ok' => true, 'xp' => (int)$u['xp'], 'level' => level($u['xp']), 'lvlxp' => (int)$u['xp'] % XP_PER_LEVEL));

case 'friends':
    $u = auth();
    $list = array();
    foreach ((isset($u['friends']) ? $u['friends'] : array()) as $fl) {
        $f = user($fl);
        if ($f) $list[] = pub($f, false);
    }
    usort($list, function ($a, $b) { return ($b['online'] ? 1 : 0) - ($a['online'] ? 1 : 0); });
    out(array('ok' => true, 'friends' => $list));

case 'friend_add':
case 'friend_del':
    lock();
    $u = auth();
    $fl = strtolower(p('login'));
    if (!isset($u['friends'])) $u['friends'] = array();
    if ($a === 'friend_add') {
        if ($fl === strtolower($u['login'])) fail('self', 'O\'zingizni qo\'sha olmaysiz');
        if (!user($fl)) fail('nouser', 'Bunday o\'yinchi yo\'q');
        if (!in_array($fl, $u['friends'])) $u['friends'][] = $fl;
        if (count($u['friends']) > 200) fail('many', 'Do\'stlar ko\'p');
    } else $u['friends'] = array_values(array_diff($u['friends'], array($fl)));
    save_user($u);
    out(array('ok' => true, 'friends' => $u['friends']));

case 'top':                                              // haftaning eng faol o'yinchilari (o'yin vaqti bo'yicha)
    $cache = rd('topcache', null);
    if ($cache && time() - $cache['t'] < 120) out(array('ok' => true, 'top' => $cache['top'], 'online' => $cache['online'], 'users' => $cache['users']));
    $top = array(); $online = 0; $users = 0; $wk = week_id();
    foreach (glob(XC_DIR . '/users/*.php') as $f) {
        $x = rd('users/' . basename($f, '.php'), null);
        if (!$x) continue;
        $users++;
        if (is_online($x)) $online++;
        $w = (isset($x['wk']) && $x['wk'] === $wk) ? (int)$x['wkxp'] : 0;
        if ($w > 0) $top[] = array('name' => $x['name'], 'login' => $x['login'], 'week' => $w, 'level' => level($x['xp']), 'vip' => !empty($x['vip']));
    }
    usort($top, function ($a, $b) { return $b['week'] - $a['week']; });
    $top = array_slice($top, 0, 10);
    wr('topcache', array('t' => time(), 'top' => $top, 'online' => $online, 'users' => $users));
    out(array('ok' => true, 'top' => $top, 'online' => $online, 'users' => $users));

case 'news':                                             // turnirlar / e'lonlar: xc_news.json (qo'lda tahrirlanadi)
    $f = __DIR__ . '/xc_news.json';
    $j = is_file($f) ? json_decode(file_get_contents($f), true) : null;
    out(array('ok' => true, 'news' => is_array($j) ? $j : array()));

case 'report':                                           // "Xatolik haqida xabar": konsol loglari
    $log = p('log');
    if (strlen($log) > 200000) $log = substr($log, -200000);
    @mkdir(XC_DIR . '/reports', 0755, true);
    $who = preg_replace('/[^\w\-]/', '', p('who', 'anon'));
    wr('reports/' . date('Ymd-His') . '-' . $who . '-' . mt_rand(100, 999), array('t' => time(), 'who' => $who, 'ver' => p('ver'), 'log' => $log, 'ua' => isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : ''));
    out(array('ok' => true));

default:
    fail('action', 'Noma\'lum amal');
}
