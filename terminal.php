<?php
require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/auth.php';

$auth = new Auth();
$auth->requireAuth();
$auth->requireRole(['admin']);

function safe_exec($cmd) {
    if (function_exists('shell_exec') && !in_array('shell_exec', array_map('trim', explode(',', ini_get('disable_functions'))))) {
        $result = @shell_exec($cmd);
        return ($result !== null && $result !== false) ? trim($result) : '';
    }
    return '';
}

$sysUser = get_current_user();
if (empty($sysUser) && PHP_OS_FAMILY !== 'Windows') {
    $sysUser = safe_exec('whoami');
}
if (empty($sysUser)) {
    $parts = explode('/', __DIR__);
    $sysUser = (isset($parts[2]) && $parts[1] === 'home') ? $parts[2] : 'admin';
}

$sysHost = gethostname();
if (empty($sysHost)) $sysHost = php_uname('n');
if (empty($sysHost)) $sysHost = 'binary-alive';

if (!isset($_SESSION['terminal_cwd'])) {
    if (PHP_OS_FAMILY === 'Windows') {
        $homeDir = getenv('USERPROFILE') ?: (getenv('HOMEDRIVE') . getenv('HOMEPATH')) ?: 'C:\\';
    } else {
        $homeDir = getenv('HOME');
        if (empty($homeDir)) {
            $passwdLine = safe_exec('getent passwd ' . escapeshellarg($sysUser));
            if (!empty($passwdLine)) {
                $fields = explode(':', $passwdLine);
                $homeDir = $fields[5] ?? '';
            }
        }
        if (empty($homeDir)) {
            $parts = explode('/', __DIR__);
            if (isset($parts[2]) && $parts[1] === 'home') {
                $homeDir = '/home/' . $parts[2];
            }
        }
        if (empty($homeDir)) {
            $homeDir = '/home/' . $sysUser;
        }
    }
    $_SESSION['terminal_cwd'] = (is_dir($homeDir)) ? $homeDir : __DIR__;
}

$pageTitle = 'Terminal';
require_once __DIR__ . '/components/header.php';
require_once __DIR__ . '/components/navbar.php';
?>

<div class="container-fluid py-4 px-md-4">
    <div class="card">
        <div class="card-header d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-terminal text-muted"></i>
                <span>Server Terminal (Admin Console)</span>
            </div>
            <button id="clear-btn" class="btn-clean btn-clean-sm" type="button">
                <i class="bi bi-trash"></i> Clear
            </button>
        </div>
        <div class="card-body p-0">
            <div id="terminal" class="terminal-window"></div>
            <div class="terminal-prompt">
                <span id="prompt-label" class="d-none d-sm-inline"><?= htmlspecialchars($sysUser) ?>@<?= htmlspecialchars($sysHost) ?>:~$</span>
                <span class="d-sm-none">~$</span>
                <input type="text" id="term-input" class="terminal-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type a command and press Enter (try: help)" autofocus>
                <button id="run-btn" class="btn-clean btn-clean-sm btn-clean-primary ms-2" type="button">
                    <i class="bi bi-play-fill"></i> Run
                </button>
            </div>
        </div>
    </div>
</div>

<script>
const terminal = document.getElementById('terminal');
const input = document.getElementById('term-input');
const SESSION_USER = <?= json_encode(['username' => $_SESSION['username'], 'role' => $_SESSION['role']]) ?>;
let currentCwd = <?= json_encode($_SESSION['terminal_cwd'] ?? __DIR__) ?>;
const SERVER_INFO = <?= json_encode(['server' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown', 'php' => phpversion(), 'os' => PHP_OS]) ?>;

let history = [];
let historyIndex = -1;

function print(text, cls) {
    const div = document.createElement('div');
    div.textContent = (text === '') ? ' ' : text;
    if (cls) {
        if (cls === 'ok') div.style.color = 'var(--status-online)';
        else if (cls === 'err') div.style.color = 'var(--status-offline)';
        else if (cls === 'warn') div.style.color = 'var(--status-warning)';
        else if (cls === 'muted') div.style.color = 'var(--text-dim)';
    }
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

function printPrompt() {
    const line = document.createElement('div');
    line.style.color = 'var(--status-info)';
    line.textContent = currentCwd + ' $';
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function printExecutedLine(cmd) {
    const line = document.createElement('div');
    line.innerHTML = `<span style="color: var(--status-info);">${escapeHtml(currentCwd)} $</span> <span class="fw-bold">${escapeHtml(cmd)}</span>`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function runLocal(cmd) {
    if (cmd === 'clear') {
        terminal.innerHTML = '';
        return true;
    }
    if (cmd === 'help') {
        print('Available built-in commands:', 'ok');
        print('  help       - show this help menu', 'muted');
        print('  clear      - clear terminal screen', 'muted');
        print('  processes  - list monitored processes via API', 'muted');
        print('  system     - display server & PHP details', 'muted');
        print('', 'muted');
        print('Any other command is executed on the server shell. All commands are audit-logged.', 'warn');
        return true;
    }
    if (cmd === 'processes') {
        print('Fetching process status...', 'muted');
        fetch('api.php?action=status')
            .then(r => r.json())
            .then(res => {
                if (!res.success) {
                    print('Failed to fetch status', 'err');
                    printPrompt();
                    return;
                }
                res.data.forEach(p => {
                    const statusStr = (p.status === 'running') ? 'ONLINE ' : 'OFFLINE';
                    const color = (p.status === 'running') ? 'ok' : 'err';
                    print(`${p.name.padEnd(20)} [${statusStr}] PID: ${p.pid || '---'} | CPU: ${p.cpu || 0}% | RAM: ${p.mem || '0 MB'}`, color);
                });
                print(`Total Monitored: ${res.data.length}`, 'ok');
                printPrompt();
            }).catch(() => {
                print('Error connecting to API', 'err');
                printPrompt();
            });
        return true;
    }
    if (cmd === 'system') {
        const info = [
            `User:        ${SESSION_USER.username} (${SESSION_USER.role})`,
            `Server:      ${SERVER_INFO.server}`,
            `PHP Version: ${SERVER_INFO.php}`,
            `OS:          ${SERVER_INFO.os}`,
            `Time:        ${new Date().toLocaleString()}`
        ];
        info.forEach(line => print(line, 'muted'));
        return true;
    }
    return false;
}

async function runCommand(rawCmd) {
    const cmd = rawCmd.trim();
    if (cmd === '') {
        printPrompt();
        return;
    }

    history.push(cmd);
    historyIndex = history.length;
    input.value = '';

    printExecutedLine(cmd);

    if (cmd === 'clear') {
        runLocal(cmd);
        printPrompt();
        return;
    }
    if (runLocal(cmd)) {
        printPrompt();
        return;
    }

    const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const fd = new FormData();
    fd.append('cmd', cmd);
    fd.append('csrf_token', csrf);

    try {
        const res = await fetch('api.php?action=terminal', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
            if (data.cwd) currentCwd = data.cwd;
            if (data.timed_out) print('[Command timed out after 30 seconds]', 'err');
            if (data.output) print(data.output.replace(/\n$/, ''));
            if (data.exit_code !== 0 && data.exit_code !== null) print(`[Exit code: ${data.exit_code}]`, 'warn');
        } else {
            print(data.message || 'Command failed', 'err');
        }
    } catch (e) {
        print('Server communication error', 'err');
    }
    printPrompt();
}

document.getElementById('run-btn').addEventListener('click', () => runCommand(input.value));
document.getElementById('clear-btn').addEventListener('click', () => runCommand('clear'));

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        runCommand(input.value);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            input.value = history[historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
            historyIndex++;
            input.value = history[historyIndex];
        } else {
            historyIndex = history.length;
            input.value = '';
        }
    } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        terminal.innerHTML = '';
        printPrompt();
    }
});

terminal.addEventListener('click', () => input.focus());

print('Binary Alive Root Console', 'ok');
print('Type "help" for local commands. All actions are logged.', 'muted');
print('---------------------------------------------------------', 'muted');
printPrompt();
input.focus();
</script>

<?php require_once __DIR__ . '/components/footer.php'; ?>
