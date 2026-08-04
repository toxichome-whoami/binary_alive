<?php
require_once 'includes/security.php';
require_once 'includes/auth.php';

$auth = new Auth();
$auth->requireAuth();
$auth->requireRole(['admin']); // Only admins can access the terminal

$sysUser = get_current_user();
if (empty($sysUser) && PHP_OS_FAMILY !== 'Windows') {
    $sysUser = trim(shell_exec('whoami'));
}
if (empty($sysUser)) $sysUser = 'root';

$sysHost = gethostname();
if (empty($sysHost)) $sysHost = php_uname('n');
if (empty($sysHost)) $sysHost = 'binary-alive';

// Determine the real home directory to use as the default terminal path
if (!isset($_SESSION['terminal_cwd'])) {
    if (PHP_OS_FAMILY === 'Windows') {
        $homeDir = getenv('USERPROFILE') ?: getenv('HOMEDRIVE') . getenv('HOMEPATH') ?: 'C:\\';
    } else {
        // On Linux/BSD/Mac: try HOME env, then read from /etc/passwd, then fall back
        $homeDir = getenv('HOME');
        if (empty($homeDir)) {
            $homeDir = trim(shell_exec('echo ~'));
        }
        if (empty($homeDir) || $homeDir === '~') {
            $homeDir = '/home/' . $sysUser;
        }
    }
    // If the resolved home dir actually exists, use it; otherwise fall back to web root
    $_SESSION['terminal_cwd'] = (is_dir($homeDir)) ? $homeDir : __DIR__;
}
?>
<?php
$pageTitle = 'Terminal';
require_once 'components/header.php';
require_once 'components/navbar.php';
?>

<style>
    /* Shared */
    #terminal {
        height: 65vh;
        overflow-y: auto;
        padding: 15px;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
    }

    /* Default (Light Mode) */
    .terminal-header { background-color: #f8f9fa; color: #212529; border-bottom: 1px solid #dee2e6; }
    .terminal-container { background-color: #ffffff; color: #333333; font-family: 'Consolas', 'Courier New', monospace; border-radius: 0 0 5px 5px; border: 1px solid #dee2e6; border-top: none; }
    .cmd-line { color: #007936; font-weight: bold; }
    .prompt { color: #0056b3; font-weight: bold; }
    .output { color: #333333; }
    .err { color: #dc3545; }
    .muted { color: #6c757d; }
    .ok { color: #198754; }
    .warn { color: #ffc107; }
    .prompt-path { color: rgb(106, 153, 85); font-weight: bold; }
    .prompt-symbol { color: rgb(86, 156, 214); font-weight: bold; margin-right: 8px; }
    .cmd-text { color: #000000; font-weight: bold; }
    .cmd-wrapper {
        position: relative;
        padding-left: 18px;
        margin-top: 8px;
        margin-bottom: 8px;
    }
    .cmd-wrapper::before {
        content: '';
        position: absolute;
        left: 2px;
        top: 0.75em;
        bottom: 0.75em;
        width: 10px;
        border-left: 2px solid #6c757d;
        border-top: 2px solid #6c757d;
        border-bottom: 2px solid #6c757d;
        border-top-left-radius: 6px;
        border-bottom-left-radius: 6px;
    }
    .prompt-line-1 { display: flex; align-items: center; margin-bottom: 2px; }
    .prompt-line-2 { display: flex; align-items: center; }
    .term-footer { background-color: #f8f9fa; padding: 10px 15px; border-top: 1px solid #dee2e6; border-radius: 0 0 5px 5px; }
    #term-input { background-color: #ffffff; color: #333333; border: 1px solid #dee2e6; border-left: none; font-family: 'Consolas', 'Courier New', monospace; }
    #term-input:focus { outline: none; border-color: #dee2e6; box-shadow: none; }

    /* Dark Mode Overrides */
    [data-bs-theme="dark"] .terminal-card { border: 1px solid #333940; }
    [data-bs-theme="dark"] .terminal-header { background-color: #2b3035 !important; border-bottom: 1px solid #333940; color: #f8f9fa; }
    [data-bs-theme="dark"] .terminal-container { background-color: #0c0c0c; color: #d4d4d4; border: none; }
    [data-bs-theme="dark"] .cmd-line { color: #4ec9b0; font-weight: normal; }
    [data-bs-theme="dark"] .prompt { color: #569cd6; font-weight: normal; }
    [data-bs-theme="dark"] .output { color: #d4d4d4; }
    [data-bs-theme="dark"] .err { color: #f44747; }
    [data-bs-theme="dark"] .muted { color: #808080; }
    [data-bs-theme="dark"] .ok { color: #6a9955; }
    [data-bs-theme="dark"] .warn { color: #e2b93d; }
    [data-bs-theme="dark"] .cmd-text { color: #d4d4d4; font-weight: normal; }
    [data-bs-theme="dark"] .cmd-wrapper::before { border-color: #808080; }
    [data-bs-theme="dark"] .term-footer { background-color: #1e1e1e; border-top: 1px solid #333; }
    [data-bs-theme="dark"] #prompt-label-full, [data-bs-theme="dark"] #prompt-label-short { background-color: #1e1e1e; border-color: #333; color: #569cd6 !important; font-weight: normal !important; border-right: none; }
    [data-bs-theme="light"] #prompt-label-full, [data-bs-theme="light"] #prompt-label-short { background-color: #ffffff; border-color: #dee2e6; color: #0056b3; font-weight: bold; border-right: none; }
    #prompt-label-full, #prompt-label-short { font-family: 'Consolas', 'Courier New', monospace; }
    [data-bs-theme="dark"] #term-input { background-color: #1e1e1e; color: #d4d4d4; border: 1px solid #333; }
    [data-bs-theme="dark"] #term-input:focus { border-color: #333; }
</style>

<div class="container mt-4 mb-4">
    <div class="card terminal-card">
        <div class="card-header terminal-header d-flex justify-content-between align-items-center">
            <span><i class="bi bi-terminal"></i> Root Terminal (Admin)</span>
            <button id="clear-btn" class="btn btn-sm btn-outline-secondary"><i class="bi bi-eraser"></i> Clear</button>
        </div>
        <div class="card-body p-0 terminal-container">
            <div id="terminal"></div>
            <div class="term-footer">
                <div class="input-group">
                    <span class="input-group-text d-none d-sm-flex" id="prompt-label-full"><?= htmlspecialchars($sysUser) ?>@<?= htmlspecialchars($sysHost) ?>:~$</span>
                    <span class="input-group-text d-sm-none" id="prompt-label-short" style="font-family: 'Consolas', monospace; color: #0056b3; font-weight: bold;">~$</span>
                    <input type="text" id="term-input" class="form-control" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type a command and press Enter (try: help)" autofocus>
                    <button id="run-btn" class="btn btn-outline-success"><i class="bi bi-play-fill"></i></button>
                </div>
            </div>
        </div>
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script>
const terminal = document.getElementById('terminal');
const input = document.getElementById('term-input');
const SESSION_USER = <?= json_encode(['username' => $_SESSION['username'], 'role' => $_SESSION['role']]) ?>;
let currentCwd = <?= json_encode($_SESSION['terminal_cwd'] ?? __DIR__) ?>;
const SERVER_INFO = <?= json_encode(['server' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown', 'php' => phpversion(), 'os' => PHP_OS]) ?>;

function buildPromptDOM(cmdText) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cmd-wrapper';

    const line1 = document.createElement('div');
    line1.className = 'prompt-line-1';

    const pathBlock = document.createElement('span');
    pathBlock.className = 'prompt-path';
    pathBlock.textContent = currentCwd;

    line1.appendChild(pathBlock);

    const line2 = document.createElement('div');
    line2.className = 'prompt-line-2';

    const symbol = document.createElement('span');
    symbol.className = 'prompt-symbol';
    symbol.textContent = '$ ';

    line2.appendChild(symbol);

    if (cmdText !== null) {
        const cmdSpan = document.createElement('span');
        cmdSpan.className = 'cmd-text';
        cmdSpan.textContent = cmdText;
        line2.appendChild(cmdSpan);
    }

    wrapper.appendChild(line1);
    wrapper.appendChild(line2);
    return wrapper;
}

let history = [];
let historyIndex = -1;

function print(text, cls) {
    const div = document.createElement('div');
    if (text === '') text = ' ';
    div.textContent = text;
    if (cls) div.classList.add(cls);
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

function printPrompt() {
    terminal.appendChild(buildPromptDOM(null));
    terminal.scrollTop = terminal.scrollHeight;
}

function printExecutedLine(cmd) {
    const lastChild = terminal.lastElementChild;
    if (lastChild && lastChild.classList.contains('cmd-wrapper')) {
        const line2 = lastChild.querySelector('.prompt-line-2');
        if (line2 && !line2.querySelector('.cmd-text')) {
            terminal.removeChild(lastChild);
        }
    }
    terminal.appendChild(buildPromptDOM(cmd));
    terminal.scrollTop = terminal.scrollHeight;
}

function runLocal(cmd) {
    if (cmd === 'clear') {
        terminal.innerHTML = '';
        return true;
    }
    if (cmd === 'help') {
        print('Available built-in commands:', 'ok');
        print('  help       - show this help', 'muted');
        print('  clear      - clear the terminal', 'muted');
        print('  processes  - show monitored processes (via API)', 'muted');
        print('  system     - show basic server info', 'muted');
        print('', 'muted');
        print('Any other command is executed on the server shell via the terminal API.', 'muted');
        print('Every command is logged to the audit logs. Use with caution.', 'warn');
        return true;
    }
    if (cmd === 'processes') {
        print('Fetching process status...', 'muted');
        $.getJSON('api.php?action=status', function(res) {
            if (!res.success) {
                print('Failed to fetch status', 'err');
                printPrompt();
                return;
            }
            res.data.forEach(function(p) {
                const icon = p.status === 'running' ? 'RUNNING ' : (p.status === 'crashed' ? 'CRASHED ' : 'STOPPED ');
                const color = p.status === 'running' ? 'ok' : (p.status === 'crashed' ? 'err' : 'muted');
                print(p.name.padEnd(20) + icon.padEnd(9) + 'pid=' + (p.pid || '---') + '  cpu=' + (p.cpu || 0) + '%', color);
            });
            print('Total processes: ' + res.data.length, 'ok');
            printPrompt();
        });
        return true;
    }
    if (cmd === 'system') {
        const info = [
            'User:        ' + SESSION_USER.username,
            'Role:        ' + SESSION_USER.role,
            'Server:      ' + SERVER_INFO.server,
            'PHP Version: ' + SERVER_INFO.php,
            'OS:          ' + SERVER_INFO.os,
            'Date:        ' + new Date().toLocaleString()
        ];
        info.forEach(function(line) { print(line, 'output'); });
        return true;
    }
    return false;
}

function runCommand(rawCmd) {
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

    $.post('api.php?action=terminal', { cmd: cmd }, function(res) {
        if (res.success) {
            if (res.cwd) {
                currentCwd = res.cwd;
            }
            if (res.timed_out) {
                print('[Command timed out after 30 seconds]', 'err');
            }
            if (res.output && res.output !== '') {
                print(res.output.replace(/\n$/, ''), 'output');
            }
            if (res.exit_code !== 0 && res.exit_code !== null) {
                print('[Exit code: ' + res.exit_code + ']', 'warn');
            }
            printPrompt();
        } else {
            print(res.message || 'Command failed', 'err');
            printPrompt();
        }
    }, 'json').fail(function() {
        print('Request failed - is the server reachable?', 'err');
        printPrompt();
    });
}

$('#run-btn').click(function() { runCommand(input.value); });

input.addEventListener('keydown', function(e) {
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
    }
});

$('#clear-btn').click(function() { runCommand('clear'); });

terminal.addEventListener('click', function() { input.focus(); });

print('Binary Alive Terminal', 'ok');
print('Type "help" to see available built-in commands. All commands are logged.', 'muted');
print('--------------------------------------------------------------', 'muted');
printPrompt();
input.focus();
</script>
<?php require_once 'components/footer.php'; ?>
