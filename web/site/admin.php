<?php
/* =====================================================================
 *  X CLIENT — admin panel (mmb.boost-top.com/admin.php)
 *  Statistika: NextClient (o'yin menyusini ochganlar) va X CLIENT (XClient.exe orqali kirganlar) alohida.
 *  Birinchi kirishda parol o'rnatiladi; buning uchun xc_data/ADMIN_KOD.php faylidagi kod kerak
 *  (FastPanel fayl menejerida oching - brauzerdan o'qib bo'lmaydi).
 * ===================================================================== */
session_start();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
@date_default_timezone_set('Asia/Tashkent');
define('XC_DIR', __DIR__ . '/xc_data');
define('XC_GUARD', "<?php exit; ?>\n");
define('NDIRECT', 'http://nextcs.boost-top.com/admin');

function rd($name, $def) {
    $f = XC_DIR . '/' . $name . '.php';
    if (!is_file($f)) return $def;
    $j = json_decode(substr((string)@file_get_contents($f), strlen(XC_GUARD)), true);
    return is_array($j) ? $j : $def;
}
function wr($name, $data) { @file_put_contents(XC_DIR . '/' . $name . '.php', XC_GUARD . json_encode($data), LOCK_EX); }
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function ago($t) {
    if (!$t) return '—';
    $d = time() - $t;
    if ($d < 120) return 'hozir';
    if ($d < 3600) return floor($d / 60) . ' daq oldin';
    if ($d < 86400) return floor($d / 3600) . ' soat oldin';
    return date('d.m.Y H:i', $t);
}
function csrf() { if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(function_exists('random_bytes') ? random_bytes(16) : openssl_random_pseudo_bytes(16)); return $_SESSION['csrf']; }
function csrf_ok() { return isset($_POST['csrf'], $_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $_POST['csrf']); }

@mkdir(XC_DIR, 0755, true);
$cfg = rd('admin', null);
$msg = '';

/* ---------- birinchi sozlash: kod + yangi parol ---------- */
if (!$cfg) {
    $kf = XC_DIR . '/ADMIN_KOD.php';
    if (!is_file($kf)) @file_put_contents($kf, XC_GUARD . "Admin panel kodi: " . str_pad((string)(function_exists('random_int') ? random_int(0, 99999999) : mt_rand(0, 99999999)), 8, '0', STR_PAD_LEFT) . "\n");
    preg_match('/(\d{8})/', (string)@file_get_contents($kf), $km);
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['code'], $_POST['pass'])) {
        if (!$km || !hash_equals($km[1], trim($_POST['code']))) $msg = 'Kod noto\'g\'ri';
        elseif (strlen($_POST['pass']) < 8) $msg = 'Parol kamida 8 belgi bo\'lsin';
        else { wr('admin', array('pass' => password_hash($_POST['pass'], PASSWORD_DEFAULT))); @unlink($kf); $_SESSION['adm'] = 1; header('Location: admin.php'); exit; }
    }
    page_head('Sozlash');
    echo '<div class="login"><h1><span>X</span> CLIENT admin</h1><p class="mut">Birinchi kirish. FastPanel\'da <b>mmb/xc_data/ADMIN_KOD.php</b> faylini oching - u yerdagi 8 xonali kodni yozing va panel parolini o\'ylab toping.</p>'
        . ($msg ? '<div class="err">' . h($msg) . '</div>' : '')
        . '<form method="post"><input name="code" placeholder="8 xonali kod" autocomplete="off"><input name="pass" type="password" placeholder="Yangi parol (8+ belgi)"><button>Saqlash va kirish</button></form></div>';
    page_foot(); exit;
}

/* ---------- kirish / chiqish ---------- */
if (isset($_GET['logout'])) { $_SESSION = array(); session_destroy(); header('Location: admin.php'); exit; }
if (empty($_SESSION['adm'])) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['pass'])) {
        if (password_verify($_POST['pass'], $cfg['pass'])) { session_regenerate_id(true); $_SESSION['adm'] = 1; header('Location: admin.php'); exit; }
        usleep(700000); $msg = 'Parol noto\'g\'ri';
    }
    page_head('Kirish');
    echo '<div class="login"><h1><span>X</span> CLIENT admin</h1>' . ($msg ? '<div class="err">' . h($msg) . '</div>' : '')
        . '<form method="post"><input name="pass" type="password" placeholder="Parol" autofocus><button>Kirish</button></form></div>';
    page_foot(); exit;
}

/* ---------- amallar (VIP berish/olish) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_ok() && isset($_POST['vip'])) {
    $l = strtolower(preg_replace('/[^A-Za-z0-9_]/', '', $_POST['vip']));
    $u = rd('users/' . $l, null);
    if ($u) { $u['vip'] = empty($u['vip']); wr('users/' . $l, $u); }
    header('Location: admin.php?t=players&q=' . urlencode(isset($_GET['q']) ? $_GET['q'] : '')); exit;
}

/* ---------- ma'lumotlar ---------- */
$tab = isset($_GET['t']) ? $_GET['t'] : 'stats';
$days = isset($_GET['d']) ? max(7, min(60, (int)$_GET['d'])) : 14;
$series = array();
for ($i = $days - 1; $i >= 0; $i--) {
    $ts = strtotime("-$i day");
    $x = rd('daily/' . date('Y-m-d', $ts), array('d' => array(), 'n' => array(), 'm' => array()));
    $series[] = array('l' => date('d.m', $ts), 'nc' => count((array)$x['m']), 'xc' => count((array)$x['d']), 'new' => count((array)$x['n']));
}
$today = end($series); $yest = $series[count($series) - 2];
$users = array(); $online = 0;
foreach ((array)glob(XC_DIR . '/users/*.php') as $f) {
    $u = rd('users/' . basename($f, '.php'), null);
    if (!$u) continue;
    if (!empty($u['seen']) && time() - $u['seen'] < 150) $online++;
    $users[] = $u;
}
$devs = array(); $vers = array(); $hwc = array('kuchsiz' => 0, "o'rtacha" => 0, 'kuchli' => 0, "noma'lum" => 0);
foreach ((array)glob(XC_DIR . '/dev/*.php') as $f) {
    $id = basename($f, '.php'); $o = rd('dev/' . $id, array());
    $o['id'] = $id; $devs[] = $o;
    $v = !empty($o['ver']) ? $o['ver'] : '?'; $vers[$v] = (isset($vers[$v]) ? $vers[$v] : 0) + 1;
    if (empty($o['hw'])) $hwc["noma'lum"]++;
    else {
        $hw = $o['hw']; $weak = preg_match('/intel.*(hd|gma|uhd)|sis |via /i', $hw['gpu']);
        if ($hw['ram'] < 3500 || $hw['cpu'] <= 2 || ($weak && $hw['ram'] < 6000)) $hwc['kuchsiz']++;
        elseif ($hw['ram'] >= 8000 && $hw['cpu'] >= 4 && !$weak) $hwc['kuchli']++;
        else $hwc["o'rtacha"]++;
    }
}
arsort($vers);

function trend($a, $b) {
    $d = $a - $b;
    if ($d > 0) return '<span class="up">' . $d . ' ko\'p, kechagidan ↗</span>';
    if ($d < 0) return '<span class="dn">' . (-$d) . ' kam, kechagidan ↘</span>';
    return '<span class="mut">kechagidek</span>';
}

page_head('Statistika');
echo '<div class="top"><div class="brand"><span>X</span> CLIENT <small>admin</small></div><div class="nav">'
    . '<a href="?t=stats" class="' . ($tab === 'stats' ? 'on' : '') . '">Statistika</a>'
    . '<a href="?t=players" class="' . ($tab === 'players' ? 'on' : '') . '">O\'yinchilar <em>' . count($users) . '</em></a>'
    . '<a href="?t=devs" class="' . ($tab === 'devs' ? 'on' : '') . '">Kompyuterlar <em>' . count($devs) . '</em></a>'
    . '<a href="' . NDIRECT . '" target="_blank">NextClient (nDirect) ↗</a>'
    . '<a href="?logout=1" class="out">Chiqish</a></div></div><div class="wrap">';

if ($tab === 'stats') {
    echo '<div class="cards">'
        . '<div class="card nc"><b>' . $today['nc'] . '</b><span>NextClient o\'yinchilar bugun</span>' . trend($today['nc'], $yest['nc']) . '</div>'
        . '<div class="card xc"><b>' . $today['xc'] . '</b><span>X CLIENT o\'yinchilar bugun</span>' . trend($today['xc'], $yest['xc']) . '</div>'
        . '<div class="card"><b>' . $today['new'] . '</b><span>Yangi o\'rnatishlar bugun</span>' . trend($today['new'], $yest['new']) . '</div>'
        . '<div class="card"><b>' . $online . '</b><span>Onlayn (akkaunt bilan)</span><span class="mut">hozir menyuda yoki serverda</span></div>'
        . '<div class="card"><b>' . count($users) . '</b><span>Jami akkauntlar</span><span class="mut">X CLIENT ro\'yxatdan o\'tganlar</span></div>'
        . '<div class="card"><b>' . count($devs) . '</b><span>Jami X CLIENT o\'rnatishlar</span><span class="mut">XClient.exe kompyuterlar</span></div></div>';
    // grafik: har kun uchun 2 ustun
    $max = 1; foreach ($series as $s) $max = max($max, $s['nc'], $s['xc']);
    $step = $max <= 5 ? 1 : ($max <= 12 ? 2 : ceil($max / 6));
    $top = ceil($max / $step) * $step;
    $W = 1100; $H = 300; $L = 40; $B = 26; $cw = ($W - $L) / count($series); $bw = min(26, $cw * 0.32);
    $svg = '';
    for ($v = 0; $v <= $top; $v += $step) { $y = $H - $B - ($H - $B - 10) * $v / $top; $svg .= '<line x1="' . $L . '" x2="' . $W . '" y1="' . $y . '" y2="' . $y . '" class="g"/><text x="' . ($L - 10) . '" y="' . ($y + 4) . '" class="ax" text-anchor="end">' . $v . '</text>'; }
    foreach ($series as $i => $s) {
        $cx = $L + $cw * $i + $cw / 2;
        foreach (array(array('nc', 'NextClient', -$bw - 2), array('xc', 'X CLIENT', 2)) as $k) {
            $hgt = ($H - $B - 10) * $s[$k[0]] / $top; $y = $H - $B - $hgt;
            if ($s[$k[0]] > 0) $svg .= '<rect class="b ' . $k[0] . '" x="' . ($cx + $k[2]) . '" y="' . $y . '" width="' . $bw . '" height="' . max(2, $hgt) . '" rx="3" data-v="' . $s[$k[0]] . '" data-l="' . $s['l'] . ' · ' . $k[1] . '"/>';
        }
        if ($i % max(1, round(count($series) / 8)) === 0 || $i === count($series) - 1) $svg .= '<text x="' . $cx . '" y="' . ($H - 6) . '" class="ax" text-anchor="middle">' . $s['l'] . '</text>';
    }
    echo '<div class="panel"><div class="ph">O\'yinchilar grafigi <span class="lg"><i class="nc"></i>NextClient <i class="xc"></i>X CLIENT</span>'
        . '<span class="rng">' . implode('', array_map(function ($d) use ($days) { return '<a href="?d=' . $d . '" class="' . ($d == $days ? 'on' : '') . '">' . $d . ' kun</a>'; }, array(7, 14, 30))) . '</span></div>'
        . '<div class="chart"><svg viewBox="0 0 ' . $W . ' ' . $H . '" preserveAspectRatio="none">' . $svg . '</svg><div id="tip"></div></div>'
        . '<div class="mut small">NextClient — o\'yin menyusini ochgan barcha kompyuterlar (kuniga bir marta). X CLIENT — o\'yinni XClient.exe orqali ochganlar. To\'liq NextClient statistikasi: <a href="' . NDIRECT . '" target="_blank">nDirect</a>.</div></div>';
    echo '<div class="two"><div class="panel"><div class="ph">X CLIENT versiyalari</div><table>';
    foreach (array_slice($vers, 0, 8, true) as $v => $n) echo '<tr><td>v' . h($v) . '</td><td class="r">' . $n . '</td></tr>';
    echo '</table></div><div class="panel"><div class="ph">Kompyuterlar quvvati</div><table>';
    foreach ($hwc as $k => $n) echo '<tr><td>' . h($k) . '</td><td class="r">' . $n . '</td></tr>';
    echo '</table></div></div>';
} elseif ($tab === 'players') {
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    usort($users, function ($a, $b) { return (isset($b['seen']) ? $b['seen'] : 0) - (isset($a['seen']) ? $a['seen'] : 0); });
    echo '<div class="panel"><form class="srch"><input type="hidden" name="t" value="players"><input name="q" value="' . h($q) . '" placeholder="Login yoki nom..."><button>Qidirish</button></form>'
        . '<table class="list"><tr><th>Login</th><th>Nom</th><th>ID</th><th>Daraja</th><th>Oxirgi faollik</th><th>Server</th><th>VIP</th></tr>';
    $n = 0;
    foreach ($users as $u) {
        if ($q !== '' && stripos($u['login'] . ' ' . $u['name'], $q) === false) continue;
        if (++$n > 300) break;
        $on = !empty($u['seen']) && time() - $u['seen'] < 150;
        echo '<tr><td>' . ($on ? '<i class="dot"></i>' : '') . h($u['login']) . '</td><td>' . h($u['name']) . '</td><td class="mut">' . h($u['id']) . '</td><td>' . ((int)floor($u['xp'] / 1000) + 1) . '</td>'
            . '<td>' . ago(isset($u['seen']) ? $u['seen'] : 0) . '</td><td class="mut">' . h($on && !empty($u['server']) ? $u['server'] : '') . '</td>'
            . '<td><form method="post"><input type="hidden" name="csrf" value="' . csrf() . '"><input type="hidden" name="vip" value="' . h($u['login']) . '"><button class="tg ' . (!empty($u['vip']) ? 'on' : '') . '">' . (!empty($u['vip']) ? 'VIP' : '—') . '</button></form></td></tr>';
    }
    echo '</table></div>';
} else {
    usort($devs, function ($a, $b) { return (isset($b['seen']) ? $b['seen'] : 0) - (isset($a['seen']) ? $a['seen'] : 0); });
    echo '<div class="panel"><table class="list"><tr><th>Kompyuter</th><th>Versiya</th><th>RAM / CPU</th><th>Videokarta</th><th>O\'rnatilgan</th><th>Oxirgi ishga tushirish</th></tr>';
    foreach (array_slice($devs, 0, 300) as $o) {
        $hw = isset($o['hw']) ? $o['hw'] : null;
        echo '<tr><td class="mut">' . h(substr($o['id'], 0, 10)) . '…</td><td>v' . h(isset($o['ver']) ? $o['ver'] : '?') . '</td><td>' . ($hw ? round($hw['ram'] / 1024) . ' GB / ' . (int)$hw['cpu'] : '—') . '</td>'
            . '<td>' . h($hw ? $hw['gpu'] : '') . '</td><td>' . (!empty($o['first']) ? date('d.m.Y', $o['first']) : '—') . '</td><td>' . ago(isset($o['seen']) ? $o['seen'] : 0) . '</td></tr>';
    }
    echo '</table></div>';
}
echo '</div>';
page_foot();

function page_head($t) {
    echo '<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>X CLIENT admin · ' . h($t) . '</title><style>
*{box-sizing:border-box}body{margin:0;background:#15171c;color:#e6e8ee;font:14px/1.45 "Segoe UI",Tahoma,Arial,sans-serif}a{color:#8ab4ff;text-decoration:none}
.mut{color:#8b90a0}.small{font-size:12px;margin-top:8px}.r{text-align:right}
.top{display:flex;align-items:center;gap:20px;padding:14px 24px;background:#1c1f26;border-bottom:1px solid #2a2e38;flex-wrap:wrap}
.brand{font:900 20px "Arial Black",Arial;letter-spacing:2px}.brand span,h1 span{color:#ff3b3b}.brand small{font:12px Tahoma;color:#8b90a0;letter-spacing:0}
.nav{display:flex;gap:6px;flex-wrap:wrap}.nav a{padding:8px 14px;border-radius:8px;color:#c9cdd8}.nav a.on{background:#2a2e38;color:#fff}.nav a em{font-style:normal;font-size:11px;background:#3a3f4c;border-radius:9px;padding:1px 7px;margin-left:4px}.nav a.out{color:#ff7a7a}
.wrap{max-width:1200px;margin:0 auto;padding:22px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:18px}
.card{background:#1c1f26;border:1px solid #2a2e38;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:4px}.card b{font-size:30px;line-height:34px}.card span{font-size:13px}
.card.nc{border-color:#2f5fa8}.card.nc b{color:#4a90e2}.card.xc{border-color:#7a2f8f}.card.xc b{color:#c84bdc}
.up{color:#3ccf8e}.dn{color:#f5a623}
.panel{background:#1c1f26;border:1px solid #2a2e38;border-radius:12px;padding:18px;margin-bottom:18px;overflow:auto}
.ph{font-weight:600;font-size:15px;margin-bottom:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.lg{font-weight:400;font-size:12px;color:#aab}.lg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 5px 0 10px}i.nc{background:#3d86df}i.xc{background:#c84bdc}
.rng{margin-left:auto}.rng a{font-weight:400;font-size:12px;padding:4px 10px;border-radius:6px;color:#aab}.rng a.on{background:#2a2e38;color:#fff}
.chart{position:relative}.chart svg{width:100%;height:300px;display:block}.g{stroke:#2a2e38;stroke-dasharray:3 4}.ax{fill:#6f7585;font-size:11px}
.b.nc{fill:#3d86df}.b.xc{fill:#c84bdc}.b:hover{stroke:#fff;stroke-width:1.5}
#tip{position:absolute;display:none;pointer-events:none;background:#23262e;border:1px solid #3a3f4c;border-radius:8px;padding:6px 10px;font-size:13px;white-space:nowrap}#tip b{font-size:16px;margin-right:6px}#tip i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:700px){.two{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse}td,th{padding:8px 10px;border-bottom:1px solid #262a33;text-align:left}th{color:#8b90a0;font-weight:500;font-size:12px}
.list td{white-space:nowrap}.dot{display:inline-block;width:8px;height:8px;border-radius:4px;background:#3ccf8e;margin-right:6px}
.tg{background:#262a33;border:1px solid #3a3f4c;color:#aab;border-radius:6px;padding:3px 10px;cursor:pointer}.tg.on{background:#7a5a10;border-color:#d6a520;color:#ffd24a}
.srch{display:flex;gap:8px;margin-bottom:12px}.srch input,.login input{flex:1;background:#15171c;border:1px solid #3a3f4c;color:#fff;border-radius:8px;padding:9px 12px;font-size:14px}
button{background:#ff3b3b;border:0;color:#fff;border-radius:8px;padding:9px 16px;font-size:14px;cursor:pointer}
.login{max-width:380px;margin:12vh auto;background:#1c1f26;border:1px solid #2a2e38;border-radius:14px;padding:26px}.login h1{font:900 24px "Arial Black",Arial;margin:0 0 10px}.login form{display:flex;flex-direction:column;gap:10px;margin-top:14px}
.err{background:#4a1b1f;color:#ff9a9a;border-radius:8px;padding:8px 12px;margin-top:10px}
</style></head><body>';
}
function page_foot() {
    echo '<script>(function(){var t=document.getElementById("tip");if(!t)return;var c=t.parentNode;
c.addEventListener("mousemove",function(e){var r=e.target;if(!r.getAttribute||!r.getAttribute("data-v")){t.style.display="none";return;}
var b=c.getBoundingClientRect();t.innerHTML="<i style=\"background:"+getComputedStyle(r).fill+"\"></i><b>"+r.getAttribute("data-v")+"</b>"+r.getAttribute("data-l");
t.style.display="block";t.style.left=(e.clientX-b.left+12)+"px";t.style.top=(e.clientY-b.top-40)+"px";});
c.addEventListener("mouseleave",function(){t.style.display="none";});})();</script></body></html>';
}
