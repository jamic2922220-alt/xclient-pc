<?php
/* =====================================================================
 *  Server so'rovi (A2S_INFO + A2S_PLAYER, GoldSrc/ReHLDS challenge bilan) - sayt tomonidan.
 *  1) Menyu zaxirasi: NextClient so'rovi javobsiz qolsa  srvq.php?ip=1.2.3.4:27015  -> JSON
 *  2) Diagnostika:  srvq.php?ip=1.2.3.4:27015&diag=1  -> serverni 5 marta so'rab, har javobni ko'rsatadi
 * ===================================================================== */
header('Access-Control-Allow-Origin: *');
$ip = isset($_GET['ip']) ? trim((string)$_GET['ip']) : '';
$diag = !empty($_GET['diag']) || $ip === '';
if ($diag) {                                              // tekshiruv sahifasi: manzil yozadigan maydon
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta name="viewport" content="width=device-width"><title>Server tekshiruvi</title><style>body{font:15px system-ui;background:#111;color:#eee;padding:16px;max-width:900px;margin:auto}td,th{padding:4px 10px;border-bottom:1px solid #333;text-align:left}.ok{color:#5d5}.no{color:#f66}input{font-size:17px;padding:9px 12px;width:260px;background:#222;color:#fff;border:1px solid #555;border-radius:8px}button{font-size:17px;padding:9px 18px;background:#e33;color:#fff;border:0;border-radius:8px;cursor:pointer}</style>'
        . '<h1>Server tekshiruvi</h1><form><input name="ip" value="' . htmlspecialchars($ip) . '" placeholder="212.47.58.40:27015" autofocus> <input type="hidden" name="diag" value="1"><button>Tekshirish</button></form>';
    if ($ip === '') exit;
    if (!preg_match('/^\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}$/', $ip)) { echo '<p class="no">Manzil noto\'g\'ri. Shunday yozing: <b>212.47.58.40:27015</b> (IP, ikki nuqta, port)</p>'; exit; }
}
if (!preg_match('/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})$/', $ip, $m) || preg_match('/^(10|127|0|192\.168|172\.(1[6-9]|2\d|3[01]))\./', $m[1])) {
    header('Content-Type: application/json'); echo '{"ok":false,"err":"bad ip"}'; exit;
}
$host = $m[1]; $port = (int)$m[2];

/* bitta UDP so'rov: javob (yoki null) va ms */
function udp($host, $port, $pkt, $to = 1.5) {
    $s = @fsockopen('udp://' . $host, $port, $en, $es, $to);
    if (!$s) return array(null, 0, 'socket: ' . $es);
    stream_set_timeout($s, (int)$to, (int)(($to - (int)$to) * 1e6));
    $t = microtime(true); @fwrite($s, $pkt); $r = @fread($s, 4096); $ms = (int)round((microtime(true) - $t) * 1000);
    fclose($s);
    return array($r === false || $r === '' ? null : $r, $ms, $r === false || $r === '' ? 'javob yo\'q (timeout)' : '');
}
function cstr($d, &$o) { $e = strpos($d, "\0", $o); if ($e === false) $e = strlen($d); $s = substr($d, $o, $e - $o); $o = $e + 1; return $s; }

function info($host, $port, &$log) {
    $q = "\xFF\xFF\xFF\xFFTSource Engine Query\0";
    list($r, $ms, $err) = udp($host, $port, $q); $log[] = array('INFO', $ms, $r === null ? $err : 'javob ' . strlen($r) . ' bayt, turi 0x' . bin2hex($r[4]));
    if ($r !== null && $r[4] === 'A') {                       // challenge talab qilindi - qayta so'raymiz
        list($r, $ms2, $err) = udp($host, $port, $q . substr($r, 5, 4)); $ms += $ms2;
        $log[] = array('INFO+challenge', $ms2, $r === null ? $err : 'javob ' . strlen($r) . ' bayt, turi 0x' . bin2hex($r[4]));
    }
    if ($r === null || strlen($r) < 6) return null;
    $o = 5; $t = $r[4];
    if ($t === 'I') {                                         // yangi format
        $o++; $name = cstr($r, $o); $map = cstr($r, $o); cstr($r, $o); cstr($r, $o); $o += 2;
        return array('name' => $name, 'map' => $map, 'pl' => ord($r[$o]), 'max' => ord($r[$o + 1]), 'bots' => ord($r[$o + 2]), 'ms' => $ms);
    }
    if ($t === 'm') {                                         // eski GoldSrc formati
        cstr($r, $o); $name = cstr($r, $o); $map = cstr($r, $o); cstr($r, $o); cstr($r, $o);
        return array('name' => $name, 'map' => $map, 'pl' => ord($r[$o]), 'max' => ord($r[$o + 1]), 'bots' => 0, 'ms' => $ms);
    }
    return null;
}
function players($host, $port, &$log) {
    list($r, $ms, $err) = udp($host, $port, "\xFF\xFF\xFF\xFFU\xFF\xFF\xFF\xFF"); $log[] = array('PLAYERS (challenge)', $ms, $r === null ? $err : 'turi 0x' . bin2hex($r[4]));
    if ($r === null) return null;
    if ($r[4] === 'A') { list($r, $ms, $err) = udp($host, $port, "\xFF\xFF\xFF\xFFU" . substr($r, 5, 4)); $log[] = array('PLAYERS', $ms, $r === null ? $err : 'javob ' . strlen($r) . ' bayt'); }
    if ($r === null || $r[4] !== 'D') return null;
    $n = ord($r[5]); $o = 6; $out = array();
    for ($i = 0; $i < $n && $o < strlen($r); $i++) {
        $o++; $nm = cstr($r, $o);
        if ($o + 8 > strlen($r)) break;
        $sc = unpack('l', substr($r, $o, 4)); $tm = unpack('f', substr($r, $o + 4, 4)); $o += 8;
        if ($nm !== '') $out[] = array('name' => $nm, 'score' => $sc[1], 'time' => (int)$tm[1]);
    }
    return $out;
}

if (!$diag) {
    header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: max-age=10');
    $log = array(); $i = info($host, $port, $log);
    if (!$i) { echo '{"ok":false}'; exit; }
    $p = players($host, $port, $log);
    $i['ok'] = true; $i['players'] = $p === null ? null : $p;
    echo json_encode($i); exit;
}

echo '<h2>' . htmlspecialchars($ip) . '</h2>';
$okN = 0;
for ($k = 1; $k <= 5; $k++) {
    $log = array(); $i = info($host, $port, $log); $p = $i ? players($host, $port, $log) : null;
    if ($i) $okN++;
    echo '<h3>' . $k . '-urinish: ' . ($i ? '<span class="ok">javob bor</span> · ' . htmlspecialchars($i['name']) . ' · ' . htmlspecialchars($i['map']) . ' · <b>' . $i['pl'] . '/' . $i['max'] . '</b>' . ($p !== null ? ' · ro\'yxatda ' . count($p) . ' o\'yinchi' : ' · <span class="no">o\'yinchilar ro\'yxati kelmadi</span>') : '<span class="no">server javob bermadi</span>') . '</h3><table>';
    foreach ($log as $l) echo '<tr><td>' . $l[0] . '</td><td>' . $l[1] . ' ms</td><td>' . htmlspecialchars($l[2]) . '</td></tr>';
    echo '</table>';
    usleep(700000);
}
echo '<h2>Natija: 5 tadan ' . $okN . ' ta javob</h2><p>' . ($okN === 5 ? 'Server barqaror javob beryapti.' : ($okN === 0 ? 'Server umuman javob bermayapti (o\'chiq, yoki so\'rovlar firewall/himoya plagini bilan to\'silgan).' : 'Server ba\'zan javob beradi, ba\'zan yo\'q - bu serverning o\'zida: so\'rovlarni cheklovchi himoya (query limit, DDoS himoya) yoki tarmoq yo\'qotishlari. Server egasi buni sozlashi kerak.')) . '</p>';
