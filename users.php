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
    
    if ($action === 'create') {
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';
        $role = $_POST['role'] ?? 'viewer';
        
        if ($username && $password) {
            $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            try {
                $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)");
                $stmt->execute([$username, $hash, $role]);
                $auth->getLogger()->logAudit($_SESSION['user_id'], 'create_user', "Created user: $username");
                $message = '<div class="alert alert-success">User created successfully.</div>';
            } catch (PDOException $e) {
                $message = '<div class="alert alert-danger">Username already exists.</div>';
            }
        }
    } elseif ($action === 'delete') {
        $id = $_POST['id'] ?? 0;
        if ($id != $_SESSION['user_id']) { // Can't delete self
            $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$id]);
            $auth->getLogger()->logAudit($_SESSION['user_id'], 'delete_user', "Deleted user ID: $id");
            $message = '<div class="alert alert-success">User deleted.</div>';
        }
    } elseif ($action === 'change_password') {
        $id = $_POST['id'] ?? 0;
        $new_username = $_POST['new_username'] ?? '';
        $new_password = $_POST['new_password'] ?? '';
        
        try {
            if (!empty($new_password) && !empty($new_username)) {
                $hash = password_hash($new_password, PASSWORD_BCRYPT, ['cost' => 12]);
                $stmt = $pdo->prepare("UPDATE users SET username = ?, password_hash = ? WHERE id = ?");
                $stmt->execute([$new_username, $hash, $id]);
                $auth->getLogger()->logAudit($_SESSION['user_id'], 'edit_user', "Changed username and password for user ID: $id");
                $message = '<div class="alert alert-success">Username and Password updated successfully.</div>';
            } elseif (!empty($new_password)) {
                $hash = password_hash($new_password, PASSWORD_BCRYPT, ['cost' => 12]);
                $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
                $stmt->execute([$hash, $id]);
                $auth->getLogger()->logAudit($_SESSION['user_id'], 'edit_user', "Changed password for user ID: $id");
                $message = '<div class="alert alert-success">Password updated successfully.</div>';
            } elseif (!empty($new_username)) {
                $stmt = $pdo->prepare("UPDATE users SET username = ? WHERE id = ?");
                $stmt->execute([$new_username, $id]);
                $auth->getLogger()->logAudit($_SESSION['user_id'], 'edit_user', "Changed username for user ID: $id");
                $message = '<div class="alert alert-success">Username updated successfully.</div>';
            }
            
            // If they edited themselves, update session
            if ($id == $_SESSION['user_id'] && !empty($new_username)) {
                $_SESSION['username'] = $new_username;
            }
        } catch (PDOException $e) {
            $message = '<div class="alert alert-danger">Failed to update user. The username might already exist.</div>';
        }
    } elseif ($action === 'generate_token') {
        $id = $_POST['id'] ?? 0;
        $token = bin2hex(random_bytes(32));
        $stmt = $pdo->prepare("UPDATE users SET api_token = ? WHERE id = ?");
        $stmt->execute([$token, $id]);
        $auth->getLogger()->logAudit($_SESSION['user_id'], 'generate_api_token', "Generated for user ID: $id");
        $message = '<div class="alert alert-success">API Token generated successfully.</div>';
    }
}

$stmt = $pdo->query("SELECT id, username, role, api_token, created_at, failed_attempts FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>User Management - Binary Alive</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">

    <style>body { margin: 0 !important; padding: 0 !important; } .navbar { margin-top: 0 !important; border-radius: 0 !important; }</style>
</head>
<body class="bg-light">
<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container-fluid">
        <a class="navbar-brand" href="index.php">Binary Alive</a>
        <div class="d-flex">
            <a href="index.php" class="btn btn-outline-light btn-sm me-2">Back to Dashboard</a>
        </div>
    </div>
</nav>

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
                        <option value="admin">Admin</option>
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
            <table class="table table-hover mb-0">
                <thead class="table-dark">
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>API Token</th>
                        <th>Failed Logins</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($users as $u): ?>
                    <tr>
                        <td><?= $u['id'] ?></td>
                        <td><?= htmlspecialchars($u['username']) ?></td>
                        <td><span class="badge bg-secondary"><?= ucfirst($u['role']) ?></span></td>
                        <td>
                            <?php if ($u['api_token']): ?>
                                <input type="text" class="form-control form-control-sm" value="<?= htmlspecialchars($u['api_token']) ?>" readonly>
                            <?php else: ?>
                                <span class="text-muted">None</span>
                            <?php endif; ?>
                        </td>
                        <td><?= $u['failed_attempts'] ?></td>
                        <td>
                            <button class="btn btn-sm btn-info text-white" onclick="openPasswordModal(<?= $u['id'] ?>, '<?= htmlspecialchars($u['username']) ?>')"><i class="bi bi-pencil-square"></i> Edit</button>
                            <form method="POST" class="d-inline" onsubmit="return confirm('Generate new API token?');">
                                <input type="hidden" name="action" value="generate_token">
                                <input type="hidden" name="id" value="<?= $u['id'] ?>">
                                <button type="submit" class="btn btn-sm btn-warning" title="Generate API Token"><i class="bi bi-braces"></i></button>
                            </form>
                            <?php if ($u['id'] != $_SESSION['user_id']): ?>
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
                <input type="text" name="new_username" id="inputNewUsername" class="form-control">
            </div>
            <div class="mb-3">
                <label>New Password</label>
                <input type="password" name="new_password" class="form-control">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
      </form>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script>
function openPasswordModal(id, username) {
    document.getElementById('modalUserId').value = id;
    document.getElementById('modalUsername').innerText = username;
    document.getElementById('inputNewUsername').value = username;
    var modal = new bootstrap.Modal(document.getElementById('passwordModal'));
    modal.show();
}
</script>
</body>
</html>

