<?php
// includes/monitor.php

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}

class Monitor {
    public static function isRunning($process) {
        if (!empty($process['pid'])) {
            $pid = (int)$process['pid'];
            $output = shell_exec("ps -p $pid -o pid= --no-headers");
            if (!empty(trim($output))) {
                return $pid;
            }
        }
        
        // Fallback: search by the actual command, not the arbitrary DB name
        $cmd = escapeshellarg($process['command']);
        $output = shell_exec("ps aux | grep $cmd | grep -v grep | awk '{print $2}'");
        $pid = trim(explode("\n", $output)[0] ?? '');
        
        return !empty($pid) ? $pid : false;
    }

    public static function getMetrics($pid) {
        if (!$pid) return ['cpu' => 0, 'mem' => 0, 'uptime' => '00:00:00'];
        $pid = (int)$pid;
        $output = shell_exec("ps -p $pid -o %cpu,rss,etime --no-headers");
        if ($output) {
            $parts = preg_split('/\s+/', trim($output));
            if (count($parts) >= 3) {
                $rss_kb = (int)$parts[1];
                $mem_mb = round($rss_kb / 1024, 1) . ' MB';
                return [
                    'cpu' => $parts[0],
                    'mem' => $mem_mb,
                    'uptime' => $parts[2]
                ];
            }
        }
        return ['cpu' => 0, 'mem' => 0, 'uptime' => '00:00:00'];
    }

    public static function startProcess($process) {
        $cmd = escapeshellcmd($process['command']); // Sanitize command line execution
        $dir = !empty($process['working_dir']) ? $process['working_dir'] : __DIR__;
        $log = !empty($process['log_file']) ? $process['log_file'] : '/dev/null';
        
        // Build nohup command
        $fullCmd = "nohup $cmd > " . escapeshellarg($log) . " 2>&1 & echo $!";
        
        // Using proc_open is the only 100% bulletproof way to prevent PHP from hanging on cPanel/LiteSpeed
        $descriptorspec = [
            0 => ["file", "/dev/null", "r"],  // stdin is empty
            1 => ["pipe", "w"],               // stdout is a pipe to read the PID
            2 => ["file", "/dev/null", "w"]   // stderr is discarded
        ];
        
        $proc = proc_open($fullCmd, $descriptorspec, $pipes, $dir);
        if (is_resource($proc)) {
            $pid = trim(stream_get_contents($pipes[1]));
            fclose($pipes[1]);
            proc_close($proc);
            return $pid;
        }
        
        return false;
    }

    public static function stopProcess($pid) {
        $pid = (int)$pid;
        if ($pid > 0) {
            shell_exec("kill -9 $pid"); // Instantly kill-9 as requested
            return true;
        }
        return false;
    }

}
