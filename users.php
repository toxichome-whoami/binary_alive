<?php
require_once 'includes/security.php';
require_once 'includes/auth.php';

$auth = new Auth();
$auth->requireAuth();
$auth->requireRole(['admin']); // Only admins can manage users

$pdo = $auth->getPdo();
$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
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
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';
        $role = $_POST['role'] ?? 'viewer';
        
        if ($_SESSION['user_id'] != 1 && $role === 'admin') {
            $_SESSION['flash_message'] = '<div class="alert alert-danger">Only the master admin can create other admin accounts.</div>';
        } elseif ($username && $password) {
            $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            try {
                $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)");
                $stmt->execute([$username, $hash, $role]);
                $auth->getLogger()->logAudit($_SESSION['user_id'], 'create_user', "Created user: $username");
                $_SESSION['flash_message'] = '<div class="alert alert-success">User created successfully.</div>';
            } catch (PDOException $e) {
                $_SESSION['flash_message'] = '<div class="alert alert-danger">Username already exists.</div>';
            }
        }
    } elseif ($action === 'delete') {
        $id = $_POST['id'] ?? 0;
        if ($id == 1) {
            $_SESSION['flash_message'] = '<div class="alert alert-danger">The master admin account cannot be deleted.</div>';
        } elseif ($id == $_SESSION['user_id']) {
            $_SESSION['flash_message'] = '<div class="alert alert-danger">You cannot delete your own account.</div>';
        } elseif ($_SESSION['user_id'] != 1 && $targetRole === 'admin') {
            $_SESSION['flash_message'] = '<div class="alert alert-danger">Only the master admin can delete other admin accounts.</div>';
        } else {
            $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$id]);
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'delete_user', "Deleted user: $targetUsername");
            $_SESSION['flash_message'] = '<div class="alert alert-success">User deleted.</div>';
        }
    } elseif ($action === 'change_password') {
        $id = $_POST['id'] ?? 0;
        $new_username = $_POST['new_username'] ?? '';
        $new_password = $_POST['new_password'] ?? '';
        $new_role = $_POST['new_role'] ?? '';
        
        $error = false;
        if ($id == 1 && $_SESSION['user_id'] != 1) {
            $_SESSION['flash_message'] = '<div class="alert alert-danger">Only the master admin can modify the master account.</div>';
            $error = true;
        } elseif ($id == 1 && !empty($new_role) && $new_role !== 'admin') {
            $_SESSION['flash_message'] = '<div class="alert alert-danger">The master admin role cannot be changed.</div>';
            $error = true;
        } elseif ($_SESSION['user_id'] != 1 && $targetRole === 'admin' && $id != $_SESSION['user_id']) {
            $_SESSION['flash_message'] = '<div class="alert alert-danger">Only the master admin can modify other admin accounts.</div>';
            $error = true;
        } elseif ($_SESSION['user_id'] != 1 && !empty($new_role) && $new_role === 'admin' && $targetRole !== 'admin') {
            $_SESSION['flash_message'] = '<div class="alert alert-danger">Only the master admin can grant the admin role.</div>';
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
                    $auth->getLogger()->logAudit($_SESSION['user_id'], 'edit_user', "Updated details for user: $targetUsername");
                    $_SESSION['flash_message'] = '<div class="alert alert-success">User updated successfully.</div>';
                    
                    if ($id == $_SESSION['user_id'] && !empty($new_username)) {
                        $_SESSION['username'] = $new_username;
                    }
                }
            } catch (PDOException $e) {
                $_SESSION['flash_message'] = '<div class="alert alert-danger">Failed to update user. The username might already exist.</div>';
            }
        }
    } elseif ($action === 'generate_token') {
        $id = $_POST['id'] ?? 0;
        $token = bin2hex(random_bytes(32));
        $stmt = $pdo->prepare("UPDATE users SET api_token = ? WHERE id = ?");
        $stmt->execute([$token, $id]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'generate_api_token', "Generated API Token for user: $targetUsername");
        $_SESSION['flash_message'] = '<div class="alert alert-success">API Token generated successfully.</div>';
    } elseif ($action === 'delete_token') {
        $id = $_POST['id'] ?? 0;
        $stmt = $pdo->prepare("UPDATE users SET api_token = NULL WHERE id = ?");
        $stmt->execute([$id]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'delete_api_token', "Deleted API Token for user: $targetUsername");
        $_SESSION['flash_message'] = '<div class="alert alert-success">API Token deleted.</div>';
    } elseif ($action === 'remove_2fa') {
        $id = $_POST['id'] ?? 0;
        $stmt = $pdo->prepare("UPDATE users SET totp_secret = NULL WHERE id = ?");
        $stmt->execute([$id]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'disable_2fa', "Removed 2FA for user: $targetUsername");
        $_SESSION['flash_message'] = '<div class="alert alert-success">2FA disabled for user.</div>';
    }
    
    // PRG Pattern: Redirect back to the same URL to prevent form resubmission
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
?>
<?php
$pageTitle = 'User Management';
require_once 'components/header.php';
require_once 'components/navbar.php';
?>

<div class="container mt-4">
    <?= $message ?>
    
    <div class="card mb-4">
        <div class="card-header">
            <h4><i class="bi bi-person-plus"></i> Add New User</h4>
        </div>
        <div class="card-body">
            <form method="POST" class="row gx-3 gy-2 align-items-center">
                <input type="hidden" name="action" value="create">
                <div class="col-sm-3">
                    <input type="text" class="form-control" name="username" placeholder="Username" required>
                </div>
                <div class="col-sm-3">
                    <input type="password" class="form-control" name="password" placeholder="Password" required>
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
                    <button type="submit" class="btn btn-primary">Create User</button>
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <h4><i class="bi bi-people"></i> Manage Users</h4>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                <thead class="table-dark">
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>API Token</th>
                        <th>2FA</th>
                        <th>Failed Logins</th>
                        <th class="text-nowrap">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $u): 
                        $isMasterAdmin = ($u['id'] == 1);
                        $isSelf = ($u['id'] == $_SESSION['user_id']);
                        $isOtherAdmin = ($u['role'] === 'admin' && !$isSelf);
                        $canEdit = ($_SESSION['user_id'] == 1 || (!$isMasterAdmin && !$isOtherAdmin) || $isSelf);
                        $canDelete = ($_SESSION['user_id'] == 1 ? !$isMasterAdmin && !$isSelf : !$isMasterAdmin && !$isOtherAdmin && !$isSelf);
                        
                        // Pass a flag to JS so it knows if role field should be disabled
                        $disableRoleSelect = ($isMasterAdmin) ? 'true' : 'false';
                    ?>
                    <tr>
                        <td><?= $u['id'] ?></td>
                        <td><?= htmlspecialchars($u['username']) ?></td>
                        <td>
                            <?php if ($isMasterAdmin): ?>
                                <span class="badge" style="background-color: #ffc107; color: #000;">Master Admin</span>
                            <?php else: ?>
                                <span class="badge bg-secondary"><?= ucfirst($u['role']) ?></span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($u['api_token']): ?>
                                <div class="input-group input-group-sm" style="max-width: 250px;">
                                    <input type="text" class="form-control" id="token-<?= $u['id'] ?>" value="<?= htmlspecialchars($u['api_token']) ?>" readonly>
                                    <button class="btn btn-outline-secondary" type="button" onclick="navigator.clipboard.writeText(document.getElementById('token-<?= $u['id'] ?>').value); alert('Copied!');" title="Copy Token"><i class="bi bi-clipboard"></i></button>
                                    <?php if ($canEdit): ?>
                                    <form method="POST" class="d-inline" onsubmit="return confirm('Delete API token? This breaks any scripts using it!');">
                                        <input type="hidden" name="action" value="delete_token">
                                        <input type="hidden" name="id" value="<?= $u['id'] ?>">
                                        <button type="submit" class="btn btn-outline-danger" title="Delete Token"><i class="bi bi-trash"></i></button>
                                    </form>
                                    <?php endif; ?>
                                </div>
                            <?php else: ?>
                                <span class="text-muted">None</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if (!empty($u['totp_secret'])): ?>
                                <span class="badge bg-success">Enabled</span>
                            <?php else: ?>
                                <span class="badge bg-secondary">Disabled</span>
                            <?php endif; ?>
                        </td>
                        <td><?= $u['failed_attempts'] ?></td>
                        <td class="text-nowrap">
                            <?php if ($canEdit): ?>
                            <button class="btn btn-sm btn-info text-white" onclick="openPasswordModal(<?= $u['id'] ?>, '<?= htmlspecialchars($u['username']) ?>', '<?= htmlspecialchars($u['role']) ?>', <?= $disableRoleSelect ?>)"><i class="bi bi-pencil-square"></i> Edit</button>
                            <form method="POST" class="d-inline" onsubmit="return confirm('Generate new API token?');">
                                <input type="hidden" name="action" value="generate_token">
                                <input type="hidden" name="id" value="<?= $u['id'] ?>">
                                <button type="submit" class="btn btn-sm btn-warning" title="Generate API Token"><i class="bi bi-braces"></i></button>
                            </form>
                            <?php if (!empty($u['totp_secret'])): ?>
                            <form method="POST" class="d-inline" onsubmit="return confirm('Forcefully remove 2FA for this user?');">
                                <input type="hidden" name="action" value="remove_2fa">
                                <input type="hidden" name="id" value="<?= $u['id'] ?>">
                                <button type="submit" class="btn btn-sm btn-outline-danger" title="Remove 2FA"><i class="bi bi-shield-x"></i></button>
                            </form>
                            <?php endif; ?>
                            <?php endif; ?>
                            
                            <?php if ($canDelete): ?>
                            <form method="POST" class="d-inline" onsubmit="return confirm('Delete this user?');">
                                <input type="hidden" name="action" value="delete">
                                <input type="hidden" name="id" value="<?= $u['id'] ?>">
                                <button type="submit" class="btn btn-sm btn-danger"><i class="bi bi-trash"></i></button>
                            </form>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
                </table>
            </div>
        </div>
        <div class="card-footer d-flex justify-content-between align-items-center">
            <?php if ($page > 1): ?>
                <a href="?page=<?= $page - 1 ?>" class="btn btn-outline-primary btn-sm">Previous</a>
            <?php else: ?>
                <button class="btn btn-outline-secondary btn-sm" disabled>Previous</button>
            <?php endif; ?>
            
            <span class="text-muted small">Page <?= $page ?> of <?= max(1, $totalPages) ?> (Total: <?= $totalUsers ?>)</span>
            
            <?php if ($page < $totalPages): ?>
                <a href="?page=<?= $page + 1 ?>" class="btn btn-outline-primary btn-sm">Next</a>
            <?php else: ?>
                <button class="btn btn-outline-secondary btn-sm" disabled>Next</button>
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- Edit User Modal -->
<div class="modal fade" id="passwordModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <form method="POST">
          <div class="modal-header">
            <h5 class="modal-title">Edit User: <span id="modalUsername"></span></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning text-sm">Leave fields blank if you do not want to change them.</div>
            <input type="hidden" name="action" value="change_password">
            <input type="hidden" name="id" id="modalUserId">
            <div class="mb-3">
                <label>New Username</label>
                <input type="text" name="new_username" id="inputNewUsername" class="form-control" oninput="checkModalChanges()">
            </div>
            <div class="mb-3">
                <label>New Password</label>
                <input type="password" name="new_password" id="inputNewPassword" class="form-control" oninput="checkModalChanges()">
            </div>
            <div class="mb-3">
                <label>Role</label>
                <select class="form-select" name="new_role" id="inputNewRole" onchange="checkModalChanges()">
                    <option value="admin" id="opt-admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="viewer">Viewer</option>
                    <option value="auditor">Auditor</option>
                </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary" id="saveChangesBtn" disabled>Save Changes</button>
          </div>
      </form>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
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
    
    // Set and store original values
    document.getElementById('inputNewUsername').value = username;
    originalUsername = username;
    
    let roleSelect = document.getElementById('inputNewRole');
    roleSelect.value = role;
    originalRole = role;
    
    // Disable role select if it's the master admin to prevent demotion
    if (disableRoleSelect) {
        roleSelect.setAttribute('disabled', 'true');
    } else {
        roleSelect.removeAttribute('disabled');
    }
    
    // UI role restriction for regular admins
    if (<?= $_SESSION['user_id'] ?> != 1) {
        let adminOpt = document.getElementById('opt-admin');
        if (role === 'admin') {
            adminOpt.disabled = false;
            roleSelect.setAttribute('disabled', 'true'); // Lock their own role
        } else {
            adminOpt.disabled = true; // Block granting admin to others
            if (!disableRoleSelect) roleSelect.removeAttribute('disabled');
        }
    }
    
    // Clear password box
    document.getElementById('inputNewPassword').value = '';
    
    // Disable save button by default
    document.getElementById('saveChangesBtn').disabled = true;
    
    var modal = new bootstrap.Modal(document.getElementById('passwordModal'));
    modal.show();
}
// Remove disabled attribute before submit so value is passed (optional, since PHP blocks it anyway)
document.querySelector('#passwordModal form').addEventListener('submit', function() {
    document.getElementById('inputNewRole').removeAttribute('disabled');
});
</script>
<?php require_once 'components/footer.php'; ?>
