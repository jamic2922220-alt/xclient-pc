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

/* Admin "hamma uchun" deb belgilagan paketlar har bir XClient.exe ga "id~versiya" ko'rinishida qo'shiladi:
 * versiya oshirilsa, eski nusxa olib tashlanib yangisi o'rnatiladi (sborka yangilanishi). */
define('SPRAY_DEFAULT_VER', 20261026);   // spray_default.wad almashtirilsa - oshiring (hammaga qayta o'rnatiladi)
function with_forced_packs($o, $d) {
    // spray hammada bir xil - X CLIENT logotipi. sprays: tempdecal.wad hajmi - launcher farq qilsa qayta yozadi
    unset($o['spray'], $o['sprays']);
    if (is_file(__DIR__ . '/spray_default.wad')) { $o['spray'] = SPRAY_DEFAULT_VER; $o['sprays'] = filesize(__DIR__ . '/spray_default.wad'); }
    $mine = array_filter(explode(',', isset($o['packs']) ? $o['packs'] : ''));
    $all = array();
    foreach ((array)@scandir(__DIR__ . '/packs') as $id) {
        if (!preg_match('/^[a-z0-9_\-]{1,40}$/', $id) || !is_dir(__DIR__ . "/packs/$id/files")) continue;
        $m = json_decode((string)@file_get_contents(__DIR__ . "/packs/$id/pack.json"), true);
        if (empty($m['all'])) continue;
        $all[] = $id . '~' . max(1, isset($m['ver']) ? (int)$m['ver'] : 1);
        $mine = array_diff($mine, array($id));
    }
    $o['packs'] = implode(',', array_merge($all, $mine));
    return $o;
}
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
    if (!is_file(XC_DIR . '/.htaccess')) @file_put_contents(XC_DIR . '/.htaccess', "Require all denied\nDeny from all\n");
    if (!is_file(XC_DIR . '/index.html')) @file_put_contents(XC_DIR . '/index.html', '');
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

/* oddiy chastota cheklovi: $key bo'yicha $win soniyada nechta hodisa bo'lgani (xc_data/rl/) */
function rl_count($key, $win) {
    $x = rd('rl/' . substr(sha1($key), 0, 24), array());
    $n = 0; foreach ($x as $t) if (time() - $t < $win) $n++;
    return $n;
}
function rl_add($key, $win) {
    @mkdir(XC_DIR . '/rl', 0755, true);
    $k = 'rl/' . substr(sha1($key), 0, 24); $x = rd($k, array()); $y = array();
    foreach ($x as $t) if (time() - $t < $win) $y[] = $t;
    $y[] = time(); wr($k, array_slice($y, -200));
}
/* papkadagi fayllar sonini cheklash: eng eskilarini o'chiradi */
function cap_dir($dir, $max) {
    $all = (array)glob($dir . '/*.php');
    if (count($all) <= $max) return;
    usort($all, function ($a, $b) { return filemtime($a) - filemtime($b); });
    foreach (array_slice($all, 0, count($all) - $max) as $f) @unlink($f);
}
/* Kompyuter (XCLauncher) ma'lumotlariga kirish: menyu o'z kaliti (k) bilan, launcher esa
 * o'sha IP dan yaqinda 'hello' yuborgan bo'lsa. Kalit boshqa hech kimga berilmaydi. */
function ip_key() { return 'ip/' . substr(sha1(client_ip() . 'xc'), 0, 24); }
function ip_dev($maxAge) { $m = rd(ip_key(), null); return ($m && time() - $m['t'] <= $maxAge) ? $m['d'] : ''; }
function dev_ok($d, $o) { $k = p('k'); return ($k !== '' && !empty($o['k']) && hash_equals($o['k'], $k)) || ip_dev(600) === $d; }
function ukey($login) { return 'users/' . strtolower($login); }
function user($login) { return rd(ukey($login), null); }
function save_user($u) { wr(ukey($u['login']), $u); }
function week_id() { return date('o-W'); }

function auth() {
    $t = isset($_POST['token']) ? trim((string)$_POST['token']) : '';   // faqat POST: GET manzillar loglarga tushadi
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
    $l = strtolower($login); $mine = array_keys($tokens, $l);
    foreach (array_slice($mine, 0, max(0, count($mine) - 7)) as $old) unset($tokens[$old]);   // bir akkauntga 8 tagacha qurilma
    $tokens[$t] = $l;
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
        'avc' => isset($u['avc']) ? $u['avc'] : '',
        'av' => !empty($u['avt']) ? 'xc_api.php?a=av&l=' . strtolower($u['login']) . '&t=' . $u['avt'] : '',
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
/* ---- admin sozlamalari (admin.php yozadi): telegram, e'lonlar, api kalitlar ---- */
function xc_cfg() { static $c = null; if ($c === null) $c = rd('config', array()); return $c; }
function client_ip() { return isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : ''; }
/* IP -> davlat kodi (geo.php bilan bir xil kesh: xc_data/geo.php) */
function geo_cc($ip) {
    if (!preg_match('/^\d{1,3}(\.\d{1,3}){3}$/', $ip) || preg_match('/^(10|127|192\.168|172\.(1[6-9]|2\d|3[01]))\./', $ip)) return '';
    $c = rd('geo', array());
    if (isset($c[$ip]) && time() - $c[$ip][1] < 30 * 86400) return $c[$ip][0];
    $ctx = stream_context_create(array('http' => array('timeout' => 2)));
    $r = json_decode((string)@file_get_contents('http://ip-api.com/json/' . $ip . '?fields=countryCode', false, $ctx), true);
    $cc = isset($r['countryCode']) ? strtolower($r['countryCode']) : '';
    $c[$ip] = array($cc, time());
    if (count($c) > 5000) $c = array_slice($c, -4000, null, true);
    wr('geo', $c);
    return $cc;
}
/* Telegram xabarnoma (admin.php > Telegram bo'limida yoqiladi) */
function tg_notify($event, $text) {
    $c = xc_cfg();
    if (empty($c['tg_token']) || empty($c['tg_chat']) || empty($c['tg_ev'][$event])) return;
    if (rl_count('tg', 3600) >= 30) return;              // soatiga 30 tadan ko'p xabar yubormaymiz
    rl_add('tg', 3600);
    $ctx = stream_context_create(array('http' => array('method' => 'POST', 'timeout' => 3,
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query(array('chat_id' => $c['tg_chat'], 'text' => $text, 'disable_web_page_preview' => 1)))));
    @file_get_contents('https://api.telegram.org/bot' . $c['tg_token'] . '/sendMessage', false, $ctx);
}
/* Kunlik vazifalar: sana bo'yicha hammaga bir xil 3 ta vazifa. Bajarilishini menyu o'yin tarixidan hisoblaydi,
 * mukofot (XP) bu yerda kuniga bir marta beriladi. */
function missions_today() {
    @date_default_timezone_set('Asia/Tashkent');
    $pool = array(
        array('min', array(30, 45, 60), 60), array('kills', array(20, 35, 50), 70), array('servers', array(2, 3), 40),
        array('xsrv', array(15, 30), 60), array('maps', array(2, 3, 4), 50), array('kd', array(10, 15), 80),
    );
    $seed = crc32(date('Y-m-d')) & 0x7fffffff; $out = array(); $used = array();
    for ($i = 0; count($out) < 3 && $i < 50; $i++) {
        $k = ($seed + $i * 7) % count($pool);
        if (isset($used[$k])) continue;
        $used[$k] = 1; $g = $pool[$k][1];
        $out[] = array('id' => $pool[$k][0], 'goal' => $g[($seed >> 4) % count($g)], 'xp' => $pool[$k][2]);
    }
    return $out;
}
function clean_str($s, $n) { return substr(preg_replace('/[\x00-\x1f<>"\\\\]/u', '', (string)$s), 0, $n); }

/* kunlik statistika (admin.php): xc_data/daily/YYYY-MM-DD.php  {d:{qurilma:1}, n:{yangi:1}, m:{menyu:1}} */
function day_mark($kind, $id, $isNew) {
    @mkdir(XC_DIR . '/daily', 0755, true);
    @date_default_timezone_set('Asia/Tashkent');
    $k = 'daily/' . date('Y-m-d');
    $x = rd($k, array('d' => array(), 'n' => array(), 'm' => array(), 'mn' => array()));
    if (!isset($x[$kind])) $x[$kind] = array();
    $x[$kind][$id] = 1;
    if ($isNew) $x['n'][$id] = 1;
    wr($k, $x);
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
    if (rl_count('reg' . client_ip(), 3600) >= 5) fail('limit', 'Bir soatda juda ko\'p ro\'yxatdan o\'tish. Keyinroq urinib ko\'ring');
    lock();
    if (user($login)) fail('exists', 'Bu login band');
    rl_add('reg' . client_ip(), 3600);
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
    tg_notify('account', "Yangi X CLIENT akkaunt: " . $login . ($email !== '' ? ' (' . $email . ')' : ''));
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
    $kip = 'lf' . client_ip(); $kl = 'lfu' . strtolower($login);
    if (rl_count($kip, 900) >= 20 || rl_count($kl, 900) >= 10) fail('limit', 'Juda ko\'p noto\'g\'ri urinish. 15 daqiqadan keyin qayta urinib ko\'ring');
    $u = user($login);
    if (!$u || !password_verify($pass, $u['pass'])) { rl_add($kip, 900); rl_add($kl, 900); usleep(400000); fail('bad', 'Login yoki parol noto\'g\'ri'); }
    lock();                                              // qulf faqat yozish uchun - noto'g'ri urinishlar boshqalarni to'xtatmasin
    $u = user($login);
    touch_device($u);
    save_user($u);
    out(array('ok' => true, 'token' => new_token($u['login']), 'me' => pub($u, true)));

case 'beat':                                             // menyu ochildi (kuniga bir marta hisoblanadi)
    $dev = p('device');
    if (!preg_match('/^[a-z0-9]{8,40}$/', $dev)) fail('bad', 'bad');
    lock();
    @mkdir(XC_DIR . '/nc', 0755, true);
    $r = rd('nc/' . $dev, array());
    $new = empty($r['first']);
    if ($new) $r['first'] = time();
    $r['seen'] = time(); $r['days'] = (isset($r['days']) ? $r['days'] : 0) + 1;
    if (p('nick') !== '') $r['nick'] = clean_str(p('nick'), 40);
    if (preg_match('/^\d{3,5}x\d{3,5}$/', p('res'))) $r['res'] = p('res');
    if (p('mv') !== '') $r['ver'] = clean_str(p('mv'), 20);
    $ip = client_ip();
    if (empty($r['ip']) || $r['ip'] !== $ip || !isset($r['cc'])) { $r['ip'] = $ip; $r['cc'] = geo_cc($ip); }
    wr('nc/' . $dev, $r);
    day_mark('m', $dev, false);
    if ($new) day_mark('mn', $dev, false);
    out(array('ok' => true));

case 'reset_req':                                        // parolni tiklash: 1) emailga 6 xonali kod
    $who = p('login');
    $login = $who;
    if (strpos($who, '@') !== false) {
        foreach (glob(XC_DIR . '/users/*.php') as $f) {
            $x = rd('users/' . basename($f, '.php'), null);
            if ($x && !empty($x['email']) && strcasecmp($x['email'], $who) === 0) { $login = $x['login']; break; }
        }
    }
    if (!preg_match('/^[A-Za-z0-9_]{3,20}$/', $login)) fail('bad', 'Bunday akkaunt topilmadi');
    lock();
    $u = user($login);
    if (!$u) { usleep(400000); fail('bad', 'Bunday akkaunt topilmadi'); }
    if (empty($u['email'])) fail('noemail', 'Bu akkauntga email ulanmagan. Parolni tiklash uchun boost-top.com admini bilan bog\'laning');
    if (!empty($u['rst']['sent']) && time() - $u['rst']['sent'] < 120) fail('wait', 'Kod yaqinda yuborildi. 2 daqiqadan keyin qayta urinib ko\'ring');
    $code = (string)(function_exists('random_int') ? random_int(100000, 999999) : mt_rand(100000, 999999));
    $host = preg_replace('/^www\./', '', isset($_SERVER['HTTP_HOST']) ? preg_replace('/^mmb\./', '', $_SERVER['HTTP_HOST']) : 'boost-top.com');
    $subj = '=?UTF-8?B?' . base64_encode('X CLIENT: parolni tiklash kodi / код восстановления') . '?=';
    $body = "X CLIENT (boost-top.com)\r\n\r\nLogin: " . $u['login'] . "\r\nKod / Код: " . $code . "\r\n\r\n"
        . "Kodni o'yindagi X CLIENT oynasiga kiriting. Kod 15 daqiqa amal qiladi.\r\n"
        . "Введите код в окне X CLIENT в игре. Код действует 15 минут.\r\n\r\n"
        . "Agar siz so'ramagan bo'lsangiz - bu xatga e'tibor bermang.\r\n";
    $hdr = "From: X CLIENT <noreply@" . $host . ">\r\nContent-Type: text/plain; charset=UTF-8\r\nMIME-Version: 1.0\r\n";
    if (!function_exists('mail') || !@mail($u['email'], $subj, $body, $hdr)) fail('mail', 'Serverdan email yuborib bo\'lmadi. boost-top.com admini bilan bog\'laning');
    $u['rst'] = array('h' => password_hash($code, PASSWORD_DEFAULT), 'exp' => time() + 900, 'n' => 0, 'sent' => time());
    save_user($u);
    out(array('ok' => true, 'login' => $u['login'], 'email' => preg_replace('/^(.).*(@.*)$/', '$1*****$2', $u['email'])));

case 'reset_do':                                         // 2) kod + yangi parol
    $login = p('login'); $code = preg_replace('/\D/', '', p('code')); $np = p('newpass');
    if (!preg_match('/^[A-Za-z0-9_]{3,20}$/', $login)) fail('bad', 'Bunday akkaunt topilmadi');
    if (strlen($np) < 6) fail('pass', 'Yangi parol kamida 6 belgi');
    lock();
    $u = user($login);
    if (!$u || empty($u['rst'])) fail('code', 'Avval kod so\'rang');
    if (time() > $u['rst']['exp'] || $u['rst']['n'] >= 5) { unset($u['rst']); save_user($u); fail('code', 'Kod eskirdi. Yangi kod so\'rang'); }
    if (!password_verify($code, $u['rst']['h'])) { $u['rst']['n']++; save_user($u); usleep(400000); fail('code', 'Kod noto\'g\'ri'); }
    unset($u['rst']);
    $u['pass'] = password_hash($np, PASSWORD_DEFAULT); $u['pwchanged'] = time();
    $tokens = rd('tokens', array());                     // eski sessiyalar bekor qilinadi
    foreach ($tokens as $t => $l) if ($l === strtolower($u['login'])) unset($tokens[$t]);
    wr('tokens', $tokens);
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

case 'avatar':                                           // profil rasmi (JPEG/PNG data URL, 128x128) yoki rang
    lock();
    $u = auth();
    $c = p('color');
    if ($c !== '') {
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $c)) fail('bad', 'Rang noto\'g\'ri');
        $u['avc'] = $c;
    }
    $img = p('img');
    if ($img === 'none') { $u['avt'] = 0; @unlink(XC_DIR . '/av/' . strtolower($u['login']) . '.php'); }
    elseif ($img !== '') {
        if (!preg_match('#^data:image/(jpeg|png);base64,([A-Za-z0-9+/=]+)$#', $img, $m)) fail('bad', 'Rasm noto\'g\'ri');
        $bin = base64_decode($m[2]);
        if (!$bin || strlen($bin) > 80000) fail('big', 'Rasm juda katta');
        @mkdir(XC_DIR . '/av', 0755, true);
        wr('av/' . strtolower($u['login']), array('type' => $m[1], 'data' => $m[2]));
        $u['avt'] = time();
    }
    save_user($u);
    out(array('ok' => true, 'me' => pub($u, true)));

case 'av':                                               // rasmni berish
    $l = strtolower(p('l'));
    $a2 = preg_match('/^[a-z0-9_]{3,20}$/', $l) ? rd('av/' . $l, null) : null;
    if (!$a2) { header('HTTP/1.1 404 Not Found'); exit; }
    header('Content-Type: image/' . (in_array($a2['type'], array('jpeg', 'png', 'gif', 'webp')) ? $a2['type'] : 'jpeg'));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=86400');
    echo base64_decode($a2['data']);
    exit;

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
    $inv = array();                                      // do'stlardan kelgan takliflar (bir marta beriladi)
    if (!empty($u['inv'])) { foreach ($u['inv'] as $i) if ($now - $i['t'] < 600) $inv[] = $i; $u['inv'] = array(); }
    $msgs = !empty($u['msgs']) ? $u['msgs'] : array(); $u['msgs'] = array();   // admin yuborgan shaxsiy xabarlar (bir marta)
    save_user($u);
    out(array('ok' => true, 'xp' => (int)$u['xp'], 'level' => level($u['xp']), 'lvlxp' => (int)$u['xp'] % XP_PER_LEVEL, 'inv' => $inv, 'msgs' => $msgs));

case 'missions':                                         // bugungi vazifalar va qaysilari olingan
    $u = auth();
    $list = missions_today(); $day = date('Y-m-d');
    out(array('ok' => true, 'day' => $day, 'list' => $list, 'done' => isset($u['mis'][$day]) ? array_keys($u['mis'][$day]) : array()));

case 'mission_claim':                                    // vazifa mukofoti (kuniga bir marta)
    lock();
    $u = auth();
    $list = missions_today(); $day = date('Y-m-d'); $id = p('id'); $m = null;
    foreach ($list as $x) if ($x['id'] === $id) $m = $x;
    if (!$m) fail('bad', 'Vazifa topilmadi');
    if (!isset($u['mis']) || !is_array($u['mis'])) $u['mis'] = array();
    foreach (array_keys($u['mis']) as $d) if ($d !== $day) unset($u['mis'][$d]);
    if (!empty($u['mis'][$day][$id])) fail('done', 'Allaqachon olingan');
    $u['mis'][$day][$id] = 1;
    $u['xp'] = (int)$u['xp'] + $m['xp'];
    if (!isset($u['wk']) || $u['wk'] !== week_id()) { $u['wk'] = week_id(); $u['wkxp'] = 0; }
    $u['wkxp'] = (int)$u['wkxp'] + $m['xp'];
    save_user($u);
    out(array('ok' => true, 'xp' => (int)$u['xp'], 'level' => level($u['xp']), 'lvlxp' => (int)$u['xp'] % XP_PER_LEVEL, 'got' => $m['xp']));

case 'whatsnew':                                         // "Nima yangi" oynasi (admin panelda yoziladi)
    out(array('ok' => true, 'w' => rd('whatsnew', null)));

case 'invite':                                           // do'stni o'zim o'ynayotgan serverga taklif qilish
    lock();
    $u = auth();
    $to = strtolower(p('to')); $ip = p('ip');
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $to)) fail('bad', 'Login noto\'g\'ri');
    if (!preg_match('/^[\w.\-]+:\d+$/', $ip)) fail('bad', 'Server manzili noto\'g\'ri');
    if (empty($u['friends']) || !in_array($to, array_map('strtolower', $u['friends']))) fail('bad', 'Faqat do\'stlarni taklif qilish mumkin');
    $t = user($to);
    if (!$t) fail('bad', 'Do\'st topilmadi');
    if (!isset($t['inv'])) $t['inv'] = array();
    $t['inv'][] = array('from' => $u['name'], 'login' => $u['login'], 'ip' => $ip, 't' => time());
    $t['inv'] = array_slice($t['inv'], -5);
    save_user($t);
    out(array('ok' => true));

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
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $fl)) fail('bad', 'Login noto\'g\'ri');
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
        if ($w > 0) $top[] = array('name' => $x['name'], 'login' => $x['login'], 'week' => $w, 'level' => level($x['xp']), 'vip' => !empty($x['vip']),
            'avc' => isset($x['avc']) ? $x['avc'] : '', 'av' => !empty($x['avt']) ? 'xc_api.php?a=av&l=' . strtolower($x['login']) . '&t=' . $x['avt'] : '');
    }
    usort($top, function ($a, $b) { return $b['week'] - $a['week']; });
    $top = array_slice($top, 0, 10);
    wr('topcache', array('t' => time(), 'top' => $top, 'online' => $online, 'users' => $users));
    out(array('ok' => true, 'top' => $top, 'online' => $online, 'users' => $users));

case 'news':                                             // turnirlar / e'lonlar: xc_news.json (qo'lda tahrirlanadi)
    $f = __DIR__ . '/xc_news.json';
    $j = is_file($f) ? json_decode(file_get_contents($f), true) : null;
    $ann = array();                                      // admin paneldagi e'lonlar
    foreach ((array)rd('announce', array()) as $x) if (empty($x['until']) || $x['until'] > time()) $ann[] = array('id' => $x['id'], 'text' => $x['text'], 'type' => $x['type'], 'link' => isset($x['link']) ? $x['link'] : '');
    out(array('ok' => true, 'news' => is_array($j) ? $j : array(), 'ann' => $ann));

case 'report':                                           // "Xatolik haqida xabar": konsol loglari
    if (rl_count('rep' . client_ip(), 3600) >= 5) fail('limit', 'Bir soatda 5 tadan ko\'p xabar yuborib bo\'lmaydi');
    rl_add('rep' . client_ip(), 3600);
    $log = p('log');
    if (strlen($log) > 200000) $log = substr($log, -200000);
    @mkdir(XC_DIR . '/reports', 0755, true);
    cap_dir(XC_DIR . '/reports', 500);
    $who = preg_replace('/[^\w\-]/', '', p('who', 'anon'));
    wr('reports/' . date('Ymd-His') . '-' . $who . '-' . mt_rand(100, 999), array('t' => time(), 'who' => $who, 'ver' => p('ver'), 'log' => $log, 'ua' => isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : ''));
    tg_notify('report', "X CLIENT: xatolik haqida xabar keldi (" . $who . ", v" . clean_str(p('ver'), 20) . ")");
    out(array('ok' => true));

/* ---- XClient.exe <-> menyu: bir kompyuter (bir IP) bo'yicha bog'lanadi ----
 * XClient.exe ishga tushganda 'hello' yuboradi (kompyuter id, versiya, kesh hajmi).
 * Menyu 'opts' / 'opts_set' ni id'siz chaqiradi - server shu IP dan oxirgi kelgan XClient.exe id'sini oladi. */
case 'hello':
case 'opts':
case 'opts_set':
case 'opts_done':
    @mkdir(XC_DIR . '/dev', 0755, true);
    @mkdir(XC_DIR . '/ip', 0755, true);
    $ipk = 'ip/' . substr(sha1((isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '') . 'xc'), 0, 24);
    $d = strtolower(p('d'));
    if ($a === 'hello') {
        if (!preg_match('/^[a-z0-9]{8,40}$/', $d)) fail('dev', 'device');
        lock();
        $o = rd('dev/' . $d, array());
        $isNew = empty($o['first']) && empty($o['seen']);  // birinchi marta ko'rinayotgan kompyuter = yangi o'rnatish
        if ($isNew) { if (rl_count('nd' . client_ip(), 86400) >= 30) fail('limit', 'limit'); rl_add('nd' . client_ip(), 86400); }
        unset($o['kc']);                                   // yangi ishga tushish: menyu kalitni yana bir marta olishi mumkin
        if (empty($o['k'])) $o['k'] = bin2hex(function_exists('random_bytes') ? random_bytes(16) : openssl_random_pseudo_bytes(16));
        if (empty($o['first'])) $o['first'] = time();
        day_mark('d', $d, $isNew);                         // kunlik statistika: XClient.exe ishga tushirganlar
        $o['ver'] = substr(preg_replace('/[^\w.\-]/', '', p('v')), 0, 20);
        $o['cachemb'] = (int)p('cache');
        $o['seen'] = time();
        if (p('ram') !== '') $o['hw'] = array('ram' => (int)p('ram'), 'cpu' => (int)p('cpu'), 'gpu' => substr(preg_replace('/[^\w .()\-\/]/', '', p('gpu')), 0, 80));
        if (p('res') !== '') $o['res'] = preg_match('/^\d{3,5}x\d{3,5}$/', p('res')) ? p('res') : '';
        if (p('os') !== '') $o['os'] = clean_str(p('os'), 80);
        if (p('ch') !== '') $o['ch'] = preg_replace('/[^a-z]/', '', p('ch'));
        if (p('pt') !== '') $o['pt'] = clean_str(p('pt'), 60);
        $ip = client_ip();
        if (empty($o['ip']) || $o['ip'] !== $ip || !isset($o['cc'])) { $o['ip'] = $ip; $o['cc'] = geo_cc($ip); }
        $o['runs'] = (isset($o['runs']) ? $o['runs'] : 0) + 1;
        wr('dev/' . $d, $o);
        if ($isNew) tg_notify('install', "Yangi X CLIENT o'rnatish\n" . strtoupper(isset($o['cc']) ? $o['cc'] : '') . ' ' . $ip . "\n" . (isset($o['os']) ? $o['os'] : '') . (isset($o['res']) ? ' · ' . $o['res'] : ''));
        wr($ipk, array('d' => $d, 't' => time()));
        $ho = with_forced_packs($o, $d); unset($ho['k'], $ho['kc']);
        out(array('ok' => true, 'o' => $ho));
    }
    $claim = false;
    if (!preg_match('/^[a-z0-9]{8,40}$/', $d)) {           // menyu hali kalitsiz: shu IP dan 10 daqiqa ichida launcher ochilgan bo'lsa - bir marta beramiz
        $d = ip_dev(600);
        if ($d === '') out(array('ok' => true, 'o' => null));
        $claim = true;
    }
    lock();
    $o = rd('dev/' . $d, array());
    if (!$o) out(array('ok' => true, 'o' => null));
    if ($claim) {
        if (!empty($o['kc'])) $claim = false;   // kalit allaqachon olingan: kalitni qayta bermaymiz, lekin sozlamalar ochiladi (dev_ok - shu IP dan 10 daqiqa ichida launcher)
        else { $o['kc'] = 1; wr('dev/' . $d, $o); }
    } elseif (!dev_ok($d, $o)) fail('nolaunch', 'XCLauncher.exe topilmadi');
    if ($a === 'opts_set') {
        $in = json_decode(p('o'), true);
        if (!is_array($in)) fail('bad', 'bad');
        foreach (array('beta', 'auto', 'start', 'win', 'clean', 'verify', 'prio', 'shots') as $k) if (isset($in[$k])) $o[$k] = $in[$k] ? 1 : 0;
        if (isset($in['packs'])) $o['packs'] = preg_match('/^[a-z0-9_,\-]{0,200}$/', $in['packs']) ? $in['packs'] : '';
        if (isset($in['hud'])) $o['hud'] = in_array((int)$in['hud'], array(100, 150, 200)) ? (int)$in['hud'] : 100;   // HUD kattaligi, %
        if (isset($in['res'])) $o['res'] = preg_match('/^\d{3,4}x\d{3,4}$/', $in['res']) ? $in['res'] : '';
        wr('dev/' . $d, $o);
    } elseif ($a === 'opts_done') {
        $o['clean'] = 0; $o['verify'] = 0;
        if (p('cache') !== '') $o['cachemb'] = (int)p('cache');
        wr('dev/' . $d, $o);
    }
    $key = isset($o['k']) ? $o['k'] : '';
    unset($o['k'], $o['kc'], $o['ip']);
    out(array('ok' => true, 'o' => $o, 'd' => $d, 'k' => $claim ? $key : null));

/* ---------- spray, skrinshotlar: XClient.exe (kompyuter id) bilan bog'liq ---------- */
case 'spray':                                            // menyu: tayyor tempdecal.wad (base64) -> keyingi ishga tushishda o'rnatiladi
case 'spray_get':                                        // XClient.exe: wad faylni olish
case 'spray_reset':
case 'shot_up':                                          // XClient.exe: skrinshot (JPEG) yuklash
case 'shots':                                            // menyu: skrinshotlar ro'yxati
case 'shot':                                             // menyu: bitta skrinshot
case 'shot_del':
    $d = strtolower(p('d'));
    if (!preg_match('/^[a-z0-9]{8,40}$/', $d) || !is_file(XC_DIR . '/dev/' . $d . '.php')) fail('nolaunch', 'XCLauncher.exe topilmadi');
    if ($a === 'shot_up') { if (ip_dev(1800) !== $d) fail('nolaunch', 'XCLauncher.exe topilmadi'); }   // launcher: shu IP dan yaqinda ochilgan
    elseif ($a !== 'spray_get' && !dev_ok($d, rd('dev/' . $d, array()))) fail('nolaunch', 'XCLauncher.exe topilmadi');
    if ($a === 'spray') fail('off', 'Spray hammada X CLIENT logotipi');   // o'z rasmini qo'yish o'chirilgan
    if ($a === 'spray_reset') {                            // menyu: "X CLIENT" spray - saytdagi tiniq standart logotip
        lock();
        @unlink(XC_DIR . '/spray/' . $d . '.php');
        $o = rd('dev/' . $d, array()); unset($o['spray']); wr('dev/' . $d, $o);
        out(array('ok' => true));
    }
    if ($a === 'spray_get') {                              // hammaga X CLIENT logotipi
        if (!is_file(__DIR__ . '/spray_default.wad')) { header('HTTP/1.1 404 Not Found'); exit; }
        header('Content-Type: application/octet-stream');
        readfile(__DIR__ . '/spray_default.wad');
        exit;
    }
    $sd = XC_DIR . '/shots/' . $d;
    if ($a === 'shot_up') {
        $img = file_get_contents('php://input');
        if (!$img || strlen($img) > 2500000 || substr($img, 0, 2) !== "\xFF\xD8") fail('bad', 'JPEG kerak');
        @mkdir($sd, 0755, true);
        $name = time() . '_' . mt_rand(100, 999);
        file_put_contents("$sd/$name.php", XC_GUARD . $img, LOCK_EX);
        $all = glob("$sd/*.php"); sort($all);
        while (count($all) > 40) @unlink(array_shift($all));   // oxirgi 40 tasi saqlanadi
        out(array('ok' => true));
    }
    if ($a === 'shots') {
        $list = array();
        foreach (array_reverse((array)glob("$sd/*.php")) as $f) { $n = basename($f, '.php'); $list[] = array('f' => $n, 't' => (int)$n); }
        out(array('ok' => true, 'd' => $d, 'list' => $list));
    }
    $f = preg_replace('/[^0-9_]/', '', p('f'));
    if ($f === '' || !is_file("$sd/$f.php")) { header('HTTP/1.1 404 Not Found'); exit; }
    if ($a === 'shot_del') { @unlink("$sd/$f.php"); out(array('ok' => true)); }
    header('Content-Type: image/jpeg');
    header('Cache-Control: public, max-age=604800');
    echo substr(file_get_contents("$sd/$f.php"), strlen(XC_GUARD));
    exit;

/* ---------- serverning soatlar bo'yicha gavjumligi (o'yinchilar menyusi yuborgan ma'lumotdan) ---------- */
case 'srvstat':
    $in = json_decode(p('s'), true);
    if (!is_array($in)) fail('bad', 'bad');
    @date_default_timezone_set('Asia/Tashkent');
    $h = (int)date('G');
    lock();
    @mkdir(XC_DIR . '/stat', 0755, true);
    foreach (array_slice($in, 0, 40) as $x) {
        if (!is_array($x) || count($x) < 3 || !preg_match('/^[\w.\-]+:\d+$/', $x[0])) continue;
        $pl = max(0, min(64, (int)$x[1])); $mx = max(1, min(64, (int)$x[2]));
        $k = 'stat/' . substr(sha1($x[0]), 0, 20);
        if (!is_file(XC_DIR . '/' . $k . '.php') && count((array)glob(XC_DIR . '/stat/*.php')) >= 3000) continue;   // yangi server soni chegarasi
        $st = rd($k, array('h' => array_fill(0, 24, array(0, 0)), 'lt' => array_fill(0, 24, 0), 'max' => $mx));
        if (time() - $st['lt'][$h] < 300) continue;      // har soatga 5 daqiqada bir marta
        $st['h'][$h][0] += $pl; $st['h'][$h][1]++;
        if ($st['h'][$h][1] > 200) { $st['h'][$h][0] /= 2; $st['h'][$h][1] /= 2; }
        $st['lt'][$h] = time(); $st['max'] = $mx;
        wr($k, $st);
    }
    out(array('ok' => true));

case 'srvhist':
    $ip = p('ip');
    if (!preg_match('/^[\w.\-]+:\d+$/', $ip)) fail('bad', 'bad');
    $st = rd('stat/' . substr(sha1($ip), 0, 20), null);
    $out = array();
    for ($i = 0; $i < 24; $i++) $out[] = ($st && $st['h'][$i][1] > 0) ? round($st['h'][$i][0] / $st['h'][$i][1], 1) : -1;
    @date_default_timezone_set('Asia/Tashkent');
    out(array('ok' => true, 'h' => $out, 'max' => $st ? $st['max'] : 32, 'now' => (int)date('G')));

default:
    fail('action', 'Noma\'lum amal');
}
