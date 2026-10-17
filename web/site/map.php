<?php
/* =====================================================================
 *  X CLIENT — xarita rasmi:  map.php?m=de_dust2  ->  JPEG
 *  Rasmlar boost-top.com saytining o'zidagi media/maps/cs16/ papkasidan olinadi
 *  (avval diskdan, bo'lmasa sayt orqali) va xc_data/maps/ ga keshlanadi.
 * ===================================================================== */
$m = isset($_GET['m']) ? strtolower(trim($_GET['m'])) : '';
if (!preg_match('/^[a-z0-9_\-\.]{2,40}$/', $m) || strpos($m, '..') !== false) { header('HTTP/1.1 404 Not Found'); exit; }
$CACHE = __DIR__ . '/xc_data/maps';
$TYPES = array('jpg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif');

function send($file, $type) {
    header('Content-Type: ' . $type);
    header('Cache-Control: public, max-age=604800');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}
// 1) kesh
foreach ($TYPES as $ext => $type) if (is_file("$CACHE/$m.$ext")) send("$CACHE/$m.$ext", $type);
if (is_file("$CACHE/$m.none") && time() - filemtime("$CACHE/$m.none") < 86400) { header('HTTP/1.1 404 Not Found'); exit; }
// 2) saytning diski (mmb papkasi sayt ichida bo'lsa)
foreach (array(__DIR__ . '/../media/maps/cs16', __DIR__ . '/media/maps/cs16') as $dir)
    foreach ($TYPES as $ext => $type) if (is_file("$dir/$m.$ext")) send("$dir/$m.$ext", $type);
// 3) sayt orqali yuklab olib keshlaymiz
@mkdir($CACHE, 0755, true);
foreach (array('jpg', 'png', 'gif') as $ext) {
    $url = "https://boost-top.com/media/maps/cs16/$m.$ext";
    $data = false;
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 8,
            CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0, CURLOPT_USERAGENT => 'XClient-map'));
        $data = curl_exec($c);
        $code = curl_getinfo($c, CURLINFO_HTTP_CODE);
        $ct = (string)curl_getinfo($c, CURLINFO_CONTENT_TYPE);
        curl_close($c);
        if ($code != 200 || stripos($ct, 'image/') !== 0) $data = false;
    } else $data = @file_get_contents($url);
    if ($data && strlen($data) > 500 && strlen($data) < 3000000 && @getimagesizefromstring($data)) {
        @file_put_contents("$CACHE/$m.$ext", $data, LOCK_EX);
        send("$CACHE/$m.$ext", $TYPES[$ext]);
    }
}
@touch("$CACHE/$m.none");                                 // rasm yo'q - bir kun qayta so'ramaymiz
header('HTTP/1.1 404 Not Found');
