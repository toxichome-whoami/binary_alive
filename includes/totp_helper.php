<?php
// includes/totp_helper.php

class TotpHelper {
    private static $base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function generateSecret($length = 16) {
        $secret = '';
        for ($i = 0; $i < $length; $i++) {
            $secret .= self::$base32chars[random_int(0, 31)];
        }
        return $secret;
    }

    public static function verifyCode($secret, $code, $discrepancy = 1) {
        $currentTimeSlice = floor(time() / 30);
        for ($i = -$discrepancy; $i <= $discrepancy; $i++) {
            $calculatedCode = self::getCode($secret, $currentTimeSlice + $i);
            if (hash_equals($calculatedCode, $code)) {
                return true;
            }
        }
        return false;
    }

    private static function getCode($secret, $timeSlice) {
        $secretKey = self::base32Decode($secret);
        
        // Pack time into 8 bytes
        $timeData = chr(0).chr(0).chr(0).chr(0).pack('N*', $timeSlice);
        
        // Generate HMAC-SHA1
        $hmac = hash_hmac('SHA1', $timeData, $secretKey, true);
        
        // Get offset
        $offset = ord(substr($hmac, -1)) & 0x0F;
        
        // Calculate OTP
        $hashPart = substr($hmac, $offset, 4);
        $value = unpack('N', $hashPart);
        $value = $value[1];
        $value = $value & 0x7FFFFFFF;
        
        $modulo = pow(10, 6);
        $otp = str_pad($value % $modulo, 6, '0', STR_PAD_LEFT);
        
        return $otp;
    }

    private static function base32Decode($secret) {
        if (empty($secret)) return '';
        $secret = strtoupper($secret);
        $paddingCharCount = substr_count($secret, '=');
        $allowedValues = array(
            6, 4, 3, 1, 0
        );
        if (!in_array($paddingCharCount, $allowedValues)) return false;
        for ($i = 0; $i < 4; $i++) {
            if ($paddingCharCount == $allowedValues[$i] &&
                substr($secret, -($allowedValues[$i])) != str_repeat('=', $allowedValues[$i])) return false;
        }
        $secret = str_replace('=', '', $secret);
        $secret = str_split($secret);
        $binaryString = "";
        for ($i = 0; $i < count($secret); $i = $i + 8) {
            $x = "";
            if (!in_array($secret[$i], str_split(self::$base32chars))) return false;
            for ($j = 0; $j < 8; $j++) {
                if (!isset($secret[$i + $j])) break;
                $x .= str_pad(base_convert(strpos(self::$base32chars, $secret[$i + $j]), 10, 2), 5, '0', STR_PAD_LEFT);
            }
            $eightBits = str_split($x, 8);
            for ($z = 0; $z < count($eightBits); $z++) {
                if (strlen($eightBits[$z]) == 8) {
                    $binaryString .= (($y = chr(base_convert($eightBits[$z], 2, 10))) || ord($y) == 48) ? $y : "";
                }
            }
        }
        return $binaryString;
    }

    public static function getQrCodeUrl($name, $secret, $issuer = 'BinaryAlive') {
        $urlencoded = urlencode('otpauth://totp/' . $name . '?secret=' . $secret . '&issuer=' . $issuer);
        return 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' . $urlencoded;
    }
}
