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
define('XP_PER_KILL', 2);         // har kill uchun XP (jang statistikasi orqali)

/* Admin "hamma uchun" deb belgilagan paketlar har bir XClient.exe ga "id~versiya" ko'rinishida qo'shiladi:
 * versiya oshirilsa, eski nusxa olib tashlanib yangisi o'rnatiladi (sborka yangilanishi). */
define('SPRAY_DEFAULT_VER', 20261026);   // spray_default.wad almashtirilsa - oshiring (hammaga qayta o'rnatiladi)
function with_forced_packs($o, $d) {
    // spray hammada bir xil - X CLIENT logotipi. sprays: tempdecal.wad hajmi - launcher farq qilsa qayta yozadi
    unset($o['spray'], $o['sprays']);
    unset($o['sprayh']);
    if (is_file(__DIR__ . '/spray_default.wad')) { $o['spray'] = SPRAY_DEFAULT_VER; $o['sprays'] = filesize(__DIR__ . '/spray_default.wad'); $o['sprayh'] = hash_file('sha256', __DIR__ . '/spray_default.wad'); }
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
function out($a) { $j = json_encode($a); if ($j === false) $j = json_encode(utf8_fix($a)); echo $j === false ? '{"ok":false,"err":"enc"}' : $j; exit; }
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
/* noto'g'ri UTF-8 (masalan baytlab kesilgan kirill harfi) json_encode ni false qiladi - fayl bo'sh qolib, akkaunt yo'qolardi.
 * Shuning uchun: avval tozalab qayta urinamiz, baribir bo'lmasa - eski faylga umuman tegmaymiz */
function utf8_fix($v) {
    if (is_array($v)) { $o = array(); foreach ($v as $k => $x) $o[is_string($k) ? utf8_fix($k) : $k] = utf8_fix($x); return $o; }
    if (!is_string($v) || preg_match('//u', $v)) return $v;
    return function_exists('mb_convert_encoding') ? mb_convert_encoding($v, 'UTF-8', 'UTF-8') : preg_replace('/[\x80-\xff]/', '?', $v);
}
function wr($name, $data) {
    $j = json_encode($data);
    if ($j === false) $j = json_encode(utf8_fix($data));
    if ($j === false) return false;
    $f = XC_DIR . '/' . $name . '.php';
    $tmp = $f . '.' . mt_rand() . '.tmp';
    if (file_put_contents($tmp, XC_GUARD . $j, LOCK_EX) === false) { @unlink($tmp); return false; }
    return @rename($tmp, $f);
}
/* butun yozish jarayonini bitta qulf ostida bajaramiz (bir vaqtda ikki so'rov) */
$LOCK = null;
function lock() {
    global $LOCK;
    if ($LOCK) return;                                   // bir so'rovda ikkinchi marta - o'zini o'zi kutib qolmasin
    $LOCK = fopen(XC_DIR . '/.lock', 'c');
    if ($LOCK) flock($LOCK, LOCK_EX);
}

function unlock() { global $LOCK; if ($LOCK) { flock($LOCK, LOCK_UN); fclose($LOCK); $LOCK = null; } }   // tarmoqqa chiqishdan oldin - boshqa so'rovlar kutib qolmasin

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
/* istalgan turdagi fayllar uchun (jonli ko'rinish rasmlari) */
function cap_dir_any($dir, $mask, $max) {
    $all = (array)glob($dir . '/' . $mask);
    if (count($all) <= $max) return;
    usort($all, function ($a, $b) { return filemtime($a) - filemtime($b); });
    foreach (array_slice($all, 0, count($all) - $max) as $f) @unlink($f);
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
/* kompyuter ma'lumotiga (saqlangan kirish tokeni ham bor) faqat shu kompyuterning maxfiy kaliti bilan: bitta IP dagi (internet-kafe,
 * mobil internet) boshqa odam IP orqali kira olmasin. Kalitni menyu launcher ochilgach bir marta oladi (opts) */
function dev_ok($d, $o) { $k = p('k'); return $k !== '' && !empty($o['k']) && hash_equals($o['k'], $k); }
function ukey($login) { return 'users/' . strtolower($login); }
function user($login) { return preg_match('/^[A-Za-z0-9_]{3,20}$/', (string)$login) ? rd(ukey($login), null) : null; }   // login fayl nomi bo'ladi: ../ bilan boshqa fayllarni o'qib bo'lmasin
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
        'vip' => !empty($u['vip']), 'online' => is_online($u), 'seen' => isset($u['seen']) ? (int)$u['seen'] : 0,
        'avc' => isset($u['avc']) ? $u['avc'] : '',
        'av' => !empty($u['avt']) ? 'xc_api.php?a=av&l=' . strtolower($u['login']) . '&t=' . $u['avt'] : '',
        'server' => is_online($u) && !empty($u['server']) ? $u['server'] : '', 'map' => is_online($u) && !empty($u['map']) ? $u['map'] : '',
    );
    $st = isset($u['st']) && is_array($u['st']) ? $u['st'] : array();
    $r['ach'] = isset($u['ach']) ? array_keys($u['ach']) : array();
    $ch = rd('champ', array()); $r['champ'] = !empty($ch['login']) && $ch['login'] === strtolower($u['login']);
    if (!empty($u['clan'])) $r['clan'] = $u['clan'];
    if (!empty($u['last'])) $r['last'] = $u['last'];
    if (!empty($u['dly']['s'])) $r['streak'] = (int)$u['dly']['s'];
    $r['rp'] = (int)@$u['rp']; $r['rank'] = rank_of((int)@$u['rp']);
    if (!empty($u['nc'])) $r['nc'] = $u['nc'];
    if (!empty($u['frame'])) $r['frame'] = $u['frame'];
    if (!empty($u['duels'])) $r['duels'] = $u['duels'];
    $r['st'] = array('k' => (int)@$st['k'], 'd' => (int)@$st['d'], 'g' => (int)@$st['g'], 't' => (int)@$st['t'], 'best' => (int)@$st['best'],
        'wk' => (isset($u['wkkid']) && $u['wkkid'] === week_id()) ? (int)$u['wkk'] : 0);
    if ($full) {
        $w = isset($st['wpn']) ? $st['wpn'] : array(); arsort($w); $r['st']['wpn'] = array_slice($w, 0, 6, true);
        $sv = isset($st['srv']) ? $st['srv'] : array(); uasort($sv, function ($a, $b) { return $b['k'] - $a['k']; }); $r['st']['srv'] = array_slice($sv, 0, 5, true);
        $r['email'] = isset($u['email']) ? preg_replace('/^(.).*(@.*)$/', '$1*****$2', $u['email']) : '';
        $r['tg'] = isset($u['tg']) ? $u['tg'] : '';
        $r['created'] = $u['created'];
        $r['pwchanged'] = isset($u['pwchanged']) ? $u['pwchanged'] : $u['created'];
        $r['cloud'] = isset($u['cloud']) ? $u['cloud'] : null;
        $r['refby'] = isset($u['refby']) ? $u['refby'] : '';
        $r['bf'] = !empty($u['bf']) ? 1 : 0;
        $r['refs'] = isset($u['refs']) ? count($u['refs']) : 0;
        $r['cloudt'] = isset($u['cloudt']) ? $u['cloudt'] : 0;
        $r['devices'] = isset($u['devices']) ? count($u['devices']) : 0;
        $r['friends'] = isset($u['friends']) ? $u['friends'] : array();
        $r['week'] = (isset($u['wk']) && $u['wk'] === week_id()) ? (int)$u['wkxp'] : 0;
        $r['wkst'] = isset($u['wkst']) ? $u['wkst'] : new stdClass();
        $r['tglinked'] = !empty($u['tgid']) ? 1 : 0;
        $r['chests'] = chests_avail($u);
        $r['inv'] = inv_of($u);
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
/* ---- reyting (RP): kill +2, o'lim -1.5 (0 dan pastga tushmaydi). Unvon RP bo'yicha ---- */
function rank_of($rp) { $r = array(array(0, 'bronze'), array(400, 'silver'), array(900, 'gold'), array(1600, 'plat'), array(2500, 'diamond'), array(3600, 'legend')); $o = 'bronze'; foreach ($r as $x) if ($rp >= $x[0]) $o = $x[1]; return $o; }
/* ---- sandiq: har darajada bittadan + bonuslar (duel g'alabasi, 7 kunlik ketma-ketlik) ---- */
function inv_of($u) { $i = isset($u['bag']) && is_array($u['bag']) ? $u['bag'] : array(); if (!isset($i['nc']) || !is_array($i['nc'])) $i['nc'] = array(); if (!isset($i['fr']) || !is_array($i['fr'])) $i['fr'] = array(); return $i; }
function chests_avail($u) { return max(0, level($u['xp']) - 1 + (int)@$u['chb'] - (int)@$u['cho']); }
function nick_colors() { return array('red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'); }   // 10-darajadan bepul
function nick_rare() { return array('gold', 'neon', 'ice', 'toxic', 'rainbow'); }                               // faqat sandiqdan
function frames_rare() { return array('ffire', 'fice', 'fneon', 'ftoxic', 'flegend'); }
/* ---- duel: 2 do'st N daqiqa ichida kim ko'p kill qilsa (istalgan serverda) ---- */
function duel_finish($id) {
    $d = rd('duels/' . $id, null);
    if (!$d || $d['st'] !== 'on' || time() < $d['end']) return $d;
    $d['st'] = 'end'; $w = $d['ka'] > $d['kb'] ? 'a' : ($d['kb'] > $d['ka'] ? 'b' : '');
    $d['win'] = $w; wr('duels/' . $id, $d);
    foreach (array('a', 'b') as $side) {
        $x = user($d[$side]); if (!$x) continue;
        if (!isset($x['duels'])) $x['duels'] = array('w' => 0, 'l' => 0, 'd' => 0);
        if ($w === '') { $x['duels']['d']++; $x['xp'] = (int)$x['xp'] + 50; }
        elseif ($w === $side) { $x['duels']['w']++; $x['xp'] = (int)$x['xp'] + 150; $x['chb'] = (int)@$x['chb'] + 1; }
        else { $x['duels']['l']++; $x['xp'] = (int)$x['xp'] + 30; }
        $x['dres'] = $id; if (isset($x['duel']) && $x['duel'] === $id) unset($x['duel']);
        save_user($x);
    }
    return $d;
}
function duel_pub($d, $me) {
    if (!$d) return null;
    $a = strtolower($d['a']) === $me;
    return array('id' => $d['id'], 'st' => $d['st'], 'mins' => $d['mins'], 'start' => isset($d['start']) ? $d['start'] : 0, 'end' => isset($d['end']) ? $d['end'] : 0,
        'op' => $a ? $d['b'] : $d['a'], 'opn' => $a ? $d['bn'] : $d['an'], 'me_k' => $a ? $d['ka'] : $d['kb'], 'op_k' => $a ? $d['kb'] : $d['ka'],
        'win' => isset($d['win']) ? ($d['win'] === '' ? 'draw' : (($d['win'] === 'a') === $a ? 'me' : 'op')) : '');
}
/* ---- funksiya tugmalari (admin panel > Funksiyalar): biror funksiya muammo qilsa - faqat o'shani o'chirish ---- */
function feat_list() { return array('duel' => 'Duel', 'chest' => 'Sandiqlar', 'ring' => "Qo'ng'iroq", 'wall' => 'Profil devori', 'suggest' => "Do'st tavsiyalari", 'daily' => 'Kunlik mukofot',
    'feedback' => 'Taklif / shikoyat', 'particles' => 'Uchqun / qor', 'anim' => 'Animatsiyalar (ramka va h.k.)', 'holiday' => 'Bayram bezaklari', 'clicks' => 'Tugma statistikasi'); }
function feat_on($k) { $c = xc_cfg(); return !isset($c['feat'][$k]) || !empty($c['feat'][$k]); }
/* ---- menyu versiyalari: beta testerlar (IP yoki kompyuter ID) ---- */
function is_beta_tester() {
    $c = xc_cfg();
    if (!empty($c['beta_ips']) && in_array(client_ip(), $c['beta_ips'], true)) return true;
    $pc = ip_dev(3 * 86400);
    return $pc !== '' && !empty($c['beta_pcs']) && in_array($pc, $c['beta_pcs'], true);
}
function tg_send($chat, $text) {
    $c = xc_cfg(); if (empty($c['tg_token']) || !$chat) return;
    $ctx = stream_context_create(array('http' => array('method' => 'POST', 'timeout' => 3, 'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query(array('chat_id' => $chat, 'text' => $text, 'disable_web_page_preview' => 1)))));
    @file_get_contents('https://api.telegram.org/bot' . $c['tg_token'] . '/sendMessage', false, $ctx);
}
/* O'yinchilar uchun bot: HTTPS webhook shart emas - menyu so'rovlari kelganda 10 soniyada bir getUpdates bilan yangi xabarlarni olamiz */
function tg_bot_poll() {
    $c = xc_cfg();
    if (empty($c['tg_bot']) || empty($c['tg_token'])) return;
    $f = XC_DIR . '/tgpoll.lock';
    if (is_file($f) && time() - filemtime($f) < 10) return;
    $h = @fopen($f, 'c'); if (!$h || !flock($h, LOCK_EX | LOCK_NB)) return;
    touch($f);
    $st = rd('tgbot', array('off' => 0));
    $ctx = stream_context_create(array('http' => array('timeout' => 3)));
    $r = json_decode((string)@file_get_contents('https://api.telegram.org/bot' . $c['tg_token'] . '/getUpdates?timeout=0&limit=30&offset=' . ((int)$st['off'] + 1), false, $ctx), true);
    if (!empty($r['result'])) foreach ($r['result'] as $up) {
        $st['off'] = max((int)$st['off'], (int)$up['update_id']);
        if (empty($up['message']['text']) || empty($up['message']['chat']['id']) || $up['message']['chat']['type'] !== 'private') continue;
        $chat = $up['message']['chat']['id']; $txt = trim($up['message']['text']);
        tg_send($chat, tg_bot_answer($chat, $txt));
    }
    wr('tgbot', $st);
    flock($h, LOCK_UN); fclose($h);
}
function tg_bot_answer($chat, $txt) {
    $me = null;
    foreach ((array)glob(XC_DIR . '/users/*.php') as $f) { $x = user(basename($f, '.php')); if ($x && !empty($x['tgid']) && (string)$x['tgid'] === (string)$chat) { $me = $x; break; } }
    if (preg_match('/^(?:\/link\s*)?(\d{6})$/', $txt, $m)) {
        $codes = rd('tglink', array());
        if (empty($codes[$m[1]]) || time() - $codes[$m[1]]['t'] > 900) return "Kod topilmadi yoki eskirgan. X CLIENT menyusida: Sozlamalar > Akkaunt > Telegram'ni ulash.";
        lock(); $codes = rd('tglink', array());          // ping/stat bilan bir vaqtda yozib, ma'lumot yo'qolmasin
        if (empty($codes[$m[1]])) return "Kod topilmadi yoki eskirgan.";
        $u = user($codes[$m[1]]['l']); if (!$u) return 'Akkaunt topilmadi.';
        $u['tgid'] = $chat; save_user($u); unset($codes[$m[1]]); wr('tglink', $codes); unlock();
        return "Ulandi! Salom, " . $u['name'] . ".\n/me - statistikam\n/friends - onlayn do'stlar\n/top - hafta qotillari\n/online - hozir o'ynayotganlar";
    }
    if (!$me) return "Salom! Bu X CLIENT boti.\nAkkauntingizni ulash: X CLIENT menyusida Sozlamalar > Akkaunt > \"Telegram'ni ulash\" ni bosing va chiqqan 6 xonali kodni shu yerga yozing.";
    $cmd = strtolower(preg_replace('/@.*$/', '', $txt));
    if ($cmd === '/me' || $cmd === '/stats') {
        $st = isset($me['st']) ? $me['st'] : array(); $k = (int)@$st['k']; $d = (int)@$st['d'];
        return $me['name'] . " - " . level($me['xp']) . "-daraja (" . ((int)$me['xp'] % XP_PER_LEVEL) . "/" . XP_PER_LEVEL . " XP)\nKill: $k · O'lim: $d · K/D: " . ($d ? round($k / $d, 2) : $k) . "\nO'yinlar: " . (int)@$st['g'] . " · Soat: " . round((int)@$st['t'] / 3600, 1) . "\nEng zo'r o'yin: " . (int)@$st['best'] . " kill\nYutuqlar: " . (isset($me['ach']) ? count($me['ach']) : 0);
    }
    if ($cmd === '/friends') {
        $on = array(); foreach ((isset($me['friends']) ? $me['friends'] : array()) as $fl) { $f = user($fl); if ($f && is_online($f)) $on[] = $f['name'] . (!empty($f['server']) ? ' - ' . $f['server'] . (!empty($f['map']) ? ' (' . $f['map'] . ')' : '') : ' - menyuda'); }
        return $on ? "Onlayn do'stlar:\n" . implode("\n", $on) : "Hozir onlayn do'st yo'q.";
    }
    if ($cmd === '/top') {
        $l = array(); $wk = week_id();
        foreach ((array)glob(XC_DIR . '/users/*.php') as $f) { $x = user(basename($f, '.php')); if ($x && isset($x['wkkid']) && $x['wkkid'] === $wk && !empty($x['wkk'])) $l[] = array($x['name'], (int)$x['wkk']); }
        usort($l, function ($a, $b) { return $b[1] - $a[1]; });
        $o = "Hafta qotillari:"; foreach (array_slice($l, 0, 10) as $i => $x) $o .= "\n" . ($i + 1) . ". " . $x[0] . " - " . $x[1] . " kill";
        return $l ? $o : "Bu hafta hali hech kim kill qilmadi.";
    }
    if ($cmd === '/online') {
        $n = 0; $srv = 0; foreach ((array)glob(XC_DIR . '/users/*.php') as $f) { $x = user(basename($f, '.php')); if ($x && is_online($x)) { $n++; if (!empty($x['server'])) $srv++; } }
        return "Hozir X CLIENT da: $n kishi ($srv tasi serverda o'ynayapti).";
    }
    return "/me - statistikam\n/friends - onlayn do'stlar\n/top - hafta qotillari\n/online - hozir o'ynayotganlar";
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
/* vazifa progressi saytning o'z bugungi statistikasidan (stat orqali yig'iladi) - menyu ham shuni ko'rsatadi */
function mis_prog($u, $day, $id) {
    $ds = isset($u['dst'][$day]) && is_array($u['dst'][$day]) ? $u['dst'][$day] : array();
    $k = (int)@$ds['k']; $d = (int)@$ds['d']; $t = (int)@$ds['t'];
    if ($id === 'min' || $id === 'xsrv') return (int)floor($t / 60);
    if ($id === 'kills') return $k;
    if ($id === 'servers') return isset($ds['ips']) && is_array($ds['ips']) ? count($ds['ips']) : (isset($ds['srv']) && is_array($ds['srv']) ? count($ds['srv']) : 0);
    if ($id === 'maps') return isset($ds['maps']) && is_array($ds['maps']) ? count($ds['maps']) : 0;
    if ($id === 'kd') return $k >= $d ? $k : 0;
    return 0;
}
/* ---------- yutuqlar (achievement): shart bajarilganda bir marta beriladi, profilda nishon ---------- */
function ach_list() {
    return array(
        'k100' => array(100, 'k'), 'k1000' => array(1000, 'k'), 'k5000' => array(5000, 'k'),
        'best30' => array(30, 'best'), 'g100' => array(100, 'g'), 't10h' => array(36000, 't'), 't50h' => array(180000, 't'),
        'awp100' => array(100, 'w:awp'), 'ak500' => array(500, 'w:ak47'), 'knife10' => array(10, 'w:knife'), 'deagle100' => array(100, 'w:deagle'),
        'fr5' => array(5, 'fr'), 'ref3' => array(3, 'ref'), 'champ' => array(1, 'champ'), 'clan' => array(1, 'clan'),
        'k10000' => array(10000, 'k'), 'best50' => array(50, 'best'), 'g500' => array(500, 'g'), 't100h' => array(360000, 't'),
        'fr20' => array(20, 'fr'), 'streak7' => array(7, 'streak'), 'srv10' => array(10, 'srvn'), 'wall10' => array(10, 'wall'),
    );
}
function ach_check(&$u) {
    $st = isset($u['st']) ? $u['st'] : array(); $new = array();
    if (!isset($u['ach']) || !is_array($u['ach'])) $u['ach'] = array();
    foreach (ach_list() as $id => $a) {
        if (isset($u['ach'][$id])) continue;
        $f = $a[1];
        if (strpos($f, 'w:') === 0) { $wn = substr($f, 2); $v = isset($st['wpn'][$wn]) ? (int)$st['wpn'][$wn] : 0; }
        elseif ($f === 'fr') $v = isset($u['friends']) ? count($u['friends']) : 0;
        elseif ($f === 'ref') $v = isset($u['refs']) ? count($u['refs']) : 0;
        elseif ($f === 'champ') $v = !empty($u['champs']) ? 1 : 0;
        elseif ($f === 'clan') $v = !empty($u['clan']) ? 1 : 0;
        elseif ($f === 'streak') $v = isset($u['dly']['s']) ? (int)$u['dly']['s'] : 0;
        elseif ($f === 'srvn') $v = isset($st['srv']) ? count($st['srv']) : 0;
        elseif ($f === 'wall') $v = isset($u['walln']) ? (int)$u['walln'] : 0;
        else $v = isset($st[$f]) ? (int)$st[$f] : 0;
        if ($v >= $a[0]) { $u['ach'][$id] = time(); $new[] = $id; $u['xp'] = (int)$u['xp'] + 100; }   // har yutuq +100 XP
    }
    return $new;
}
/* hafta chempioni: o'tgan haftaning eng ko'p kill qilgani - toj nishoni (bir hafta) + 500 XP. Hafta almashgach birinchi so'rovda hisoblanadi */
function champ_update() {
    $prev = date('o-W', strtotime('-7 day')); $c = rd('champ', array());
    if (isset($c['wk']) && $c['wk'] === $prev) return $c;
    lock(); $c = rd('champ', array());                    // hafta almashganda ikki so'rov bir vaqtda kelsa - mukofot bir marta
    if (isset($c['wk']) && $c['wk'] === $prev) return $c;
    $best = null; $bk = 0;
    foreach (glob(XC_DIR . '/users/*.php') as $f) {
        $x = rd('users/' . basename($f, '.php'), null); if (!$x) continue;
        $k = (isset($x['wkkid']) && $x['wkkid'] === $prev) ? (int)$x['wkk'] : ((isset($x['wkkpid']) && $x['wkkpid'] === $prev) ? (int)$x['wkkp'] : 0);
        if ($k > $bk) { $bk = $k; $best = $x; }
    }
    $c = array('wk' => $prev, 'login' => $best ? strtolower($best['login']) : '', 'name' => $best ? $best['name'] : '', 'k' => $bk);
    wr('champ', $c);
    if ($best) {
        $best['champs'] = (isset($best['champs']) ? (int)$best['champs'] : 0) + 1; $best['xp'] = (int)$best['xp'] + 500;
        ach_check($best);
        if (!isset($best['msgs'])) $best['msgs'] = array();
        $best['msgs'][] = array('t' => time(), 'text' => "\xF0\x9F\x91\x91 Tabriklaymiz! Siz o'tgan haftaning chempionisiz ($bk kill). +500 XP va toj nishoni.");
        save_user($best); unlock();
        tg_notify('daily', "Hafta chempioni: " . $best['name'] . " - $bk kill");
    }
    return $c;
}
/* Telegram'ga kunlik hisobot: soat 9 dan keyin birinchi so'rovda, kuniga bir marta (cron kerak emas) */
function daily_report() {
    @date_default_timezone_set('Asia/Tashkent');
    if ((int)date('G') < 9) return;
    $c = xc_cfg(); if (empty($c['tg_token']) || empty($c['tg_ev']['daily'])) return;
    $today = date('Y-m-d'); $m = rd('dailyrep', array());
    if (isset($m['d']) && $m['d'] === $today) return;
    wr('dailyrep', array('d' => $today));                 // avval belgi: parallel so'rovlar ikki marta yubormasin
    $y = date('Y-m-d', strtotime('-1 day'));
    $x = rd('daily/' . $y, array('d' => array(), 'n' => array(), 'm' => array(), 'mn' => array()));
    $cnt = function ($a) { return is_array($a) ? count($a) : 0; };
    $users = 0; $newu = 0; $top = array(); $wk = week_id();
    foreach (glob(XC_DIR . '/users/*.php') as $f) {
        $u = rd('users/' . basename($f, '.php'), null); if (!$u) continue;
        $users++; if (!empty($u['created']) && date('Y-m-d', $u['created']) === $y) $newu++;
        if (isset($u['wkkid']) && $u['wkkid'] === $wk && !empty($u['wkk'])) $top[] = array($u['name'], (int)$u['wkk']);
    }
    usort($top, function ($a, $b) { return $b[1] - $a[1]; });
    $t = "X CLIENT - kecha ($y)\n"
        . "O'yinchilar: " . $cnt($x['d']) . " (yangi o'rnatish: " . $cnt($x['n']) . ")\n"
        . "NextClient menyu: " . $cnt($x['m']) . "\n"
        . "Akkauntlar: $users (kecha +$newu)\n"
        . "Klanlar: " . count((array)glob(XC_DIR . '/clans/*.php'));
    if ($top) { $t .= "\nHafta qotillari:"; foreach (array_slice($top, 0, 3) as $i => $r) $t .= "\n" . ($i + 1) . ". " . $r[0] . " - " . $r[1] . " kill"; }
    tg_notify('daily', $t);
}
function clean_str($s, $n) {
    $s = (string)preg_replace('/[\x00-\x1f<>"\\\\]/u', '', (string)$s);   // noto'g'ri UTF-8 bo'lsa preg_replace null qaytaradi - bo'sh satr
    return function_exists('mb_strcut') ? mb_strcut($s, 0, $n, 'UTF-8') : substr($s, 0, $n);   // harfni o'rtasidan kesmaydi
}

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
/* menyu qaysi versiyani ochsin: beta testerlarga - beta, boshqalarga - barqaror (ver.txt). Tez javob: boshqa ishlarsiz */
if ($a === 'menuver') {
    header('Content-Type: text/plain'); header('Cache-Control: no-store');
    $c = xc_cfg(); $st = trim((string)@file_get_contents(__DIR__ . '/ver.txt'));
    $b = isset($c['menu_beta']) ? preg_replace('/[^0-9]/', '', $c['menu_beta']) : '';
    echo ($b !== '' && is_file(__DIR__ . '/rel/' . $b . '/index.html') && is_beta_tester()) ? $b : $st;
    exit;
}
/* launcher: F10 bosilganda video sifatini so'raydi (o'yin paytida menyuda o'zgartirilgan bo'lishi mumkin). Maxfiy emas - kalitsiz */
/* ---- F10 videolari (Demo bo'limi). Ro'yxat kompyuter yozuvida ('vids'); menyu buyruqlari ('vc') launcherga navbat orqali ----
 * vadd  - launcher: yangi video saqlandi (n, mb, sec)
 * vpoll - launcher: o'yin paytida har 4 soniyada - menyu yuborgan buyruqlarni oladi ("open|del|folder nom" qatorlari) */
function vid_name($n) { return is_string($n) && preg_match('/^xc_\d{8}_\d{6}$/', $n) ? $n : ''; }
if ($a === 'vadd' || $a === 'vpoll') {
    header('Content-Type: text/plain'); header('Cache-Control: no-store');
    $d = strtolower(p('d'));
    if (!preg_match('/^[a-z0-9]{8,40}$/', $d) || !is_file(XC_DIR . '/dev/' . $d . '.php')) exit;
    if ($a === 'vpoll') {
        $o = rd('dev/' . $d, array());
        if (empty($o['vc'])) exit;                           // ko'p hollarda - faqat o'qish, yozuvsiz
        lock(); $o = rd('dev/' . $d, array()); $c = isset($o['vc']) ? $o['vc'] : array(); unset($o['vc']); wr('dev/' . $d, $o); unlock();
        foreach ($c as $x) echo $x, "\n";
        exit;
    }
    $n = vid_name(p('n'));
    if ($n === '' || rl_count('vadd' . $d, 3600) >= 120) exit;
    rl_add('vadd' . $d, 3600);
    lock();
    $o = rd('dev/' . $d, array());
    $v = isset($o['vids']) && is_array($o['vids']) ? $o['vids'] : array();
    $v = array_values(array_filter($v, function ($x) use ($n) { return isset($x['n']) && $x['n'] !== $n; }));
    array_unshift($v, array('n' => $n, 'mb' => max(0, min(100000, (int)p('mb'))), 'sec' => max(0, min(86400, (int)p('sec'))), 'q' => preg_replace('/[^a-z]/', '', substr(p('q'), 0, 4))));
    $o['vids'] = array_slice($v, 0, 200);
    wr('dev/' . $d, $o);
    echo 'ok';
    exit;
}
if ($a === 'vq') {
    header('Content-Type: text/plain'); header('Cache-Control: no-store');
    $d = strtolower(p('d'));
    $o = preg_match('/^[a-z0-9]{8,40}$/', $d) ? rd('dev/' . $d, array()) : array();
    // "sifat mikrofon bufer": eski launcher faqat birinchi so'zni o'qiydi
    // "sifat mikrofon bufer radar": bufer 2 - o'yinchi tanlamagan (launcher o'zi hal qiladi; eski launcher 2 ni "yoqiq" deb o'qiydi)
    echo (isset($o['vq']) && in_array($o['vq'], array('hi', 'mid', 'low'), true) ? $o['vq'] : 'mid'), ' ', empty($o['mic']) ? 0 : 1, ' ',
        empty($o['rbx']) ? 2 : (isset($o['rb']) && !$o['rb'] ? 0 : 1), ' ', isset($o['rsk']) ? (int)$o['rsk'] : 1;
    exit;
}
/* ---- klip ulashish: menyu 'share' buyrug'i chipta (tk) yaratadi, launcher videoni bo'laklab yuklaydi ----
 * clipup   - launcher: ?a=clipup&tk=..&off=N, tana - xom baytlar (2 MB gacha). Javob: "ok N" (fayl hajmi) yoki "off N" (shu joydan davom eting)
 * clipdone - launcher: hammasi yuklandi -> clips/<id>.mp4, ro'yxatga, Telegram kanalga */
define('CLIP_MAX', 60 * 1024 * 1024);
define('CLIP_DIR', __DIR__ . '/clips');
function clip_dir_ok() {
    if (!is_dir(CLIP_DIR)) @mkdir(CLIP_DIR, 0755, true);
    if (!is_file(CLIP_DIR . '/.htaccess')) @file_put_contents(CLIP_DIR . '/.htaccess', "Options -Indexes\n<FilesMatch \"\\.(php\\d?|phtml|phar|html?|svg|js)$\">\nRequire all denied\n</FilesMatch>\n");
    if (!is_file(CLIP_DIR . '/index.html')) @file_put_contents(CLIP_DIR . '/index.html', '');
    return is_writable(CLIP_DIR);
}
function clip_ticket($tk) { $s = rd('shares', array()); return preg_match('/^[a-f0-9]{32}$/', $tk) && isset($s[$tk]) && time() - $s[$tk]['t'] < 7200 ? $s[$tk] : null; }
function clip_mark($d, $n, $v) {                         // kompyuter video ro'yxatida: 'sh' - 'q' (navbatda), '45' (%), yoki klip id
    $o = rd('dev/' . $d, array());
    if (empty($o['vids'])) return;
    foreach ($o['vids'] as &$x) if (isset($x['n']) && $x['n'] === $n) { $x['sh'] = $v; $x['sht'] = time(); }
    unset($x); wr('dev/' . $d, $o);
}
function clip_url($id) { return 'https://mmb.boost-top.com/clips.php?v=' . $id; }
function tg_clip($c) {
    $cf = xc_cfg(); if (empty($cf['tg_token']) || empty($cf['tg_clips'])) return;
    $cap = "\xF0\x9F\x8E\xAC " . $c['name'] . ($c['srv'] !== '' ? " \xC2\xB7 " . $c['srv'] : '') . "\n" . clip_url($c['id']) . "\n#xclient";
    $f = CLIP_DIR . '/' . $c['id'] . '.mp4';
    if (function_exists('curl_init') && class_exists('CURLFile') && filesize($f) < 48 * 1024 * 1024) {
        $ch = curl_init('https://api.telegram.org/bot' . $cf['tg_token'] . '/sendVideo');
        curl_setopt_array($ch, array(CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120,
            CURLOPT_POSTFIELDS => array('chat_id' => $cf['tg_clips'], 'caption' => $cap, 'supports_streaming' => 'true', 'video' => new CURLFile($f, 'video/mp4', $c['id'] . '.mp4'))));
        $r = json_decode((string)curl_exec($ch), true); curl_close($ch);
        if (!empty($r['ok'])) return;
    }
    tg_send($cf['tg_clips'], $cap);                       // katta fayl yoki curl yo'q - havola bilan
}
/* "Mening videolarim" dagi jonli ko'rinish: launcher 8 kadrli JPEG yuboradi (vthumb), menyu o'z kaliti bilan oladi (vth) */
if ($a === 'vthumb' || $a === 'vth') {
    $d = strtolower(p('d')); $n = vid_name(p('n'));
    if (!preg_match('/^[a-z0-9]{8,40}$/', $d) || $n === '' || !is_file(XC_DIR . '/dev/' . $d . '.php')) { header('HTTP/1.1 404 Not Found'); exit; }
    @mkdir(XC_DIR . '/vth', 0755, true);
    $f = XC_DIR . '/vth/' . $d . '_' . $n . '.jpg';
    if ($a === 'vthumb') {
        header('Content-Type: text/plain');
        if (rl_count('vth' . $d, 3600) >= 300) { echo 'limit'; exit; }
        rl_add('vth' . $d, 3600);
        $data = file_get_contents('php://input', false, null, 0, 300001);
        if ($data === false || strlen($data) < 200 || strlen($data) > 300000 || substr($data, 0, 2) !== "\xFF\xD8") { echo 'bad'; exit; }
        file_put_contents($f, $data, LOCK_EX);
        cap_dir_any(XC_DIR . '/vth', '*.jpg', 20000);
        echo 'ok'; exit;
    }
    $o = rd('dev/' . $d, array());
    if (!dev_ok($d, $o) || !is_file($f)) { header('HTTP/1.1 404 Not Found'); exit; }
    header('Content-Type: image/jpeg'); header('Cache-Control: private, max-age=604800');
    readfile($f); exit;
}
if ($a === 'clipfail' || $a === 'clipstat') {                // launcher: yuklab bo'lmadi (x / l - juda uzun) yoki kichraytirilmoqda (c)
    header('Content-Type: text/plain'); header('Cache-Control: no-store');
    $tk = strtolower(p('tk')); $t = clip_ticket($tk);
    if ($t && $a === 'clipstat') { lock(); clip_mark($t['d'], $t['n'], p('s') === 'c' ? 'c' : 'q'); unlock(); }
    elseif ($t) { lock(); $s = rd('shares', array()); unset($s[$tk]); wr('shares', $s); clip_mark($t['d'], $t['n'], p('r') === 'l' ? 'l' : 'x'); unlock(); @unlink(XC_DIR . '/up/' . $tk . '.part'); }
    echo 'ok'; exit;
}
if ($a === 'clipup' || $a === 'clipdone') {
    header('Content-Type: text/plain'); header('Cache-Control: no-store');
    $tk = strtolower(p('tk'));
    $t = clip_ticket($tk);
    if (!$t) { echo 'gone'; exit; }
    @mkdir(XC_DIR . '/up', 0755, true);
    $part = XC_DIR . '/up/' . $tk . '.part';
    $have = is_file($part) ? filesize($part) : 0;
    if ($a === 'clipup') {
        $off = (int)p('off');
        $data = file_get_contents('php://input', false, null, 0, 2 * 1024 * 1024 + 1);
        $cl = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : -1;
        if ($data === false || $data === '' || strlen($data) > 2 * 1024 * 1024 || ($cl >= 0 && $cl !== strlen($data))) { echo 'bad'; exit; }   // uzilib kelgan bo'lak - yozmaymiz
        /* bitta bo'lak ikki marta kelsa (launcher qayta yubordi) - faqat bittasi yozilsin: tekshirish va yozish bitta qulf ostida */
        $fh = fopen($part, 'c+'); if (!$fh) { echo 'disk'; exit; }
        flock($fh, LOCK_EX); clearstatcache(); $have = filesize($part);
        if ($off !== $have) { flock($fh, LOCK_UN); fclose($fh); echo 'off ', $have; exit; }
        if ($have + strlen($data) > CLIP_MAX) { flock($fh, LOCK_UN); fclose($fh); echo 'big'; exit; }
        fseek($fh, 0, SEEK_END); $wok = fwrite($fh, $data) === strlen($data); fflush($fh);
        flock($fh, LOCK_UN); fclose($fh);
        if (!$wok) { echo 'disk'; exit; }
        clearstatcache(); $have = filesize($part);
        $tot = max(1, (int)p('tot'));
        lock(); clip_mark($t['d'], $t['n'], (string)min(99, (int)($have * 100 / $tot))); unlock();
        echo 'ok ', $have; exit;
    }
    $hd = $have > 4096 ? file_get_contents($part, false, null, 4, 4) : '';
    if ($hd !== 'ftyp' || !clip_dir_ok()) { @unlink($part); lock(); $s = rd('shares', array()); unset($s[$tk]); wr('shares', $s); clip_mark($t['d'], $t['n'], 'x'); unlock(); echo 'bad'; exit; }
    $id = substr($tk, 0, 12);
    if (!@rename($part, CLIP_DIR . '/' . $id . '.mp4')) { echo 'disk'; exit; }
    $dv = rd('dev/' . $t['d'], array()); $u = user($t['login']); $sec = 0;
    foreach ((array)(isset($dv['vids']) ? $dv['vids'] : array()) as $x) if (isset($x['n']) && $x['n'] === $t['n']) $sec = (int)$x['sec'];
    $c = array('id' => $id, 'login' => $t['login'], 'name' => $u ? $u['name'] : $t['login'], 't' => time(), 'mb' => round($have / 1048576, 1), 'sec' => $sec, 'srv' => clean_str($t['srv'], 64));
    lock();
    $s = rd('shares', array()); unset($s[$tk]); wr('shares', $s);
    $l = rd('clips', array()); array_unshift($l, $c);
    foreach (array_slice($l, 300) as $old) @unlink(CLIP_DIR . '/' . $old['id'] . '.mp4');   // eng eskilari o'chadi (disk to'lmasin)
    wr('clips', array_slice($l, 0, 300));
    clip_mark($t['d'], $t['n'], $id);
    unlock();
    /* launcherga javobni darhol beramiz - Telegram'ga yuborish (2 daqiqagacha) kutdirmasin, aks holda launcher "yuklanmadi" deb o'ylaydi */
    ignore_user_abort(true);
    $ans = 'ok ' . $id;
    header('Connection: close'); header('Content-Length: ' . strlen($ans));
    echo $ans;
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request(); else { while (ob_get_level() > 0) @ob_end_flush(); flush(); }
    @set_time_limit(180);
    tg_clip($c);
    exit;
}
daily_report();
tg_bot_poll();

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
    if (!preg_match('/^[a-z0-9]{8,40}$/', p('device'))) fail('bad', 'bad');
    if (rl_count('bt' . client_ip(), 3600) >= 120) out(array('ok' => true));   // sun'iy "yangi o'yinchi" va disk to'ldirishga qarshi
    rl_add('bt' . client_ip(), 3600);
    /* O'yin brauzeri localStorage ni saqlamaydi - menyuning tasodifiy device id si har ochilishda yangi bo'lib,
     * bitta kompyuter o'nlab "yangi o'yinchi" bo'lib sanalardi. Shuning uchun id serverda: nik + ekran + IP tarmog'i */
    $ipn = implode('.', array_slice(explode('.', client_ip()), 0, 2));
    $dev = 'f' . substr(md5(strtolower(trim(p('nick'))) . '|' . p('res') . '|' . $ipn), 0, 15);
    geo_cc(client_ip());                                   // davlat - qulfdan oldin (yangi IP bo'lsa tarmoqqa chiqadi, boshqalar kutmasin)
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
    $pre = (int)p('preset');                              // o'yin ichida fayl oynasi ochilmaydi - tayyor rasmlardan biri (av/p1..p12.png)
    if ($pre >= 1 && $pre <= 12 && is_file(__DIR__ . '/av/p' . $pre . '.png')) {
        @mkdir(XC_DIR . '/av', 0755, true);
        wr('av/' . strtolower($u['login']), array('type' => 'png', 'data' => base64_encode(file_get_contents(__DIR__ . '/av/p' . $pre . '.png'))));
        $u['avt'] = time(); $img = '';
    }
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
        $u['last'] = array('s' => $srv, 'm' => $u['map'], 't' => $now);   // oxirgi o'ynagan serveri (do'stlar profilida)
    } else { $u['server'] = ''; $u['map'] = ''; }
    $u['seen'] = $now;
    $inv = array();                                      // do'stlardan kelgan takliflar (bir marta beriladi)
    if (!empty($u['inv'])) { foreach ((array)$u['inv'] as $i) if (is_array($i) && isset($i['t']) && $now - $i['t'] < 600) $inv[] = $i; $u['inv'] = array(); }
    $msgs = !empty($u['msgs']) ? $u['msgs'] : array(); $u['msgs'] = array();   // admin yuborgan shaxsiy xabarlar (bir marta)
    save_user($u);
    out(array('ok' => true, 'xp' => (int)$u['xp'], 'level' => level($u['xp']), 'lvlxp' => (int)$u['xp'] % XP_PER_LEVEL, 'inv' => $inv, 'msgs' => $msgs));

case 'missions':                                         // bugungi vazifalar va qaysilari olingan
    $u = auth();
    $list = missions_today(); $day = date('Y-m-d');
    $prog = array(); foreach ($list as $x) $prog[$x['id']] = mis_prog($u, $day, $x['id']);
    out(array('ok' => true, 'day' => $day, 'list' => $list, 'prog' => $prog, 'done' => isset($u['mis'][$day]) ? array_keys($u['mis'][$day]) : array()));

case 'mission_claim':                                    // vazifa mukofoti (kuniga bir marta)
    lock();
    $u = auth();
    $list = missions_today(); $day = date('Y-m-d'); $id = p('id'); $m = null;
    foreach ($list as $x) if ($x['id'] === $id) $m = $x;
    if (!$m) fail('bad', 'Vazifa topilmadi');
    if (!isset($u['mis']) || !is_array($u['mis'])) $u['mis'] = array();
    foreach (array_keys($u['mis']) as $d) if ($d !== $day) unset($u['mis'][$d]);
    if (!empty($u['mis'][$day][$id])) fail('done', 'Allaqachon olingan');
    /* bajarilganini saytning o'zi tekshiradi (bugungi o'yin statistikasi - stat orqali yig'ilgan) */
    $okm = mis_prog($u, $day, $id) + ($id === 'min' || $id === 'xsrv' ? 2 : 0) >= $m['goal'];   // daqiqalarda 2 daq. zaxira (oxirgi xabar kechikishi)
    if (!$okm) fail('notyet', 'Vazifa hali bajarilmagan');
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
        if ($f) { $x = pub($f, false); $x['unread'] = isset($u['unread'][strtolower($fl)]) ? (int)$u['unread'][strtolower($fl)] : 0; $list[] = $x; }
    }
    usort($list, function ($a, $b) { return ($b['online'] ? 1 : 0) - ($a['online'] ? 1 : 0); });
    $req = array();                                      // menga kelgan do'stlik so'rovlari
    foreach ((isset($u['freq']) ? $u['freq'] : array()) as $fl => $t) { $f = user($fl); if ($f) $req[] = pub($f, false); }
    out(array('ok' => true, 'friends' => $list, 'req' => $req, 'sent' => array_keys(isset($u['fsent']) ? $u['fsent'] : array())));

/* o'yinchi qidirish: login yoki ism bo'yicha (kamida 2 harf), ostida variantlar chiqadi */
case 'user_search':
    $u = auth();
    $q = strtolower(p('q'));
    if (strlen($q) < 2 || strlen($q) > 20) out(array('ok' => true, 'list' => array()));
    if (rl_count('us' . $u['login'], 60) >= 90) out(array('ok' => true, 'list' => array()));
    rl_add('us' . $u['login'], 60);
    $me = strtolower($u['login']); $fr = array_map('strtolower', isset($u['friends']) ? $u['friends'] : array());
    $hit = array();
    foreach (glob(XC_DIR . '/users/*.php') as $f) {
        $l = basename($f, '.php');
        if ($l === $me) continue;
        $x = null;
        if (strpos($l, $q) !== false) $x = user($l);
        if (!$x) continue;
        $hit[] = array('x' => $x, 's' => strpos($l, $q) === 0 ? 0 : 1);
        if (count($hit) >= 40) break;
    }
    usort($hit, function ($a, $b) { return $a['s'] - $b['s'] ?: strcmp($a['x']['login'], $b['x']['login']); });
    $list = array();
    foreach (array_slice($hit, 0, 8) as $h) {
        $l = strtolower($h['x']['login']); $r = pub($h['x'], false); unset($r['server'], $r['map']);
        $r['st'] = in_array($l, $fr) ? 'friend' : (isset($u['fsent'][$l]) ? 'sent' : (isset($u['freq'][$l]) ? 'req' : ''));
        $list[] = $r;
    }
    out(array('ok' => true, 'list' => $list));

/* do'stlik: so'rov yuboriladi, u tomonda "qabul qilish / rad etish" chiqadi */
case 'friend_add':
case 'friend_accept':
case 'friend_decline':
case 'friend_del':
    lock();
    $u = auth();
    $fl = strtolower(p('login')); $me = strtolower($u['login']);
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $fl)) fail('bad', 'Login noto\'g\'ri');
    if ($fl === $me) fail('self', 'O\'zingizni qo\'sha olmaysiz');
    $t = user($fl);
    if (!$t) fail('nouser', 'Bunday o\'yinchi yo\'q');
    foreach (array('friends', 'freq', 'fsent') as $k) { if (!isset($u[$k]) || !is_array($u[$k])) $u[$k] = array(); if (!isset($t[$k]) || !is_array($t[$k])) $t[$k] = array(); }
    $u['friends'] = array_map('strtolower', $u['friends']); $t['friends'] = array_map('strtolower', $t['friends']);
    $st = '';
    if ($a === 'friend_add' || $a === 'friend_accept') {
        if (in_array($fl, $u['friends']) && in_array($me, $t['friends'])) $st = 'friend';
        elseif (isset($u['freq'][$fl]) || in_array($me, $t['friends'])) {             // u menga so'rov yuborgan (yoki eski usulda qo'shgan) - qabul
            if (!in_array($fl, $u['friends'])) $u['friends'][] = $fl;
            if (!in_array($me, $t['friends'])) $t['friends'][] = $me;
            unset($u['freq'][$fl], $t['fsent'][$me], $u['fsent'][$fl], $t['freq'][$me]);
            $st = 'friend';
        } elseif ($a === 'friend_add') {
            if (count($u['fsent']) >= 50) fail('many', 'Juda ko\'p so\'rov yuborilgan');
            if (count($t['freq']) >= 100) fail('many', 'Bu o\'yinchiga juda ko\'p so\'rov kelgan');
            $u['fsent'][$fl] = time(); $t['freq'][$me] = time();
            $st = 'sent';
        } else fail('noreq', 'So\'rov topilmadi');
        if (count($u['friends']) > 200) fail('many', 'Do\'stlar ko\'p');
    } elseif ($a === 'friend_decline') {
        unset($u['freq'][$fl], $t['fsent'][$me]);
    } else {
        $u['friends'] = array_values(array_diff($u['friends'], array($fl))); $t['friends'] = array_values(array_diff($t['friends'], array($me)));
        unset($u['fsent'][$fl], $t['freq'][$me]);
    }
    save_user($u); save_user($t);
    out(array('ok' => true, 'st' => $st, 'friends' => $u['friends']));

/* do'stlar bilan yozishma: xc_data/chat/<a>__<b> (oxirgi 100 ta xabar) */
case 'msg_send':
case 'msg_list':
    if ($a === 'msg_send') lock();
    $u = auth();
    $fl = strtolower(p('login')); $me = strtolower($u['login']);
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $fl) || $fl === $me) fail('bad', 'Login noto\'g\'ri');
    $pair = array($me, $fl); sort($pair); $ck = 'chat/' . $pair[0] . '__' . $pair[1];
    if ($a === 'msg_send') {
        if (!in_array($fl, array_map('strtolower', isset($u['friends']) ? $u['friends'] : array()))) fail('bad', 'Faqat do\'stlarga yozish mumkin');
        $txt = trim(preg_replace('/[\x00-\x1f]+/u', ' ', p('text')));
        if ($txt === '') fail('empty', 'Xabar bo\'sh');
        if (function_exists('mb_substr')) $txt = mb_substr($txt, 0, 300, 'UTF-8'); else $txt = substr($txt, 0, 300);
        if (rl_count('ms' . $me, 60) >= 20) fail('limit', 'Juda tez yozyapsiz, biroz kuting');
        rl_add('ms' . $me, 60);
        @mkdir(XC_DIR . '/chat', 0755, true);
        $c = rd($ck, array());
        $c[] = array('f' => $me, 'm' => $txt, 't' => time());
        wr($ck, array_slice($c, -100));
        $t = user($fl);
        if ($t) { if (!isset($t['unread']) || !is_array($t['unread'])) $t['unread'] = array(); $t['unread'][$me] = (isset($t['unread'][$me]) ? (int)$t['unread'][$me] : 0) + 1; save_user($t); }
        out(array('ok' => true));
    }
    $c = rd($ck, array());
    if (!empty($u['unread'][$fl])) { lock(); $u = user($me); unset($u['unread'][$fl]); save_user($u); }
    out(array('ok' => true, 'list' => array_slice($c, -60)));

/* tez-tez (15 soniyada) so'raladigan engil bildirishnoma: yangi xabarlar va do'stlik so'rovlari */
/* ---------- klanlar: 10 kishigacha jamoa, teg [TAG], taklif kodi bilan qo'shilish, haftalik klan reytingi (a'zolar killari) ---------- */
case 'clan_create':
case 'clan_join':
case 'clan_leave':
case 'clan_kick':
case 'clan_info':
case 'clan_top':
    @mkdir(XC_DIR . '/clans', 0755, true);
    if ($a === 'clan_top') {
        $cache = rd('clantop', null);
        if ($cache && time() - $cache['t'] < 300) out(array('ok' => true, 'top' => $cache['top']));
        $top = array(); $wk = week_id();
        foreach (glob(XC_DIR . '/clans/*.php') as $f) {
            $c = rd('clans/' . basename($f, '.php'), null); if (!$c) continue;
            $k = 0; foreach ($c['members'] as $ml) { $m = user($ml); if ($m && isset($m['wkkid']) && $m['wkkid'] === $wk) $k += (int)$m['wkk']; }
            $top[] = array('name' => $c['name'], 'tag' => $c['tag'], 'n' => count($c['members']), 'k' => $k);
        }
        usort($top, function ($x, $y) { return $y['k'] - $x['k']; });
        $top = array_slice($top, 0, 10); wr('clantop', array('t' => time(), 'top' => $top));
        out(array('ok' => true, 'top' => $top));
    }
    lock();
    $u = auth(); $me = strtolower($u['login']);
    $cid = !empty($u['clan']['id']) ? $u['clan']['id'] : '';
    $c = $cid ? rd('clans/' . $cid, null) : null;
    if ($a === 'clan_create') {
        if ($c) fail('bad', 'Siz allaqachon klandasiz');
        $name = clean_str(p('name'), 24); $tag = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', p('tag')));
        if (mb_strlen($name, 'UTF-8') < 3) fail('bad', 'Klan nomi kamida 3 harf');
        if (strlen($tag) < 2 || strlen($tag) > 5) fail('bad', 'Teg 2-5 ta lotin harf yoki raqam');
        foreach (glob(XC_DIR . '/clans/*.php') as $f) { $x = rd('clans/' . basename($f, '.php'), null); if ($x && $x['tag'] === $tag) fail('bad', 'Bu teg band'); }
        $cid = strtolower($tag);
        $c = array('id' => $cid, 'name' => $name, 'tag' => $tag, 'owner' => $me, 'members' => array($me), 'code' => strtoupper(substr(bin2hex(function_exists('random_bytes') ? random_bytes(4) : openssl_random_pseudo_bytes(4)), 0, 6)), 't' => time());
        wr('clans/' . $cid, $c);
        $u['clan'] = array('id' => $cid, 'tag' => $tag, 'name' => $name); ach_check($u); save_user($u);
    } elseif ($a === 'clan_join') {
        if ($c) fail('bad', 'Avval hozirgi klandan chiqing');
        if (rl_count('cj' . strtolower($u['login']), 3600) >= 15) fail('limit', 'Juda ko\'p urinish, keyinroq');   // taklif kodini terib topmasin
        rl_add('cj' . strtolower($u['login']), 3600);
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', p('code'))); $found = null;
        foreach (glob(XC_DIR . '/clans/*.php') as $f) { $x = rd('clans/' . basename($f, '.php'), null); if ($x && $code !== '' && hash_equals($x['code'], $code)) $found = $x; }
        if (!$found) fail('bad', 'Taklif kodi noto\'g\'ri');
        if (count($found['members']) >= 10) fail('bad', 'Klan to\'la (10 kishi)');
        $found['members'][] = $me; wr('clans/' . $found['id'], $found); $c = $found;
        $u['clan'] = array('id' => $c['id'], 'tag' => $c['tag'], 'name' => $c['name']); ach_check($u); save_user($u);
    } elseif ($a === 'clan_leave') {
        if (!$c) fail('bad', 'Siz klanda emassiz');
        $c['members'] = array_values(array_diff($c['members'], array($me)));
        if (!$c['members']) @unlink(XC_DIR . '/clans/' . $c['id'] . '.php');
        else { if ($c['owner'] === $me) $c['owner'] = $c['members'][0]; wr('clans/' . $c['id'], $c); }
        unset($u['clan']); save_user($u);
        out(array('ok' => true, 'clan' => null));
    } elseif ($a === 'clan_kick') {
        if (!$c || $c['owner'] !== $me) fail('bad', 'Faqat klan boshlig\'i chiqara oladi');
        $who = strtolower(p('who'));
        if ($who === $me || !in_array($who, $c['members'])) fail('bad', 'Topilmadi');
        $c['members'] = array_values(array_diff($c['members'], array($who))); wr('clans/' . $c['id'], $c);
        $w = user($who); if ($w) { unset($w['clan']); save_user($w); }
    }
    if (!$c) out(array('ok' => true, 'clan' => null));
    $wk = week_id(); $mem = array(); $k = 0;
    foreach ($c['members'] as $ml) { $m = user($ml); if (!$m) continue; $x = pub($m, false); $x['wk'] = $x['st']['wk']; $k += $x['wk']; $mem[] = $x; }
    usort($mem, function ($x, $y) { return $y['wk'] - $x['wk']; });
    out(array('ok' => true, 'clan' => array('id' => $c['id'], 'name' => $c['name'], 'tag' => $c['tag'], 'owner' => $c['owner'], 'boss' => $c['owner'] === $me,
        'code' => $c['code'], 'members' => $mem, 'wk' => $k)));

/* ---------- taklif kodi: kodi = taklif qilganning logini. Yangi akkaunt 7 kun ichida kiritadi.
 * Taklif qilgan: +300 XP (3 ta taklifda "Taklifchi" yutug'i), yangi o'yinchi: +100 XP. Bir IP dan kuniga 3 tadan ortiq emas */
case 'ref_set':
    lock();
    $u = auth();
    if (!empty($u['refby'])) fail('bad', 'Taklif kodi allaqachon kiritilgan');
    if (time() - (int)$u['created'] > 7 * 86400) fail('bad', 'Taklif kodi faqat ro\'yxatdan o\'tgandan keyin 7 kun ichida kiritiladi');
    $code = strtolower(preg_replace('/[^A-Za-z0-9_]/', '', p('code')));
    if ($code === strtolower($u['login'])) fail('bad', 'O\'zingizni taklif qila olmaysiz');
    $inv = user($code);
    if (!$inv) fail('bad', 'Bunday taklif kodi yo\'q');
    if (rl_count('ref' . client_ip(), 86400) >= 3) fail('limit', 'Bugun bu tarmoqdan juda ko\'p taklif kiritildi');
    if (!empty($inv['devices']) && !empty($u['devices']) && array_intersect(array_keys($inv['devices']), array_keys($u['devices']))) fail('bad', 'Bitta kompyuterdan o\'zingizni taklif qilib bo\'lmaydi');
    rl_add('ref' . client_ip(), 86400);
    $u['refby'] = strtolower($inv['login']); $u['xp'] = (int)$u['xp'] + 100;
    if (!isset($inv['refs'])) $inv['refs'] = array();
    $inv['refs'][strtolower($u['login'])] = time(); $inv['xp'] = (int)$inv['xp'] + 300;
    if (!isset($inv['msgs'])) $inv['msgs'] = array();
    $inv['msgs'][] = array('t' => time(), 'text' => $u['name'] . " sizning taklif kodingiz bilan qo'shildi: +300 XP");
    ach_check($inv); save_user($inv); save_user($u);
    out(array('ok' => true, 'me' => pub($u, true)));

/* ---------- CFG kodi: sozlama + tugmalar 6 belgili kod bilan ulashiladi (xc_data/cfgs) ---------- */
case 'cfg_share':
    $raw = p('cfg');
    if (strlen($raw) < 10 || strlen($raw) > 30000) fail('bad', 'CFG noto\'g\'ri');
    $c = json_decode($raw, true);
    if (!is_array($c) || !isset($c['s']) || !is_array($c['s'])) fail('bad', 'CFG noto\'g\'ri');
    if (rl_count('cfg' . client_ip(), 3600) >= 20) fail('limit', 'Juda ko\'p. Keyinroq urinib ko\'ring');
    rl_add('cfg' . client_ip(), 3600);
    @mkdir(XC_DIR . '/cfgs', 0755, true);
    $abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do { $code = ''; for ($i = 0; $i < 6; $i++) $code .= $abc[mt_rand(0, strlen($abc) - 1)]; } while (is_file(XC_DIR . '/cfgs/' . $code . '.php'));
    unset($c['s']['name'], $c['s']['tag']);
    $title = trim(clean_str(p('title'), 40)); $who = '';
    $tok = p('token'); if (preg_match('/^[a-f0-9]{40}$/', $tok)) { $tks = rd('tokens', array()); if (!empty($tks[$tok])) $who = $tks[$tok]; }
    wr('cfgs/' . $code, array('t' => time(), 'c' => $c, 'title' => $title, 'who' => $who, 'lk' => array(), 'uses' => 0));
    cap_dir(XC_DIR . '/cfgs', 5000);
    if ($title !== '' && p('pub') === '1') {               // "Mashhur CFGlar" ro'yxatiga
        lock(); $ix = rd('cfgpub', array());
        $ix[$code] = array('code' => $code, 'title' => $title, 'who' => $who, 't' => time(), 'likes' => 0, 'uses' => 0);
        if (count($ix) > 300) { uasort($ix, function ($a, $b) { return ($b['likes'] * 5 + $b['uses']) - ($a['likes'] * 5 + $a['uses']); }); $ix = array_slice($ix, 0, 300, true); }
        wr('cfgpub', $ix);
    }
    out(array('ok' => true, 'code' => $code));

case 'feat':                                             // menyu: qaysi funksiyalar yoqilgan
    $f = array(); foreach (feat_list() as $k => $n) $f[$k] = feat_on($k) ? 1 : 0;
    out(array('ok' => true, 'f' => $f, 'beta' => is_beta_tester() ? 1 : 0));

/* ---------- menyu tezligi (admin panel > Tezlik): har sessiyada bir marta ---------- */
case 'perf':
    if (rl_count('pf' . client_ip(), 3600) >= 6) out(array('ok' => true));
    rl_add('pf' . client_ip(), 3600);
    $v = preg_replace('/[^0-9]/', '', p('v')); if ($v === '' || strlen($v) > 12) out(array('ok' => true));
    if (!is_file(XC_DIR . '/perf/' . $v . '.php')) cap_dir(XC_DIR . '/perf', 300);
    $load = max(0, min(60000, (int)p('load'))); $lag = max(0, min(60000, (int)p('lag'))); $fps = max(0, min(1000, (int)p('fps')));
    @mkdir(XC_DIR . '/perf', 0755, true); lock();
    $x = rd('perf/' . $v, array('n' => 0, 'load' => 0, 'lag' => 0, 'bad' => 0, 'game' => 0, 'fps' => 0, 'fpsn' => 0, 'low' => 0, 't0' => time()));
    $x['n']++; $x['load'] += $load; $x['lag'] += $lag; if ($lag > 500) $x['bad']++; if (p('game') === '1') $x['game']++; if (p('low') === '1') $x['low']++;
    if ($fps > 0) { $x['fps'] += $fps; $x['fpsn']++; }
    $x['t1'] = time(); wr('perf/' . $v, $x);
    out(array('ok' => true));

case 'music':                                            // menyu musiqalari ro'yxati (admin panel > Sozlamalar)
    $c = xc_cfg(); $l = array();
    foreach (preg_split('/\r?\n/', isset($c['music']) ? $c['music'] : '') as $ln) { $x = array_map('trim', explode('|', $ln)); if (count($x) === 2 && $x[0] !== '' && preg_match('/^[\w\/.\-]+\.mp3$/', $x[1])) $l[] = array($x[0], $x[1]); }
    out(array('ok' => true, 'list' => $l));
case 'cfg_top':
    $ix = array_values(rd('cfgpub', array()));
    usort($ix, function ($a, $b) { return ($b['likes'] * 5 + $b['uses']) - ($a['likes'] * 5 + $a['uses']); });
    out(array('ok' => true, 'list' => array_slice($ix, 0, 50)));
case 'cfg_like':
    lock();
    $u = auth();
    $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', p('code')));
    $x = rd('cfgs/' . $code, null); if (!$x) fail('bad', 'Kod topilmadi');
    $me = strtolower($u['login']);
    if (!isset($x['lk'])) $x['lk'] = array();
    if (isset($x['lk'][$me])) fail('done', 'Allaqachon yoqtirgansiz');
    $x['lk'][$me] = 1; wr('cfgs/' . $code, $x);
    $ix = rd('cfgpub', array()); if (isset($ix[$code])) { $ix[$code]['likes'] = count($x['lk']); wr('cfgpub', $ix); }
    out(array('ok' => true, 'likes' => count($x['lk'])));

case 'cfg_get':
    $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', p('code')));
    if (strlen($code) !== 6) fail('bad', 'Kod 6 belgidan iborat');
    $x = rd('cfgs/' . $code, null);
    if (!$x) fail('bad', 'Kod topilmadi');
    $ix = rd('cfgpub', array());
    if (isset($ix[$code]) && rl_count('cfgu' . $code . client_ip(), 86400) < 1) { rl_add('cfgu' . $code . client_ip(), 86400); lock(); $ix = rd('cfgpub', array()); $ix[$code]['uses']++; wr('cfgpub', $ix); }
    out(array('ok' => true, 'cfg' => $x['c']));

/* ---------- Telegram bot: o'yinchi akkauntini ulaydi -> /me, /friends, /top, /online ---------- */
case 'tg_code':
    lock();
    $u = auth();
    $c = xc_cfg();
    if (empty($c['tg_bot']) || empty($c['tg_token'])) fail('off', 'Telegram bot hali yoqilmagan');
    $codes = rd('tglink', array()); foreach ($codes as $k => $v) if (time() - $v['t'] > 900) unset($codes[$k]);
    do { $code = (string)mt_rand(100000, 999999); } while (isset($codes[$code]));
    $codes[$code] = array('l' => strtolower($u['login']), 't' => time()); wr('tglink', $codes);
    out(array('ok' => true, 'code' => $code, 'bot' => isset($c['tg_botname']) ? $c['tg_botname'] : '', 'linked' => !empty($u['tgid'])));
case 'tg_unlink':
    lock(); $u = auth(); unset($u['tgid']); save_user($u); out(array('ok' => true));

/* ---------- menyu xatolari (avtomatik): bir xil xato bir yozuvga yig'iladi, admin panel > Xatolar ---------- */
case 'jserr':
    if (rl_count('je' . client_ip(), 3600) >= 20) out(array('ok' => true));
    rl_add('je' . client_ip(), 3600);
    $msg = clean_str(p('msg'), 300); if ($msg === '') out(array('ok' => true));
    $src = clean_str(p('src'), 60); $line = (int)p('line'); $k = substr(md5($msg . '|' . $src . '|' . $line), 0, 12);
    lock(); $all = rd('jserr', array()); $new = !isset($all[$k]);
    if ($new) $all[$k] = array('msg' => $msg, 'src' => $src, 'line' => $line, 'ver' => clean_str(p('ver'), 20), 'n' => 0, 'first' => time(), 'last' => 0, 'ua' => clean_str(isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '', 120));
    $all[$k]['n']++; $all[$k]['last'] = time(); $all[$k]['ver'] = clean_str(p('ver'), 20);
    if (count($all) > 200) { uasort($all, function ($a, $b) { return $b['last'] - $a['last']; }); $all = array_slice($all, 0, 200, true); }
    wr('jserr', $all);
    if ($new) tg_notify('report', "X CLIENT menyusida yangi xato: " . $msg . " (" . $src . ":" . $line . ")");
    $hv = rd('jserr_hour', array()); $hk = date('YmdH') . '-' . preg_replace('/[^0-9]/', '', p('ver'));   // shu soatda shu versiyada nechta xato
    $hv[$hk] = (isset($hv[$hk]) ? $hv[$hk] : 0) + 1; if (count($hv) > 48) $hv = array_slice($hv, -48, 48, true); wr('jserr_hour', $hv);
    if ($hv[$hk] === 15) tg_notify('report', "DIQQAT! Menyu v" . clean_str(p('ver'), 20) . " da 1 soatda 15+ xato. Admin panel > Menyu versiyalari > oldingisiga qaytaring.");
    out(array('ok' => true));

/* ---------- qaysi tugmalar bosiladi (admin panel > Tugmalar): menyu 2 daqiqada bir yig'ib yuboradi ---------- */
case 'clicks':
    if (!feat_on('clicks')) fail('off', 'Bu funksiya vaqtincha o\'chirilgan');
    if (rl_count('ck' . client_ip(), 3600) >= 40) out(array('ok' => true));
    rl_add('ck' . client_ip(), 3600);
    $c = json_decode(p('c'), true); if (!is_array($c)) out(array('ok' => true));
    @mkdir(XC_DIR . '/clicks', 0755, true); @date_default_timezone_set('Asia/Tashkent');
    lock(); $k = 'clicks/' . date('Y-m-d'); $x = rd($k, array());
    foreach (array_slice($c, 0, 60, true) as $a => $n) { $a = (string)$a; if (!preg_match('/^[a-z0-9_:\-]{1,40}$/i', $a) || (!isset($x[$a]) && count($x) >= 500)) continue; $x[$a] = (isset($x[$a]) ? $x[$a] : 0) + max(0, min(200, (int)$n)); }
    wr($k, $x);
    out(array('ok' => true));

case 'promo':                                            // admin panelda qo'yilgan reklama serverlari (muddati o'tmagan)
    $l = array(); foreach (rd('promo', array()) as $x) if (!empty($x['until']) && $x['until'] > time()) $l[] = array('ip' => $x['ip'], 'title' => $x['title']);
    out(array('ok' => true, 'list' => $l));

case 'notif':
    $u = auth();
    $un = array(); foreach ((isset($u['unread']) && is_array($u['unread']) ? $u['unread'] : array()) as $k => $n) if ($n > 0) { $f = user($k); $un[] = array('login' => $k, 'name' => $f ? $f['name'] : $k, 'n' => (int)$n); }
    $rq = array(); foreach ((isset($u['freq']) && is_array($u['freq']) ? $u['freq'] : array()) as $k => $tm) { $f = user($k); if ($f) $rq[] = array('login' => $k, 'name' => $f['name'], 't' => $tm); }
    $inv = array();                                      // do'st chaqiruvlari: 15 s ichida yetib boradi (ping 1 daqiqa kutmaydi)
    if (!empty($u['inv'])) { lock(); $u = auth(); foreach ((array)$u['inv'] as $i) if (is_array($i) && isset($i['t']) && time() - $i['t'] < 600) $inv[] = $i; $u['inv'] = array(); save_user($u); }
    $calls = array();                                    // "Sizni sog'indik": uzoq kirmagan paytda do'stlar chaqirgan
    if (!empty($u['calls'])) { lock(); $u = auth(); $calls = $u['calls']; $u['calls'] = array(); save_user($u); }
    $dinv = null; $duel = null; $dres = null;
    if (!empty($u['dinv'])) { $x = rd('duels/' . $u['dinv'], null); if ($x && $x['st'] === 'wait' && time() - $x['t'] < 60) $dinv = array('id' => $x['id'], 'from' => $x['an'], 'login' => $x['a'], 'mins' => $x['mins']); }
    if (!empty($u['duel'])) { lock(); $duel = duel_pub(duel_finish($u['duel']), strtolower($u['login'])); $u = auth(); }
    if (!empty($u['dres'])) { lock(); $u = auth(); $dres = duel_pub(rd('duels/' . $u['dres'], null), strtolower($u['login'])); unset($u['dres']); save_user($u); }
    $wn = 0; if (!empty($u['wallnew'])) { lock(); $u = auth(); $wn = (int)$u['wallnew']; $u['wallnew'] = 0; save_user($u); }
    $ring = null; $ans = array();                        // qo'ng'iroq: do'st menyuda qo'ng'iroq qilyapti / javob berdi
    if (!empty($u['ring']) || !empty($u['ringans'])) {
        lock(); $u = auth();
        if (!empty($u['ring']) && time() - $u['ring']['t'] < 45) $ring = $u['ring'];
        if (!empty($u['ringans'])) foreach ($u['ringans'] as $x) if (time() - $x['t'] < 120) $ans[] = $x;
        unset($u['ring']); $u['ringans'] = array(); save_user($u);
    }
    out(array('ok' => true, 'unread' => $un, 'req' => $rq, 'inv' => $inv, 'calls' => $calls, 'ring' => $ring, 'ringans' => $ans, 'wallnew' => $wn, 'dinv' => $dinv, 'duel' => $duel, 'dres' => $dres));

case 'duel_req':
    lock();
    if (!feat_on('duel')) fail('off', 'Bu funksiya vaqtincha o\'chirilgan');
    $u = auth();
    $to = strtolower(p('to')); $mins = (int)p('mins'); if (!in_array($mins, array(5, 10, 15), true)) $mins = 10;
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $to) || empty($u['friends']) || !in_array($to, array_map('strtolower', $u['friends']))) fail('bad', 'Faqat do\'stni duelga chaqirish mumkin');
    if (!empty($u['duel'])) { $x = duel_finish($u['duel']); if ($x && $x['st'] === 'on') fail('busy', 'Sizda duel davom etyapti'); $u = auth(); }
    $t = user($to); if (!$t) fail('bad', 'Topilmadi');   // duel_finish ikkala tomonni saqlaydi - raqib undan keyin o'qiladi (eski nusxa natijani o'chirmasin)
    if (!is_online($t)) fail('off', 'Do\'stingiz hozir onlayn emas');
    @mkdir(XC_DIR . '/duels', 0755, true); cap_dir(XC_DIR . '/duels', 2000);
    $id = substr(md5(microtime() . mt_rand()), 0, 10);
    wr('duels/' . $id, array('id' => $id, 'a' => $u['login'], 'an' => $u['name'], 'b' => $t['login'], 'bn' => $t['name'], 'mins' => $mins, 'st' => 'wait', 't' => time(), 'ka' => 0, 'kb' => 0));
    $t['dinv'] = $id; save_user($t);
    out(array('ok' => true, 'id' => $id));
case 'duel_ans':
    lock();
    $u = auth();
    $id = preg_replace('/[^a-f0-9]/', '', p('id')); $d = rd('duels/' . $id, null);
    if (!$d || strtolower($d['b']) !== strtolower($u['login']) || $d['st'] !== 'wait') fail('bad', 'Duel topilmadi');
    unset($u['dinv']);
    if (p('ok') !== '1') { $d['st'] = 'no'; wr('duels/' . $id, $d); save_user($u); $a = user($d['a']); if ($a) { $a['dres'] = $id; save_user($a); } out(array('ok' => true)); }
    $d['st'] = 'on'; $d['start'] = time(); $d['end'] = time() + $d['mins'] * 60; wr('duels/' . $id, $d);
    $u['duel'] = $id; save_user($u);
    $a = user($d['a']); if ($a) { $a['duel'] = $id; save_user($a); }
    out(array('ok' => true, 'duel' => duel_pub($d, strtolower($u['login']))));

/* ---------- sandiq ochish ---------- */
case 'chest_open':
    lock();
    if (!feat_on('chest')) fail('off', 'Bu funksiya vaqtincha o\'chirilgan');
    $u = auth();
    if (chests_avail($u) <= 0) fail('none', 'Sandiq yo\'q. Har yangi darajada bittadan beriladi');
    $u['cho'] = (int)@$u['cho'] + 1;
    $u['bag'] = inv_of($u);
    $r = mt_rand(1, 1000); $rw = null;
    $pick = function ($all, $have) { $left = array_values(array_diff($all, $have)); return $left ? $left[mt_rand(0, count($left) - 1)] : null; };
    if ($r > 970) { $f = in_array('flegend', $u['bag']['fr']) ? null : 'flegend'; if ($f) $u['bag']['fr'][] = $f; $u['xp'] = (int)$u['xp'] + 1000; $rw = array('type' => 'legend', 'xp' => 1000, 'id' => $f, 'rar' => 'legend'); }
    elseif ($r > 820) { $f = $pick(array_diff(frames_rare(), array('flegend')), $u['bag']['fr']); if ($f) { $u['bag']['fr'][] = $f; $rw = array('type' => 'frame', 'id' => $f, 'rar' => 'epic'); } }
    elseif ($r > 570) { $c = $pick(nick_rare(), $u['bag']['nc']); if ($c) { $u['bag']['nc'][] = $c; $rw = array('type' => 'nick', 'id' => $c, 'rar' => 'rare'); } }
    if (!$rw) { $x = mt_rand(10, 30) * 10; $u['xp'] = (int)$u['xp'] + $x; $rw = array('type' => 'xp', 'xp' => $x, 'rar' => 'common'); }
    save_user($u);
    out(array('ok' => true, 'rw' => $rw, 'chests' => chests_avail($u), 'xp' => (int)$u['xp'], 'level' => level($u['xp']), 'lvlxp' => (int)$u['xp'] % XP_PER_LEVEL, 'inv' => $u['bag']));
case 'equip':
    lock();
    $u = auth();
    $inv = inv_of($u);
    if (p('nc', '-') !== '-') { $c = p('nc');
        if ($c === '') unset($u['nc']);
        elseif ((in_array($c, nick_colors(), true) && level($u['xp']) >= 10) || in_array($c, $inv['nc'], true)) $u['nc'] = $c;
        else fail('lock', 'Rangli nik 10-darajadan ochiladi (maxsus ranglar - sandiqdan)'); }
    if (p('frame', '-') !== '-') { $f = p('frame');
        if ($f === '') unset($u['frame']); elseif (in_array($f, $inv['fr'], true)) $u['frame'] = $f; else fail('lock', 'Bu ramka sizda yo\'q'); }
    save_user($u);
    out(array('ok' => true, 'me' => pub($u, true)));

/* ---------- reyting TOP ---------- */
case 'toprp':
    $l = array();
    foreach ((array)glob(XC_DIR . '/users/*.php') as $f) { $x = user(basename($f, '.php')); if ($x && !empty($x['rp'])) $l[] = array('name' => $x['name'], 'login' => $x['login'], 'rp' => (int)$x['rp'], 'rank' => rank_of((int)$x['rp']), 'nc' => isset($x['nc']) ? $x['nc'] : ''); }
    usort($l, function ($a, $b) { return $b['rp'] - $a['rp']; });
    out(array('ok' => true, 'top' => array_slice($l, 0, 20)));

/* ---------- do'st profili: daraja, statistika, yutuqlar, oxirgi faollik ---------- */
case 'uinfo':
    $u = auth();
    $t = user(strtolower(p('login')));
    if (!$t) fail('bad', 'Topilmadi');
    $r = pub($t, false);
    $st = isset($t['st']) ? $t['st'] : array(); $w = isset($st['wpn']) ? $st['wpn'] : array(); arsort($w);
    $r['wpn'] = array_slice($w, 0, 3, true);
    $r['created'] = isset($t['created']) ? (int)$t['created'] : 0;
    $r['nfr'] = isset($t['friends']) ? count($t['friends']) : 0;
    $r['isfr'] = !empty($u['friends']) && in_array(strtolower($t['login']), array_map('strtolower', $u['friends']));
    $r['wall'] = array_reverse(isset($t['wall']) ? array_slice($t['wall'], -20) : array());
    out(array('ok' => true, 'u' => $r));

/* ---------- profil devori: do'stlar profilingizga izoh qoldiradi (Steam'dagidek) ---------- */
case 'wall_add':
    lock();
    if (!feat_on('wall')) fail('off', 'Bu funksiya vaqtincha o\'chirilgan');
    $u = auth();
    $to = strtolower(p('to')); $txt = trim(clean_str(p('text'), 200));
    if (mb_strlen($txt, 'UTF-8') < 1) fail('bad', 'Matn bo\'sh');
    $t = preg_match('/^[a-z0-9_]{3,20}$/', $to) ? user($to) : null;
    if (!$t) fail('bad', 'Topilmadi');
    $mine = strtolower($u['login']) === $to;
    if (!$mine && (empty($u['friends']) || !in_array($to, array_map('strtolower', $u['friends'])))) fail('bad', 'Faqat do\'stlar profiliga yozish mumkin');
    if (rl_count('wall' . strtolower($u['login']), 3600) >= 20) fail('limit', 'Juda ko\'p. Keyinroq yozing');
    rl_add('wall' . strtolower($u['login']), 3600);
    if (!isset($t['wall'])) $t['wall'] = array();
    $t['wall'][] = array('id' => substr(md5(microtime() . mt_rand()), 0, 8), 'from' => $u['login'], 'name' => $u['name'], 'text' => $txt, 't' => time());
    $t['wall'] = array_slice($t['wall'], -30);
    if (!$mine) $t['wallnew'] = (isset($t['wallnew']) ? (int)$t['wallnew'] : 0) + 1;
    if (!$mine) { $t['walln'] = (isset($t['walln']) ? (int)$t['walln'] : 0) + 1; ach_check($t); }
    save_user($t);
    out(array('ok' => true));
case 'wall_del':
    lock();
    $u = auth();
    $to = strtolower(p('to')); $id = preg_replace('/[^a-f0-9]/', '', p('id'));
    $t = preg_match('/^[a-z0-9_]{3,20}$/', $to) ? user($to) : null;
    if (!$t || empty($t['wall'])) fail('bad', 'Topilmadi');
    $me = strtolower($u['login']); $n = array();
    foreach ($t['wall'] as $w) { if ($w['id'] === $id && ($me === $to || strtolower($w['from']) === $me)) continue; $n[] = $w; }
    $t['wall'] = $n; save_user($t);
    out(array('ok' => true));

/* ---------- "Bilasizmi?": siz bilan bir serverlarda o'ynagan, lekin do'stingiz bo'lmagan o'yinchilar ---------- */
case 'suggest':
    if (!feat_on('suggest')) fail('off', 'Bu funksiya vaqtincha o\'chirilgan');
    $u = auth();
    $me = strtolower($u['login']);
    $mys = isset($u['st']['srv']) ? $u['st']['srv'] : array(); uasort($mys, function ($a, $b) { return $b['t'] - $a['t']; });
    $mys = array_slice($mys, 0, 15, true);
    if (!$mys) out(array('ok' => true, 'list' => array()));
    $skip = array($me => 1); foreach ((isset($u['friends']) ? $u['friends'] : array()) as $f) $skip[strtolower($f)] = 1;
    foreach ((isset($u['freq']) ? $u['freq'] : array()) as $f => $x) $skip[strtolower($f)] = 1;
    $cand = array();
    foreach ((array)glob(XC_DIR . '/users/*.php') as $f) {
        $l = basename($f, '.php'); if (isset($skip[$l])) continue;
        $x = user($l); if (!$x || empty($x['seen']) || time() - $x['seen'] > 14 * 86400) continue;
        if (isset($x['freq'][$me])) continue;                // so'rov allaqachon yuborilgan
        $sc = 0; $common = '';
        foreach ((isset($x['st']['srv']) ? $x['st']['srv'] : array()) as $ip => $sv) if (isset($mys[$ip])) { $sc += 1 + min($sv['t'], $mys[$ip]['t']) / 3600; if ($common === '') $common = $sv['n'] !== '' ? $sv['n'] : $ip; }
        if ($sc > 0) { $pp = pub($x, false); $cand[] = array('s' => $sc, 'u' => array('login' => $pp['login'], 'name' => $pp['name'], 'level' => $pp['level'], 'av' => $pp['av'], 'avc' => $pp['avc'], 'online' => $pp['online'], 'common' => $common)); }
    }
    usort($cand, function ($a, $b) { return $b['s'] < $a['s'] ? -1 : 1; });
    $out = array(); foreach (array_slice($cand, 0, 6) as $c) $out[] = $c['u'];
    out(array('ok' => true, 'list' => $out));

/* ---------- qo'ng'iroq: onlayn do'stning menyusida qo'ng'iroq oynasi chiqadi (ovoz bilan) ---------- */
case 'ring':
    lock();
    if (!feat_on('ring')) fail('off', 'Bu funksiya vaqtincha o\'chirilgan');
    $u = auth();
    $to = strtolower(p('to'));
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $to) || empty($u['friends']) || !in_array($to, array_map('strtolower', $u['friends']))) fail('bad', 'Faqat do\'stlarga qo\'ng\'iroq qilish mumkin');
    $t = user($to);
    if (!$t) fail('bad', 'Do\'st topilmadi');
    if (!is_online($t)) fail('off', 'Do\'stingiz hozir onlayn emas');
    if (rl_count('ring' . strtolower($u['login']) . '-' . $to, 60) >= 2) fail('limit', 'Biroz kuting');
    rl_add('ring' . strtolower($u['login']) . '-' . $to, 60);
    $srv = p('srv'); if (!preg_match('/^[\w.\-]+:\d+$/', $srv)) $srv = '';
    $t['ring'] = array('from' => $u['name'], 'login' => $u['login'], 't' => time(), 'srv' => $srv);
    save_user($t);
    out(array('ok' => true));
case 'ring_ans':
    lock();
    $u = auth();
    $to = strtolower(p('to'));
    $t = preg_match('/^[a-z0-9_]{3,20}$/', $to) ? user($to) : null;
    if (!$t) fail('bad', 'Topilmadi');
    $me = strtolower($u['login']);
    if (!in_array($to, array_map('strtolower', (array)@$u['friends'])) && !in_array($me, array_map('strtolower', (array)@$t['friends']))) fail('bad', 'Topilmadi');   // faqat do'stga
    if (rl_count('ra' . strtolower($u['login']), 60) >= 10) fail('limit', 'limit'); rl_add('ra' . strtolower($u['login']), 60);
    if (!isset($t['ringans'])) $t['ringans'] = array();
    $t['ringans'][] = array('from' => $u['name'], 'login' => $u['login'], 'ok' => p('ok') === '1' ? 1 : 0, 't' => time());
    $t['ringans'] = array_slice($t['ringans'], -5);
    save_user($t);
    out(array('ok' => true));

/* ---------- kunlik kirish mukofoti: har kuni birinchi kirishda XP, ketma-ket kunlar (streak) ko'paytiradi, 7-kuni katta bonus ---------- */
case 'daily':
    lock();
    if (!feat_on('daily')) fail('off', 'Bu funksiya vaqtincha o\'chirilgan');
    $u = auth();
    @date_default_timezone_set('Asia/Tashkent');
    $day = date('Y-m-d'); $yd = date('Y-m-d', time() - 86400);
    $dl = isset($u['dly']) && is_array($u['dly']) ? $u['dly'] : array('d' => '', 's' => 0);
    if ($dl['d'] === $day) out(array('ok' => true, 'got' => 0, 'streak' => (int)$dl['s']));
    $yday = isset($u['dst'][$yd]) && $u['dst'][$yd]['t'] > 0 ? $u['dst'][$yd] : null;
    if ($yday) { arsort($yday['srv']); $yday['top'] = key($yday['srv']); unset($yday['srv']); }
    $streak = $dl['d'] === $yd ? (int)$dl['s'] + 1 : 1;
    $got = $streak % 7 === 0 ? 200 : 20 + 10 * min(5, ($streak - 1) % 7);
    $u['dly'] = array('d' => $day, 's' => $streak);
    $u['xp'] = (int)$u['xp'] + $got;
    if (!isset($u['wk']) || $u['wk'] !== week_id()) { $u['wk'] = week_id(); $u['wkxp'] = 0; }
    $u['wkxp'] = (int)$u['wkxp'] + $got;
    $newach = ach_check($u);
    save_user($u);
    if ($streak % 7 === 0) $u['chb'] = (int)@$u['chb'] + 1;                    // 7 kun ketma-ket - sandiq
    save_user($u);
    out(array('ok' => true, 'yday' => $yday, 'chests' => chests_avail($u), 'newach' => $newach, 'got' => $got, 'streak' => $streak, 'xp' => (int)$u['xp'], 'level' => level($u['xp']), 'lvlxp' => (int)$u['xp'] % XP_PER_LEVEL));

/* ---------- "Sizni sog'indik": 3+ kun kirmagan do'stni chaqirish (u qaytganda menyuda ko'radi) ---------- */
case 'miss_call':
    lock();
    $u = auth();
    $to = strtolower(p('to'));
    if (!preg_match('/^[a-z0-9_]{3,20}$/', $to) || empty($u['friends']) || !in_array($to, array_map('strtolower', $u['friends']))) fail('bad', 'Faqat do\'stlarni chaqirish mumkin');
    $t = user($to);
    if (!$t) fail('bad', 'Do\'st topilmadi');
    if (!empty($t['seen']) && time() - $t['seen'] < 3 * 86400) fail('bad', 'Do\'stingiz yaqinda kirgan');
    if (rl_count('call' . strtolower($u['login']) . '-' . $to, 86400) >= 1) fail('limit', 'Bugun allaqachon chaqirgansiz');
    rl_add('call' . strtolower($u['login']) . '-' . $to, 86400);
    if (!isset($t['calls'])) $t['calls'] = array();
    $t['calls'][] = array('from' => $u['name'], 'login' => $u['login'], 't' => time());
    $t['calls'] = array_slice($t['calls'], -10);
    save_user($t);
    if (!empty($t['tgid'])) tg_send($t['tgid'], $u['name'] . " sizni sog'inibdi! X CLIENT ga kiring - birga o'ynaymiz.");
    out(array('ok' => true));

/* ---------- menyudagi "Taklif / shikoyat" tugmasi -> admin panel (Fikrlar) + Telegram ---------- */
case 'feedback':
    if (!feat_on('feedback')) fail('off', 'Bu funksiya vaqtincha o\'chirilgan');
    if (rl_count('fb' . client_ip(), 3600) >= 5) fail('limit', 'Bir soatda 5 tadan ko\'p yozib bo\'lmaydi');
    $txt = trim(clean_str(p('text'), 1500));
    if (mb_strlen($txt, 'UTF-8') < 3) fail('bad', 'Matn juda qisqa');
    $kind = in_array(p('kind'), array('idea', 'bug', 'complain'), true) ? p('kind') : 'idea';
    rl_add('fb' . client_ip(), 3600);
    $who = ''; $tok = p('token');
    if (preg_match('/^[a-f0-9]{40}$/', $tok)) { $tks = rd('tokens', array()); if (!empty($tks[$tok])) $who = $tks[$tok]; }
    @mkdir(XC_DIR . '/feedback', 0755, true);
    cap_dir(XC_DIR . '/feedback', 1000);
    wr('feedback/' . date('Ymd-His') . '-' . mt_rand(1000, 9999), array('t' => time(), 'kind' => $kind, 'text' => $txt, 'who' => $who, 'nick' => clean_str(p('nick'), 40), 'ver' => clean_str(p('ver'), 20), 'ip' => client_ip()));
    $kn = array('idea' => 'Taklif', 'bug' => 'Xatolik', 'complain' => 'Shikoyat');
    tg_notify('feedback', 'X CLIENT - ' . $kn[$kind] . ' (' . ($who !== '' ? $who : (p('nick') !== '' ? clean_str(p('nick'), 40) : 'mehmon')) . "):\n" . $txt);
    out(array('ok' => true));

/* ---------- jang statistikasi: o'yinchining hamma serverlardagi kill/o'limi akkauntga yig'iladi (Steam statistikasidek) ----------
 * Menyu o'yin davomida (2 daqiqada bir) va chiqishda shu o'yinning JAMI qiymatlarini yuboradi: sid - o'yin boshlangan vaqt (ms).
 * Server oldingi yuborilganidan farqini qo'shadi - qayta yuborish ikki marta sanalmaydi. Konsol yozuvini soxtalashtirib
 * bo'lmasligi uchun: o'yin vaqtiga nisbatan chegara (daqiqasiga 6 kill + 5). */
case 'stat':
    lock();
    $u = auth();
    $sid = preg_replace('/[^0-9]/', '', p('sid')); $ip = p('ip');
    if ($sid === '' || strlen($sid) > 15 || !preg_match('/^[a-z0-9.\-]{3,64}:\d{2,5}$/i', $ip)) fail('bad', 'bad');
    $dur = max(0, min(6 * 3600, (int)p('dur')));
    $ss = isset($u['ss']) && is_array($u['ss']) ? $u['ss'] : array();
    /* soxta statistika: o'yin vaqti saytning o'z soati bilan cheklanadi (o'yin birinchi marta ko'ringan paytdan beri),
     * eski (ro'yxatdan chiqib ketgan) o'yinni qayta yuborib bo'lmaydi, daqiqasiga 10 so'rovdan ko'p emas */
    $nowms = time() * 1000.0;   // soati noto'g'ri kompyuter (klub PC) boshqa qurilmalardagi statistikani bloklamasin
    if (!isset($ss[$sid]) && isset($u['sidcut']) && (float)$sid <= (float)$u['sidcut'] && abs((float)$sid - $nowms) < 2 * 86400000) fail('old', 'old');
    if (rl_count('st' . strtolower($u['login']), 60) >= 10) fail('limit', 'limit');
    rl_add('st' . strtolower($u['login']), 60);
    $old = isset($ss[$sid]) ? $ss[$sid] : array('k' => 0, 'd' => 0, 't' => 0, 'w' => array());
    $s0 = isset($old['s0']) ? (int)$old['s0'] : time() - $dur;   // birinchi xabar (o'yin o'rtasida kirilgan bo'lsa ham) - o'zi aytgan vaqt, 6 soatgacha
    $dur = min($dur, time() - $s0 + 120);
    $cap = (int)ceil($dur / 60 * 6) + 5;
    $k = max(0, min($cap, (int)p('k'))); $d = max(0, min($cap, (int)p('d')));
    $k = max($k, (int)$old['k']); $d = max($d, (int)$old['d']); $dur = max($dur, (int)$old['t']);   // kamayib, keyin qayta qo'shilmasin
    $dk = max(0, $k - $old['k']); $dd = max(0, $d - $old['d']); $dt = max(0, $dur - $old['t']);
    $st = isset($u['st']) && is_array($u['st']) ? $u['st'] : array('k' => 0, 'd' => 0, 'g' => 0, 't' => 0, 'best' => 0, 'wpn' => array(), 'srv' => array());
    if (!isset($ss[$sid])) $st['g'] = (int)@$st['g'] + 1;
    $st['k'] = (int)@$st['k'] + $dk; $st['d'] = (int)@$st['d'] + $dd; $st['t'] = (int)@$st['t'] + $dt;
    if ($k > (int)@$st['best']) $st['best'] = $k;
    $w = json_decode(p('w'), true); $nw = array();
    if (is_array($w)) foreach ($w as $wn => $wc) {
        $wn = strtolower(preg_replace('/[^a-z0-9_\-]/i', '', (string)$wn));
        if ($wn === '' || strlen($wn) > 20) continue;
        $nw[$wn] = min($k, max(0, (int)$wc));
        $add = $nw[$wn] - (isset($old['w'][$wn]) ? (int)$old['w'][$wn] : 0);
        if ($add > 0) { if (!isset($st['wpn'][$wn])) $st['wpn'][$wn] = 0; $st['wpn'][$wn] += $add; }
    }
    if (count($st['wpn']) > 40) { arsort($st['wpn']); $st['wpn'] = array_slice($st['wpn'], 0, 40, true); }
    $sv = isset($st['srv'][$ip]) ? $st['srv'][$ip] : array('k' => 0, 'd' => 0, 't' => 0, 'n' => '');
    $sv['k'] += $dk; $sv['d'] += $dd; $sv['t'] += $dt; if (p('name') !== '') $sv['n'] = clean_str(p('name'), 60);
    $st['srv'][$ip] = $sv;
    if (count($st['srv']) > 30) { uasort($st['srv'], function ($a, $b) { return $b['t'] - $a['t']; }); $st['srv'] = array_slice($st['srv'], 0, 30, true); }
    $u['st'] = $st;
    $ws = isset($u['wkst']) && is_array($u['wkst']) ? $u['wkst'] : array();   // haftalar bo'yicha (statistika grafigi uchun, 12 hafta)
    $wid = week_id(); if (!isset($ws[$wid])) $ws[$wid] = array('k' => 0, 'd' => 0, 't' => 0, 'g' => 0);
    $ws[$wid]['k'] += $dk; $ws[$wid]['d'] += $dd; $ws[$wid]['t'] += $dt; if (!isset($ss[$sid])) $ws[$wid]['g']++;
    ksort($ws); if (count($ws) > 12) $ws = array_slice($ws, -12, 12, true);
    $u['wkst'] = $ws;
    $u['rp'] = max(0, (float)@$u['rp'] + 2 * $dk - 1.5 * $dd);                 // reyting
    @date_default_timezone_set('Asia/Tashkent');
    $dsa = isset($u['dst']) && is_array($u['dst']) ? $u['dst'] : array(); $td = date('Y-m-d');   // kunlik xulosa ("Kechagi o'yiningiz")
    if (!isset($dsa[$td])) $dsa[$td] = array('k' => 0, 'd' => 0, 't' => 0, 'g' => 0, 'srv' => array());
    $dsa[$td]['k'] += $dk; $dsa[$td]['d'] += $dd; $dsa[$td]['t'] += $dt; if (!isset($ss[$sid])) $dsa[$td]['g']++;
    $sn = p('name') !== '' ? clean_str(p('name'), 60) : $ip; $dsa[$td]['srv'][$sn] = (isset($dsa[$td]['srv'][$sn]) ? $dsa[$td]['srv'][$sn] : 0) + $dt;
    if (!isset($dsa[$td]['ips']) || count($dsa[$td]['ips']) < 30) $dsa[$td]['ips'][$ip] = 1;   // "serverlar" vazifasi - manzil bo'yicha (nomlari bir xil bo'lishi mumkin)
    $mp = strtolower(preg_replace('/[^a-z0-9_\-]/i', '', p('map')));   // "xaritalar" vazifasi uchun
    if ($mp !== '' && strlen($mp) <= 40 && (!isset($dsa[$td]['maps']) || count($dsa[$td]['maps']) < 30)) $dsa[$td]['maps'][$mp] = 1;
    if ($k > (isset($dsa[$td]['best']) ? $dsa[$td]['best'] : 0)) $dsa[$td]['best'] = $k;
    ksort($dsa); if (count($dsa) > 3) $dsa = array_slice($dsa, -3, 3, true); $u['dst'] = $dsa;
    if (!empty($u['duel']) && $dk > 0) {                                       // duel davom etyapti - kill hisobga
        $dl = rd('duels/' . $u['duel'], null);
        if ($dl && $dl['st'] === 'on' && time() <= $dl['end']) { $side = strtolower($dl['a']) === strtolower($u['login']) ? 'ka' : 'kb'; $dl[$side] += $dk; wr('duels/' . $u['duel'], $dl); }
    }
    $wk = week_id(); if (!isset($u['wkkid']) || $u['wkkid'] !== $wk) { if (isset($u['wkkid'])) { $u['wkkpid'] = $u['wkkid']; $u['wkkp'] = (int)$u['wkk']; } $u['wkkid'] = $wk; $u['wkk'] = 0; } $u['wkk'] += $dk;
    if ($dk > 0) {                                        // har kill uchun XP (vaqt XP siga qo'shimcha)
        $u['xp'] = (int)$u['xp'] + $dk * XP_PER_KILL;
        if (!isset($u['wk']) || $u['wk'] !== $wk) { $u['wk'] = $wk; $u['wkxp'] = 0; }
        $u['wkxp'] = (int)$u['wkxp'] + $dk * XP_PER_KILL;
    }
    $newach = ach_check($u);
    $ss[$sid] = array('k' => $k, 'd' => $d, 't' => $dur, 'w' => $nw, 's0' => $s0);
    if (count($ss) > 8) { ksort($ss); foreach (array_slice(array_keys($ss), 0, count($ss) - 8) as $ev) $u['sidcut'] = max((float)@$u['sidcut'], min((float)$ev, $nowms)); $ss = array_slice($ss, -8, 8, true); }
    $u['ss'] = $ss;
    save_user($u);
    $pu = pub($u, true);
    out(array('ok' => true, 'st' => $pu['st'], 'ach' => $pu['ach'], 'newach' => $newach, 'xp' => (int)$u['xp'], 'level' => level($u['xp']), 'lvlxp' => (int)$u['xp'] % XP_PER_LEVEL));

case 'stat_bf':                                          // eski o'yinlar (menyu tarixidan) - akkauntga bir marta
    lock();
    $u = auth();
    if (empty($u['bf'])) {
        $st = isset($u['st']) && is_array($u['st']) ? $u['st'] : array('k' => 0, 'd' => 0, 'g' => 0, 't' => 0, 'best' => 0, 'wpn' => array(), 'srv' => array());
        $ss = isset($u['ss']) ? $u['ss'] : array();
        $g = json_decode(p('g'), true); $n = 0;
        if (is_array($g)) foreach (array_slice($g, 0, 100) as $x) {
            if (!is_array($x) || empty($x['ip']) || !preg_match('/^[a-z0-9.\-]{3,64}:\d{2,5}$/i', $x['ip'])) continue;
            $sid = preg_replace('/[^0-9]/', '', (string)@$x['t']); if ($sid === '' || isset($ss[$sid])) continue;
            $dur = max(0, min(6 * 3600, (int)@$x['dur'])); $cap = (int)ceil($dur / 60 * 6) + 5;
            $k = max(0, min($cap, (int)@$x['k'])); $d = max(0, min($cap, (int)@$x['d']));
            $st['k'] += $k; $st['d'] += $d; $st['t'] += $dur; $st['g']++; $n++;
            if ($k > (int)@$st['best']) $st['best'] = $k;
            $sv = isset($st['srv'][$x['ip']]) ? $st['srv'][$x['ip']] : array('k' => 0, 'd' => 0, 't' => 0, 'n' => '');
            $sv['k'] += $k; $sv['d'] += $d; $sv['t'] += $dur; if (!empty($x['n'])) $sv['n'] = clean_str($x['n'], 60);
            $st['srv'][$x['ip']] = $sv;
        }
        if (count($st['srv']) > 30) { uasort($st['srv'], function ($a, $b) { return $b['t'] - $a['t']; }); $st['srv'] = array_slice($st['srv'], 0, 30, true); }
        $u['st'] = $st; $u['bf'] = time();
        $newach = ach_check($u);
        save_user($u);
    } else $newach = array();
    $pu = pub($u, true);
    out(array('ok' => true, 'st' => $pu['st'], 'ach' => $pu['ach'], 'newach' => $newach));

case 'topk':                                             // haftaning eng ko'p kill qilgan o'yinchilari
    $ch = champ_update();
    $cache = rd('topkcache', null);
    if ($cache && time() - $cache['t'] < 120) out(array('ok' => true, 'top' => $cache['top'], 'champ' => $ch));
    $top = array(); $wk = week_id();
    foreach (glob(XC_DIR . '/users/*.php') as $f) {
        $x = rd('users/' . basename($f, '.php'), null);
        if (!$x || !isset($x['wkkid']) || $x['wkkid'] !== $wk || empty($x['wkk'])) continue;
        $sx = isset($x['st']) ? $x['st'] : array();
        $top[] = array('name' => $x['name'], 'login' => $x['login'], 'k' => (int)$x['wkk'], 'kd' => !empty($sx['d']) ? round($sx['k'] / $sx['d'], 2) : (float)@$sx['k'], 'vip' => !empty($x['vip']));
    }
    usort($top, function ($a, $b) { return $b['k'] - $a['k']; });
    $top = array_slice($top, 0, 10);
    wr('topkcache', array('t' => time(), 'top' => $top));
    out(array('ok' => true, 'top' => $top, 'champ' => $ch));

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

/* o'yin xulosasini ulashish: raqamlar saytdagi o'yin yozuvidan (stat), kartani gcard.php chizadi, Telegram kanalga rasm bo'lib tushadi */
case 'gsshare':
    lock();
    $u = auth();
    $sid = preg_replace('/[^0-9]/', '', p('sid'));
    $g = isset($u['ss'][$sid]) ? $u['ss'][$sid] : null;
    if (!$g) fail('nogame', 'Bu o\'yin hali saytga yetib kelmagan - birozdan keyin urinib ko\'ring');
    if (rl_count('gss' . strtolower($u['login']), 86400) >= 10) fail('limit', 'Bugun 10 marta ulashildi - ertaga yana');
    rl_add('gss' . strtolower($u['login']), 86400);
    $k = (int)$g['k'];
    $w = isset($g['w']) && is_array($g['w']) ? $g['w'] : array(); arsort($w); $fav = $w ? (string)key($w) : '';
    $ip = p('ip'); $sv = isset($u['st']['srv'][$ip]) ? $u['st']['srv'][$ip]['n'] : '';
    $id = substr(sha1(strtolower($u['login']) . ':' . $sid), 0, 12);
    $rec = array('login' => $u['login'], 'name' => $u['name'], 'k' => $k, 'd' => (int)$g['d'], 't' => (int)$g['t'],
        'h' => max(0, min($k, (int)p('h'))), 'bs' => max(0, min($k, (int)p('bs'))), 'a' => max(0, min(200, (int)p('as'))),
        'fav' => preg_replace('/[^a-z0-9_\-]/', '', $fav), 'srv' => clean_str($sv, 64), 'map' => preg_replace('/[^A-Za-z0-9_\-.]/', '', substr(p('map'), 0, 32)), 'ts' => time());
    @mkdir(XC_DIR . '/gs', 0755, true);
    wr('gs/' . $id, $rec); @unlink(XC_DIR . '/gcards/' . $id . '.png');
    cap_dir(XC_DIR . '/gs', 3000);
    unlock();
    $img = 'https://mmb.boost-top.com/gcard.php?g=' . $id;
    $cf = xc_cfg();
    if (!empty($cf['tg_token']) && !empty($cf['tg_clips'])) {
        $kd = $rec['d'] ? round($k / $rec['d'], 2) : $k;
        $cap = "\xF0\x9F\x8E\xAE " . $rec['name'] . ": " . $k . " kill \xC2\xB7 K/D " . $kd . ($rec['srv'] !== '' ? " \xC2\xB7 " . $rec['srv'] : '') . "\n#xclient";
        $ctx = stream_context_create(array('http' => array('method' => 'POST', 'timeout' => 20, 'ignore_errors' => true, 'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query(array('chat_id' => $cf['tg_clips'], 'photo' => $img . '&v=' . time(), 'caption' => $cap)))));
        $r = json_decode((string)@file_get_contents('https://api.telegram.org/bot' . $cf['tg_token'] . '/sendPhoto', false, $ctx), true);
        if (empty($r['ok'])) tg_send($cf['tg_clips'], $cap . "\n" . $img);
    }
    out(array('ok' => true, 'url' => $img));

case 'clips':                                            // ulashilgan kliplar (clips.php va yuklab olish sahifasidagi lenta)
    header('Access-Control-Allow-Origin: *');            // ochiq ma'lumot: cssborka.uz dagi yuklab olish sahifasi ham o'qiydi
    $l = rd('clips', array()); $out = array();
    foreach (array_slice($l, 0, 60) as $c) $out[] = array('id' => $c['id'], 'name' => $c['name'], 't' => $c['t'], 'sec' => $c['sec'], 'srv' => $c['srv']);
    out(array('ok' => true, 'clips' => $out));

case 'news':                                             // turnirlar / e'lonlar: xc_news.json (qo'lda tahrirlanadi)
    $f = __DIR__ . '/xc_news.json';
    $j = is_file($f) ? json_decode(file_get_contents($f), true) : null;
    $ann = array();                                      // admin paneldagi e'lonlar
    foreach ((array)rd('announce', array()) as $x) if (empty($x['until']) || $x['until'] > time()) $ann[] = array('id' => $x['id'], 'text' => $x['text'], 'type' => $x['type'], 'link' => isset($x['link']) ? $x['link'] : '', 'ip' => isset($x['ip']) ? $x['ip'] : '');
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
        geo_cc(client_ip());                               // qulfdan oldin - keyin keshdan olinadi
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
        /* launcher monitor o'lchamini yuboradi - 'scr' ga. 'res' = o'yinchi menyuda tanlagan o'yin o'lchami (bosib ketilmasin).
         * Eski versiya 'res' ga monitor o'lchamini yozib qo'ygan: tanlov ko'rinmasdi - bir marta tozalaymiz. */
        if (p('res') !== '' && preg_match('/^\d{3,5}x\d{3,5}$/', p('res'))) {
            if (!isset($o['scr']) && isset($o['res']) && $o['res'] === p('res')) unset($o['res']);
            $o['scr'] = p('res');
        }
        if (p('os') !== '') $o['os'] = clean_str(p('os'), 80);
        if (p('dvr') !== '') { $o['dvr'] = p('dvr') === '1' ? 1 : 0; if (!$o['dvr']) unset($o['dvroff']); }   // Windows Game Bar fon yozuvi (FPS ni tushiradi)
        if (preg_match('/^([0-9a-f]{8})~(\d{1,4})$/', p('cr'), $cm)) {   // launcher: o'yin yiqildi (Windows xato kodi ~ chetga olingan fayllar)
            $o['cr'] = array('t' => time(), 'c' => $cm[1], 'n' => (int)$cm[2]); $o['crn'] = (isset($o['crn']) ? $o['crn'] : 0) + 1;
        }
        if (isset($_GET['dm']) || isset($_POST['dm'])) {     // launcher: cstrike\xc_*.dem fayllari (eng yangisi birinchi) - menyudagi demolar ro'yxati
            $dmf = array();
            foreach (explode(',', (string)p('dm')) as $x) if (preg_match('/^[\w\-]{1,40}$/', $x) && count($dmf) < 40) $dmf[] = $x;
            $o['dmf'] = $dmf;
        }
        if (isset($_GET['vl']) || isset($_POST['vl'])) {     // launcher: Videolar\X CLIENT dagi haqiqiy MP4 lar - qo'lda o'chirilganlar ro'yxatdan ketadi
            $old = array(); foreach ((isset($o['vids']) && is_array($o['vids']) ? $o['vids'] : array()) as $x) if (isset($x['n'])) $old[$x['n']] = $x;
            $v = array();
            foreach (explode(',', (string)p('vl')) as $x) {
                $pp = explode('~', $x); $n = vid_name($pp[0]);
                if ($n === '' || count($v) >= 200) continue;
                $v[] = isset($old[$n]) ? $old[$n] : array('n' => $n, 'mb' => isset($pp[1]) ? (int)$pp[1] : 0, 'sec' => 0, 'q' => '');
            }
            $o['vids'] = $v;
        }
        if (preg_match('/^(ru|uz|en)$/', p('lang'))) $o['ilang'] = p('lang');      // o'rnatuvchida tanlangan til
        if (p('ch') !== '') $o['ch'] = preg_replace('/[^a-z]/', '', p('ch'));
        if (p('pt') !== '') $o['pt'] = clean_str(p('pt'), 60);
        $ip = client_ip();
        if (empty($o['ip']) || $o['ip'] !== $ip || !isset($o['cc'])) { $o['ip'] = $ip; $o['cc'] = geo_cc($ip); }
        $o['runs'] = (isset($o['runs']) ? $o['runs'] : 0) + 1;
        wr('dev/' . $d, $o);
        if ($isNew) tg_notify('install', "Yangi X CLIENT o'rnatish\n" . strtoupper(isset($o['cc']) ? $o['cc'] : '') . ' ' . $ip . "\n" . (isset($o['os']) ? $o['os'] : '') . (isset($o['scr']) ? ' · ' . $o['scr'] : ''));
        wr($ipk, array('d' => $d, 't' => time()));
        $ho = with_forced_packs($o, $d); unset($ho['k'], $ho['kc'], $ho['st'], $ho['fav'], $ho['ip']);   // launcherga saqlangan holat (token) kerak emas
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
    } elseif (!dev_ok($d, $o) && !($a === 'opts_done' && ip_dev(600) === $d)) fail('nolaunch', 'XCLauncher.exe topilmadi');   // opts_done - launcherning o'zi (kalitsiz, IP bo'yicha); u faqat belgilarni o'chiradi
    if ($a === 'opts_set') {
        $in = json_decode(p('o'), true);
        if (!is_array($in)) fail('bad', 'bad');
        foreach (array('beta', 'auto', 'start', 'win', 'clean', 'verify', 'prio', 'shots') as $k) if (isset($in[$k])) $o[$k] = $in[$k] ? 1 : 0;
        if (isset($in['packs'])) $o['packs'] = preg_match('/^[a-z0-9_,\-]{0,200}$/', $in['packs']) ? $in['packs'] : '';
        foreach (array('tune', 'macc', 'bgp') as $k) if (isset($in[$k])) $o[$k] = $in[$k] ? 1 : 0;   // o'yin paytida Windows'ni moslash (quvvat, sichqoncha, fon dasturlari)
        if (!empty($in['dvroff'])) $o['dvroff'] = 1;                                   // Game Bar fon yozuvini o'chirish - launcher keyingi ochilishda bajaradi
        foreach (array('mic', 'rb') as $k) if (isset($in[$k])) $o[$k] = $in[$k] ? 1 : 0;   // videoda mikrofon, "oxirgi 30 soniya"
        if (!empty($in['rbx'])) $o['rbx'] = 1;                                        // "oxirgi 30 soniya" ni o'yinchi o'zi tanladi (bo'lmasa - avto: oddiy kompyuterda o'chiq)
        if (isset($in['rsk'])) $o['rsk'] = max(0, min(2, (int)$in['rsk']));          // klassik radar foni: 0 asl, 1 qora kontrast, 2 qora + halqalar
        if (isset($in['vq'])) $o['vq'] = in_array($in['vq'], array('hi', 'mid', 'low'), true) ? $in['vq'] : 'mid';   // F10 video sifati
        if (isset($in['hud'])) $o['hud'] = in_array((int)$in['hud'], array(100, 150, 200)) ? (int)$in['hud'] : 100;   // HUD kattaligi, %
        if (isset($in['res'])) $o['res'] = preg_match('/^\d{3,4}x\d{3,4}$/', $in['res']) ? $in['res'] : '';
        wr('dev/' . $d, $o);
    } elseif ($a === 'opts_done') {
        $o['clean'] = 0; $o['verify'] = 0;
        if (p('cache') !== '') $o['cachemb'] = (int)p('cache');
        wr('dev/' . $d, $o);
    }
    $key = isset($o['k']) ? $o['k'] : '';
    unset($o['k'], $o['kc'], $o['ip'], $o['st'], $o['fav'], $o['vc']);   // saqlangan holat (token) faqat dstate orqali, kalit bilan
    out(array('ok' => true, 'o' => $o, 'd' => $d, 'k' => $claim ? $key : null));

/* ---------- sevimli serverlar kompyuter bo'yicha zaxirada (menyu keshi tozalansa yoki manzil o'zgarsa yo'qolmasin) ---------- */
case 'favs':
    $d = strtolower(p('d'));
    if (!preg_match('/^[a-z0-9]{8,40}$/', $d) || !is_file(XC_DIR . '/dev/' . $d . '.php')) fail('nolaunch', 'XCLauncher.exe topilmadi');
    lock();
    $o = rd('dev/' . $d, array());
    if (!dev_ok($d, $o)) fail('nolaunch', 'XCLauncher.exe topilmadi');
    if (p('set') !== '') {
        $in = json_decode(p('set'), true);
        if (!is_array($in)) fail('bad', 'bad');
        $fav = array();
        foreach ($in as $ip) if (is_string($ip) && preg_match('/^[a-z0-9.\-]{3,64}:\d{2,5}$/i', $ip) && !in_array($ip, $fav)) $fav[] = $ip;
        $o['fav'] = array_slice($fav, 0, 100);
        wr('dev/' . $d, $o);
    }
    out(array('ok' => true, 'fav' => isset($o['fav']) ? $o['fav'] : array()));

/* menyu: F10 videosi bilan amal - launcher o'yin paytida bajaradi (ochish / o'chirish / papka) */
case 'vcmd':
    $d = strtolower(p('d'));
    if (!preg_match('/^[a-z0-9]{8,40}$/', $d) || !is_file(XC_DIR . '/dev/' . $d . '.php')) fail('nolaunch', 'XCLauncher.exe topilmadi');
    lock();
    $o = rd('dev/' . $d, array());
    if (!dev_ok($d, $o)) fail('nolaunch', 'XCLauncher.exe topilmadi');
    $c = p('c'); $n = vid_name(p('n'));
    if (!in_array($c, array('open', 'del', 'folder', 'trim', 'clip', 'opt', 'edit', 'share'), true) || (in_array($c, array('open', 'del', 'trim', 'edit', 'share'), true) && $n === '')) fail('bad', 'bad');
    $tk = '';
    if ($c === 'share') {                                 // ulashish: faqat akkaunt bilan, kuniga 10 ta
        unlock(); $su = auth(); lock(); $o = rd('dev/' . $d, array());
        if (rl_count('share' . $su['login'], 86400) >= 10) fail('limit', 'Bugun 10 ta klip ulashildi - ertaga yana');
        rl_add('share' . $su['login'], 86400);
        $tk = function_exists('random_bytes') ? bin2hex(random_bytes(16)) : md5(uniqid(mt_rand(), true) . client_ip());
        $sh = rd('shares', array());
        foreach ($sh as $k => $x) if (time() - $x['t'] > 7200) { unset($sh[$k]); @unlink(XC_DIR . '/up/' . $k . '.part'); }
        $sh[$tk] = array('d' => $d, 'n' => $n, 'login' => $su['login'], 't' => time(), 'srv' => clean_str(p('srv'), 64));
        wr('shares', $sh);
        if (isset($o['vids'])) foreach ($o['vids'] as &$vx) if (isset($vx['n']) && $vx['n'] === $n) { $vx['sh'] = 'q'; $vx['sht'] = time(); }
        unset($vx);
    }
    $ta = max(0, min(86400, (int)p('ta'))); $tb = max(0, min(86400, (int)p('tb')));
    if ($c === 'trim' && $tb <= $ta) fail('bad', 'bad');
    if ($c === 'clip' && rl_count('vclip' . $d, 60) >= 3) out(array('ok' => true));   // avtomatik klip - daqiqasiga 3 tadan ko'p emas
    if ($c === 'clip') rl_add('vclip' . $d, 60);
    $q = isset($o['vc']) && is_array($o['vc']) ? $o['vc'] : array();
    $q[] = $c . ' ' . ($n !== '' ? $n : '-') . ($c === 'trim' ? ' ' . $ta . ' ' . $tb : '') . ($c === 'share' ? ' ' . $tk : '');
    $o['vc'] = array_slice($q, -5);
    if ($c === 'del' && isset($o['vids'])) $o['vids'] = array_values(array_filter($o['vids'], function ($x) use ($n) { return isset($x['n']) && $x['n'] !== $n; }));
    wr('dev/' . $d, $o);
    out(array('ok' => true, 'vids' => isset($o['vids']) ? $o['vids'] : array()));

/* menyu holati (kirish tokeni, sevimlilar, tarix, tugmalar, til) - kompyuter bo'yicha; o'yin brauzeri localStorage ni yo'qotsa tiklanadi */
case 'dstate':
    $d = strtolower(p('d'));
    if (!preg_match('/^[a-z0-9]{8,40}$/', $d) || !is_file(XC_DIR . '/dev/' . $d . '.php')) fail('nolaunch', 'XCLauncher.exe topilmadi');
    lock();
    $o = rd('dev/' . $d, array());
    if (!dev_ok($d, $o)) fail('nolaunch', 'XCLauncher.exe topilmadi');
    $st = isset($o['st']) && is_array($o['st']) ? $o['st'] : array();
    if (empty($st['fav']) && !empty($o['fav'])) $st['fav'] = $o['fav'];           // eski 'favs' zaxirasi
    if (p('set') !== '') {
        if (strlen(p('set')) > 40000) fail('big', 'big');
        $in = json_decode(p('set'), true);
        if (!is_array($in)) fail('bad', 'bad');
        $kv = function ($m) { $r = array(); if (is_array($m)) foreach ($m as $k => $v) if (is_string($k) && strlen($k) <= 40 && is_string($v) && strlen($v) <= 24) $r[$k] = $v; return $r ? $r : null; };
        $fav = array();
        foreach ((isset($in['fav']) && is_array($in['fav']) ? $in['fav'] : array()) as $ip) if (is_string($ip) && preg_match('/^[a-z0-9.\-]{3,64}:\d{2,5}$/i', $ip) && !in_array($ip, $fav)) $fav[] = $ip;
        $hist = array();
        foreach ((isset($in['hist']) && is_array($in['hist']) ? array_slice($in['hist'], 0, 50) : array()) as $h) if (is_array($h) && isset($h['ip']) && is_string($h['ip']) && preg_match('/^[a-z0-9.\-]{3,64}:\d{2,5}$/i', $h['ip']))
            $hist[] = array('ip' => $h['ip'], 'name' => clean_str(isset($h['name']) ? (string)$h['name'] : '', 64), 'map' => clean_str(isset($h['map']) ? (string)$h['map'] : '', 32),
                't' => (float)(isset($h['t']) ? $h['t'] : 0), 'd' => (int)(isset($h['d']) ? $h['d'] : 0), 'k' => (int)(isset($h['k']) ? $h['k'] : 0), 'x' => (int)(isset($h['x']) ? $h['x'] : 0));
        $tok = isset($in['token']) && is_string($in['token']) && preg_match('/^[a-f0-9]{40}$/', $in['token']) ? $in['token'] : '';
        $st = array('token' => $tok, 'fav' => array_slice($fav, 0, 100), 'hist' => $hist, 'binds' => $kv(isset($in['binds']) ? $in['binds'] : null), 'binds2' => $kv(isset($in['binds2']) ? $in['binds2'] : null),
            'lang' => isset($in['lang']) && is_string($in['lang']) && preg_match('/^[a-z]{2,3}$/', $in['lang']) ? $in['lang'] : '', 'wnSeen' => isset($in['wnSeen']) && is_string($in['wnSeen']) ? substr($in['wnSeen'], 0, 40) : '',
            'dnd' => empty($in['dnd']) ? 0 : 1, 'acx' => empty($in['acx']) ? 0 : 1, 'pxx' => isset($in['pxx']) ? (int)$in['pxx'] : 0);
        /* demolar ro'yxati (fayllar o'yin papkasida; menyu ularni o'zi ko'ra olmaydi) - o'yin brauzeri xotirasi tozalansa yo'qolmasin */
        $dm = array();
        foreach ((isset($in['demos']) && is_array($in['demos']) ? array_slice($in['demos'], 0, 40) : array()) as $x)
            if (is_array($x) && isset($x['n']) && is_string($x['n']) && preg_match('/^[\w\-]{1,40}$/', $x['n']))
                $dm[] = array('n' => $x['n'], 's' => clean_str(isset($x['s']) ? (string)$x['s'] : '', 64), 'm' => clean_str(isset($x['m']) ? (string)$x['m'] : '', 32), 't' => (float)(isset($x['t']) ? $x['t'] : 0));
        $st['demos'] = $dm;
        $o['st'] = $st;
        wr('dev/' . $d, $o);
    }
    out(array('ok' => true, 'st' => $st));

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
        if (rl_count('su' . client_ip(), 3600) >= 60) fail('limit', 'limit');   // bitta IP soatiga 60 ta rasm (diskni to'ldirmasin)
        rl_add('su' . client_ip(), 3600);
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
    if (rl_count('ss' . client_ip(), 3600) >= 60) out(array('ok' => true));
    rl_add('ss' . client_ip(), 3600);
    $in = json_decode(p('s'), true);
    if (!is_array($in)) fail('bad', 'bad');
    @date_default_timezone_set('Asia/Tashkent');
    $h = (int)date('G');
    lock();
    @mkdir(XC_DIR . '/stat', 0755, true);
    foreach (array_slice($in, 0, 40) as $x) {
        if (!is_array($x) || count($x) < 3 || !is_string($x[0]) || !preg_match('/^[\w.\-]+:\d+$/', $x[0])) continue;
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
