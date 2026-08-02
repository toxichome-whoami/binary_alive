<?php
session_start();

$width = 160;
$height = 50;

$image = imagecreatetruecolor($width, $height);

// Colors
$bg_color = imagecolorallocate($image, 240, 248, 255); 
$text_color = imagecolorallocate($image, 20, 40, 100);
$noise_color = imagecolorallocate($image, 150, 180, 220);
$noise_color2 = imagecolorallocate($image, 180, 200, 240);

imagefilledrectangle($image, 0, 0, $width, $height, $bg_color);

// Generate random code
$chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
$code = '';
for ($i = 0; $i < 6; $i++) {
    $code .= $chars[rand(0, strlen($chars) - 1)];
}
$_SESSION['captcha_code'] = $code;
$_SESSION['captcha_attempts'] = 0;

// Add text using largest built-in font (5) and slight staggering
$x = 15;
for ($i = 0; $i < 6; $i++) {
    $y = rand(10, 25);
    imagestring($image, 5, $x, $y, $code[$i], $text_color);
    $x += 22;
}

// ---------------------------------------------------------
// APPLY SINE-WAVE DISTORTION TO WARP THE CHARACTERS
// ---------------------------------------------------------
$warped_image = imagecreatetruecolor($width, $height);
imagefilledrectangle($warped_image, 0, 0, $width, $height, $bg_color);

// Randomize the wave shape
$period = rand(12, 25); 
$amplitude = rand(3, 5); 

for ($px = 0; $px < $width; $px++) {
    $y_offset = (int)($amplitude * sin($px / $period));
    // Copy vertical slices, offsetting Y to create a wave
    imagecopy($warped_image, $image, $px, $y_offset, $px, 0, 1, $height);
}
imagedestroy($image);
$image = $warped_image;

// ---------------------------------------------------------
// DRAW NOISE *OVER* THE WARPED TEXT TO BREAK OCR LINES
// ---------------------------------------------------------
// Draw intersecting slash lines
for ($i = 0; $i < 15; $i++) {
    imageline($image, rand(0, $width), rand(0, $height), rand(0, $width), rand(0, $height), $noise_color);
}

// Draw confusing hollow circles
for ($i = 0; $i < 10; $i++) {
    imageellipse($image, rand(0, $width), rand(0, $height), rand(20, 60), rand(20, 60), $noise_color2);
}

// Draw heavy dot noise scattered across the letters
for ($i = 0; $i < 400; $i++) {
    imagesetpixel($image, rand(0, $width), rand(0, $height), $noise_color);
}

// Output
header('Content-type: image/png');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
imagepng($image);
imagedestroy($image);
