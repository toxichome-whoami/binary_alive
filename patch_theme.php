<?php
$files = ['index.php', 'logs.php', 'settings.php', 'setup_2fa.php', 'terminal.php', 'users.php'];

$headScript = <<<HTML
    <script>
        const theme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-bs-theme', theme);
    </script>
</head>
HTML;

$buttonHtml = <<<HTML
<button id="theme-toggle" class="btn btn-outline-light btn-sm me-2" title="Toggle Theme"><i class="bi bi-moon-stars"></i></button>
            <a href="logout.php"
HTML;

$footerScript = <<<HTML
<script>
document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        let current = document.documentElement.getAttribute('data-bs-theme');
        toggleBtn.innerHTML = current === 'dark' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
        toggleBtn.addEventListener('click', function() {
            let current = document.documentElement.getAttribute('data-bs-theme');
            let next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', next);
            localStorage.setItem('theme', next);
            toggleBtn.innerHTML = next === 'dark' ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
        });
    }
});
</script>
</body>
HTML;

foreach ($files as $file) {
    if (!file_exists($file)) continue;
    $content = file_get_contents($file);
    
    // Inject Head Script
    if (strpos($content, "localStorage.getItem('theme')") === false) {
        $content = str_replace('</head>', $headScript, $content);
    }
    
    // Inject Button before Logout
    if (strpos($content, 'id="theme-toggle"') === false) {
        $content = str_replace('<a href="logout.php"', $buttonHtml, $content);
    }
    
    // Inject Footer Script
    if (strpos($content, "const toggleBtn = document.getElementById('theme-toggle');") === false) {
        $content = str_replace('</body>', $footerScript, $content);
    }
    
    file_put_contents($file, $content);
    echo "Patched $file\n";
}
