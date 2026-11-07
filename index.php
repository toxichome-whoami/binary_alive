<?php
require_once __DIR__ . '/includes/security.php';
require_once __DIR__ . '/includes/auth.php';

$auth = new Auth();
$auth->requireAuth();

$pageTitle = 'Dashboard';
require_once __DIR__ . '/components/header.php';
require_once __DIR__ . '/components/navbar.php';
?>

<div class="container-fluid py-4 px-md-4">
    <!-- Metric Ribbon (Zero Drop Shadows, Crisp Borders) -->
    <div class="metric-ribbon">
        <div class="metric-card">
            <span class="metric-label">Total Processes</span>
            <span class="metric-val" id="stat-total">0</span>
        </div>
        <div class="metric-card online">
            <span class="metric-label">Running</span>
            <span class="metric-val" id="stat-running">0</span>
        </div>
        <div class="metric-card offline">
            <span class="metric-label">Stopped</span>
            <span class="metric-val" id="stat-stopped">0</span>
        </div>
        <div class="metric-card info">
            <span class="metric-label">System Load</span>
            <span class="metric-val" id="stat-load">---</span>
        </div>
        <div class="metric-card">
            <span class="metric-label">Host Memory</span>
            <span class="metric-val" id="stat-mem">---</span>
        </div>
        <div class="metric-card">
            <span class="metric-label">Supervisor Engine</span>
            <span class="metric-val" id="stat-supervisor" style="font-size: 0.95rem;">Live Active</span>
        </div>
    </div>

    <!-- Process Table Card -->
    <div class="card">
        <div class="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-list-task text-muted"></i>
                <span>Monitored Processes</span>
            </div>

            <div class="d-flex flex-wrap align-items-center gap-2">
                <?php if ($auth->hasRole(['admin'])): ?>
                    <button class="btn-clean btn-clean-primary" type="button" data-bs-toggle="modal" data-bs-target="#addProcessModal">
                        <i class="bi bi-plus-lg"></i> Add Process
                    </button>
                <?php endif; ?>

                <?php if ($auth->hasRole(['admin', 'operator'])): ?>
                    <div class="d-flex align-items-center gap-1">
                        <button id="bulk-start" class="btn-clean btn-clean-sm" type="button" title="Start Selected">
                            <i class="bi bi-play-fill text-success"></i> Start
                        </button>
                        <button id="bulk-stop" class="btn-clean btn-clean-sm btn-clean-danger" type="button" title="Stop Selected">
                            <i class="bi bi-stop-fill"></i> Stop
                        </button>
                        <button id="bulk-restart" class="btn-clean btn-clean-sm" type="button" title="Restart Selected">
                            <i class="bi bi-arrow-repeat text-warning"></i> Restart
                        </button>
                    </div>
                <?php endif; ?>

                <button id="refresh-btn" class="btn-clean btn-clean-sm" type="button" title="Refresh list">
                    <i class="bi bi-arrow-clockwise"></i> Refresh
                </button>
            </div>
        </div>

        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th style="width: 38px;">
                                <input type="checkbox" id="select-all" class="form-check-input">
                            </th>
                            <th>Name / Command</th>
                            <th>Status</th>
                            <th>PID</th>
                            <th>CPU</th>
                            <th>Memory</th>
                            <th>Uptime</th>
                            <th>Restarts</th>
                            <th style="width: 170px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="process-list">
                        <tr>
                            <td colspan="9" class="text-center py-4 text-muted">Loading processes...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- Add Process Modal -->
<div class="modal fade" id="addProcessModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <form id="addProcessForm">
                <div class="modal-header">
                    <h5 class="modal-title">Add New Process</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div id="addProcessError" class="alert alert-danger d-none py-2 px-3 small"></div>
                    
                    <div class="mb-3">
                        <label class="form-label">Process Name</label>
                        <input type="text" name="name" class="form-control" placeholder="e.g. mrtx_bot" required autocomplete="off">
                        <div class="form-text">A unique identifier for this process.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Group Name</label>
                        <input type="text" name="group_name" class="form-control" placeholder="e.g. Bots" value="Default" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Execution Command</label>
                        <input type="text" name="command" class="form-control font-mono" placeholder="./mrtx (do not add & or nohup)" required autocomplete="off">
                        <div class="form-text">The exact command to run. Nohup and logging are handled automatically.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Working Directory</label>
                        <input type="text" name="working_dir" class="form-control font-mono" placeholder="/home/username/project">
                        <div class="form-text">Absolute path to folder where the file lives.</div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Log File (Optional)</label>
                        <input type="text" name="log_file" class="form-control font-mono" placeholder="bot.log">
                    </div>
                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input" type="checkbox" name="auto_restart" id="addProcessAutoRestart" value="1" checked>
                        <label class="form-check-label" for="addProcessAutoRestart">
                            Auto Restart (automatically revive if killed or crashed)
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-clean" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn-clean btn-clean-primary">Save Process</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Edit Process Modal -->
<div class="modal fade" id="editProcessModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <form id="editProcessForm">
                <input type="hidden" name="id" id="editProcessId">
                <div class="modal-header">
                    <h5 class="modal-title">Edit Process</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div id="editProcessError" class="alert alert-danger d-none py-2 px-3 small"></div>

                    <div class="mb-3">
                        <label class="form-label">Process Name</label>
                        <input type="text" name="name" id="editProcessName" class="form-control" required autocomplete="off">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Group Name</label>
                        <input type="text" name="group_name" id="editProcessGroup" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Execution Command</label>
                        <input type="text" name="command" id="editProcessCmd" class="form-control font-mono" required autocomplete="off">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Working Directory</label>
                        <input type="text" name="working_dir" id="editProcessDir" class="form-control font-mono">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Log File</label>
                        <input type="text" name="log_file" id="editProcessLog" class="form-control font-mono">
                    </div>
                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input" type="checkbox" name="auto_restart" id="editProcessAutoRestart" value="1">
                        <label class="form-check-label" for="editProcessAutoRestart">
                            Auto Restart (automatically revive if killed or crashed)
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-clean" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn-clean btn-clean-primary">Update Process</button>
                </div>
            </form>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/components/footer.php'; ?>
