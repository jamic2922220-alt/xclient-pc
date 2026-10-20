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
    $f = XC_DIR . '/' . $name . '.php';
    @mkdir(dirname($f), 0755, true);
    $tmp = $f . '.' . mt_rand(1000, 9999) . '.tmp';
    if (@file_put_contents($tmp, XC_GUARD . json_encode($data, JSON_UNESCAPED_UNICODE)) !== false) @rename($tmp, $f);
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
);
$d = preg_replace('/[^a-z0-9]/', '', strtolower(isset($_REQUEST['d']) ? (string)$_REQUEST['d'] : ''));
$d = substr($d, 0, 40);
$done = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $r = isset($_POST['r']) && isset($REASONS[$_POST['r']]) ? $_POST['r'] : '';
    $txt = trim(substr(preg_replace('/[\x00-\x1f<>]/u', ' ', isset($_POST['t']) ? (string)$_POST['t'] : ''), 0, 600));
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    $key = 'bye/' . date('Ymd') . '-' . substr(sha1($ip . '|' . $d), 0, 12);   // bitta kompyuter kuniga bitta javob (qayta yuborsa - almashadi)
    if ($r !== '' || $txt !== '') {
        $files = glob(XC_DIR . '/bye/*.php');
        if (count((array)$files) < 5000) wr($key, array('t' => time(), 'd' => $d, 'r' => $r, 'text' => $txt, 'ip' => $ip));
    }
    $done = true;
}
?><!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>X CLIENT o'chirildi</title>
<style>
body{margin:0;background:#120d10;color:#eee;font:16px/1.5 system-ui,Segoe UI,Arial,sans-serif;padding:24px 16px}
.w{max-width:560px;margin:0 auto}
h1{font-size:26px;margin:0 0 6px}h1 span{color:#ff3b3b}
p{color:#c9b7bd;margin:0 0 18px}
label{display:flex;gap:10px;align-items:center;padding:12px 14px;margin:0 0 8px;border:1px solid #3a2a30;border-radius:10px;background:#1b1418;cursor:pointer}
label:hover{border-color:#ff5a5a}
label small{display:block;color:#8f7d84;font-size:13px}
textarea{width:100%;box-sizing:border-box;min-height:80px;margin:6px 0 14px;padding:10px;border-radius:10px;border:1px solid #3a2a30;background:#1b1418;color:#eee;font:inherit}
button{padding:13px 22px;border:0;border-radius:10px;background:#e33;color:#fff;font-weight:700;font-size:17px;cursor:pointer}
a{color:#ff9a39}
</style></head><body><div class="w">
<?php if ($done): ?>
<h1>Rahmat! <span>Спасибо!</span></h1>
<p>Javobingiz X CLIENT ni yaxshilashga yordam beradi. Qachon xohlasangiz qaytib keling - sozlamalaringiz akkauntda saqlanib turadi.<br>
Ваш ответ поможет сделать X CLIENT лучше.</p>
<p><a href="https://cssborka.uz/xclient/">X CLIENT ni qayta yuklab olish</a></p>
<?php else: ?>
<h1><span>X</span> CLIENT o'chirildi</h1>
<p>Nega o'chirdingiz? Bitta bosish kifoya - bu bizga juda kerak.<br>Почему удалили? Один клик - это очень важно для нас.</p>
<form method="post"><input type="hidden" name="d" value="<?= h($d) ?>">
<?php foreach ($REASONS as $k => $r): ?>
<label><input type="radio" name="r" value="<?= h($k) ?>"> <span><?= h($r[0]) ?><small><?= h($r[1]) ?></small></span></label>
<?php endforeach; ?>
<textarea name="t" maxlength="600" placeholder="Nima yoqmadi? (ixtiyoriy) / Что не понравилось? (необязательно)"></textarea>
<button>Yuborish / Отправить</button>
</form>
<?php endif; ?>
</div></body></html>
