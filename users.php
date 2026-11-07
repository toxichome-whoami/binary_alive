<?php
require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/auth.php';

$auth = new Auth();
$auth->requireAuth();
$auth->requireRole(['admin']);

$pdo = $auth->getPdo();
$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrfToken();
    $action = $_POST['action'] ?? '';

    $targetUsername = "Unknown";
    $targetRole = "viewer";
    if (isset($_POST['id'])) {
        $stmt = $pdo->prepare("SELECT username, role FROM users WHERE id = ?");
        $stmt->execute([$_POST['id']]);
        $userRow = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($userRow) {
            $targetUsername = $userRow['username'];
            $targetRole = $userRow['role'];
        } else {
            $targetUsername = "ID " . $_POST['id'];
        }
    }

    if ($action === 'create') {
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $role = $_POST['role'] ?? 'viewer';

        if ($_SESSION['user_id'] != 1 && $role === 'admin') {
            $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Only the master admin can create other admin accounts.</div>';
        } elseif ($username && $password) {
            $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            try {
                $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)");
                $stmt->execute([$username, $hash, $role]);
                $auth->getLogger()->logAudit($_SESSION['user_id'], 'create_user', "Created user: $username");
                $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">User created successfully.</div>';
            } catch (PDOException $e) {
                $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Username already exists.</div>';
            }
        }
    } elseif ($action === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        if ($id == 1) {
            $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">The master admin account cannot be deleted.</div>';
        } elseif ($id == $_SESSION['user_id']) {
            $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">You cannot delete your own account.</div>';
        } elseif ($_SESSION['user_id'] != 1 && $targetRole === 'admin') {
            $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Only the master admin can delete other admin accounts.</div>';
        } else {
            $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$id]);
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'delete_user', "Deleted user: $targetUsername");
            $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">User deleted.</div>';
        }
    } elseif ($action === 'change_password') {
        $id = (int)($_POST['id'] ?? 0);
        $new_username = trim($_POST['new_username'] ?? '');
        $new_password = $_POST['new_password'] ?? '';
        $new_role = $_POST['new_role'] ?? '';

        $error = false;
        if ($id == 1 && $_SESSION['user_id'] != 1) {
            $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Only the master admin can modify the master account.</div>';
            $error = true;
        } elseif ($id == 1 && !empty($new_role) && $new_role !== 'admin') {
            $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">The master admin role cannot be changed.</div>';
            $error = true;
        } elseif ($_SESSION['user_id'] != 1 && $targetRole === 'admin' && $id != $_SESSION['user_id']) {
            $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Only the master admin can modify other admin accounts.</div>';
            $error = true;
        } elseif ($_SESSION['user_id'] != 1 && !empty($new_role) && $new_role === 'admin' && $targetRole !== 'admin') {
            $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Only the master admin can grant the admin role.</div>';
            $error = true;
        }

        if (!$error) {
            try {
                $updates = [];
                $params = [];

                if (!empty($new_username)) {
                    $updates[] = "username = ?";
                    $params[] = $new_username;
                }
                if (!empty($new_password)) {
                    $updates[] = "password_hash = ?";
                    $params[] = password_hash($new_password, PASSWORD_BCRYPT, ['cost' => 12]);
                }
                if (!empty($new_role)) {
                    $updates[] = "role = ?";
                    $params[] = $new_role;
                }

                if (!empty($updates)) {
                    $params[] = $id;
                    $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $auth->getLogger()->logAudit($_SESSION['user_id'], 'edit_user', "Updated user: $targetUsername");
                    $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">User details updated.</div>';

                    if ($id == $_SESSION['user_id'] && !empty($new_username)) {
                        $_SESSION['username'] = $new_username;
                    }
                }
            } catch (PDOException $e) {
                $_SESSION['flash_message'] = '<div class="alert alert-danger py-2 px-3 small">Failed to update user. Username might already exist.</div>';
            }
        }
    } elseif ($action === 'generate_token') {
        $id = (int)($_POST['id'] ?? 0);
        $token = bin2hex(random_bytes(32));
        $hashedToken = hash('sha256', $token);
        $stmt = $pdo->prepare("UPDATE users SET api_token = ? WHERE id = ?");
        $stmt->execute([$hashedToken, $id]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'generate_api_token', "Generated API Token for: $targetUsername");
        $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">API Token generated for <strong>' . htmlspecialchars($targetUsername) . '</strong>.<br><strong>Copy token now (shown only once):</strong><br><code class="d-block bg-dark text-warning p-2 mt-2 user-select-all rounded font-mono">' . htmlspecialchars($token) . '</code></div>';
    } elseif ($action === 'delete_token') {
        $id = (int)($_POST['id'] ?? 0);
        $stmt = $pdo->prepare("UPDATE users SET api_token = NULL WHERE id = ?");
        $stmt->execute([$id]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'delete_api_token', "Deleted API Token for: $targetUsername");
        $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">API Token deleted.</div>';
    } elseif ($action === 'remove_2fa') {
        $id = (int)($_POST['id'] ?? 0);
        $stmt = $pdo->prepare("UPDATE users SET totp_secret = NULL WHERE id = ?");
        $stmt->execute([$id]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'disable_2fa', "Disabled 2FA for: $targetUsername");
        $_SESSION['flash_message'] = '<div class="alert alert-success py-2 px-3 small">Two-factor authentication disabled for user.</div>';
    }

    header("Location: " . $_SERVER['REQUEST_URI']);
    exit;
}

if (isset($_SESSION['flash_message'])) {
    $message = $_SESSION['flash_message'];
    unset($_SESSION['flash_message']);
}

$limit = 20;
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$offset = ($page - 1) * $limit;

$totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
$totalPages = ceil($totalUsers / $limit);

$stmt = $pdo->prepare("SELECT id, username, role, api_token, totp_secret, created_at, failed_attempts FROM users LIMIT ? OFFSET ?");
$stmt->execute([$limit, $offset]);
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

$pageTitle = 'Users';
require_once __DIR__ . '/components/header.php';
require_once __DIR__ . '/components/navbar.php';
?>

<div class="container-fluid py-4 px-md-4">
    <?php if ($message): ?>
        <div class="mb-3"><?= $message ?></div>
    <?php endif; ?>

    <!-- Add User Card -->
    <div class="card mb-4">
        <div class="card-header">
            <i class="bi bi-person-plus text-muted"></i> Add User
        </div>
        <div class="card-body">
            <form method="POST" class="row g-2 align-items-center">
                <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                <input type="hidden" name="action" value="create">
                
                <div class="col-sm-3">
                    <input type="text" class="form-control" name="username" placeholder="Username" required autocomplete="off">
                </div>
                <div class="col-sm-3">
                    <input type="password" class="form-control" name="password" placeholder="Password" required autocomplete="new-password">
                </div>
                <div class="col-sm-3">
                    <select class="form-select" name="role">
                        <option value="admin" <?= $_SESSION['user_id'] == 1 ? '' : 'disabled' ?>>Admin</option>
                        <option value="operator">Operator</option>
                        <option value="viewer" selected>Viewer</option>
                        <option value="auditor">Auditor</option>
                    </select>
                </div>
                <div class="col-auto">
                    <button type="submit" class="btn-clean btn-clean-primary">
                        <i class="bi bi-plus-lg"></i> Create User
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- User Table Card -->
    <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
            <span>Registered Accounts</span>
            <span class="text-muted small">Total: <?= (int)$totalUsers ?></span>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th style="width: 50px;">ID</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>API Token</th>
                            <th>2FA</th>
                            <th>Failed Logins</th>
                            <th style="width: 200px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($users as $u):
                            $isMasterAdmin = ($u['id'] == 1);
                            $isSelf = ($u['id'] == $_SESSION['user_id']);
                            $isOtherAdmin = ($u['role'] === 'admin' && !$isSelf);
                            $canEdit = ($_SESSION['user_id'] == 1 || (!$isMasterAdmin && !$isOtherAdmin) || $isSelf);
                            $canDelete = ($_SESSION['user_id'] == 1 ? !$isMasterAdmin && !$isSelf : !$isMasterAdmin && !$isOtherAdmin && !$isSelf);
                            $disableRoleSelect = ($isMasterAdmin) ? 'true' : 'false';
                        ?>
                        <tr>
                            <td class="font-mono text-muted"><?= $u['id'] ?></td>
                            <td class="fw-semibold"><?= htmlspecialchars($u['username']) ?></td>
                            <td>
                                <?php if ($isMasterAdmin): ?>
                                    <span class="version-pill" style="color: var(--status-warning); border-color: rgba(210,153,34,0.4);">Master Admin</span>
                                <?php else: ?>
                                    <span class="version-pill"><?= ucfirst(htmlspecialchars($u['role'])) ?></span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <?php if ($u['api_token']): ?>
                                    <span class="status-pill online"><span class="status-dot"></span> Active</span>
                                    <?php if ($canEdit): ?>
                                    <form method="POST" class="d-inline ms-1" onsubmit="return confirm('Delete API token?');">
                                        <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                                        <input type="hidden" name="action" value="delete_token">
                                        <input type="hidden" name="id" value="<?= $u['id'] ?>">
                                        <button type="submit" class="btn-clean btn-clean-sm btn-clean-danger" title="Delete Token"><i class="bi bi-x-lg"></i></button>
                                    </form>
                                    <?php endif; ?>
                                <?php else: ?>
                                    <span class="text-dim small">None</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <?php if (!empty($u['totp_secret'])): ?>
                                    <span class="status-pill online"><span class="status-dot"></span> Enabled</span>
                                <?php else: ?>
                                    <span class="text-dim small">Disabled</span>
                                <?php endif; ?>
                            </td>
                            <td class="font-mono text-muted"><?= $u['failed_attempts'] ?></td>
                            <td>
                                <div class="d-flex align-items-center gap-1">
                                    <?php if ($canEdit): ?>
                                    <button class="btn-clean btn-clean-sm" type="button" onclick="openPasswordModal(<?= $u['id'] ?>, '<?= htmlspecialchars($u['username']) ?>', '<?= htmlspecialchars($u['role']) ?>', <?= $disableRoleSelect ?>)">Edit</button>
                                    <form method="POST" class="d-inline" onsubmit="return confirm('Generate new API token?');">
                                        <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                                        <input type="hidden" name="action" value="generate_token">
                                        <input type="hidden" name="id" value="<?= $u['id'] ?>">
                                        <button type="submit" class="btn-clean btn-clean-sm" title="New API Token">Token</button>
                                    </form>
                                    <?php if (!empty($u['totp_secret'])): ?>
                                    <form method="POST" class="d-inline" onsubmit="return confirm('Disable 2FA for this user?');">
                                        <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                                        <input type="hidden" name="action" value="remove_2fa">
                                        <input type="hidden" name="id" value="<?= $u['id'] ?>">
                                        <button type="submit" class="btn-clean btn-clean-sm btn-clean-danger" title="Reset 2FA">Reset 2FA</button>
                                    </form>
                                    <?php endif; ?>
                                    <?php endif; ?>

                                    <?php if ($canDelete): ?>
                                    <form method="POST" class="d-inline" onsubmit="return confirm('Permanently delete this user?');">
                                        <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
                                        <input type="hidden" name="action" value="delete">
                                        <input type="hidden" name="id" value="<?= $u['id'] ?>">
                                        <button type="submit" class="btn-clean btn-clean-sm btn-clean-danger" title="Delete User"><i class="bi bi-trash"></i></button>
                                    </form>
                                    <?php endif; ?>
                                </div>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="card-footer bg-transparent d-flex justify-content-between align-items-center py-2 px-3 border-top">
            <?php if ($page > 1): ?>
                <a href="?page=<?= $page - 1 ?>" class="btn-clean btn-clean-sm">Previous</a>
            <?php else: ?>
                <button class="btn-clean btn-clean-sm opacity-50" disabled>Previous</button>
            <?php endif; ?>

            <span class="text-muted small">Page <?= $page ?> of <?= max(1, $totalPages) ?></span>

            <?php if ($page < $totalPages): ?>
                <a href="?page=<?= $page + 1 ?>" class="btn-clean btn-clean-sm">Next</a>
            <?php else: ?>
                <button class="btn-clean btn-clean-sm opacity-50" disabled>Next</button>
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- Edit User Modal -->
<div class="modal fade" id="passwordModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <form method="POST">
          <div class="modal-header">
            <h5 class="modal-title">Edit User: <span id="modalUsername"></span></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="form-text mb-3">Leave password blank if you do not wish to change it.</div>
            <input type="hidden" name="csrf_token" value="<?= generateCsrfToken() ?>">
            <input type="hidden" name="action" value="change_password">
            <input type="hidden" name="id" id="modalUserId">

            <div class="mb-3">
                <label class="form-label">Username</label>
                <input type="text" name="new_username" id="inputNewUsername" class="form-control" oninput="checkModalChanges()">
            </div>
            <div class="mb-3">
                <label class="form-label">New Password</label>
                <input type="password" name="new_password" id="inputNewPassword" class="form-control" oninput="checkModalChanges()" autocomplete="new-password">
            </div>
            <div class="mb-3">
                <label class="form-label">Role</label>
                <select class="form-select" name="new_role" id="inputNewRole" onchange="checkModalChanges()">
                    <option value="admin" id="opt-admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="viewer">Viewer</option>
                    <option value="auditor">Auditor</option>
                </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-clean" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn-clean btn-clean-primary" id="saveChangesBtn" disabled>Save Changes</button>
          </div>
      </form>
    </div>
  </div>
</div>

<script>
let originalUsername = '';
let originalRole = '';

function checkModalChanges() {
    const currentUsername = document.getElementById('inputNewUsername').value;
    const currentRole = document.getElementById('inputNewRole').value;
    const currentPassword = document.getElementById('inputNewPassword').value;
    const saveBtn = document.getElementById('saveChangesBtn');

    if (currentUsername !== originalUsername || currentRole !== originalRole || currentPassword.length > 0) {
        saveBtn.disabled = false;
    } else {
        saveBtn.disabled = true;
    }
}

function openPasswordModal(id, username, role, disableRoleSelect) {
    document.getElementById('modalUserId').value = id;
    document.getElementById('modalUsername').innerText = username;

    document.getElementById('inputNewUsername').value = username;
    originalUsername = username;

    let roleSelect = document.getElementById('inputNewRole');
    roleSelect.value = role;
    originalRole = role;

    if (disableRoleSelect) {
        roleSelect.setAttribute('disabled', 'true');
    } else {
        roleSelect.removeAttribute('disabled');
    }

    if (<?= $_SESSION['user_id'] ?> != 1) {
        let adminOpt = document.getElementById('opt-admin');
        if (role === 'admin') {
            adminOpt.disabled = false;
            roleSelect.setAttribute('disabled', 'true');
        } else {
            adminOpt.disabled = true;
            if (!disableRoleSelect) roleSelect.removeAttribute('disabled');
        }
    }

    document.getElementById('inputNewPassword').value = '';
    document.getElementById('saveChangesBtn').disabled = true;

    var modal = new bootstrap.Modal(document.getElementById('passwordModal'));
    modal.show();
}

document.querySelector('#passwordModal form').addEventListener('submit', function() {
    document.getElementById('inputNewRole').removeAttribute('disabled');
});
</script>

<?php require_once __DIR__ . '/components/footer.php'; ?>
