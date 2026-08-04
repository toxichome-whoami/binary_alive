<?php
session_start();
header('Content-Type: application/json');

$input = strtoupper(trim($_POST['captcha'] ?? ''));
$expected = $_SESSION['captcha_code'] ?? '';

if (empty($expected)) {
    echo json_encode(['valid' => false]);
    exit;
}

if (!isset($_SESSION['captcha_attempts'])) {
    $_SESSION['captcha_attempts'] = 0;
}

if ($input === $expected) {
    echo json_encode(['valid' => true]);
} else {
    $_SESSION['captcha_attempts']++;
    // Invalidate captcha after 3 failed live checks to prevent brute-forcing
    if ($_SESSION['captcha_attempts'] >= 3) {
        unset($_SESSION['captcha_code']);
        unset($_SESSION['captcha_attempts']);
        echo json_encode(['valid' => false, 'reload' => true]);
    } else {
        echo json_encode(['valid' => false]);
    }
}
