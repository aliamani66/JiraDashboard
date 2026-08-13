CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'To Do',
    capabilities TEXT,
    category TEXT DEFAULT 'general',
    confluence_link TEXT,
    start_date TEXT,
    due_date TEXT,
    progress REAL DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    waiting_tasks INTEGER DEFAULT 0,
    last_synced TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'To Do',
    assignee TEXT,
    estimate_hours REAL DEFAULT 0,
    spent_hours REAL DEFAULT 0,
    start_date TEXT,
    due_date TEXT,
    is_waiting INTEGER DEFAULT 0,
    waiting_for_team TEXT,
    waiting_reason TEXT,
    sprint_name TEXT,
    sprint_start_date TEXT,
    sprint_end_date TEXT,
    priority TEXT DEFAULT 'Medium',
    labels TEXT DEFAULT '[]',
    component TEXT DEFAULT 'dev',
    sort_order INTEGER DEFAULT 0,
    is_subtask INTEGER DEFAULT 0,
    parent_task_id TEXT,
    epic_id TEXT,
    parent_key TEXT,
    linked_tasks TEXT DEFAULT '[]',
    created_at TEXT,
    last_synced TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT DEFAULT 'viewer'
);

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    synced_at TEXT NOT NULL,
    status TEXT,
    message TEXT,
    projects_synced INTEGER DEFAULT 0,
    tasks_synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS task_estimate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    old_estimate REAL DEFAULT 0,
    new_estimate REAL DEFAULT 0,
    delta_hours REAL DEFAULT 0,
    changed_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);
