<?php
require_once 'includes/security.php';
require_once 'includes/auth.php';
$auth = new Auth();
$auth->requireAuth();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Binary Alive</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
    <style>
        body { background-color: #f8f9fa; margin: 0 !important; padding: 0 !important; }
        .navbar { background-color: #2c3e50; margin-top: 0 !important; border-radius: 0 !important; }
        .navbar-brand, .nav-link { color: white !important; }
        .status-running { color: #198754; }
        .status-stopped { color: #dc3545; }
        .group-header { background-color: #e9ecef; font-weight: bold; }
    </style>
</head>
<body>

<nav class="navbar navbar-expand-lg">
    <div class="container-fluid">
        <a class="navbar-brand" href="#"><i class="bi bi-shield-lock"></i> Binary Alive v1.0</a>
        <div class="d-flex align-items-center">
            <span class="navbar-text text-white me-3">User: <?= htmlspecialchars($_SESSION['username']) ?> (<?= ucfirst(htmlspecialchars($_SESSION['role'])) ?>)</span>
            <?php if ($auth->hasRole(['admin'])): ?>
                <a href="users.php" class="btn btn-outline-success btn-sm me-2"><i class="bi bi-people"></i> Users</a>
                <a href="logs.php" class="btn btn-outline-light btn-sm me-2"><i class="bi bi-journal-text"></i> Logs</a>
                <a href="settings.php" class="btn btn-outline-warning btn-sm me-2"><i class="bi bi-gear"></i> Settings</a>
            <?php elseif ($auth->hasRole(['auditor'])): ?>
                <a href="logs.php" class="btn btn-outline-light btn-sm me-2"><i class="bi bi-journal-text"></i> Logs</a>
            <?php endif; ?>
            <a href="setup_2fa.php" class="btn btn-outline-info btn-sm me-2"><i class="bi bi-shield-check"></i> 2FA</a>
            <a href="logout.php" class="btn btn-outline-light btn-sm">Logout</a>
        </div>
    </div>
</nav>

<div class="container mt-4">
    <!-- Stat Cards -->
    <div class="row mb-4">
        <div class="col-md-3">
            <div class="card text-center bg-primary text-white">
                <div class="card-body">
                    <h5 class="card-title">Total Processes</h5>
                    <h2 id="stat-total">0</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card text-center bg-success text-white">
                <div class="card-body">
                    <h5 class="card-title">Running</h5>
                    <h2 id="stat-running">0</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card text-center bg-danger text-white">
                <div class="card-body">
                    <h5 class="card-title">Stopped</h5>
                    <h2 id="stat-stopped">0</h2>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card text-center bg-info text-white">
                <div class="card-body">
                    <h5 class="card-title">System Load</h5>
                    <h2 id="stat-load">---</h2>
                </div>
            </div>
        </div>
    </div>

    <!-- Process Table -->
    <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
            <span><i class="bi bi-list-task"></i> Monitored Processes</span>
            <div>
                <?php if ($auth->hasRole(['admin'])): ?>
                <button class="btn btn-sm btn-primary me-2" onclick="new bootstrap.Modal(document.getElementById('addProcessModal')).show();"><i class="bi bi-plus-circle"></i> Add Process</button>
                <?php endif; ?>
                <?php if ($auth->hasRole(['admin', 'operator'])): ?>
                <div class="btn-group me-2" role="group">
                    <button id="bulk-start" class="btn btn-sm btn-outline-success"><i class="bi bi-play-fill"></i> Start Selected</button>
                    <button id="bulk-stop" class="btn btn-sm btn-outline-danger"><i class="bi bi-stop-fill"></i> Stop Selected</button>
                    <button id="bulk-restart" class="btn btn-sm btn-outline-warning"><i class="bi bi-arrow-repeat"></i> Restart Selected</button>
                </div>
                <?php endif; ?>
                <button id="refresh-btn" class="btn btn-sm btn-outline-secondary"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
            </div>
        </div>
        <div class="card-body p-0">
            <table class="table table-hover mb-0">
                <thead class="table-dark">
                    <tr>
                        <th style="width: 40px;"><input type="checkbox" id="select-all"></th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>PID</th>
                        <th>CPU %</th>
                        <th>Memory</th>
                        <th>Uptime</th>
                        <th>Restarts</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="process-list">
                    <tr><td colspan="9" class="text-center">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Add Process Modal -->
<div class="modal fade" id="addProcessModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <form id="addProcessForm">
          <div class="modal-header">
            <h5 class="modal-title">Add New Process</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div id="addProcessError" class="alert alert-danger d-none"></div>
            <div class="mb-3">
                <label>Process Name (Unique)</label>
                <input type="text" name="name" class="form-control" placeholder="e.g. mrtx_bot" required>
            </div>
            <div class="mb-3">
                <label>Group Name</label>
                <input type="text" name="group_name" class="form-control" placeholder="e.g. Bots" value="Default">
            </div>
            <div class="mb-3">
                <label>Command to Execute</label>
                <input type="text" name="command" class="form-control" placeholder="./mrtx (Do NOT include nohup or &)" required>
            </div>
            <div class="mb-3">
                <label>Working Directory (Must be a folder, not a file)</label>
                <input type="text" name="working_dir" class="form-control" placeholder="/home/toxichom/mrtx_discord_bot">
            </div>
            <div class="mb-3">
                <label>Log File (Optional)</label>
                <input type="text" name="log_file" class="form-control" placeholder="mrtx.log">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Process</button>
          </div>
      </form>
    </div>
  </div>
</div>

<!-- Edit Process Modal -->
<div class="modal fade" id="editProcessModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <form id="editProcessForm">
          <div class="modal-header">
            <h5 class="modal-title">Edit Process</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div id="editProcessError" class="alert alert-danger d-none"></div>
            <input type="hidden" name="id" id="editProcessId">
            <div class="mb-3">
                <label>Process Name (Unique)</label>
                <input type="text" name="name" id="editProcessName" class="form-control" required>
            </div>
            <div class="mb-3">
                <label>Group Name</label>
                <input type="text" name="group_name" id="editProcessGroup" class="form-control" required>
            </div>
            <div class="mb-3">
                <label>Command to Execute</label>
                <input type="text" name="command" id="editProcessCmd" class="form-control" required>
            </div>
            <div class="mb-3">
                <label>Working Directory (Must be a folder)</label>
                <input type="text" name="working_dir" id="editProcessDir" class="form-control">
            </div>
            <div class="mb-3">
                <label>Log File (Optional)</label>
                <input type="text" name="log_file" id="editProcessLog" class="form-control">
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

<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script>
const userRole = "<?= $_SESSION['role'] ?>";
const canControl = ['admin', 'operator'].includes(userRole);

// Force jQuery to append a timestamp to GET requests so the browser NEVER caches them
$.ajaxSetup({ cache: false });

function parseUptimeToSeconds(str) {
    if (!str || str === '---') return 0;
    let days = 0, hours = 0, mins = 0, secs = 0;
    if (str.includes('-')) {
        let parts = str.split('-');
        days = parseInt(parts[0], 10);
        str = parts[1];
    }
    let timeParts = str.split(':');
    if (timeParts.length === 3) {
        hours = parseInt(timeParts[0], 10);
        mins = parseInt(timeParts[1], 10);
        secs = parseInt(timeParts[2], 10);
    } else if (timeParts.length === 2) {
        mins = parseInt(timeParts[0], 10);
        secs = parseInt(timeParts[1], 10);
    }
    return (days * 86400) + (hours * 3600) + (mins * 60) + secs;
}

function formatSecondsToUptime(totalSecs) {
    let d = Math.floor(totalSecs / 86400);
    totalSecs %= 86400;
    let h = Math.floor(totalSecs / 3600);
    totalSecs %= 3600;
    let m = Math.floor(totalSecs / 60);
    let s = totalSecs % 60;
    
    let hStr = h.toString().padStart(2, '0');
    let mStr = m.toString().padStart(2, '0');
    let sStr = s.toString().padStart(2, '0');
    
    if (d > 0 || h > 0) {
        return (d > 0 ? d + '-' : '') + hStr + ':' + mStr + ':' + sStr;
    }
    return mStr + ':' + sStr;
}

function fetchStatus() {
    $.getJSON('api.php?action=status', function(res) {
        if (!res.success) return;
        
        let html = '';
        let running = 0, stopped = 0;
        let groups = {};
        
        // Group processes
        res.data.forEach(p => {
            if (p.status === 'running') running++; else stopped++;
            let g = p.group_name || 'Default';
            if (!groups[g]) groups[g] = [];
            groups[g].push(p);
        });
        
        // Render rows by group
        for (let groupName in groups) {
            html += `<tr class="group-header"><td colspan="9"><i class="bi bi-folder2-open"></i> ${groupName}</td></tr>`;
            
            groups[groupName].forEach(p => {
                let statusIcon = p.status === 'running' 
                    ? '<i class="bi bi-circle-fill status-running"></i> RUNNING' 
                    : '<i class="bi bi-circle border rounded-circle status-stopped"></i> STOPPED';
                
                let actions = canControl ? `
                        <button class="btn btn-sm btn-success me-1 ctl-btn" data-id="${p.id}" data-cmd="start" ${p.status==='running'?'disabled':''} title="Start"><i class="bi bi-play-fill"></i></button>
                        <button class="btn btn-sm btn-danger me-1 ctl-btn" data-id="${p.id}" data-cmd="stop" ${p.status==='stopped'?'disabled':''} title="Stop"><i class="bi bi-stop-fill"></i></button>
                        <button class="btn btn-sm btn-warning me-1 ctl-btn" data-id="${p.id}" data-cmd="restart" title="Restart"><i class="bi bi-arrow-repeat"></i></button>
                        ${userRole === 'admin' ? `<button class="btn btn-sm btn-info text-white edit-btn" data-id="${p.id}" title="Edit"><i class="bi bi-pencil-square"></i></button>` : ''}
                ` : '<span class="badge bg-secondary">Read-only</span>';

                html += `<tr>
                    <td><input type="checkbox" class="process-checkbox" value="${p.id}" ${canControl?'':'disabled'}></td>
                    <td><strong>${p.name}</strong></td>
                    <td>${statusIcon}</td>
                    <td>${p.pid || '---'}</td>
                    <td>${p.cpu || '0'}%</td>
                    <td>${p.mem || '0 MB'}</td>
                    <td><span class="uptime-ticker" data-seconds="${p.uptime ? parseUptimeToSeconds(p.uptime) : 0}">${p.uptime || '---'}</span></td>
                    <td><span class="badge bg-secondary">${p.restart_count}</span></td>
                    <td>${actions}</td>
                </tr>`;
            });
        }
        
        if(res.data.length === 0) {
            html = '<tr><td colspan="9" class="text-center">No processes configured.</td></tr>';
        }
        
        $('#process-list').html(html);
        $('#stat-total').text(res.data.length);
        $('#stat-running').text(running);
        $('#stat-stopped').text(stopped);
        if (res.sys_load !== undefined) {
            $('#stat-load').text(res.sys_load);
        }
        
        // Restore checked state based on selection might be needed in a real app, but for now it resets on refresh
        $('#select-all').prop('checked', false);
    });
}

function handleControl(id_or_ids, cmd, btn) {
    let data = { cmd: cmd };
    if (Array.isArray(id_or_ids)) {
        data.ids = id_or_ids;
    } else {
        data.id = id_or_ids;
    }
    
    if(btn) btn.prop('disabled', true);
    
    $.post('api.php?action=control', data, function(res) {
        fetchStatus();
    }, 'json');
}

$(document).on('click', '.ctl-btn', function() {
    handleControl($(this).data('id'), $(this).data('cmd'), $(this));
});

function getSelectedIds() {
    let ids = [];
    $('.process-checkbox:checked').each(function() {
        ids.push($(this).val());
    });
    return ids;
}

$('#bulk-start').click(function() { let ids = getSelectedIds(); if(ids.length) handleControl(ids, 'start', $(this)); });
$('#bulk-stop').click(function() { let ids = getSelectedIds(); if(ids.length) handleControl(ids, 'stop', $(this)); });
$('#bulk-restart').click(function() { let ids = getSelectedIds(); if(ids.length) handleControl(ids, 'restart', $(this)); });

$('#select-all').change(function() {
    $('.process-checkbox').prop('checked', $(this).prop('checked'));
});

$('#refresh-btn').click(fetchStatus);

$('#addProcessForm').submit(function(e) {
    e.preventDefault();
    $.post('api.php?action=add_process', $(this).serialize(), function(res) {
        if (res.success) {
            bootstrap.Modal.getInstance(document.getElementById('addProcessModal')).hide();
            $('#addProcessForm')[0].reset();
            $('#addProcessError').addClass('d-none');
            fetchStatus();
        } else {
            $('#addProcessError').text(res.message).removeClass('d-none');
        }
    }, 'json');
});

$(document).on('click', '.edit-btn', function() {
    let id = $(this).data('id');
    $.getJSON('api.php?action=get_process&id=' + id, function(res) {
        if (res.success) {
            $('#editProcessId').val(res.process.id);
            $('#editProcessName').val(res.process.name);
            $('#editProcessGroup').val(res.process.group_name);
            $('#editProcessCmd').val(res.process.command);
            $('#editProcessDir').val(res.process.working_dir);
            $('#editProcessLog').val(res.process.log_file);
            new bootstrap.Modal(document.getElementById('editProcessModal')).show();
        }
    });
});

$('#editProcessForm').submit(function(e) {
    e.preventDefault();
    $.post('api.php?action=edit_process', $(this).serialize(), function(res) {
        if (res.success) {
            bootstrap.Modal.getInstance(document.getElementById('editProcessModal')).hide();
            $('#editProcessError').addClass('d-none');
            fetchStatus();
        } else {
            $('#editProcessError').text(res.message).removeClass('d-none');
        }
    }, 'json');
});

fetchStatus();
setInterval(fetchStatus, 5000);

// Smooth 1-second Uptime Ticker
setInterval(function() {
    $('.uptime-ticker').each(function() {
        let secs = parseInt($(this).attr('data-seconds'));
        if (!isNaN(secs) && secs > 0) {
            secs++;
            $(this).attr('data-seconds', secs);
            $(this).text(formatSecondsToUptime(secs));
        }
    });
}, 1000);
</script>
</body>
</html>
