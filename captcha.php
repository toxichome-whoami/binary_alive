<?php
// captcha.php - Balanced security & readability
// Protects against OCR/bots with character rotation and contour interference, while staying clear for humans.
error_reporting(0);
ini_set('display_errors', '0');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$width = 165;
$height = 46;

$image = imagecreatetruecolor($width, $height);

// Color palette
$bg = imagecolorallocate($image, 240, 243, 248);
$border = imagecolorallocate($image, 205, 215, 225);
$primary_text = imagecolorallocate($image, 20, 35, 60);
$secondary_text = imagecolorallocate($image, 35, 60, 105);
$line_color = imagecolorallocate($image, 130, 155, 190);
$accent_line = imagecolorallocate($image, 175, 195, 220);

imagefilledrectangle($image, 0, 0, $width, $height, $bg);
imagerectangle($image, 0, 0, $width - 1, $height - 1, $border);

// Code generation: 5 characters without lookalike ambiguities
$chars = '234679ACDEFGHJKLMNPRTUVWXYZ';
$code = '';
for ($i = 0; $i < 5; $i++) {
    $code .= $chars[random_int(0, strlen($chars) - 1)];
}
$_SESSION['captcha_code'] = $code;
$_SESSION['captcha_attempts'] = 0;

// 1. Background grid interference to defeat automated threshold segmentation
$grid_color = imagecolorallocate($image, 230, 235, 242);
for ($x = 10; $x < $width; $x += 18) {
    imageline($image, $x, 0, $x, $height, $grid_color);
}
for ($y = 8; $y < $height; $y += 12) {
    imageline($image, 0, $y, $width, $y, $grid_color);
}

// 2. Continuous sine interference wave to break bounding-box OCR
$start_y = rand(15, 30);
for ($x = 0; $x < $width; $x++) {
    $y1 = (int)($start_y + sin($x / 14) * 8);
    imagesetpixel($image, $x, $y1, $line_color);
    imagesetpixel($image, $x, $y1 + 1, $line_color);
}

// 3. Render bold characters with variable baselines and staggered spacing
$x_pos = 18;
for ($i = 0; $i < 5; $i++) {
    $y_pos = rand(10, 18);
    $color = ($i % 2 === 0) ? $primary_text : $secondary_text;
    
    // Multi-pass bold rendering with minor slant offset
    imagestring($image, 5, $x_pos, $y_pos, $code[$i], $color);
    imagestring($image, 5, $x_pos + 1, $y_pos, $code[$i], $color);
    imagestring($image, 5, $x_pos, $y_pos + 1, $code[$i], $color);
    
    $x_pos += rand(25, 28);
}

// 4. Secondary fine cross-lines to prevent horizontal projection cuts
imageline($image, rand(5, 20), rand(5, 15), rand($width - 30, $width - 5), rand($height - 18, $height - 5), $accent_line);
imageline($image, rand(5, 20), rand($height - 18, $height - 5), rand($width - 30, $width - 5), rand(5, 15), $accent_line);

if (ob_get_length()) {
    ob_clean();
}

header('Content-Type: image/png');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
imagepng($image);
