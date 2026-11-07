<?php
/* =====================================================================
 *  "Nega o'chiryapsiz?" - X CLIENT o'chirilganda brauzerda ochiladi (installer: bye.php?d=kompyuter_id).
 *  Javoblar xc_data/bye/ ga yoziladi, admin panel > Ketganlar sahifasida ko'rinadi.
 * ===================================================================== */
define('XC_DIR', __DIR__ . '/xc_data');
define('XC_GUARD', "<?php exit; ?>\n");
function rd($name, $def) {
    $f = XC_DIR . '/' . $name . '.php';
    if (!is_file($f)) return $def;
    $j = json_decode(substr((string)@file_get_contents($f), strlen(XC_GUARD)), true);
    return is_array($j) ? $j : $def;
}
function wr($name, $data) {
    $j = json_encode($data, JSON_UNESCAPED_UNICODE); if ($j === false) return;   // noto'g'ri UTF-8 - bo'sh fayl yozmaymiz
    $f = XC_DIR . '/' . $name . '.php';
    @mkdir(dirname($f), 0755, true);
    $tmp = $f . '.' . mt_rand(1000, 9999) . '.tmp';
    if (@file_put_contents($tmp, XC_GUARD . $j) !== false) @rename($tmp, $f);
}
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
$REASONS = array(
    'lag'    => array("O'yin qotadi / FPS past", 'Тормозит / низкий FPS'),
    'bugs'   => array('Xatolar ko\'p, ishlamadi', 'Много ошибок, не работает'),
    'menu'   => array('Menyu yoqmadi / noqulay', 'Не понравилось меню'),
    'ads'    => array('Reklama va xabarlar ko\'p', 'Много рекламы и уведомлений'),
    'other'  => array('Boshqa sborka o\'rnatdim', 'Поставил другую сборку'),
    'reinst' => array("Qayta o'rnatish uchun o'chiryapman", 'Удаляю, чтобы переустановить'),
    'nogame' => array("Endi CS 1.6 o'ynamayman", 'Больше не играю в CS 1.6'),
    'av'     => array('Antivirus o\'chirib tashladi', 'Антивирус удалил / ругается'),
);
$d = preg_replace('/[^a-z0-9]/', '', strtolower(isset($_REQUEST['d']) ? (string)$_REQUEST['d'] : ''));
$d = substr($d, 0, 40);
$done = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $r = isset($_POST['r']) && is_string($_POST['r']) && isset($REASONS[$_POST['r']]) ? $_POST['r'] : '';
    $txt = (string)preg_replace('/[\x00-\x1f<>]/u', ' ', isset($_POST['t']) && is_string($_POST['t']) ? $_POST['t'] : '');
    $txt = trim(function_exists('mb_strcut') ? mb_strcut($txt, 0, 1800, 'UTF-8') : substr($txt, 0, 600));   // harfni o'rtasidan kesmaymiz
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    $key = 'bye/' . date('Ymd') . '-' . substr(sha1($ip . '|' . $d), 0, 12);   // bitta kompyuter kuniga bitta javob (qayta yuborsa - almashadi)
    if ($r !== '' || $txt !== '') {
        $files = glob(XC_DIR . '/bye/*.php');
        // bitta IP kuniga 3 ta javob; 5000 dan oshsa eng eskisi o'chadi (yangi javoblar yo'qolmasin)
        $ipn = glob(XC_DIR . '/bye/' . date('Ymd') . '-*.php'); $mine = 0;
        foreach ((array)$ipn as $bf) { $bx = rd('bye/' . basename($bf, '.php'), null); if ($bx && isset($bx['ip']) && $bx['ip'] === $ip) $mine++; }
        if ($mine < 3 || is_file(XC_DIR . '/' . $key . '.php')) {
            if (count((array)$files) >= 5000) { usort($files, function ($a, $b) { return filemtime($a) - filemtime($b); }); @unlink($files[0]); }
            $old = rd($key, null);                       // 2-qadam: faqat izoh yuborilsa - avvalgi sababni saqlaymiz
            if ($r === '' && $old && !empty($old['r'])) $r = $old['r'];
            if ($txt === '' && $old && !empty($old['text'])) $txt = $old['text'];
            wr($key, array('t' => time(), 'd' => $d, 'r' => $r, 'text' => $txt, 'ip' => $ip));
        }
    }
    $done = $txt !== '' ? 2 : 1;
    $why = $r;
}
?><!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>X CLIENT o'chirildi</title>
<style>
body{margin:0;background:#120d10;color:#eee;font:16px/1.5 system-ui,Segoe UI,Arial,sans-serif;padding:24px 16px}
.w{max-width:560px;margin:0 auto}
h1{font-size:26px;margin:0 0 6px}h1 span{color:#ff3b3b}
p{color:#c9b7bd;margin:0 0 18px}
.r{display:block;width:100%;text-align:left;padding:14px 16px;margin:0 0 8px;border:1px solid #3a2a30;border-radius:10px;background:#1b1418;color:#eee;font:inherit;font-size:17px;cursor:pointer}
.r:hover{border-color:#ff5a5a;background:#25191e}
.r small{display:block;color:#8f7d84;font-size:13px}
textarea{width:100%;box-sizing:border-box;min-height:90px;margin:6px 0 14px;padding:10px;border-radius:10px;border:1px solid #3a2a30;background:#1b1418;color:#eee;font:inherit}
.go{padding:13px 22px;border:0;border-radius:10px;background:#e33;color:#fff;font-weight:700;font-size:17px;cursor:pointer}
.tip{padding:12px 14px;border-radius:10px;background:#2a2108;border:1px solid #6b5410;color:#f3dfa0;margin:0 0 18px}
a{color:#ff9a39}
</style></head><body><div class="w">
<?php $TIPS = array(
    'lag' => "Maslahat: X CLIENT Sozlamalarida «Kuchsiz kompyuter» rejimini yoqing - grafika yengillashib, FPS ko'tariladi. / Совет: включите в настройках X CLIENT режим «Слабый компьютер» - FPS вырастет.",
    'bugs' => "Muammoni pastda qisqa yozing - albatta tuzatamiz va Telegram kanalda xabar beramiz. / Опишите проблему ниже - исправим.",
    'av' => "X CLIENT virus emas: antivirus noma'lum yangi fayllarni shunday ushlaydi. Karantindan XCLauncher.exe ni tiklab, istisnoga qo'shing. / Это ложное срабатывание: восстановите XCLauncher.exe из карантина.",
    'reinst' => "Yangi versiyani shu yerdan oling: / Новая версия здесь: <a href=\"https://cssborka.uz/xclient/\">cssborka.uz/xclient</a>",
); ?>
<?php if ($done === 2): ?>
<h1>Rahmat! <span>Спасибо!</span></h1>
<p>Javobingizni o'qiymiz va X CLIENT ni yaxshilaymiz. Qachon xohlasangiz qaytib keling - sozlamalaringiz akkauntda saqlanib turadi.<br>Ваш ответ поможет сделать X CLIENT лучше.</p>
<p><a href="https://cssborka.uz/xclient/">X CLIENT ni qayta yuklab olish / Скачать снова</a></p>
<?php elseif ($done): ?>
<h1>Rahmat! <span>Спасибо!</span></h1>
<?php if (isset($TIPS[$why])): ?><div class="tip"><?= strpos($TIPS[$why], '<a ') !== false ? $TIPS[$why] : h($TIPS[$why]) ?></div><?php endif; ?>
<p>Yana bir narsa yozmoqchimisiz? (ixtiyoriy)<br>Хотите что-то добавить? (необязательно)</p>
<form method="post"><input type="hidden" name="d" value="<?= h($d) ?>">
<textarea name="t" maxlength="600" placeholder="Nima yoqmadi, nimani qo'shaylik? / Что не понравилось?"></textarea>
<button class="go">Yuborish / Отправить</button>
</form>
<?php else: ?>
<h1><span>X</span> CLIENT o'chirildi</h1>
<p>Nega o'chirdingiz? Bittasini bosing - shu kifoya.<br>Почему удалили? Нажмите один вариант - этого достаточно.</p>
<form method="post"><input type="hidden" name="d" value="<?= h($d) ?>">
<?php foreach ($REASONS as $k => $r): ?>
<button class="r" name="r" value="<?= h($k) ?>"><?= h($r[0]) ?><small><?= h($r[1]) ?></small></button>
<?php endforeach; ?>
</form>
<?php endif; ?>
</div></body></html>
