/**
 * assets/js/app.js
 * Binary Alive - Modern Client Controller
 * Pure vanilla JavaScript, zero bloat, visibility-aware polling, clean notifications.
 */

const App = (function() {
    let pollInterval = null;
    let isPolling = false;
    const POLL_MS = 3000;

    function getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    function showToast(message, type = 'info') {
        let container = document.getElementById('clean-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'clean-toast-container';
            container.className = 'clean-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `clean-toast ${type}`;
        toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        }, 3000);
    }

    function initTheme() {
        const toggleBtn = document.getElementById('theme-toggle');
        if (!toggleBtn) return;

        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-bs-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', next);
            localStorage.setItem('theme', next);
            updateThemeIcon(next);
        });

        const activeTheme = localStorage.getItem('theme') || 'dark';
        updateThemeIcon(activeTheme);
    }

    function updateThemeIcon(theme) {
        const icon = document.querySelector('#theme-toggle i');
        if (!icon) return;
        icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
    }

    function initDashboard() {
        const processList = document.getElementById('process-list');
        if (!processList) return;

        startPolling();

        // Pause polling when tab is hidden to save cPanel server resources
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopPolling();
            } else {
                fetchStatus();
                startPolling();
            }
        });

        // Manual refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                fetchStatus();
                showToast('Refreshed status', 'info');
            });
        }

        // Form handlers
        initForms();
    }

    function initForms() {
        // Add Process Form
        const addForm = document.getElementById('addProcessForm');
        if (addForm) {
            addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const errBox = document.getElementById('addProcessError');
                if (errBox) errBox.classList.add('d-none');

                const fd = new FormData(addForm);
                fd.append('csrf_token', getCsrfToken());

                try {
                    const res = await fetch('api.php?action=add_process', { method: 'POST', body: fd });
                    const data = await res.json();
                    if (data.success) {
                        const modalEl = document.getElementById('addProcessModal');
                        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                        modal.hide();
                        addForm.reset();
                        showToast(data.message || 'Process added successfully', 'success');
                        fetchStatus();
                    } else {
                        if (errBox) {
                            errBox.textContent = data.message || 'Failed to add process';
                            errBox.classList.remove('d-none');
                        } else {
                            showToast(data.message, 'error');
                        }
                    }
                } catch (e) {
                    showToast('Network error while saving process', 'error');
                }
            });
        }

        // Edit Process Form
        const editForm = document.getElementById('editProcessForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const errBox = document.getElementById('editProcessError');
                if (errBox) errBox.classList.add('d-none');

                const fd = new FormData(editForm);
                fd.append('csrf_token', getCsrfToken());

                try {
                    const res = await fetch('api.php?action=edit_process', { method: 'POST', body: fd });
                    const data = await res.json();
                    if (data.success) {
                        const modalEl = document.getElementById('editProcessModal');
                        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                        modal.hide();
                        showToast(data.message || 'Process updated', 'success');
                        fetchStatus();
                    } else {
                        if (errBox) {
                            errBox.textContent = data.message || 'Failed to update process';
                            errBox.classList.remove('d-none');
                        } else {
                            showToast(data.message, 'error');
                        }
                    }
                } catch (e) {
                    showToast('Network error while updating process', 'error');
                }
            });
        }
    }

    function startPolling() {
        if (isPolling) return;
        isPolling = true;
        fetchStatus();
        pollInterval = setInterval(fetchStatus, POLL_MS);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        isPolling = false;
    }

    async function fetchStatus() {
        try {
            const res = await fetch('api.php?action=status', {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) {
                renderDashboard(data.data, data.sys_load, data.sys_mem, data.daemon_active);
            }
        } catch (e) {
            // Quiet network failure
        }
    }

    function renderDashboard(processes, sysLoad, sysMem, daemonActive) {
        // Update metric ribbon
        const elTotal = document.getElementById('stat-total');
        const elRunning = document.getElementById('stat-running');
        const elStopped = document.getElementById('stat-stopped');
        const elLoad = document.getElementById('stat-load');
        const elMem = document.getElementById('stat-mem');
        const elSupervisor = document.getElementById('stat-supervisor');

        let runningCount = 0;
        let stoppedCount = 0;

        processes.forEach(p => {
            if (p.status === 'running') runningCount++;
            else stoppedCount++;
        });

        if (elTotal) elTotal.textContent = processes.length;
        if (elRunning) elRunning.textContent = runningCount;
        if (elStopped) elStopped.textContent = stoppedCount;
        if (elLoad) elLoad.textContent = sysLoad || '---';
        if (elMem && sysMem) elMem.textContent = sysMem;
        if (elSupervisor) {
            if (daemonActive) {
                elSupervisor.innerHTML = '<span class="text-success">Daemon Active</span>';
            } else {
                elSupervisor.innerHTML = '<span class="text-primary">Live Web Active</span>';
            }
        }

        const groups = {};
        processes.forEach(p => {
            const g = p.group_name || 'Default';
            if (!groups[g]) groups[g] = [];
            groups[g].push(p);
        });

        const tbody = document.getElementById('process-list');
        if (!tbody) return;

        let html = '';

        if (processes.length === 0) {
            html = `<tr><td colspan="9" class="text-center py-4 text-muted">No monitored processes found. Click "Add Process" to start one.</td></tr>`;
            tbody.innerHTML = html;
            return;
        }

        const groupNames = Object.keys(groups).sort();
        groupNames.forEach(groupName => {
            html += `<tr class="group-row"><td colspan="9"><span class="fw-semibold">${escapeHtml(groupName)}</span></td></tr>`;
            
            groups[groupName].forEach(p => {
                const isOnline = p.status === 'running';
                const isCrashed = p.status === 'crashed';
                const statusClass = isOnline ? 'online' : (isCrashed ? 'crashed' : 'stopped');
                const statusText = isOnline ? 'Running' : (isCrashed ? 'Crashed' : 'Stopped');

                html += `
                <tr data-id="${p.id}">
                    <td style="width: 38px;">
                        <input type="checkbox" class="process-checkbox form-check-input" value="${p.id}">
                    </td>
                    <td>
                        <div class="d-flex align-items-center gap-1">
                            <span class="fw-semibold">${escapeHtml(p.name)}</span>
                            ${(parseInt(p.auto_restart) !== 0) ? '<span class="badge text-bg-secondary ms-1" style="font-size: 0.65rem; font-weight: 500;">auto</span>' : ''}
                        </div>
                        <div class="font-mono text-dim small">${escapeHtml(p.command)}</div>
                    </td>
                    <td>
                        <span class="status-pill ${statusClass}">
                            <span class="status-dot"></span>
                            ${statusText}
                        </span>
                    </td>
                    <td><span class="font-mono text-muted">${p.pid ? p.pid : '---'}</span></td>
                    <td><span class="font-mono text-muted">${p.cpu ? p.cpu + '%' : '0%'}</span></td>
                    <td><span class="font-mono text-muted">${p.mem ? p.mem : '0 MB'}</span></td>
                    <td><span class="font-mono text-muted">${p.uptime ? p.uptime : '---'}</span></td>
                    <td><span class="font-mono text-muted">${p.restart_count || 0}</span></td>
                    <td>
                        <div class="d-flex align-items-center gap-1">
                            ${isOnline ? 
                                `<button class="btn-clean btn-clean-sm btn-clean-danger" onclick="App.controlProcess(${p.id}, 'stop')">Stop</button>
                                 <button class="btn-clean btn-clean-sm" onclick="App.controlProcess(${p.id}, 'restart')">Restart</button>`
                                :
                                `<button class="btn-clean btn-clean-sm btn-clean-primary" onclick="App.controlProcess(${p.id}, 'start')">Start</button>`
                            }
                            <button class="btn-clean btn-clean-sm" onclick="App.editProcess(${p.id})" title="Edit">Edit</button>
                            <button class="btn-clean btn-clean-sm btn-clean-danger" onclick="App.deleteProcess(${p.id}, '${escapeHtml(p.name)}')" title="Delete">Delete</button>
                        </div>
                    </td>
                </tr>`;
            });
        });

        tbody.innerHTML = html;
        bindCheckboxes();
    }

    function bindCheckboxes() {
        const selectAll = document.getElementById('select-all');
        const checkboxes = document.querySelectorAll('.process-checkbox');

        if (selectAll) {
            selectAll.onclick = function() {
                checkboxes.forEach(cb => cb.checked = selectAll.checked);
            };
        }
    }

    function getSelectedIds() {
        const checkboxes = document.querySelectorAll('.process-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    async function controlProcess(id, cmd) {
        const fd = new FormData();
        fd.append('id', id);
        fd.append('cmd', cmd);
        fd.append('csrf_token', getCsrfToken());

        try {
            const res = await fetch('api.php?action=control', {
                method: 'POST',
                body: fd
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Process ${cmd} command sent`, 'success');
                fetchStatus();
            } else {
                showToast(data.message || 'Action failed', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    }

    async function bulkControl(cmd) {
        const ids = getSelectedIds();
        if (ids.length === 0) {
            showToast('Please select at least one process', 'error');
            return;
        }

        const fd = new FormData();
        ids.forEach(id => fd.append('ids[]', id));
        fd.append('cmd', cmd);
        fd.append('csrf_token', getCsrfToken());

        try {
            const res = await fetch('api.php?action=control', {
                method: 'POST',
                body: fd
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Bulk ${cmd} initiated`, 'success');
                fetchStatus();
            } else {
                showToast(data.message || 'Action failed', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    }

    async function deleteProcess(id, name) {
        if (!confirm(`Are you sure you want to delete the process "${name}"?`)) {
            return;
        }

        const fd = new FormData();
        fd.append('id', id);
        fd.append('csrf_token', getCsrfToken());

        try {
            const res = await fetch('api.php?action=delete_process', {
                method: 'POST',
                body: fd
            });
            const data = await res.json();
            if (data.success) {
                showToast('Process deleted', 'success');
                fetchStatus();
            } else {
                showToast(data.message || 'Delete failed', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    }

    async function editProcess(id) {
        try {
            const res = await fetch(`api.php?action=get_process&id=${id}`);
            const data = await res.json();
            if (data.success && data.process) {
                const p = data.process;
                document.getElementById('editProcessId').value = p.id;
                document.getElementById('editProcessName').value = p.name;
                document.getElementById('editProcessGroup').value = p.group_name || 'Default';
                document.getElementById('editProcessCmd').value = p.command;
                document.getElementById('editProcessDir').value = p.working_dir || '';
                document.getElementById('editProcessLog').value = p.log_file || '';
                const autoCb = document.getElementById('editProcessAutoRestart');
                if (autoCb) {
                    autoCb.checked = (parseInt(p.auto_restart) !== 0);
                }

                const modal = new bootstrap.Modal(document.getElementById('editProcessModal'));
                modal.show();
            }
        } catch (e) {
            showToast('Failed to load process details', 'error');
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    return {
        init: function() {
            initTheme();
            initDashboard();

            const bStart = document.getElementById('bulk-start');
            const bStop = document.getElementById('bulk-stop');
            const bRestart = document.getElementById('bulk-restart');

            if (bStart) bStart.addEventListener('click', () => bulkControl('start'));
            if (bStop) bStop.addEventListener('click', () => bulkControl('stop'));
            if (bRestart) bRestart.addEventListener('click', () => bulkControl('restart'));
        },
        controlProcess,
        bulkControl,
        deleteProcess,
        editProcess,
        showToast
    };
})();

document.addEventListener('DOMContentLoaded', App.init);
