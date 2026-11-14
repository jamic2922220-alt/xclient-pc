<?php
/* Test ma'lumotlari: 2 akkaunt (do'st), biri onlayn serverda. php seed.php <xc_data papkasi> */
define('XC_DIR', $argv[1]); define('XC_GUARD', "<?php exit; ?>\n");
function rd($n) { return json_decode(substr(file_get_contents(XC_DIR . "/$n.php"), strlen(XC_GUARD)), true); }
function wr($n, $d) { file_put_contents(XC_DIR . "/$n.php", XC_GUARD . json_encode($d)); }
$a = rd('users/testa'); $b = rd('users/testb');
$a['friends'] = array('testb'); $b['friends'] = array('testa');
$a['xp'] = 12500; $a['st'] = array('k' => 900, 'd' => 600, 'g' => 80, 't' => 50000, 'best' => 35, 'wpn' => array('ak47' => 300), 'srv' => array('1.2.3.4:27015' => array('k' => 500, 'd' => 300, 't' => 30000, 'n' => 'UZB ARENA')));
$a['wkst'] = array('2026-40' => array('k' => 90, 'd' => 110, 't' => 6000, 'g' => 8), '2026-41' => array('k' => 260, 'd' => 130, 't' => 15000, 'g' => 18));
$b['seen'] = time(); $b['server'] = '1.2.3.4:27015'; $b['map'] = 'de_dust2'; $b['name'] = 'Night';
wr('users/testa', $a); wr('users/testb', $b);
