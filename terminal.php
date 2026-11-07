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
    $_SESSION['terminal_home'] = $homeDir;
    $_SESSION['terminal_cwd'] = (is_dir($homeDir)) ? $homeDir : __DIR__;
}

if (!isset($_SESSION['terminal_shell'])) {
    $_SESSION['terminal_shell'] = (PHP_OS_FAMILY === 'Windows') ? 'cmd' : 'bash';
}

$isWindows = (PHP_OS_FAMILY === 'Windows');
$activeShell = $_SESSION['terminal_shell'];
$currentCwd = $_SESSION['terminal_cwd'];

$pageTitle = 'Terminal';
require_once __DIR__ . '/components/header.php';
require_once __DIR__ . '/components/navbar.php';
?>

<div class="container-fluid py-4 px-md-4">
    <div class="card">
        <div class="card-header d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-terminal text-muted"></i>
                <span>Server Terminal</span>
            </div>
            <button id="quick-clear-btn" class="btn-clean btn-clean-sm" type="button" title="Clear Screen (Ctrl+L)">
                <i class="bi bi-trash"></i> Clear
            </button>
        </div>
        <div class="card-body p-0">
            <!-- Terminal Stream Canvas -->
            <div class="terminal-screen" id="terminal-screen">
                <!-- Log buffer container -->
                <div id="terminal-log"></div>

                <!-- Active interactive prompt line at the bottom of the buffer -->
                <div class="terminal-input-line" id="terminal-active-line">
                    <span class="terminal-prompt-badge" id="terminal-prompt-badge"></span>
                    <span class="terminal-text-buffer" id="terminal-text-buffer"></span>
                    <span class="terminal-cursor" id="terminal-cursor"></span>
                </div>

                <!-- Autocomplete suggestion box -->
                <div id="terminal-autocomplete-bar" class="terminal-autocomplete-box" style="display: none;"></div>

                <!-- Off-screen receiver capturing keystrokes and clipboard -->
                <textarea id="terminal-receiver" class="terminal-hidden-receiver" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
            </div>
        </div>
    </div>
</div>

<script>
(function() {
    'use strict';

    const screen = document.getElementById('terminal-screen');
    const logContainer = document.getElementById('terminal-log');
    const promptBadge = document.getElementById('terminal-prompt-badge');
    const textBuffer = document.getElementById('terminal-text-buffer');
    const receiver = document.getElementById('terminal-receiver');
    const autocompleteBar = document.getElementById('terminal-autocomplete-bar');
    const cwdDisplay = document.getElementById('cwd-display');
    const activeShellLabel = document.getElementById('active-shell-label');

    const SESSION_USER = <?= json_encode(['username' => $_SESSION['username'], 'role' => $_SESSION['role']]) ?>;
    const SYS_HOST = <?= json_encode($sysHost) ?>;
    const IS_WINDOWS = <?= json_encode($isWindows) ?>;
    let currentCwd = <?= json_encode($currentCwd) ?>;
    let activeShell = <?= json_encode($activeShell) ?>;

    let commandHistory = [];
    let historyPointer = -1;
    let isExecuting = false;
    let autocompleteItems = [];
    let autocompleteIndex = -1;

    // ANSI escape parser: converts terminal colors to CSS-styled spans
    function parseAnsi(text) {
        if (!text) return '';
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return escaped.replace(/\x1b\[([0-9;]+)m/g, function(match, codes) {
            const parts = codes.split(';');
            let classes = [];
            for (let i = 0; i < parts.length; i++) {
                const code = parseInt(parts[i], 10);
                if (code === 0) return '</span>';
                if (code === 1) classes.push('ansi-bold');
                if (code === 2) classes.push('ansi-dim');
                if (code === 3) classes.push('ansi-italic');
                if (code === 4) classes.push('ansi-underline');
                if (code >= 30 && code <= 37) classes.push('ansi-c' + code);
                if (code >= 90 && code <= 97) classes.push('ansi-c' + code);
            }
            return '<span class="' + classes.join(' ') + '">';
        });
    }

    function updatePrompt() {
        if (IS_WINDOWS) {
            if (activeShell === 'powershell') {
                promptBadge.className = 'terminal-prompt-badge terminal-prompt-ps';
                promptBadge.textContent = 'PS ' + currentCwd + '>';
            } else {
                promptBadge.className = 'terminal-prompt-badge terminal-prompt-cmd';
                promptBadge.textContent = currentCwd + '>';
            }
        } else {
            promptBadge.className = 'terminal-prompt-badge terminal-prompt-bash';
            const shortCwd = currentCwd.replace(/^\/home\/[^\/]+/, '~');
            promptBadge.textContent = SESSION_USER.username + '@' + SYS_HOST + ':' + shortCwd + (activeShell === 'sh' ? '# ' : '$ ');
        }
        if (cwdDisplay) cwdDisplay.textContent = currentCwd;
    }

    function appendLine(html, cls) {
        const div = document.createElement('div');
        div.className = 'terminal-line' + (cls ? ' ' + cls : '');
        div.innerHTML = html;
        logContainer.appendChild(div);
        scrollToBottom();
    }

    function appendExecuted(cmd) {
        const div = document.createElement('div');
        div.className = 'terminal-line d-flex align-items-baseline';
        
        const badge = document.createElement('span');
        badge.className = promptBadge.className;
        badge.textContent = promptBadge.textContent;
        badge.style.marginRight = '0.4rem';

        const text = document.createElement('span');
        text.className = 'fw-bold text-white';
        text.textContent = cmd;

        div.appendChild(badge);
        div.appendChild(text);
        logContainer.appendChild(div);
        scrollToBottom();
    }

    function scrollToBottom() {
        screen.scrollTop = screen.scrollHeight;
    }

    function focusInput() {
        receiver.focus();
    }

    function syncBuffer() {
        textBuffer.textContent = receiver.value;
        scrollToBottom();
    }

    function clearAutocomplete() {
        autocompleteBar.style.display = 'none';
        autocompleteBar.innerHTML = '';
        autocompleteItems = [];
        autocompleteIndex = -1;
    }

    async function handleAutocomplete() {
        const val = receiver.value;
        if (!val) return;
        const tokens = val.split(/\s+/);
        const lastToken = tokens[tokens.length - 1] || '';

        try {
            const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
            const res = await fetch(`api.php?action=terminal_autocomplete&prefix=${encodeURIComponent(lastToken)}`);
            const data = await res.json();
            if (data.success && data.matches && data.matches.length > 0) {
                if (data.matches.length === 1) {
                    // Direct single match autocompletion
                    tokens[tokens.length - 1] = data.matches[0].name;
                    receiver.value = tokens.join(' ');
                    syncBuffer();
                    clearAutocomplete();
                } else {
                    // Multiple suggestions
                    autocompleteItems = data.matches;
                    autocompleteBar.innerHTML = '';
                    autocompleteBar.style.display = 'flex';
                    data.matches.forEach((item, idx) => {
                        const pill = document.createElement('span');
                        pill.className = 'terminal-autocomplete-item' + (item.is_dir ? ' is-dir' : '');
                        pill.textContent = item.name;
                        pill.addEventListener('click', () => {
                            tokens[tokens.length - 1] = item.name;
                            receiver.value = tokens.join(' ');
                            syncBuffer();
                            clearAutocomplete();
                            focusInput();
                        });
                        autocompleteBar.appendChild(pill);
                    });
                }
            } else {
                clearAutocomplete();
            }
        } catch (e) {
            clearAutocomplete();
        }
    }

    function runLocalCommand(cmd) {
        const lower = cmd.toLowerCase().trim();
        if (lower === 'clear' || lower === 'cls') {
            logContainer.innerHTML = '';
            clearAutocomplete();
            return true;
        }

        if (lower === 'help') {
            const lines = [
                '<span class="text-info ansi-bold">Binary Alive Native Terminal &mdash; Help Menu</span>',
                '<span class="text-muted">Available Built-In Commands:</span>',
                '  <span class="text-success">help</span>       - Displays this help reference',
                '  <span class="text-success">clear / cls</span> - Clears the terminal screen (or press Ctrl+L)',
                '  <span class="text-success">processes</span>   - Fetches and displays live monitored processes and CPU/RAM',
                '  <span class="text-success">system</span>      - Displays host server architecture, PHP version, and time',
                '',
                '<span class="text-muted">Dual-Shell Engine:</span>',
                <?php if ($isWindows): ?>
                '  <span class="text-warning">powershell / power</span> - Switches session to Windows PowerShell engine',
                '  <span class="text-warning">cmd</span>                - Switches session to Windows Command Prompt (CMD)',
                '  <span class="text-warning">D: or C:</span>           - Switches active Windows drive directly',
                <?php else: ?>
                '  <span class="text-warning">bash / sh</span>          - Switches between Bash and POSIX Sh',
                <?php endif; ?>
                '  <span class="text-warning">exit</span>               - Resets session to system default shell',
                '',
                '<span class="text-muted">Keyboard Controls:</span>',
                '  <span class="ansi-dim">Up / Down Arrow</span>        - Browse command history',
                '  <span class="ansi-dim">Tab</span>                    - File and directory path autocompletion',
                '  <span class="ansi-dim">Ctrl + L</span>                - Instant screen clear',
                '  <span class="ansi-dim">Ctrl + C</span>                - Cancel/interrupt current input line'
            ];
            lines.forEach(l => appendLine(l));
            return true;
        }

        if (lower === 'processes') {
            appendLine('<span class="text-muted">Querying monitored processes...</span>');
            fetch('api.php?action=status')
                .then(r => r.json())
                .then(res => {
                    if (!res.success) {
                        appendLine('<span class="text-danger">Failed to fetch process status.</span>');
                        return;
                    }
                    if (res.data.length === 0) {
                        appendLine('<span class="text-warning">No processes are currently configured.</span>');
                        return;
                    }
                    res.data.forEach(p => {
                        const statusClass = (p.status === 'running') ? 'text-success' : 'text-danger';
                        const statusTag = (p.status === 'running') ? 'ONLINE ' : 'OFFLINE';
                        appendLine(`<span class="${statusClass} fw-bold">[${statusTag}]</span> <span class="fw-bold">${p.name.padEnd(20)}</span> PID: ${p.pid || '---'} | CPU: ${p.cpu || 0}% | RAM: ${p.mem || '0 MB'} | Auto-Restart: ${p.auto_restart == 1 ? 'Enabled' : 'Disabled'}`);
                    });
                    appendLine(`<span class="text-muted">Total: ${res.data.length} | Load: ${res.sys_load || 'N/A'} | Memory: ${res.sys_mem || 'N/A'}</span>`);
                })
                .catch(() => appendLine('<span class="text-danger">Error contacting API endpoint.</span>'));
            return true;
        }

        if (lower === 'system') {
            const sysInfo = [
                `<span class="text-muted">User:</span>        ${SESSION_USER.username} (${SESSION_USER.role})`,
                `<span class="text-muted">Host:</span>        ${SYS_HOST}`,
                `<span class="text-muted">Shell:</span>       ${activeShell} (${IS_WINDOWS ? 'Windows' : 'Unix'})`,
                `<span class="text-muted">PHP Version:</span> <?= phpversion() ?>`,
                `<span class="text-muted">Directory:</span>   ${currentCwd}`,
                `<span class="text-muted">Local Time:</span>  ${new Date().toLocaleString()}`
            ];
            sysInfo.forEach(l => appendLine(l));
            return true;
        }

        return false;
    }

    async function executeCommand(rawCmd) {
        const cmd = rawCmd.trim();
        clearAutocomplete();

        if (cmd === '') {
            appendExecuted('');
            return;
        }

        commandHistory.push(cmd);
        historyPointer = commandHistory.length;
        receiver.value = '';
        syncBuffer();

        appendExecuted(cmd);

        if (runLocalCommand(cmd)) {
            return;
        }

        isExecuting = true;
        const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
        const fd = new FormData();
        fd.append('cmd', cmd);
        fd.append('csrf_token', csrf);

        try {
            const res = await fetch('api.php?action=terminal', { method: 'POST', body: fd });
            const data = await res.json();

            if (data.success) {
                if (data.cwd) {
                    currentCwd = data.cwd;
                }
                if (data.shell) {
                    activeShell = data.shell;
                    if (activeShellLabel) {
                        activeShellLabel.textContent = IS_WINDOWS ? (activeShell === 'powershell' ? 'PowerShell' : 'Command Prompt (CMD)') : (activeShell === 'sh' ? 'POSIX Sh' : 'Bash');
                    }
                    document.querySelectorAll('.shell-option').forEach(opt => {
                        opt.classList.toggle('active', opt.dataset.shell === activeShell);
                    });
                }
                updatePrompt();

                if (data.clear) {
                    logContainer.innerHTML = '';
                } else if (data.output) {
                    appendLine(parseAnsi(data.output));
                }

                if (data.timed_out) {
                    appendLine('<span class="text-danger">[Command execution timed out after 30 seconds]</span>');
                }

                if (data.exit_code !== 0 && data.exit_code !== null) {
                    appendLine(`<span class="text-warning">[Exit code: ${data.exit_code}]</span>`);
                }
            } else {
                appendLine(`<span class="text-danger">${data.message || 'Command execution failed.'}</span>`);
            }
        } catch (e) {
            appendLine('<span class="text-danger">Network communication failure with terminal API.</span>');
        } finally {
            isExecuting = false;
            scrollToBottom();
            focusInput();
        }
    }

    // Event Listeners
    receiver.addEventListener('input', () => {
        syncBuffer();
        clearAutocomplete();
    });

    receiver.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executeCommand(receiver.value);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyPointer > 0) {
                historyPointer--;
                receiver.value = commandHistory[historyPointer];
                syncBuffer();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyPointer < commandHistory.length - 1) {
                historyPointer++;
                receiver.value = commandHistory[historyPointer];
                syncBuffer();
            } else {
                historyPointer = commandHistory.length;
                receiver.value = '';
                syncBuffer();
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            handleAutocomplete();
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            logContainer.innerHTML = '';
            clearAutocomplete();
        } else if (e.key === 'c' && e.ctrlKey) {
            e.preventDefault();
            appendExecuted(receiver.value + '^C');
            receiver.value = '';
            syncBuffer();
            clearAutocomplete();
        }
    });

    screen.addEventListener('click', () => {
        focusInput();
    });

    // Quick Clear Button
    const clearBtn = document.getElementById('quick-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            logContainer.innerHTML = '';
            clearAutocomplete();
            focusInput();
        });
    }

    // Initialize prompt and cursor
    updatePrompt();
    focusInput();
})();
</script>

<?php require_once __DIR__ . '/components/footer.php'; ?>
