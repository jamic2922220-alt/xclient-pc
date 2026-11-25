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

/* ---------- o'yinchi sahifasi ---------- */
header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store');
$ipa = is_file(__DIR__ . '/mobile/X-CLIENT.ipa');
$install = 'itms-services://?action=download-manifest&url=' . rawurlencode(base_url() . 'ios.php?a=manifest');
?><!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>X CLIENT - iPhone</title>
<style>
:root{--bg:#0e0f13;--card:#181a21;--fg:#f2f2f5;--mut:#9a9caa;--red:#e5383b;--ok:#3ccf6e;--line:#2a2d38}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,system-ui,Segoe UI,Roboto,sans-serif}
.w{max-width:560px;margin:0 auto;padding:24px max(16px,env(safe-area-inset-left)) 40px}
h1{font-size:26px;margin:8px 0 4px}h1 span{color:var(--red)}.mut{color:var(--mut);font-size:14px}
.c{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin:16px 0}
.c h2{font-size:18px;margin:0 0 10px}.n{display:inline-flex;width:26px;height:26px;border-radius:50%;background:var(--red);align-items:center;justify-content:center;font-weight:700;font-size:14px;margin-right:8px}
ol{padding-left:20px;margin:8px 0}li{margin:4px 0}
input{width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:#0b0c10;color:var(--fg);font-size:16px;margin:8px 0}
.b{display:block;text-align:center;background:var(--red);color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:12px;border:0;width:100%;font-size:17px}
.b.g{background:#2a2d38}.ok{border-color:var(--ok)}.ok h2{color:var(--ok)}.bad{border-color:var(--red)}
</style></head><body><div class="w">
<h1><span>X</span> CLIENT · iPhone</h1>
<div class="mut">CS 1.6 iPhone uchun. Kompyuter kerak emas — faqat Safari.</div>
<?php if (isset($_GET['ok'])): ?>
<div class="c ok"><h2>✓ iPhone qabul qilindi</h2>
<div>Raqamingiz ro'yxatga yozildi. Ro'yxatga qo'shilgach (odatda 1 kun ichida), shu sahifadagi <b>«O'yinni o'rnatish»</b> tugmasi ishlaydi.</div>
<div class="mut" style="margin-top:8px">Endi Sozlamalar → Umumiy → VPN va qurilma boshqaruvi dagi «X CLIENT - iPhone ro'yxati» profilini o'chirib tashlasangiz bo'ladi — u endi kerak emas.</div></div>
<?php elseif (isset($_GET['err'])): ?>
<div class="c bad"><h2>Xato</h2><div>iPhone raqamini o'qib bo'lmadi. Qaytadan urinib ko'ring (faqat Safari da).</div></div>
<?php endif; ?>
<div class="c"><h2><span class="n">1</span>iPhone ni ro'yxatga yozish</h2>
<div class="mut">Bir marta qilinadi. Apple faqat ro'yxatdagi iPhone larga o'rnatishga ruxsat beradi.</div>
<form method="get" action="ios.php"><input type="hidden" name="a" value="cfg">
<input name="n" maxlength="24" placeholder="O'yindagi nikingiz" autocomplete="off" required>
<button class="b" type="submit">Ro'yxatga yozish</button></form>
<ol class="mut">
<li>«Ruxsat berish» ni bosing — profil yuklanadi.</li>
<li>Sozlamalar ni oching → yuqorida «Profil yuklandi» → «O'rnatish».</li>
<li>iPhone parolini kiriting. Telefon raqamni yuboradi va shu sahifaga qaytadi.</li>
</ol></div>
<div class="c"><h2><span class="n">2</span>O'yinni o'rnatish</h2>
<?php if ($ipa): ?>
<a class="b" href="<?php echo h($install); ?>">O'yinni o'rnatish</a>
<ol class="mut">
<li>«O'rnatish» ni bosing — ilova bosh ekranda yuklana boshlaydi.</li>
<li>Birinchi ochishda: Sozlamalar → Maxfiylik va xavfsizlik → <b>Developer Mode</b> ni yoqing (iOS 16+), telefon qayta yonadi.</li>
<li>Birinchi ochilishda o'yin fayllari yuklanadi (~280 MB, Wi-Fi tavsiya).</li>
</ol>
<div class="mut">«Ilovani o'rnatib bo'lmadi» desa — iPhone ingiz hali ro'yxatga qo'shilmagan, biroz kuting.</div>
<?php else: ?>
<a class="b g">Tez orada</a><div class="mut" style="margin-top:8px">iPhone versiyasi tayyorlanyapti. Hozir 1-qadamni bajarib qo'ying — tayyor bo'lganda darhol o'rnata olasiz.</div>
<?php endif; ?>
</div>
</div></body></html>
