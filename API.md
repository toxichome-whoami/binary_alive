# API Documentation

You can control the system remotely using an API token generated from the Users page. Pass the token either as a URL parameter (`?api_token=YOUR_TOKEN`) or as an HTTP header (`Authorization: Bearer YOUR_TOKEN`).

*Note: Your API token inherits the exact same role and permissions as your web user account.*

---

### 1. Fetch Process Status (GET)
**Required Role:** `Admin`, `Operator`, `Viewer`, or `Auditor` (All roles)
Returns a JSON array of all monitored processes and their current CPU/Memory metrics, plus the server system load average.
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://yourdomain.com/watch/api.php?action=status"
```
**Response fields:**
- `data` — array of processes with `status`, `pid`, `cpu`, `mem`, `uptime` fields.
- `sys_load` — current 1-minute server load average.

### 2. Control a Process (POST)
**Required Role:** `Admin` or `Operator`
Starts, stops, or restarts one or more processes.
- **cmd options:** `start`, `stop`, `restart`
- **id:** Single process ID (e.g. `id=1`)
- **ids[]:** Multiple process IDs for bulk control (e.g. `ids[]=1&ids[]=2`)
```bash
# Single process
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -d "action=control" \
     -d "cmd=restart" \
     -d "id=1" \
     "https://yourdomain.com/watch/api.php"

# Multiple processes at once
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -d "action=control" \
     -d "cmd=stop" \
     -d "ids[]=1" \
     -d "ids[]=2" \
     "https://yourdomain.com/watch/api.php"
```

### 3. Add a New Process (POST)
**Required Role:** `Admin`
Registers a new binary into the system to be monitored.
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -d "action=add_process" \
     -d "name=My_New_Bot" \
     -d "group_name=Default" \
     -d "command=./start_bot.sh" \
     -d "working_dir=/home/username/my_bot" \
     -d "log_file=/home/username/my_bot/output.log" \
     "https://yourdomain.com/watch/api.php"
```

### 4. Edit an Existing Process (POST)
**Required Role:** `Admin`
Updates the configuration of an existing process. You must provide the `id` along with all the updated fields.
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -d "action=edit_process" \
     -d "id=1" \
     -d "name=Updated_Bot_Name" \
     -d "group_name=Production" \
     -d "command=./start_bot.sh --update" \
     -d "working_dir=/home/username/my_bot" \
     -d "log_file=/home/username/my_bot/output.log" \
     "https://yourdomain.com/watch/api.php"
```

### 5. Fetch a Single Process (GET)
**Required Role:** `Admin`
Returns the full database record (including commands and directories) for a specific process ID.
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://yourdomain.com/watch/api.php?action=get_process&id=1"
```

### 6. Delete a Process (POST)
**Required Role:** `Admin`
Permanently deletes a process from the system. (If the process is currently running, it will be forcefully stopped before deletion).
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -d "action=delete_process" \
     -d "id=1" \
     "https://yourdomain.com/watch/api.php"
```


### 7. Run a Terminal Command (POST)
**Required Role:** `Admin`
Runs an arbitrary shell command on the server and returns the combined stdout/stderr output. The command runs from the system directory with a 30-second timeout, and every command is recorded in the audit logs.
- **cmd:** The shell command to execute (max 2000 characters)
```bash
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
     -d "action=terminal" \
     -d "cmd=ls -la" \
     "https://yourdomain.com/watch/api.php"
```

**Response:**
```json
{
  "success": true,
  "output": "drwxr-xr-x 2 user user 4096 Aug 02 12:00 .",
  "exit_code": 0,
  "timed_out": false,
  "cwd": "/home/username/watch"
}
```
- `output` — combined stdout/stderr from the command.
- `exit_code` — the process exit code (non-zero usually means an error).
- `timed_out` — `true` if the command was killed because it exceeded the 30-second limit.
- `cwd` — the current working directory the command ran in.
