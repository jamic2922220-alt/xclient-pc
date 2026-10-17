<?php
/* =====================================================================
 *  X CLIENT — XClient.exe avto-yangilanish manzili (mmb.boost-top.com/xclient/api.php)
 *  ?a=update&v=<versiya>&ch=stable|beta  ->  key=value qatorlar:
 *      status, build, version, base, manifest, min, msg, master, game
 *  XClient.exe har ochilganda so'raydi; build boshqacha bo'lsa manifest bo'yicha
 *  o'zgargan fayllarni (XClient.exe, xc_theme, ...) yuklab oladi.
 *  Boshqarish: admin.php > Yangilanishlar.
 * ===================================================================== */
@date_default_timezone_set('Asia/Tashkent');
require __DIR__ . '/release_lib.php';
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

$a = isset($_GET['a']) ? (string)$_GET['a'] : '';
$ch = isset($_GET['ch']) && $_GET['ch'] === 'beta' ? 'beta' : 'stable';

if ($a === 'update') {
    $r = rel_current($ch);
    $line = function ($k, $v) { echo $k . '=' . str_replace(array("\r", "\n"), ' ', (string)$v) . "\n"; };
    $line('status', 'ok');
    if ($r['build'] && $r['base'] !== '') {
        $line('build', $r['build']);
        $line('version', $r['version']);
        $line('base', $r['base']);
        $line('manifest', $r['base'] . '/manifest.txt');
    }
    if ($r['min']) $line('min', $r['min']);
    if ($r['msg'] !== '') $line('msg', $r['msg']);
    exit;
}
echo "status=ok\n";   // install / launch va boshqalar - statistika xc_api.php 'hello' orqali yoziladi
