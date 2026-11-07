<?php require_once __DIR__ . "/inc/i18n.php";
error_reporting(E_ALL);
ini_set('display_errors', 0);
require_once "db.php";
require_once __DIR__ . "/inc/slider-images.php";
require_once __DIR__ . "/inc/roulette-data.php";

/*
    CSSBORKA.UZ — Premium home page
    Bazalar saqlangan:
    - items
    - categories
    - type = sborka
    - is_active = 1
    - pagination
    - downloads/views
    - item.php / slug
*/

if (!function_exists('str_contains')) {
    function str_contains($haystack, $needle) {
        return $needle === '' || strpos((string)$haystack, (string)$needle) !== false;
    }
}
if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle) {
        return $needle === '' || strncmp((string)$haystack, (string)$needle, strlen((string)$needle)) === 0;
    }
}

$limit = 12;
$page = max(1, (int)($_GET["page"] ?? 1));
$offset = ($page - 1) * $limit;

$totalLatest = (int)$pdo->query("
    SELECT COUNT(*)
    FROM items
    WHERE is_active = 1 AND type = 'sborka'
")->fetchColumn();

$totalPages = max(1, (int)ceil($totalLatest / $limit));

if ($page > $totalPages) {
    $page = $totalPages;
    $offset = ($page - 1) * $limit;
}

$latestStmt = $pdo->prepare("
    SELECT items.*, categories.title AS category_title
    FROM items
    LEFT JOIN categories ON categories.id = items.category_id
    WHERE items.is_active = 1 AND items.type = 'sborka'
    ORDER BY items.id DESC
    LIMIT ? OFFSET ?
");
$latestStmt->bindValue(1, $limit, PDO::PARAM_INT);
$latestStmt->bindValue(2, $offset, PDO::PARAM_INT);
$latestStmt->execute();
$latest_items = $latestStmt->fetchAll(PDO::FETCH_ASSOC);

$popularStmt = $pdo->query("
    SELECT items.*, categories.title AS category_title
    FROM items
    LEFT JOIN categories ON categories.id = items.category_id
    WHERE items.is_active = 1 AND items.type = 'sborka'
    ORDER BY items.downloads DESC, items.views DESC, items.id DESC
    LIMIT 6
");
$popular_items = $popularStmt ? $popularStmt->fetchAll(PDO::FETCH_ASSOC) : [];

/* Tavsiya etilgan sborka "Популярные сборки" ro'yxatida birinchi turadi (ro'yxat uzunligi o'zgarmaydi: 6 ta) */
$featuredId = csFeaturedBuildId($pdo);
if ($featuredId) {
    $fStmt = $pdo->prepare("SELECT items.*, categories.title AS category_title FROM items LEFT JOIN categories ON categories.id = items.category_id WHERE items.id = ? AND items.is_active = 1 LIMIT 1");
    $fStmt->execute([$featuredId]);
    $featuredRow = $fStmt->fetch(PDO::FETCH_ASSOC);
    if ($featuredRow) {
        $rest = array_values(array_filter($popular_items, fn($x) => (int)$x['id'] !== $featuredId));
        $popular_items = array_slice(array_merge([$featuredRow], $rest), 0, 6);
    }
}

$rouletteStmt = $pdo->query("
    SELECT items.*, categories.title AS category_title
    FROM items
    LEFT JOIN categories ON categories.id = items.category_id
    WHERE items.is_active = 1 AND items.type = 'sborka'
    ORDER BY RAND()
    LIMIT 60
");
$roulette_items = $rouletteStmt ? $rouletteStmt->fetchAll(PDO::FETCH_ASSOC) : [];

$totalDownloads = (int)$pdo->query("
    SELECT COALESCE(SUM(downloads),0)
    FROM items
    WHERE is_active = 1 AND type = 'sborka'
")->fetchColumn();

$totalViews = (int)$pdo->query("
    SELECT COALESCE(SUM(views),0)
    FROM items
    WHERE is_active = 1 AND type = 'sborka'
")->fetchColumn();

function cleanImagePath($path)
{
    $path = trim((string)$path);
    if ($path === '') return '';
    if (preg_match('~^https?://~i', $path) || str_starts_with($path, '/')) return $path;
    return '/' . ltrim($path, '/');
}

function pushImage(&$images, $path)
{
    $path = cleanImagePath($path);
    if ($path !== '' && !in_array($path, $images, true)) {
        $images[] = $path;
    }
}

function getTableColumns(PDO $pdo, $table)
{
    static $cache = [];
    if (isset($cache[$table])) return $cache[$table];

    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM `" . str_replace('`', '', $table) . "`");
        $cache[$table] = $stmt ? $stmt->fetchAll(PDO::FETCH_COLUMN) : [];
    } catch (Throwable $e) {
        $cache[$table] = [];
    }

    return $cache[$table];
}

function getItemSliderImages(PDO $pdo, array $item)
{
    return csSliderImages($pdo, $item);
}

function itemImage(PDO $pdo, array $item)
{
    return csFirstImage($pdo, $item) ?: '/no-image.png';
}

function itemUrl(array $item)
{
    if (!empty($item['slug'])) return '/item/' . rawurlencode((string)$item['slug']);
    return '/item.php?id=' . (int)($item['id'] ?? 0);
}

function homePageUrl($page)
{
    return $page > 1 ? "/?page=" . (int)$page : "/";
}

function shortText($text, $length = 140)
{
    $text = trim(strip_tags((string)$text));
    if ($text === '') return 'Описание пока не добавлено.';
    return mb_substr($text, 0, $length, 'UTF-8');
}

function formatNumberRu($number)
{
    $number = (int)$number;
    if ($number >= 1000000) return round($number / 1000000, 1) . 'M';
    if ($number >= 1000) return round($number / 1000, 1) . 'K';
    return (string)$number;
}

$rouletteData = [];
foreach ($roulette_items as $r) {
    $rouletteData[] = [
        'id' => (int)($r['id'] ?? 0),
        'title' => (string)($r['title'] ?? 'CS 1.6 сборка'),
        'category' => (string)($r['category_title'] ?: 'CS 1.6 сборка'),
        'image' => itemImage($pdo, $r),
        'thumb' => csThumbUrl(itemImage($pdo, $r), 320),
        'url' => itemUrl($r),
        'download' => '/download/' . (int)($r['id'] ?? 0),
        'downloads' => (int)($r['downloads'] ?? 0),
        'views' => (int)($r['views'] ?? 0),
    ];
}

$rouletteData = csRouletteFeature($pdo, $rouletteData);   // tavsiya etilgan sborka ruletkada albatta bo'ladi

$heroImages = [];
foreach (array_slice($popular_items ?: $latest_items, 0, 6) as $h) {
    pushImage($heroImages, itemImage($pdo, $h));
}
if (!$heroImages) {
    $heroImages = ['/test.webp', '/no-image.png'];
}

$ads = [
    ["image" => "/boostop.webp", "link" => "https://boost-top.com"]
];
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#070a11">
<script>try{if(localStorage.getItem("theme")==="light"){document.documentElement.classList.add("light-mode","cs-light");document.documentElement.setAttribute("data-theme","light");}}catch(e){}</script>
<?php
require_once __DIR__ . "/inc/seo.php";
require_once __DIR__ . "/inc/faq-data.php";

/* Bosh sahifa uchun FAQPage Schema (Google'da savol-javoblar ko'rinishi) */
$homeLd = ['@type' => 'FAQPage', 'mainEntity' => []];
foreach (array_slice($faq, 0, 8) as [$fq, $fa]) {
    $homeLd['mainEntity'][] = ['@type' => 'Question', 'name' => $fq, 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $fa]];
}
$csSeo = ['ld' => [$homeLd]];

/* Ulashilgan havola: /?build=ID — Telegram/WhatsApp'da sborka rasmi va nomi bilan chiqadi */
$sharedBuild = null;
$sharedId = (int)($_GET['build'] ?? 0);
if ($sharedId > 0) {
    $shStmt = $pdo->prepare("SELECT items.*, categories.title AS category_title FROM items LEFT JOIN categories ON categories.id = items.category_id WHERE items.id = ? AND items.is_active = 1 AND items.type = 'sborka' LIMIT 1");
    $shStmt->execute([$sharedId]);
    $shRow = $shStmt->fetch(PDO::FETCH_ASSOC);
    if ($shRow) {
        $shImg = itemImage($pdo, $shRow);
        if (!preg_match('~^https?://~i', $shImg)) $shImg = CS_SITE_URL . '/' . ltrim($shImg, '/');
        $sharedBuild = [
            'id' => (int)$shRow['id'],
            'title' => (string)$shRow['title'],
            'category' => (string)($shRow['category_title'] ?: 'CS 1.6 сборка'),
            'image' => itemImage($pdo, $shRow),
            'thumb' => csThumbUrl(itemImage($pdo, $shRow), 320),
            'url' => itemUrl($shRow),
            'download' => '/download/' . (int)$shRow['id'],
            'downloads' => (int)$shRow['downloads'],
            'views' => (int)$shRow['views'],
        ];
        $csSeo['title'] = csT('Мне подобрали сборку: ', 'Menga sborka tanlandi: ') . $shRow['title'];
        $csSeo['desc'] = csT('Выберите случайную сборку CS 1.6 на CSSBORKA.UZ. Мне подобрали: ', 'CSSBORKA.UZ da ruletkani aylantiring va tasodifiy CS 1.6 sborkasini oling. Menga tushdi: ') . $shRow['title'];
        $csSeo['image'] = CS_SITE_URL . '/og.php?id=' . (int)$shRow['id'];
    }
}
csSeoHead();
?>
<?php foreach ($rouletteData as $__rr) { if (!empty($__rr['featured']) && !empty($__rr['thumb'])) { echo '<link rel="preload" as="image" href="' . htmlspecialchars($__rr['thumb'], ENT_QUOTES, 'UTF-8') . '" fetchpriority="high">' . "\n"; break; } } ?>
<link rel="stylesheet" href="/assets/cs-extra.css?v=7">
<script src="/assets/cs-fav.js?v=2" defer></script>
<link rel="manifest" href="/manifest.webmanifest">
<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){});});}</script>

<link rel="stylesheet" href="/assets/home.css?v=94c8a8a2">
<link rel="stylesheet" href="/assets/roulette-pro.css?v=8">
<link rel="stylesheet" href="/assets/home-faq.css?v=5" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="/assets/home-faq.css?v=5"></noscript>
</head>

<body>
<script>
(function(){
    if(localStorage.getItem("theme")==="light"){
        document.documentElement.classList.add("light-mode");
        document.documentElement.setAttribute("data-theme","light");
        document.body.classList.add("light-mode");
    }
})();
</script>

<div class="cs-bg" aria-hidden="true">
    <?php foreach (array_slice($heroImages, 0, 3) as $bgi => $bg): ?>
        <img src="<?= htmlspecialchars(csThumbUrl($bg, 640), ENT_QUOTES, 'UTF-8') ?>" alt="" width="640" height="360" decoding="async" fetchpriority="low"<?= $bgi > 0 ? ' loading="lazy"' : '' ?>>
    <?php endforeach; ?>
</div>

<?php define("CS_HEAD_PRINTED", true); define("CS_OWN_LAYOUT", true); include(__DIR__ . "/top.php"); ?>

<?php /* Tepada: X CLIENT va Android bannerlari. Ruletka pastda (FAQ dan oldin) */ ?>
<?php if (file_exists(__DIR__ . "/inc/xclient-promo.php")) include __DIR__ . "/inc/xclient-promo.php"; ?>
<?php include __DIR__ . "/inc/android-promo.php"; ?>

<?php
/* Bosh sahifadagi "Скачать CS 1.6" tugmasi tavsiya etilgan sborkani yuklaydi (csFeaturedBuildId: inc/roulette-data.php) */
$heroBuildId = csFeaturedBuildId($pdo);
$heroDownloadUrl = '/download/' . ($heroBuildId ?: 30);
?>
<section class="hero">
    <div class="hero-bg">
        <img class="hero-bg-img" src="<?= htmlspecialchars($heroImages[0] ?? '/test.webp', ENT_QUOTES, 'UTF-8') ?>" alt="CS 1.6">
    </div>

    <div class="site-shell">
        <div class="hero-grid">
            <div>
                <div class="hero-kicker">🔥 Premium CS 1.6 сборки</div>

                <h1 class="hero-title">
                    Скачать
                    <span>CS 1.6</span>
                    сборки
                </h1>

                <p class="hero-desc">
                    Лучшие сборки Counter-Strike 1.6 в одном месте: чистые клиенты, красивые модели,
                    топовые сборки от ютуберов, быстрая загрузка и удобный каталог.
                </p>

                <div class="hero-actions">
                    <a href="<?= htmlspecialchars($heroDownloadUrl, ENT_QUOTES, 'UTF-8') ?>" class="btn btn-main">⬇ Скачать CS 1.6</a>
                    <a href="#builds" class="btn btn-dark">🎮 Смотреть сборки</a>
                    <a href="#roulette" class="btn btn-dark">🎲 Случайная сборка</a>
                </div>

                <div class="hero-stats">
                    <div class="stat">
                        <b><?= formatNumberRu($totalLatest) ?>+</b>
                        <span>Сборок на сайте</span>
                    </div>
                    <div class="stat">
                        <b><?= formatNumberRu($totalDownloads) ?>+</b>
                        <span>Скачиваний</span>
                    </div>
                    <div class="stat">
                        <b><?= formatNumberRu($totalViews) ?>+</b>
                        <span>Просмотров</span>
                    </div>
                </div>
            </div>

            <div class="hero-panel">
                <div class="float-badge">
                    <b>⚡ Быстрая загрузка</b><br>
                    <span style="color:#9aa7b7;font-size:13px;font-weight:800;">Простая установка</span>
                </div>

                <div class="panel-card secondary">
                    <img src="<?= htmlspecialchars($heroImages[1] ?? $heroImages[0] ?? '/no-image.png', ENT_QUOTES, 'UTF-8') ?>" alt="">
                </div>

                <div class="panel-card main">
                    <img src="<?= htmlspecialchars($heroImages[0] ?? '/no-image.png', ENT_QUOTES, 'UTF-8') ?>" alt="">
                    <div class="panel-info">
                        <small>Top build</small>
                        <h3><?= htmlspecialchars($popular_items[0]['title'] ?? 'CS 1.6 Premium сборка', ENT_QUOTES, 'UTF-8') ?></h3>
                    </div>
                </div>

                <div class="panel-card third">
                    <img src="<?= htmlspecialchars($heroImages[2] ?? $heroImages[0] ?? '/no-image.png', ENT_QUOTES, 'UTF-8') ?>" alt="">
                </div>
            </div>
        </div>
    </div>
</section>

<div class="site-shell ad-wrap">
    <?php foreach ($ads as $ad): ?>
        <div class="ad-card">
            <a href="<?= htmlspecialchars($ad["link"], ENT_QUOTES, 'UTF-8') ?>" target="_blank">
                <img loading="lazy" decoding="async" src="<?= htmlspecialchars($ad["image"], ENT_QUOTES, 'UTF-8') ?>" alt="Реклама">
            </a>
        </div>
    <?php endforeach; ?>
</div>

<?php if ($popular_items): ?>
<section class="section">
    <div class="site-shell">
        <div class="section-head">
            <div>
                <div class="section-kicker">🏆 Топ скачиваний</div>
                <h2 class="section-title">Популярные сборки</h2>
                <p class="section-desc">Сборки, которые чаще всего скачивают пользователи, и рекомендация сайта.</p>
            </div>
            <a href="#builds" class="btn btn-dark">Все материалы</a>
        </div>

        <div class="popular-grid">
            <?php foreach ($popular_items as $p): ?>
                <a class="popular-card" href="<?= htmlspecialchars(itemUrl($p), ENT_QUOTES, 'UTF-8') ?>">
                    <?php if ($featuredId && (int)$p['id'] === $featuredId): ?><span class="cs-feat-tag">⭐ Рекомендуем</span><?php endif; ?>
                    <img loading="lazy" decoding="async" src="<?= htmlspecialchars(itemImage($pdo, $p), ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($p['title'], ENT_QUOTES, 'UTF-8') ?>">
                    <div class="popular-content">
                        <small><?= htmlspecialchars($p['category_title'] ?: 'Сборка', ENT_QUOTES, 'UTF-8') ?></small>
                        <b><?= htmlspecialchars($p['title'], ENT_QUOTES, 'UTF-8') ?></b>
                        <span>
                            <em>👁 <?= (int)$p['views'] ?></em>
                            <em>⬇ <?= (int)$p['downloads'] ?></em>
                        </span>
                    </div>
                </a>
            <?php endforeach; ?>
        </div>
    </div>
</section>
<?php endif; ?>


<section class="section" id="builds">
    <div class="site-shell">
        <div class="section-head">
            <div>
                <div class="section-kicker">🆕 Последние материалы</div>
                <h2 class="section-title">Новые сборки CS 1.6</h2>
                <p class="section-desc">Последние добавленные сборки Counter-Strike 1.6 с просмотрами, скачиваниями и красивыми превью.</p>
            </div>
        </div>

        <div class="card-grid">
            <?php if ($latest_items): ?>
                <?php foreach ($latest_items as $item): ?>
                    <?php $sliderImages = csSliderImages($pdo, $item, 5); ?>
                    <article class="build-card">
                        <?php if ($sliderImages): ?>
                            <div class="card-slider" data-slider>
                                <div class="card-top-badge">🔥 CS 1.6</div>

                                <?php foreach ($sliderImages as $imgKey => $img): ?>
                                    <img loading="lazy" decoding="async"
                                        src="<?= htmlspecialchars($img, ENT_QUOTES, 'UTF-8') ?>"
                                        alt="<?= htmlspecialchars($item['title'], ENT_QUOTES, 'UTF-8') ?>"
                                        class="card-slide <?= $imgKey === 0 ? 'active' : '' ?>"
                                        loading="lazy"
                                        onerror="this.src='/no-image.png'"
                                    >
                                <?php endforeach; ?>

                                <?php if (count($sliderImages) > 1): ?>
                                    <div class="slider-count">1 / <?= count($sliderImages) ?></div>
                                    <button type="button" class="slider-btn slider-prev" data-slider-prev aria-label="Назад">‹</button>
                                    <button type="button" class="slider-btn slider-next" data-slider-next aria-label="Вперёд">›</button>

                                    <div class="slider-thumbs">
                                        <?php foreach (array_slice($sliderImages, 0, 5) as $dotKey => $img): ?>
                                            <div class="slider-thumb <?= $dotKey === 0 ? 'active' : '' ?>" data-slider-dot="<?= $dotKey ?>">
                                                <img loading="lazy" decoding="async" src="<?= htmlspecialchars($img, ENT_QUOTES, 'UTF-8') ?>" alt="">
                                            </div>
                                        <?php endforeach; ?>
                                    </div>
                                <?php endif; ?>
                            </div>
                        <?php else: ?>
                            <div class="card-noimg">Нет картинки</div>
                        <?php endif; ?>

                        <div class="card-body">
                            <div class="card-category">
                                <?= htmlspecialchars($item['category_title'] ?: 'Сборка', ENT_QUOTES, 'UTF-8') ?>
                            </div>

                            <h3 class="card-title">
                                <a class="card-title-link" href="<?= htmlspecialchars(itemUrl($item), ENT_QUOTES, 'UTF-8') ?>"><?= htmlspecialchars($item['title'], ENT_QUOTES, 'UTF-8') ?></a>
                            </h3>

                            <div class="card-desc">
                                <?= htmlspecialchars(shortText($item['short_description'] ?? '', 130), ENT_QUOTES, 'UTF-8') ?>
                            </div>

                            <div class="card-footer">
                                <div class="card-stats">
                                    <span>👁 Просмотры: <?= (int)$item['views'] ?></span>
                                    <span>⬇ Скачали: <?= (int)$item['downloads'] ?></span>
                                </div>

                                <a href="<?= htmlspecialchars(itemUrl($item), ENT_QUOTES, 'UTF-8') ?>" class="card-more">
                                    Подробнее
                                </a>
                            </div>
                        </div>
                    </article>
                <?php endforeach; ?>
            <?php else: ?>
                <div style="color:#9aa7b7;font-weight:800;">Сборки пока не добавлены.</div>
            <?php endif; ?>
        </div>

        <?php if ($totalPages > 1): ?>
            <div class="pagination">
                <?php if ($page > 1): ?>
                    <a href="<?= homePageUrl($page - 1) ?>">‹</a>
                <?php endif; ?>

                <?php $start = max(1, $page - 2); $end = min($totalPages, $page + 2); ?>

                <?php if ($start > 1): ?>
                    <a href="<?= homePageUrl(1) ?>">1</a>
                    <?php if ($start > 2): ?><span>...</span><?php endif; ?>
                <?php endif; ?>

                <?php for ($i = $start; $i <= $end; $i++): ?>
                    <a href="<?= homePageUrl($i) ?>" class="<?= $page === $i ? 'active' : '' ?>"><?= $i ?></a>
                <?php endfor; ?>

                <?php if ($end < $totalPages): ?>
                    <?php if ($end < $totalPages - 1): ?><span>...</span><?php endif; ?>
                    <a href="<?= homePageUrl($totalPages) ?>"><?= $totalPages ?></a>
                <?php endif; ?>

                <?php if ($page < $totalPages): ?>
                    <a href="<?= homePageUrl($page + 1) ?>">›</a>
                <?php endif; ?>
            </div>

            <div class="page-info">
                Страница <?= $page ?> из <?= $totalPages ?> — всего <?= $totalLatest ?> сборок
            </div>
        <?php endif; ?>
    </div>
</section>

<?php /* Ruletka: endi pastda (oldin sahifaning eng tepasida edi). "Не знаешь какую сборку выбрать?" bloki o'rniga */ ?>
<?php include __DIR__ . "/inc/roulette-section.php"; ?>

<?php require_once __DIR__ . "/inc/faq-data.php"; $homeFaq = array_slice($faq, 0, 8); ?>
<section class="section" id="faq">
    <div class="site-shell">
        <div class="section-head">
            <div>
                <div class="section-kicker">❓ FAQ</div>
                <h2 class="section-title">Частые вопросы</h2>
                <p class="section-desc">Ответы на самые частые вопросы: установка, FPS, скины, карты и ошибки.</p>
            </div>
            <a href="<?= htmlspecialchars(csUrl('/faq'), ENT_QUOTES, 'UTF-8') ?>" class="btn btn-dark">Все вопросы</a>
        </div>

        <div class="hx-faq">
            <?php foreach ($homeFaq as $i => [$q, $a]): ?>
                <details>
                    <summary><?= htmlspecialchars($q, ENT_QUOTES, 'UTF-8') ?></summary>
                    <div class="hx-ans"><?= $a ?></div>
                </details>
            <?php endforeach; ?>
        </div>

        <div class="hx-links">
            <a href="/top-sborok">🏆 Топ-10</a>
            <a href="/podobrat-sborku">🎯 Подбор сборки</a>
            <a href="/komandy-cs-1-6">⌨ Команды</a>
            <a href="/blog">📝 Блог</a>
            <a href="/faq">❓ FAQ</a>
            <a href="/izbrannoe">♥ Избранное</a>
        </div>
    </div>
</section>

<?php include __DIR__ . "/inc/roulette-script.php"; ?>

<?php include(__DIR__ . "/bottom.php"); ?>
<?php if (file_exists("footer.php")): ?>
    <?php include("footer.php"); ?>
<?php endif; ?>

</body>
</html>
