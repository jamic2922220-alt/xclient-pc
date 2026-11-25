<?php
/* =====================================================================
 *  X CLIENT — iPhone (mmb.boost-top.com/ios.php)
 *   ios.php              - o'yinchi sahifasi: 1) iPhone ni ro'yxatga yozish  2) o'yinni o'rnatish
 *   ios.php?a=cfg&n=NIK  - Safari ga "profil" beriladi: iPhone o'z raqamini (UDID) shu faylga yuboradi
 *   ios.php?a=udid       - iPhone UDID ni shu yerga POST qiladi (Apple "Profile Service")
 *   ios.php?a=manifest   - "havola orqali o'rnatish" (itms-services) uchun manifest
 *  UDID lar xc_data/ios/devices.php da. Admin panel > iPhone: Apple Developer ga yuklash uchun ro'yxat (txt).
 *  O'rnatiladigan fayl: mobile/X-CLIENT.ipa (Apple sertifikati bilan imzolangan; faqat ro'yxatdagi iPhone larga o'rnatiladi)
 * ===================================================================== */
define('XC_DIR', __DIR__ . '/xc_data');
define('XC_GUARD', "<?php exit; ?>\n");
define('IOS_BUNDLE', 'uz.cssborka.xclient');
function rd($name, $def) {
    $f = XC_DIR . '/' . $name . '.php';
    if (!is_file($f)) return $def;
    $j = json_decode(substr((string)@file_get_contents($f), strlen(XC_GUARD)), true);
    return is_array($j) ? $j : $def;
}
function wr($name, $data) {
    @mkdir(dirname(XC_DIR . '/' . $name), 0755, true);
    $j = json_encode($data); if ($j === false) return false;
    $f = XC_DIR . '/' . $name . '.php'; $tmp = $f . '.' . mt_rand() . '.tmp';
    if (@file_put_contents($tmp, XC_GUARD . $j, LOCK_EX) === false) { @unlink($tmp); return false; }
    return @rename($tmp, $f);
}
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function x($s) { return htmlspecialchars((string)$s, ENT_XML1 | ENT_QUOTES, 'UTF-8'); }
function base_url() {
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
    return 'https://' . preg_replace('/[^A-Za-z0-9.\-:]/', '', $_SERVER['HTTP_HOST']) . $dir . '/';
}
function nick_clean($n) { $n = preg_replace('/[^\p{L}\p{N} _\-\.\[\]|]/u', '', (string)$n); return function_exists('mb_substr') ? mb_substr(trim($n), 0, 24, 'UTF-8') : substr(trim($n), 0, 24); }
function ipa_ver() { $v = trim((string)@file_get_contents(__DIR__ . '/mobile/ios_ver.txt')); return preg_match('/^[0-9.]{1,12}$/', $v) ? $v : '1.0'; }
$a = isset($_GET['a']) ? $_GET['a'] : '';

/* ---------- 1) profil: iPhone o'z UDID sini bizga yuboradi ---------- */
if ($a === 'cfg') {
    $n = nick_clean(isset($_GET['n']) ? $_GET['n'] : '');
    $uuid = strtoupper(sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0x4000, 0x4fff), mt_rand(0x8000, 0xbfff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)));
    $url = base_url() . 'ios.php?a=udid&n=' . rawurlencode($n);
    header('Content-Type: application/x-apple-aspen-config');
    header('Content-Disposition: attachment; filename="xclient-iphone.mobileconfig"');
    header('Cache-Control: no-store');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
        . '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' . "\n"
        . '<plist version="1.0"><dict>'
        . '<key>PayloadContent</key><dict><key>URL</key><string>' . x($url) . '</string>'
        . '<key>DeviceAttributes</key><array><string>UDID</string><string>PRODUCT</string><string>VERSION</string><string>DEVICE_NAME</string></array></dict>'
        . '<key>PayloadOrganization</key><string>X CLIENT</string>'
        . '<key>PayloadDisplayName</key><string>X CLIENT - iPhone ro\'yxati</string>'
        . '<key>PayloadDescription</key><string>iPhone raqami (UDID) X CLIENT ga yuboriladi - o\'yinni o\'rnatish uchun. Telefonga hech narsa o\'rnatilmaydi.</string>'
        . '<key>PayloadVersion</key><integer>1</integer>'
        . '<key>PayloadUUID</key><string>' . $uuid . '</string>'
        . '<key>PayloadIdentifier</key><string>uz.cssborka.xclient.udid</string>'
        . '<key>PayloadType</key><string>Profile Service</string>'
        . '</dict></plist>';
    exit;
}

/* ---------- 2) iPhone UDID ni yubordi ---------- */
if ($a === 'udid') {
    $body = (string)file_get_contents('php://input', false, null, 0, 65536);    // imzolangan plist (PKCS7) - ichida ochiq XML bor
    $get = function ($k) use ($body) { return preg_match('#<key>' . $k . '</key>\s*<string>([^<]{1,80})</string>#', $body, $m) ? $m[1] : ''; };
    $udid = strtoupper($get('UDID'));
    if (!preg_match('/^([0-9A-F]{8}-[0-9A-F]{16}|[0-9A-F]{40})$/', $udid)) { header('Location: ' . base_url() . 'ios.php?err=1', true, 301); exit; }
    $n = nick_clean(isset($_GET['n']) ? $_GET['n'] : '');
    $prod = preg_replace('/[^A-Za-z0-9,]/', '', $get('PRODUCT')); $ver = preg_replace('/[^0-9.A-Za-z]/', '', $get('VERSION'));
    $dn = nick_clean($get('DEVICE_NAME'));
    $db = rd('ios/devices', array());
    $new = !isset($db[$udid]);
    if ($new && count($db) >= 2000) { header('Location: ' . base_url() . 'ios.php?err=2', true, 301); exit; }
    $o = $new ? array('t' => time(), 'ok' => 0) : $db[$udid];
    $o['n'] = $n !== '' ? $n : (isset($o['n']) ? $o['n'] : ''); $o['p'] = $prod; $o['v'] = $ver; $o['dn'] = $dn; $o['seen'] = time();
    $o['ip'] = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    $db[$udid] = $o; wr('ios/devices', $db);
    header('Location: ' . base_url() . 'ios.php?ok=' . substr(md5($udid), 0, 10), true, 301);   // Apple faqat 301 ni kutadi
    exit;
}

/* ---------- 3) o'rnatish manifesti ---------- */
if ($a === 'manifest') {
    header('Content-Type: application/xml; charset=utf-8'); header('Cache-Control: no-store');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
        . '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' . "\n"
        . '<plist version="1.0"><dict><key>items</key><array><dict>'
        . '<key>assets</key><array><dict><key>kind</key><string>software-package</string><key>url</key><string>' . x(base_url() . 'mobile/X-CLIENT.ipa?v=' . ipa_ver()) . '</string></dict>'
        . '<dict><key>kind</key><string>display-image</string><key>url</key><string>' . x(base_url() . 'logo.png') . '</string></dict>'
        . '<dict><key>kind</key><string>full-size-image</string><key>url</key><string>' . x(base_url() . 'logo_big.png') . '</string></dict></array>'
        . '<key>metadata</key><dict><key>bundle-identifier</key><string>' . IOS_BUNDLE . '</string><key>bundle-version</key><string>' . x(ipa_ver()) . '</string>'
        . '<key>kind</key><string>software</string><key>title</key><string>X CLIENT</string></dict>'
        . '</dict></array></dict></plist>';
    exit;
}

/* ---------- o'yinchi sahifasi ----------
 * Bepul rejim (hozir): imzosiz mobile/X-CLIENT-ios.ipa yuklab olinadi, o'yinchi o'zi o'rnatadi (Sideloadly - kompyuter orqali).
 * Pullik rejim (Apple Developer akkaunt bo'lsa): imzolangan mobile/X-CLIENT.ipa bor bo'lsa - UDID ro'yxati + havola orqali o'rnatish */
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store');
$signed = is_file(__DIR__ . '/mobile/X-CLIENT.ipa');
$free = __DIR__ . '/mobile/X-CLIENT-ios.ipa';
$freeOk = is_file($free);
$fv = trim((string)@file_get_contents(__DIR__ . '/mobile/ios_free_ver.txt')); if (!preg_match('/^[0-9.]{1,12}$/', $fv)) $fv = '';
$install = 'itms-services://?action=download-manifest&url=' . rawurlencode(base_url() . 'ios.php?a=manifest');
?><!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>X CLIENT - iPhone</title>
<style>
:root{--bg:#0e0f13;--card:#181a21;--fg:#f2f2f5;--mut:#9a9caa;--red:#e5383b;--ok:#3ccf6e;--warn:#f5c518;--line:#2a2d38}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,system-ui,Segoe UI,Roboto,sans-serif}
.w{max-width:560px;margin:0 auto;padding:24px max(16px,env(safe-area-inset-left)) 40px}
h1{font-size:26px;margin:8px 0 4px}h1 span{color:var(--red)}.mut{color:var(--mut);font-size:14px}
.c{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin:16px 0}
.c h2{font-size:18px;margin:0 0 10px}.n{display:inline-flex;width:26px;height:26px;border-radius:50%;background:var(--red);align-items:center;justify-content:center;font-weight:700;font-size:14px;margin-right:8px}
ol{padding-left:20px;margin:8px 0}li{margin:5px 0}a{color:#ff6b6e}
input{width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:#0b0c10;color:var(--fg);font-size:16px;margin:8px 0}
.b{display:block;text-align:center;background:var(--red);color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:12px;border:0;width:100%;font-size:17px}
.b.g{background:#2a2d38}.ok{border-color:var(--ok)}.ok h2{color:var(--ok)}.bad{border-color:var(--red)}.warn{border-color:var(--warn)}.warn h2{color:var(--warn)}
</style></head><body><div class="w">
<h1><span>X</span> CLIENT · iPhone</h1>
<div class="mut">CS 1.6 iPhone uchun<?php echo $fv ? ' · versiya ' . h($fv) : ''; ?> · bepul</div>
<?php if ($signed): ?>
<?php if (isset($_GET['ok'])): ?>
<div class="c ok"><h2>✓ iPhone qabul qilindi</h2><div>Ro'yxatga qo'shilgach, quyidagi «O'yinni o'rnatish» tugmasi ishlaydi.</div></div>
<?php endif; ?>
<div class="c"><h2><span class="n">1</span>iPhone ni ro'yxatga yozish</h2>
<form method="get" action="ios.php"><input type="hidden" name="a" value="cfg"><input name="n" maxlength="24" placeholder="O'yindagi nikingiz" autocomplete="off" required>
<button class="b" type="submit">Ro'yxatga yozish</button></form>
<div class="mut">Safari da oching → «Ruxsat berish» → Sozlamalar → «Profil yuklandi» → «O'rnatish».</div></div>
<div class="c"><h2><span class="n">2</span>O'yinni o'rnatish (kompyutersiz)</h2><a class="b" href="<?php echo h($install); ?>">O'yinni o'rnatish</a>
<div class="mut" style="margin-top:8px">«O'rnatib bo'lmadi» desa - iPhone hali ro'yxatda emas.</div></div>
<?php endif; ?>
<div class="c"><h2><span class="n"><?php echo $signed ? '3' : '1'; ?></span>iPhone faylini yuklab olish</h2>
<?php if ($freeOk): ?>
<a class="b" href="mobile/X-CLIENT-ios.ipa<?php echo $fv ? '?v=' . h($fv) : ''; ?>" download>X-CLIENT.ipa yuklab olish (<?php echo round(filesize($free) / 1048576); ?> MB)</a>
<div class="mut" style="margin-top:8px">Bu fayl telefonga to'g'ridan-to'g'ri o'rnatilmaydi - Apple qoidasi bo'yicha uni o'z Apple ID ingiz bilan «imzolash» kerak. Quyidagi yo'l bepul.</div>
<?php else: ?>
<a class="b g">Tez orada</a>
<?php endif; ?>
</div>
<div class="c"><h2><span class="n"><?php echo $signed ? '4' : '2'; ?></span>O'rnatish (bepul, kompyuter orqali)</h2>
<ol>
<li>Kompyuterga <b>Sideloadly</b> ni o'rnating: <a href="https://sideloadly.io" target="_blank" rel="noopener">sideloadly.io</a> (Windows yoki Mac). Windows da <b>iTunes</b> ham kerak - apple.com saytidagisini o'rnating (Microsoft Store dagisi emas).</li>
<li>iPhone ni kabel bilan kompyuterga ulang, telefonda «Ishonish» ni bosing.</li>
<li>Sideloadly ni oching, <b>X-CLIENT.ipa</b> faylini oynaga tashlang.</li>
<li>«Apple account» ga o'z Apple ID (pochta) ingizni yozing → <b>Start</b>. Parolni faqat Sideloadly so'raganda, o'sha oynaga yozing.</li>
<li>iPhone da: Sozlamalar → Umumiy → <b>VPN va qurilma boshqaruvi</b> → Apple ID ingiz → «Ishonish».</li>
<li>iOS 16 va yangi: Sozlamalar → Maxfiylik va xavfsizlik → <b>Developer Mode</b> → yoqing (telefon qayta yonadi).</li>
<li>X CLIENT ni oching - birinchi marta o'yin fayllari yuklanadi (~280 MB, Wi-Fi tavsiya), keyin o'yin o'zi boshlanadi.</li>
</ol>
<div class="mut">Bepul Apple ID bilan o'yin <b>7 kun</b> ishlaydi. Keyin iPhone ni yana ulab, Sideloadly da qayta «Start» bosing - o'yin va sozlamalar saqlanib qoladi.</div>
</div>
<div class="c warn"><h2>⚠ Telefonning o'zida o'rnatish (ESign, Scarlet va h.k.)</h2>
<div class="mut">Ba'zi o'yinchilar bu faylni shunday ilovalar orqali kompyutersiz o'rnatadi. Ular boshqa kompaniyalarning sertifikatlaridan foydalanadi: Apple ularni tez-tez bloklaydi, o'yin birdan ochilmay qolishi mumkin, shaxsiy ma'lumotlar uchun ham xavfli. X CLIENT bunga kafolat bermaydi - o'z xavfingizga.</div>
</div>
</div></body></html>
