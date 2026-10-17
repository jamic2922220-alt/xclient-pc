<?php
/* =====================================================================
 *  X CLIENT — kontent paketlari (ovozlar, modellar, NextClient yangilanishi ...)
 *
 *  Paket qo'shish (FastPanel'da):  mmb/packs/<paket_id>/
 *      pack.json   {"name":"Ovozlar: Pro", "desc":"Qisqacha tavsif", "type":"sound"}
 *      files/      o'yin papkasining nusxasi, masalan files/cstrike/sound/weapons/ak47-1.wav
 *  paket_id: kichik lotin harflar, raqam, _ yoki - (masalan sound_pro, nextclient_new).
 *
 *  packs.php            -> menyu uchun ro'yxat (JSON)
 *  packs.php?files=<id> -> XClient.exe uchun fayllar: "yo'l<TAB>hajm<TAB>manzil" qatorlari
 * ===================================================================== */
$ROOT = __DIR__ . '/packs';
$BASE = 'http://mmb.boost-top.com/packs/';

function pack_files($dir, $rel = '') {
    $out = array();
    foreach ((array)@scandir($dir) as $f) {
        if ($f === '.' || $f === '..' || $f === '') continue;
        $p = "$dir/$f";
        if (is_dir($p)) $out = array_merge($out, pack_files($p, $rel . $f . '/'));
        else $out[] = array($rel . $f, filesize($p));
    }
    return $out;
}

if (isset($_GET['files'])) {
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    $id = $_GET['files'];
    if (!preg_match('/^[a-z0-9_\-]{1,40}$/', $id) || !is_dir("$ROOT/$id/files")) { header('HTTP/1.1 404 Not Found'); exit; }
    foreach (pack_files("$ROOT/$id/files") as $f) {
        if (strpos($f[0], '..') !== false || $f[0][0] === '/') continue;
        echo $f[0] . "\t" . $f[1] . "\t" . $BASE . $id . '/files/' . implode('/', array_map('rawurlencode', explode('/', $f[0]))) . "\n";
    }
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$list = array();
foreach ((array)@scandir($ROOT) as $id) {
    if (!preg_match('/^[a-z0-9_\-]{1,40}$/', $id) || !is_dir("$ROOT/$id/files")) continue;
    $meta = is_file("$ROOT/$id/pack.json") ? json_decode(file_get_contents("$ROOT/$id/pack.json"), true) : null;
    $files = pack_files("$ROOT/$id/files");
    $size = 0; foreach ($files as $f) $size += $f[1];
    $list[] = array('id' => $id, 'name' => isset($meta['name']) ? $meta['name'] : $id, 'desc' => isset($meta['desc']) ? $meta['desc'] : '',
        'type' => isset($meta['type']) ? $meta['type'] : '', 'files' => count($files), 'size' => $size);
}
echo json_encode($list);
