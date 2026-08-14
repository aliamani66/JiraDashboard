const cron = require('node-cron');
const jiraService = require('./jiraService');
const { getDb, saveDb } = require('../db/database');
const dotenv = require('dotenv');

dotenv.config();

const SYNC_INTERVAL = process.env.SYNC_INTERVAL_MINUTES || 60;

async function syncFromJira() {
  if (!jiraService.isConfigured) {
    console.log('Jira is not configured. Skipping sync.');
    return { success: false, message: 'Jira not configured' };
  }

  const db = getDb();
  let projectsSynced = 0;
  let tasksSynced = 0;
  const syncTime = new Date().toISOString();

  try {
    // Clear previous tasks, relations, history and projects before full rebuild (ensures DB count = Jira fetch count)
    db.prepare('DELETE FROM task_relations').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM projects').run();
    db.prepare('DELETE FROM task_estimate_history').run();
    try { db.exec('VACUUM'); } catch (_) {}

    // Step 1: Fetch all epics and save as projects
    console.log('Starting Epic extraction from Jira...');
    const epics = await jiraService.fetchEpics();
    console.log(`Fetched ${epics.length} epics from Jira.`);
    
    const insertProject = db.prepare(`
      INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, labels, assignee, priority, linked_tasks, last_synced)
      VALUES (@id, @title, @description, @status, @capabilities, @category, @confluence_link, @start_date, @due_date, @labels, @assignee, @priority, @linked_tasks, @last_synced)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE projects.description END,
        status=excluded.status,
        capabilities=excluded.capabilities,
        category=excluded.category,
        confluence_link=excluded.confluence_link,
        start_date=COALESCE(excluded.start_date, projects.start_date),
        due_date=COALESCE(excluded.due_date, projects.due_date),
        labels=CASE WHEN excluded.labels IS NOT NULL AND excluded.labels != '' AND excluded.labels != '[]' THEN excluded.labels ELSE COALESCE(projects.labels, excluded.labels) END,
        assignee=COALESCE(excluded.assignee, projects.assignee),
        priority=COALESCE(excluded.priority, projects.priority),
        linked_tasks=COALESCE(excluded.linked_tasks, projects.linked_tasks),
        last_synced=excluded.last_synced
    `);

    const insertEpicRelation = db.prepare(`
      INSERT INTO task_relations (task_id, linked_task_id, relation_type, relationship, title, status, assignee, start_date, due_date, created_at)
      VALUES (@task_id, @linked_task_id, @relation_type, @relationship, @title, @status, @assignee, @start_date, @due_date, @created_at)
    `);

    db.transaction(() => {
      for (const epic of epics) {
        epic.last_synced = syncTime;
        if (!epic.capabilities) epic.capabilities = '';
        if (!epic.confluence_link) epic.confluence_link = null;
        if (!epic.labels) epic.labels = '[]';
        if (!epic.assignee) epic.assignee = null;
        if (!epic.priority) epic.priority = 'Medium';
        if (!epic.linked_tasks) epic.linked_tasks = '[]';
        insertProject.run(epic);
        projectsSynced++;

        if (Array.isArray(epic.raw_relations) && epic.raw_relations.length > 0) {
          try { db.prepare('DELETE FROM task_relations WHERE task_id = ?').run(epic.id); } catch (_) {}
          for (const rel of epic.raw_relations) {
            rel.created_at = syncTime;
            try { insertEpicRelation.run(rel); } catch (_) {}
          }
        }
      }
    })();

    console.log(`Epics saved: ${projectsSynced}. Now fetching tasks per epic...`);

    // First query total task count directly from Jira API for configured projects
    let totalJiraCount = 0;
    try {
      const cfg = jiraService.getJiraConfig();
      const projKeyStr = cfg.projectKey;
      let projectFilter = '';
      if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
        const projects = projKeyStr.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
        if (projects.length > 1) {
          projectFilter = `project IN (${projects.join(',')})`;
        } else if (projects.length === 1) {
          projectFilter = `project = ${projects[0]}`;
        }
      }
      const countJql = projectFilter ? `${projectFilter} AND issuetype != Epic` : `issuetype != Epic`;
      const countRes = await jiraService.jiraSearch(countJql, ['key'], { maxResults: 1 });
      totalJiraCount = countRes.total || 0;
      console.log(`[JIRA COUNT CHECK] Total tasks in Jira for ${projKeyStr}: ${totalJiraCount}`);
    } catch (countErr) {
      console.error('Error fetching total Jira task count:', countErr.message);
    }

    // Step 2: Fetch tasks per epic (correct project_id guaranteed)
    const insertTask = db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, assignee, estimate_hours, spent_hours, start_date, created_at, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, is_subtask, parent_task_id, epic_id, parent_key, linked_tasks, last_synced)
      VALUES (@id, @project_id, @title, @description, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @created_at, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @is_subtask, @parent_task_id, @epic_id, @parent_key, @linked_tasks, @last_synced)
      ON CONFLICT(id) DO UPDATE SET
        project_id=excluded.project_id,
        title=excluded.title,
        description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE tasks.description END,
        status=excluded.status,
        assignee=excluded.assignee,
        estimate_hours=excluded.estimate_hours,
        spent_hours=excluded.spent_hours,
        start_date=excluded.start_date,
        created_at=excluded.created_at,
        due_date=excluded.due_date,
        is_waiting=excluded.is_waiting,
        waiting_for_team=excluded.waiting_for_team,
        waiting_reason=excluded.waiting_reason,
        sprint_name=excluded.sprint_name,
        sprint_start_date=excluded.sprint_start_date,
        sprint_end_date=excluded.sprint_end_date,
        priority=excluded.priority,
        labels=excluded.labels,
        component=excluded.component,
        sort_order=excluded.sort_order,
        is_subtask=excluded.is_subtask,
        parent_task_id=excluded.parent_task_id,
        epic_id=excluded.epic_id,
        parent_key=excluded.parent_key,
        linked_tasks=excluded.linked_tasks,
        last_synced=excluded.last_synced
    `);

    // Step 2: Fetch ALL tasks directly from Jira for configured projects (no date filter)
    try {
      const cfg = jiraService.getJiraConfig();
      const projKeyStr = cfg.projectKey || '';
      let projectFilter = '';
      if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
        const projects = projKeyStr.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
        if (projects.length > 1) {
          projectFilter = `project IN (${projects.join(',')})`;
        } else if (projects.length === 1) {
          projectFilter = `project = ${projects[0]}`;
        }
      }
      const searchJql = projectFilter ? `${projectFilter} AND issuetype != Epic ORDER BY created ASC` : `issuetype != Epic ORDER BY created ASC`;
      console.log(`[FULL SYNC] Fetching ALL tasks from Jira (no date filter): JQL = "${searchJql}"`);

      const searchRes = await jiraService.jiraSearch(searchJql, null, { timeout: 60000, retries: 2 });
      const rawIssues = (searchRes && searchRes.issues) ? searchRes.issues : [];
      console.log(`[FULL SYNC] Raw issues returned from Jira: ${rawIssues.length}`);

      const knownEpicsSet = new Set(db.prepare('SELECT UPPER(id) as id FROM projects').all().map(p => p.id));
      const skippedDetails = [];

      const parsedTasks = [];
      for (let idx = 0; idx < rawIssues.length; idx++) {
        const issue = rawIssues[idx];
        const issueKey = (issue.key || '').trim().toUpperCase();
        const summary = issue.fields?.summary || issueKey;
        const issueTypeName = (issue.fields?.issuetype?.name || '').toLowerCase().trim();

        if (!/^[A-Z0-9_]+-\d+$/i.test(issueKey)) {
          skippedDetails.push({
            key: issueKey || 'UNKNOWN',
            title: summary,
            reason: `شناسه «${issueKey}» فاقد الگوی استاندارد (پروژه-شماره) است و نادیده گرفته شد.`
          });
          continue;
        }

        if (issueTypeName === 'epic') {
          skippedDetails.push({
            key: issueKey,
            title: summary,
            reason: `آیتم «${issueKey}» از نوع اپیک است و در جدول پروژه‌ها ذخیره گردید.`
          });
          continue;
        }

        const parsed = jiraService.parseTaskIssue ? jiraService.parseTaskIssue(issue, null, idx, knownEpicsSet) : issue;
        if (parsed) {
          if (!parsed.project_id) {
            const projKey = (issue.fields?.project?.key || issueKey.split('-')[0] || 'ORD').toUpperCase();
            parsed.project_id = projKey;
          }
          parsedTasks.push(parsed);
        } else {
          skippedDetails.push({
            key: issueKey,
            title: summary,
            reason: `تسک «${issueKey}» در پردازش اولیه نادیده گرفته شد.`
          });
        }
      }

      const insertRelation = db.prepare(`
        INSERT INTO task_relations (task_id, linked_task_id, relation_type, relationship, title, status, assignee, start_date, due_date, created_at)
        VALUES (@task_id, @linked_task_id, @relation_type, @relationship, @title, @status, @assignee, @start_date, @due_date, @created_at)
      `);
      const deleteRelations = db.prepare(`DELETE FROM task_relations WHERE task_id = ?`);

      for (const task of parsedTasks) {
        if (task && task.id && /^[A-Z][A-Z0-9_]*-\d+$/i.test(task.id)) {
          task.last_synced = syncTime;
          if (!task.parent_task_id) task.parent_task_id = null;
          try {
            insertTask.run(task);
            tasksSynced++;

            // Sync with dedicated task_relations table
            if (task.linked_tasks) {
              let links = [];
              try { links = typeof task.linked_tasks === 'string' ? JSON.parse(task.linked_tasks) : task.linked_tasks; } catch (_) {}
              if (Array.isArray(links)) {
                try { deleteRelations.run(task.id); } catch (_) {}
                for (const link of links) {
                  if (link && link.key) {
                    try {
                      insertRelation.run({
                        task_id: task.id,
                        linked_task_id: link.key,
                        relation_type: link.linkType || 'Relates',
                        relationship: link.relationship || 'relates to',
                        title: link.title || link.key,
                        status: link.status || null,
                        assignee: link.assignee || null,
                        start_date: link.start_date || null,
                        due_date: link.due_date || null,
                        created_at: syncTime
                      });
                    } catch (_) {}
                  }
                }
              }
            }
          } catch (dbErr) {
            skippedDetails.push({
              key: task.id,
              title: task.title || task.id,
              reason: `خطای دیتابیس در درج SQL: ${dbErr.message}`
            });
          }
        }
      }

      const syncReport = {
        syncTime,
        rawIssuesCount: rawIssues.length,
        projectsSynced,
        tasksSynced,
        skippedOrFailedCount: skippedDetails.length,
        skippedDetails
      };

      try {
        db.prepare(`INSERT INTO system_settings (key, value) VALUES ('LAST_SYNC_REPORT', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(JSON.stringify(syncReport));
      } catch (_) {}

      // Purge obsolete/deleted tasks in DB for configured projects that no longer exist in Jira
      const fetchedKeysSet = new Set(parsedTasks.map(t => (t.id || '').toUpperCase()).filter(Boolean));
      if (fetchedKeysSet.size > 0) {
        let taskProjWhere = '';
        if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
          const pKeys = projKeyStr.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
          if (pKeys.length > 0) {
            const taskLikes = pKeys.map(k => `id LIKE '${k}-%'`).join(' OR ');
            taskProjWhere = ` AND (${taskLikes})`;
          }
        }
        const dbTasksInProj = db.prepare(`SELECT id FROM tasks WHERE 1=1 ${taskProjWhere}`).all();
        const obsoleteKeys = dbTasksInProj.map(t => t.id).filter(id => !fetchedKeysSet.has(id.toUpperCase()));
        if (obsoleteKeys.length > 0) {
          db.transaction(() => {
            const delStmt = db.prepare('DELETE FROM tasks WHERE id = ?');
            for (const oldKey of obsoleteKeys) {
              delStmt.run(oldKey);
            }
          })();
          console.log(`[FULL SYNC] Purged ${obsoleteKeys.length} obsolete/deleted tasks from DB that no longer exist in Jira.`);
        }
      }
    } catch (taskErr) {
      console.error(`[FULL SYNC] Failed to fetch all tasks from Jira:`, taskErr.message);
    }

    autoLinkTasksToEpics();
    updateProjectStats();

    // Real DB counts for accuracy
    const dbTotalTasks = db.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
    const dbRegularTasks = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE is_subtask = 0 OR is_subtask IS NULL').get().c;
    const dbSubtasks = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE is_subtask = 1').get().c;

    const logInsert = db.prepare('INSERT INTO sync_log (synced_at, status, message, projects_synced, tasks_synced) VALUES (?, ?, ?, ?, ?)');
    logInsert.run(syncTime, 'Success', 'Full sync completed', projectsSynced, dbTotalTasks);

    console.log(`Full sync complete. Epics: ${projectsSynced}, Jira total report: ${totalJiraCount}, Tasks fetched: ${tasksSynced}, DB total: ${dbTotalTasks} (regular: ${dbRegularTasks}, subtasks: ${dbSubtasks})`);
    return {
      success: true,
      projectsSynced,
      jiraTotalCount: totalJiraCount,
      tasksSynced: dbTotalTasks,
      dbRegularTasks,
      dbSubtasks,
      message: `بازسازی کامل انجام شد (${projectsSynced} اپیک، کل جیرا: ${totalJiraCount} تسک | دیتابیس: ${dbRegularTasks} تسک + ${dbSubtasks} زیرتسک = ${dbTotalTasks} کل)`
    };

  } catch (err) {
    console.error('Sync failed:', err);
    const logInsert = db.prepare('INSERT INTO sync_log (synced_at, status, message) VALUES (?, ?, ?)');
    logInsert.run(syncTime, 'Failed', err.message);
    return { success: false, message: err.message };
  }
}

function getLastSync() {
  try {
    const db = getDb();
    const logRow = db.prepare('SELECT * FROM sync_log WHERE status = "Success" ORDER BY id DESC LIMIT 1').get();
    if (logRow && logRow.synced_at) {
      return logRow;
    }
    const projRow = db.prepare('SELECT MAX(last_synced) as synced_at FROM projects').get();
    if (projRow && projRow.synced_at) {
      return { synced_at: projRow.synced_at, status: 'Success' };
    }
    return null;
  } catch (e) {
    return null;
  }
}

const PERSIAN_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

function getJalaliMonthLabel(year, monthZeroIndexed) {
  const gMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const gName = gMonthNames[monthZeroIndexed];
  let jMonthIdx = (monthZeroIndexed + 9) % 12;
  let jYear = monthZeroIndexed >= 2 ? year - 621 : year - 622;
  return {
    jalali: `${PERSIAN_MONTH_NAMES[jMonthIdx]} ${jYear}`,
    gregorian: `${gName} ${year}`
  };
}

async function syncMonthlyLastYearFromJira() {
  if (!jiraService.isConfigured) {
    return { success: false, message: 'Jira is not configured' };
  }

  const db = getDb();
  const syncTime = new Date().toISOString();
  const monthlyResults = [];
  let totalTasksSynced = 0;
  let projectsSynced = 0;

  // 1. Fetch Epics first
  let epics = [];
  try {
    epics = await jiraService.fetchEpics();
    db.transaction(() => {
      const insertProject = db.prepare(`
        INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, last_synced)
        VALUES (@id, @title, @description, @status, @capabilities, @category, @confluence_link, @start_date, @due_date, @last_synced)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title,
          description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE projects.description END,
          status=excluded.status,
          last_synced=excluded.last_synced
      `);
      for (const epic of epics) {
        epic.last_synced = syncTime;
        insertProject.run(epic);
        projectsSynced++;
      }
    })();
  } catch (err) {
    console.error('Fetching epics failed during monthly sync:', err);
  }

  // 2. Generate 12 month ranges (11 months ago to current month)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthRanges = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();

    const lastDay = new Date(y, m + 1, 0);

    const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01 00:00`;
    const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')} 23:59`;

    const monthInfo = getJalaliMonthLabel(y, m);

    monthRanges.push({
      monthIndex: 12 - i,
      year: y,
      month: m + 1,
      monthKey: `${y}-${String(m + 1).padStart(2, '0')}`,
      jalaliName: monthInfo.jalali,
      gregorianName: monthInfo.gregorian,
      startStr,
      endStr
    });
  }

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, project_id, title, description, status, assignee, estimate_hours, spent_hours, start_date, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, is_subtask, parent_task_id, last_synced)
    VALUES (@id, @project_id, @title, @description, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @is_subtask, @parent_task_id, @last_synced)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE tasks.description END,
      status=excluded.status,
      assignee=excluded.assignee,
      estimate_hours=excluded.estimate_hours,
      spent_hours=excluded.spent_hours,
      start_date=excluded.start_date,
      due_date=excluded.due_date,
      is_waiting=excluded.is_waiting,
      waiting_for_team=excluded.waiting_for_team,
      waiting_reason=excluded.waiting_reason,
      sprint_name=excluded.sprint_name,
      sprint_start_date=excluded.sprint_start_date,
      sprint_end_date=excluded.sprint_end_date,
      priority=excluded.priority,
      labels=excluded.labels,
      component=excluded.component,
      sort_order=excluded.sort_order,
      is_subtask=excluded.is_subtask,
      parent_task_id=excluded.parent_task_id,
      last_synced=excluded.last_synced
  `);

  const cfg = jiraService.getJiraConfig();
  const projKeys = cfg.projectKey ? cfg.projectKey.split(',').map(k => k.trim()).filter(Boolean) : [];
  const projectJqlClause = projKeys.length > 0 ? `project IN (${projKeys.join(',')}) AND ` : '';

  const configuredProjKeySet = new Set((cfg.projectKey || '').split(',').map(k => k.trim().toUpperCase()).filter(Boolean));

  for (const mRange of monthRanges) {
    const jql = `${projectJqlClause}created >= "${mRange.startStr}" AND created <= "${mRange.endStr}" ORDER BY created ASC`;
    try {
      const searchRes = await jiraService.jiraSearch(jql);
      const rawIssues = searchRes.issues || [];

      // Strict JS-level filter: only keep issues from configured project keys
      const filteredIssues = configuredProjKeySet.size > 0
        ? rawIssues.filter(issue => {
            const issueProjKey = (issue.fields?.project?.key || (issue.key || '').split('-')[0] || '').toUpperCase();
            return configuredProjKeySet.has(issueProjKey);
          })
        : rawIssues;

      const parsedTasks = filteredIssues.map((issue, idx) => jiraService.parseTaskIssue ? jiraService.parseTaskIssue(issue, null, idx) : issue);

      db.transaction(() => {
        for (const task of parsedTasks) {
          if (task && task.id) {
            task.last_synced = syncTime;
            // Only insert tasks from configured project keys (check by key prefix, not exact epic ID)
            if (task.id && configuredProjKeySet.size > 0) {
              const issueKeyPrefix = (task.id || '').split('-')[0].toUpperCase();
              if (!configuredProjKeySet.has(issueKeyPrefix)) continue;
            }
            insertTask.run(task);
          }
        }
      })();

      totalTasksSynced += parsedTasks.length;

      monthlyResults.push({
        monthIndex: mRange.monthIndex,
        monthKey: mRange.monthKey,
        jalaliName: mRange.jalaliName,
        gregorianName: mRange.gregorianName,
        dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
        jql,
        taskCount: parsedTasks.length,
        status: parsedTasks.length > 0 ? 'success' : 'empty',
        message: parsedTasks.length > 0 ? `${parsedTasks.length} تسک دریافت شد` : '۰ تسک (بدون نتیجه)'
      });

    } catch (monthErr) {
      console.error(`Monthly sync failed for month ${mRange.monthKey}:`, monthErr.message);
      monthlyResults.push({
        monthIndex: mRange.monthIndex,
        monthKey: mRange.monthKey,
        jalaliName: mRange.jalaliName,
        gregorianName: mRange.gregorianName,
        dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
        jql,
        taskCount: 0,
        status: 'error',
        message: `خطا در همگام‌سازی: ${monthErr.message}`
      });
    }
  }

  // Update project stats
  try {
    const updateAllProjectStats = db.prepare(`
      UPDATE projects SET
        total_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0)),
        completed_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0) AND (status = 'Done' OR status = 'Completed')),
        waiting_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0) AND (is_waiting = 1 OR status = 'OnHolding' OR status = 'Waiting'))
    `);
    updateAllProjectStats.run();
  } catch (_) {}

  return {
    success: true,
    totalTasksSynced,
    projectsSynced,
    monthlyResults
  };
}

async function syncDateRangeFromJira(startDateInput, endDateInput) {
  if (!jiraService.isConfigured) {
    return { success: false, message: 'Jira is not configured' };
  }

  const db = getDb();
  const syncTime = new Date().toISOString();
  const monthlyResults = [];
  let totalTasksSynced = 0;
  let projectsSynced = 0;

  // 1. Fetch Epics first
  let epics = [];
  try {
    epics = await jiraService.fetchEpics();
    db.transaction(() => {
      const insertProject = db.prepare(`
        INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, last_synced)
        VALUES (@id, @title, @description, @status, @capabilities, @category, @confluence_link, @start_date, @due_date, @last_synced)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title,
          description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE projects.description END,
          status=excluded.status,
          last_synced=excluded.last_synced
      `);
      for (const epic of epics) {
        epic.last_synced = syncTime;
        insertProject.run(epic);
        projectsSynced++;
      }
    })();
  } catch (err) {
    console.error('Fetching epics failed during range sync:', err);
  }

  const startDt = new Date(startDateInput || '2025-01-01');
  const endDt = new Date(endDateInput || new Date().toISOString().split('T')[0]);

  const monthRanges = [];
  let curr = new Date(startDt.getFullYear(), startDt.getMonth(), 1);
  let stepIndex = 1;

  while (curr <= endDt) {
    const y = curr.getFullYear();
    const m = curr.getMonth();
    const lastDayOfMonth = new Date(y, m + 1, 0);

    const chunkStart = (y === startDt.getFullYear() && m === startDt.getMonth()) ? startDt : new Date(y, m, 1);
    const chunkEnd = (y === endDt.getFullYear() && m === endDt.getMonth()) ? endDt : lastDayOfMonth;

    const startStr = `${chunkStart.getFullYear()}-${String(chunkStart.getMonth() + 1).padStart(2, '0')}-${String(chunkStart.getDate()).padStart(2, '0')} 00:00`;
    const endStr = `${chunkEnd.getFullYear()}-${String(chunkEnd.getMonth() + 1).padStart(2, '0')}-${String(chunkEnd.getDate()).padStart(2, '0')} 23:59`;

    const monthInfo = getJalaliMonthLabel(y, m);

    monthRanges.push({
      monthIndex: stepIndex++,
      year: y,
      month: m + 1,
      monthKey: `${y}-${String(m + 1).padStart(2, '0')}`,
      jalaliName: monthInfo.jalali,
      gregorianName: monthInfo.gregorian,
      startStr,
      endStr
    });

    curr = new Date(y, m + 1, 1);
  }

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, project_id, title, description, status, assignee, estimate_hours, spent_hours, start_date, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, is_subtask, parent_task_id, last_synced)
    VALUES (@id, @project_id, @title, @description, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @is_subtask, @parent_task_id, @last_synced)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE tasks.description END,
      status=excluded.status,
      assignee=excluded.assignee,
      estimate_hours=excluded.estimate_hours,
      spent_hours=excluded.spent_hours,
      start_date=excluded.start_date,
      due_date=excluded.due_date,
      is_waiting=excluded.is_waiting,
      waiting_for_team=excluded.waiting_for_team,
      waiting_reason=excluded.waiting_reason,
      sprint_name=excluded.sprint_name,
      sprint_start_date=excluded.sprint_start_date,
      sprint_end_date=excluded.sprint_end_date,
      priority=excluded.priority,
      labels=excluded.labels,
      component=excluded.component,
      sort_order=excluded.sort_order,
      is_subtask=excluded.is_subtask,
      parent_task_id=excluded.parent_task_id,
      last_synced=excluded.last_synced
  `);

  const cfg = jiraService.getJiraConfig();
  const projKeys = cfg.projectKey ? cfg.projectKey.split(',').map(k => k.trim()).filter(Boolean) : [];
  const projectJqlClause = projKeys.length > 0 ? `project IN (${projKeys.join(',')}) AND ` : '';

  for (const mRange of monthRanges) {
    const jql = `${projectJqlClause}created >= "${mRange.startStr}" AND created <= "${mRange.endStr}" ORDER BY created ASC`;
    try {
      const searchRes = await jiraService.jiraSearch(jql);
      const rawIssues = searchRes.issues || [];
      const parsedTasks = rawIssues.map((issue, idx) => jiraService.parseTaskIssue ? jiraService.parseTaskIssue(issue, null, idx) : issue);

      db.transaction(() => {
        for (const task of parsedTasks) {
          if (task && task.id) {
            task.last_synced = syncTime;
            insertTask.run(task);
          }
        }
      })();

      totalTasksSynced += parsedTasks.length;

      monthlyResults.push({
        monthIndex: mRange.monthIndex,
        monthKey: mRange.monthKey,
        jalaliName: mRange.jalaliName,
        gregorianName: mRange.gregorianName,
        dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
        jql,
        taskCount: parsedTasks.length,
        status: parsedTasks.length > 0 ? 'success' : 'empty',
        message: parsedTasks.length > 0 ? `${parsedTasks.length} تسک دریافت شد` : '۰ تسک (بدون نتیجه)'
      });

    } catch (monthErr) {
      console.error(`Range sync failed for month ${mRange.monthKey}:`, monthErr.message);
      monthlyResults.push({
        monthIndex: mRange.monthIndex,
        monthKey: mRange.monthKey,
        jalaliName: mRange.jalaliName,
        gregorianName: mRange.gregorianName,
        dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
        jql,
        taskCount: 0,
        status: 'error',
        message: `خطا در همگام‌سازی: ${monthErr.message}`
      });
    }
  }

  try {
    const updateAllProjectStats = db.prepare(`
      UPDATE projects SET
        total_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0)),
        completed_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0) AND (status = 'Done' OR status = 'Completed')),
        waiting_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0) AND (is_waiting = 1 OR status = 'OnHolding' OR status = 'Waiting'))
    `);
    updateAllProjectStats.run();
  } catch (_) {}

  return {
    success: true,
    totalTasksSynced,
    projectsSynced,
    startDate: startDateInput,
    endDate: endDateInput,
    totalMonths: monthRanges.length,
    monthlyResults
  };
}

function g2j(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

async function syncSingleMonthFromJira({ startStr, endStr, jalaliStartStr, jalaliEndStr, monthLabel, monthIndex }) {
  if (!jiraService.isConfigured) {
    return { success: false, message: 'Jira is not configured' };
  }

  const db = getDb();
  const syncTime = new Date().toISOString();

  // Ensure projects table has Epics (fetch if missing Epics or monthIndex === 1)
  const epicCountInDb = db.prepare("SELECT COUNT(*) as c FROM projects WHERE id LIKE '%-%'").get()?.c || 0;
  if (Number(monthIndex) === 1 || epicCountInDb === 0) {
    try {
      const epics = await jiraService.fetchEpics();
      const insertEpicRelation = db.prepare(`
        INSERT INTO task_relations (task_id, linked_task_id, relation_type, relationship, title, status, assignee, start_date, due_date, created_at)
        VALUES (@task_id, @linked_task_id, @relation_type, @relationship, @title, @status, @assignee, @start_date, @due_date, @created_at)
      `);
      db.transaction(() => {
        const insertProject = db.prepare(`
          INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, labels, assignee, priority, linked_tasks, last_synced)
          VALUES (@id, @title, @description, @status, @capabilities, @category, @confluence_link, @start_date, @due_date, @labels, @assignee, @priority, @linked_tasks, @last_synced)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE projects.description END,
            status=excluded.status,
            capabilities=excluded.capabilities,
            category=excluded.category,
            confluence_link=excluded.confluence_link,
            start_date=COALESCE(excluded.start_date, projects.start_date),
            due_date=COALESCE(excluded.due_date, projects.due_date),
            labels=COALESCE(excluded.labels, projects.labels),
            assignee=COALESCE(excluded.assignee, projects.assignee),
            priority=COALESCE(excluded.priority, projects.priority),
            linked_tasks=COALESCE(excluded.linked_tasks, projects.linked_tasks),
            last_synced=excluded.last_synced
        `);
        for (const epic of epics) {
          epic.last_synced = syncTime;
          if (!epic.labels) epic.labels = '[]';
          if (!epic.assignee) epic.assignee = null;
          if (!epic.priority) epic.priority = 'Medium';
          if (!epic.linked_tasks) epic.linked_tasks = '[]';
          insertProject.run(epic);

          if (Array.isArray(epic.raw_relations) && epic.raw_relations.length > 0) {
            try { db.prepare('DELETE FROM task_relations WHERE task_id = ?').run(epic.id); } catch (_) {}
            for (const rel of epic.raw_relations) {
              rel.created_at = syncTime;
              try { insertEpicRelation.run(rel); } catch (_) {}
            }
          }
        }
      })();
      autoLinkTasksToEpics();
    } catch (err) {
      console.error('Fetching epics failed during single month sync:', err.message);
    }
  }

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, project_id, title, description, status, assignee, estimate_hours, spent_hours, start_date, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, is_subtask, parent_task_id, last_synced)
    VALUES (@id, @project_id, @title, @description, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @is_subtask, @parent_task_id, @last_synced)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE tasks.description END,
      status=excluded.status,
      assignee=excluded.assignee,
      estimate_hours=excluded.estimate_hours,
      spent_hours=excluded.spent_hours,
      start_date=excluded.start_date,
      due_date=excluded.due_date,
      is_waiting=excluded.is_waiting,
      waiting_for_team=excluded.waiting_for_team,
      waiting_reason=excluded.waiting_reason,
      sprint_name=excluded.sprint_name,
      sprint_start_date=excluded.sprint_start_date,
      sprint_end_date=excluded.sprint_end_date,
      priority=excluded.priority,
      labels=excluded.labels,
      component=excluded.component,
      sort_order=excluded.sort_order,
      is_subtask=excluded.is_subtask,
      parent_task_id=excluded.parent_task_id,
      last_synced=excluded.last_synced
  `);

  const cfg = jiraService.getJiraConfig();
  const projKeyStr = cfg.projectKey || 'ORD';

  let projectClause = '';
  if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
    const projects = projKeyStr.split(',').map(p => {
      const clean = p.trim().toUpperCase();
      return /^[A-Z0-9_]+$/.test(clean) ? clean : `"${clean}"`;
    }).filter(Boolean);
    if (projects.length > 1) {
      projectClause = `project IN (${projects.join(',')})`;
    } else if (projects.length === 1) {
      projectClause = `project = ${projects[0]}`;
    }
  }

  const projPrefix = projectClause ? `${projectClause} AND ` : '';

  let effectiveJalaliStart = jalaliStartStr;
  let effectiveJalaliEnd = jalaliEndStr;

  if (!effectiveJalaliStart && startStr) {
    const sDateParts = startStr.split(' ')[0].split('-').map(Number);
    if (sDateParts.length === 3) {
      const jStart = g2j(sDateParts[0], sDateParts[1], sDateParts[2]);
      effectiveJalaliStart = `${jStart.jy}/${String(jStart.jm).padStart(2, '0')}/${String(jStart.jd).padStart(2, '0')} 00:00`;
    }
  }

  if (!effectiveJalaliEnd && endStr) {
    const eDateParts = endStr.split(' ')[0].split('-').map(Number);
    if (eDateParts.length === 3) {
      const jEnd = g2j(eDateParts[0], eDateParts[1], eDateParts[2]);
      effectiveJalaliEnd = `${jEnd.jy}/${String(jEnd.jm).padStart(2, '0')}/${String(jEnd.jd).padStart(2, '0')} 23:59`;
    }
  }

  const jalaliSlashDateOnly = effectiveJalaliStart && effectiveJalaliEnd ? effectiveJalaliStart.split(' ')[0] : '';
  const jalaliSlashDateEndOnly = effectiveJalaliStart && effectiveJalaliEnd ? effectiveJalaliEnd.split(' ')[0] : '';
  const jalaliDashDateOnly = jalaliSlashDateOnly ? jalaliSlashDateOnly.replace(/\//g, '-') : '';
  const jalaliDashDateEndOnly = jalaliSlashDateEndOnly ? jalaliSlashDateEndOnly.replace(/\//g, '-') : '';

  try {
    const gregStartDateOnly = (startStr || '').split(' ')[0];
    const gregEndDateOnly = (endStr || '').split(' ')[0];

    const confirmedJql = projectClause
      ? `${projectClause} AND created >= "${gregStartDateOnly}" AND created <= "${gregEndDateOnly}" ORDER BY created ASC`
      : `created >= "${gregStartDateOnly}" AND created <= "${gregEndDateOnly}" ORDER BY created ASC`;

    const configuredProjKeys = new Set(
      projKeyStr.split(',').map(k => k.trim().toUpperCase()).filter(Boolean)
    );

    console.log(`[SYNC][${monthLabel}] JQL: ${confirmedJql}`);
    console.log(`[SYNC][${monthLabel}] configuredProjKeys: ${[...configuredProjKeys].join(', ')}`);

    // Count projects in DB
    const projCount = db.prepare('SELECT COUNT(*) as c FROM projects').get();
    console.log(`[SYNC][${monthLabel}] Projects in DB before sync: ${projCount.c}`);

    let searchRes = null;
    try {
      searchRes = await jiraService.jiraSearch(confirmedJql);
    } catch (err) {
      const errCode = err.code || (err.response ? `HTTP_${err.response.status}` : 'TIMEOUT_OR_NETWORK');
      const detailMsg = err.response?.data?.errorMessages?.join(', ') || err.message;
      console.error(`[SYNC][${monthLabel}] Jira search ERROR: ${errCode} - ${detailMsg}`);
      return {
        success: false, monthIndex, monthLabel,
        dateRange: `${gregStartDateOnly} تا ${gregEndDateOnly}`,
        jql: confirmedJql, taskCount: 0, status: 'error',
        errorCode: errCode, message: `🔴 خطا (${errCode}): ${detailMsg}`,
        queryAuditResults: [{ variant: 3, name: 'کوئری #۳ (پروژه + تاریخ میلادی)', jql: confirmedJql, taskCount: 0, status: 'error', error: detailMsg }]
      };
    }

    const startDt = new Date(startStr);
    const endDt = new Date(endStr);
    const rawIssues = (searchRes && searchRes.issues) ? searchRes.issues : [];

    console.log(`[SYNC][${monthLabel}] Raw issues from Jira: ${rawIssues.length}`);
    if (rawIssues.length > 0) {
      const projKeysSeen = [...new Set(rawIssues.map(i => i.fields?.project?.key || i.key?.split('-')[0] || '?'))];
      console.log(`[SYNC][${monthLabel}] Project keys seen in raw issues: ${projKeysSeen.join(', ')}`);
    }

    // Filter in JS: by configured project keys + exact date range
    const finalIssues = rawIssues.filter(issue => {
      const issueProjKey = (issue.fields?.project?.key || (issue.key || '').split('-')[0] || '').toUpperCase();
      if (configuredProjKeys.size > 0 && issueProjKey && !configuredProjKeys.has(issueProjKey)) return false;
      if (issue.fields?.created) {
        const cDate = new Date(issue.fields.created);
        const fullEndDt = new Date(endDt);
        fullEndDt.setHours(23, 59, 59, 999);
        if (cDate < startDt || cDate > fullEndDt) return false;
      }
      return true;
    });

    console.log(`[SYNC][${monthLabel}] Issues after JS project+date filter: ${finalIssues.length}`);

    const knownEpicsSet = new Set(db.prepare('SELECT UPPER(id) as id FROM projects').all().map(p => p.id));
    const parsedTasks = finalIssues.map((issue, idx) => {
      const parsed = jiraService.parseTaskIssue ? jiraService.parseTaskIssue(issue, null, idx, knownEpicsSet) : issue;
      if (parsed && !parsed.project_id) {
        const projKey = (issue.fields?.project?.key || (issue.key || '').split('-')[0] || 'ORD').toUpperCase();
        const proj = db.prepare('SELECT id FROM projects WHERE UPPER(id) = ? LIMIT 1').get(projKey);
        parsed.project_id = proj ? proj.id : projKey;
      }
      return parsed;
    });

    let savedCount = 0;
    let skippedCount = 0;
    db.transaction(() => {
      for (const task of parsedTasks) {
        if (task && task.id && /^[A-Z][A-Z0-9_]*-\d+$/i.test(task.id)) {
          task.last_synced = syncTime;
          // Only insert tasks from configured project keys (check by key prefix, not exact epic ID)
          if (task.id && configuredProjKeys.size > 0) {
            const issueKeyPrefix = (task.id || '').split('-')[0].toUpperCase();
            if (!configuredProjKeys.has(issueKeyPrefix)) {
              skippedCount++;
              continue;
            }
          }
          try {
            insertTask.run(task);
            savedCount++;

            // Populate dedicated task_relations table
            if (task.linked_tasks) {
              let links = [];
              try { links = typeof task.linked_tasks === 'string' ? JSON.parse(task.linked_tasks) : task.linked_tasks; } catch (_) {}
              if (Array.isArray(links)) {
                try { db.prepare('DELETE FROM task_relations WHERE task_id = ?').run(task.id); } catch (_) {}
                const insertRelation = db.prepare(`
                  INSERT INTO task_relations (task_id, linked_task_id, relation_type, relationship, title, status, assignee, start_date, due_date, created_at)
                  VALUES (@task_id, @linked_task_id, @relation_type, @relationship, @title, @status, @assignee, @start_date, @due_date, @created_at)
                `);
                for (const link of links) {
                  if (link && link.key) {
                    try {
                      insertRelation.run({
                        task_id: task.id,
                        linked_task_id: link.key,
                        relation_type: link.linkType || 'Relates',
                        relationship: link.relationship || 'relates to',
                        title: link.title || link.key,
                        status: link.status || null,
                        assignee: link.assignee || null,
                        start_date: link.start_date || null,
                        due_date: link.due_date || null,
                        created_at: syncTime
                      });
                    } catch (_) {}
                  }
                }
              }
            }
          } catch (insertErr) {
            console.error(`[SYNC][${monthLabel}] insertTask ERROR for ${task.id}:`, insertErr.message);
          }
        }
      }
    })();

    console.log(`[SYNC][${monthLabel}] Tasks saved: ${savedCount}, skipped (wrong project): ${skippedCount}`);

    autoLinkTasksToEpics();
    updateProjectStats();

    const tasksInDb = db.prepare('SELECT COUNT(*) as c FROM tasks').get();
    console.log(`[SYNC][${monthLabel}] Total tasks in DB after sync: ${tasksInDb.c}`);

    saveDb();

    return {
      success: true, monthIndex, monthLabel,
      dateRange: `${gregStartDateOnly} تا ${gregEndDateOnly}`,
      jql: confirmedJql,
      winningVariant: 'کوئری #۳ (پروژه + تاریخ میلادی دقیق)',
      taskCount: savedCount,
      status: savedCount > 0 ? 'success' : 'empty',
      message: savedCount > 0 ? `${savedCount} تسک دریافت و ذخیره شد` : '۰ تسک (در این بازه تسکی یافت نشد)',
      queryAuditResults: [{
        variant: 3, name: '✅ کوئری #۳ (پروژه + تاریخ میلادی دقیق)',
        jql: confirmedJql, taskCount: parsedTasks.length,
        status: parsedTasks.length > 0 ? 'success' : 'zero'
      }]
    };
  } catch (outerErr) {
    const fallbackJql = `${projPrefix}created >= "${(startStr||'').split(' ')[0]}" AND created <= "${(endStr||'').split(' ')[0]}" ORDER BY created ASC`;
    return {
      success: false, monthIndex, monthLabel,
      dateRange: `${(startStr||'').split(' ')[0]} تا ${(endStr||'').split(' ')[0]}`,
      jql: fallbackJql,
      taskCount: 0, status: 'error',
      errorCode: 'PROCESSING_ERROR',
      message: `🔴 خطا در پردازش ماه: ${outerErr.message}`,
      queryAuditResults: [{ variant: 3, name: 'کوئری #۳', jql: fallbackJql, taskCount: 0, status: 'error', error: outerErr.message }]
    };
  }
}

function autoLinkTasksToEpics() {
  try {
    const db = getDb();
    const now = new Date().toISOString();

    // Clean task IDs accidentally inserted into projects table
    db.prepare('DELETE FROM projects WHERE id IN (SELECT id FROM tasks)').run();

    const cfg = jiraService.getJiraConfig();
    const pKeyStr = (cfg.projectKey || '').trim().toUpperCase();
    let pKeys = [];
    if (pKeyStr && pKeyStr !== 'ALL' && pKeyStr !== '*') {
      pKeys = pKeyStr.split(',').map(k => k.trim()).filter(Boolean);
      if (pKeys.length > 0) {
        const projLikeClauses = pKeys.map(k => `id LIKE '${k}-%' OR id = '${k}'`).join(' OR ');
        const taskLikeClauses = pKeys.map(k => `id LIKE '${k}-%' OR project_id LIKE '${k}-%' OR project_id = '${k}'`).join(' OR ');
        
        // Purge any epics, projects, or tasks outside the user's configured project keys (e.g., ORD, OPS, DEV)
        db.prepare(`DELETE FROM projects WHERE NOT (${projLikeClauses})`).run();
        db.prepare(`DELETE FROM tasks WHERE NOT (${taskLikeClauses})`).run();
      }
    }

    let pKeyFilter = '';
    if (pKeys.length > 0) {
      const pLike = pKeys.map(k => `parent_task_id LIKE '${k}-%'`).join(' OR ');
      pKeyFilter = `AND (${pLike})`;
    }

    // 0. Ensure epic_id is synced with parent_task_id for all tasks
    try {
      db.prepare(`UPDATE tasks SET epic_id = parent_task_id WHERE (epic_id IS NULL OR epic_id = '') AND parent_task_id IS NOT NULL AND parent_task_id LIKE '%-%'`).run();
      db.prepare(`UPDATE tasks SET parent_task_id = epic_id WHERE (parent_task_id IS NULL OR parent_task_id = '') AND epic_id IS NOT NULL AND epic_id LIKE '%-%'`).run();
    } catch (_) {}

    // 1. Auto-insert missing Epics into projects table if referenced by tasks.epic_id / parent_task_id
    db.prepare(`
      INSERT INTO projects (id, title, status, last_synced)
      SELECT DISTINCT COALESCE(epic_id, parent_task_id), 'اپیک ' || COALESCE(epic_id, parent_task_id), 'In Progress', ?
      FROM tasks
      WHERE COALESCE(epic_id, parent_task_id) IS NOT NULL 
        AND COALESCE(epic_id, parent_task_id) != '' 
        AND COALESCE(epic_id, parent_task_id) LIKE '%-%'
        ${pKeyFilter}
        AND COALESCE(epic_id, parent_task_id) NOT IN (SELECT id FROM projects)
    `).run(now);

    // 2. Propagate epic project_id from parent task to sub-tasks
    db.prepare(`
      UPDATE tasks
      SET project_id = (SELECT t2.project_id FROM tasks t2 WHERE t2.id = tasks.parent_task_id)
      WHERE parent_task_id IS NOT NULL
        AND parent_task_id IN (SELECT id FROM tasks)
        AND (project_id NOT IN (SELECT id FROM projects) OR project_id IS NULL)
        AND (SELECT t2.project_id FROM tasks t2 WHERE t2.id = tasks.parent_task_id) IN (SELECT id FROM projects)
    `).run();

    // 3. Direct parent task as epic if parent_task_id is in projects table
    db.prepare(`
      UPDATE tasks
      SET project_id = parent_task_id
      WHERE (project_id NOT IN (SELECT id FROM projects) OR project_id IS NULL)
        AND parent_task_id IS NOT NULL
        AND parent_task_id IN (SELECT id FROM projects)
    `).run();

    // 4. Ensure any task whose project_id is missing from projects table gets linked to standing project container (e.g. 'ORD')
    const unlinkedRows = db.prepare(`
      SELECT DISTINCT project_id, id FROM tasks
      WHERE (project_id NOT IN (SELECT id FROM projects) OR project_id IS NULL OR project_id = '')
        AND (parent_task_id IS NULL OR parent_task_id = '' OR parent_task_id NOT IN (SELECT id FROM projects))
    `).all();

    if (unlinkedRows && unlinkedRows.length > 0) {
      const defaultFallback = pKeys[0] || 'ORD';
      const insertProj = db.prepare(`
        INSERT INTO projects (id, title, status, last_synced)
        VALUES (?, ?, 'In Progress', ?)
        ON CONFLICT(id) DO NOTHING
      `);

      db.transaction(() => {
        for (const r of unlinkedRows) {
          let fallbackId = (r.project_id || r.id || '').split('-')[0].toUpperCase();
          if (pKeys.length > 0 && !pKeys.includes(fallbackId)) {
            fallbackId = defaultFallback;
          }
          if (fallbackId) {
            insertProj.run(fallbackId, `پروژه ${fallbackId}`, now);
            db.prepare('UPDATE tasks SET project_id = ? WHERE id = ?').run(fallbackId, r.id);
          }
        }
      })();
    }

    saveDb();
  } catch (e) {
    console.error('Error in autoLinkTasksToEpics:', e.message);
  }
}

function updateProjectStats() {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE projects SET
        total_tasks = (
          SELECT COUNT(*) FROM tasks 
          WHERE UPPER(parent_task_id) = UPPER(projects.id) 
             OR UPPER(epic_id) = UPPER(projects.id) 
             OR UPPER(project_id) = UPPER(projects.id)
        ),
        completed_tasks = (
          SELECT COUNT(*) FROM tasks 
          WHERE (UPPER(parent_task_id) = UPPER(projects.id) OR UPPER(epic_id) = UPPER(projects.id) OR UPPER(project_id) = UPPER(projects.id))
            AND (status = 'Done' OR status = 'Completed')
        ),
        waiting_tasks = (
          SELECT COUNT(*) FROM tasks 
          WHERE (UPPER(parent_task_id) = UPPER(projects.id) OR UPPER(epic_id) = UPPER(projects.id) OR UPPER(project_id) = UPPER(projects.id))
            AND (status = 'Waiting' OR status = 'OnHolding' OR is_waiting = 1)
        ),
        progress = (
          SELECT CASE 
            WHEN COUNT(*) = 0 THEN 0 
            ELSE ROUND(CAST(SUM(CASE WHEN status = 'Done' OR status = 'Completed' THEN 1 ELSE 0 END) AS FLOAT) * 100.0 / COUNT(*), 1)
          END
          FROM tasks 
          WHERE UPPER(parent_task_id) = UPPER(projects.id) 
             OR UPPER(epic_id) = UPPER(projects.id) 
             OR UPPER(project_id) = UPPER(projects.id)
        )
    `).run();
    saveDb();
  } catch (err) {
    console.error('Failed to update project stats:', err.message);
  }
}

async function syncSingleEpicFromJira(epicKey) {
  if (!epicKey) return { success: false, message: 'شناسه اپیک الزامی است' };
  const cleanEpicKey = epicKey.trim().toUpperCase();
  const db = getDb();
  const syncTime = new Date().toISOString();

  try {
    const tasks = await jiraService.fetchTasksForEpic(cleanEpicKey);
    if (!tasks || tasks.length === 0) {
      return { success: true, count: 0, message: `هیچ تسکی در جیرا برای اپیک ${cleanEpicKey} یافت نشد.` };
    }

    const insertTask = db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, assignee, estimate_hours, spent_hours, start_date, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, is_subtask, parent_task_id, epic_id, last_synced)
      VALUES (@id, @project_id, @title, @description, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @is_subtask, @parent_task_id, @epic_id, @last_synced)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE tasks.description END,
        status=excluded.status,
        assignee=excluded.assignee,
        estimate_hours=excluded.estimate_hours,
        spent_hours=excluded.spent_hours,
        start_date=COALESCE(excluded.start_date, tasks.start_date),
        due_date=COALESCE(excluded.due_date, tasks.due_date),
        is_waiting=excluded.is_waiting,
        waiting_for_team=excluded.waiting_for_team,
        waiting_reason=excluded.waiting_reason,
        sprint_name=excluded.sprint_name,
        sprint_start_date=excluded.sprint_start_date,
        sprint_end_date=excluded.sprint_end_date,
        priority=excluded.priority,
        labels=excluded.labels,
        component=excluded.component,
        sort_order=excluded.sort_order,
        is_subtask=excluded.is_subtask,
        parent_task_id=COALESCE(excluded.parent_task_id, tasks.parent_task_id),
        epic_id=COALESCE(excluded.epic_id, tasks.epic_id),
        last_synced=excluded.last_synced
    `);

    const insertRelation = db.prepare(`
      INSERT INTO task_relations (task_id, linked_task_id, relation_type, relationship, title, status, assignee, start_date, due_date, created_at)
      VALUES (@task_id, @linked_task_id, @relation_type, @relationship, @title, @status, @assignee, @start_date, @due_date, @created_at)
    `);

    db.transaction(() => {
      for (const task of tasks) {
        task.last_synced = syncTime;
        task.parent_task_id = cleanEpicKey;
        task.epic_id = cleanEpicKey;
        if (!task.project_id) {
          task.project_id = cleanEpicKey.split('-')[0] || cleanEpicKey;
        }
        insertTask.run(task);

        if (task.linked_tasks) {
          let links = [];
          try { links = typeof task.linked_tasks === 'string' ? JSON.parse(task.linked_tasks) : task.linked_tasks; } catch (_) {}
          if (Array.isArray(links)) {
            try { db.prepare('DELETE FROM task_relations WHERE task_id = ?').run(task.id); } catch (_) {}
            for (const link of links) {
              if (link && link.key) {
                try {
                  insertRelation.run({
                    task_id: task.id,
                    linked_task_id: link.key.toUpperCase(),
                    relation_type: link.linkType || 'Relates',
                    relationship: link.relationship || 'relates to',
                    title: link.title || link.key,
                    status: link.status || null,
                    assignee: link.assignee || null,
                    start_date: link.start_date || null,
                    due_date: link.due_date || null,
                    created_at: syncTime
                  });
                } catch (_) {}
              }
            }
          }
        }
      }
    })();

    autoLinkTasksToEpics();
    updateProjectStats();
    saveDb();

    return {
      success: true,
      count: tasks.length,
      message: `${tasks.length} ایشو برای اپیک ${cleanEpicKey} از جیرا دریافت و در دیتابیس ذخیره گردید.`
    };
  } catch (err) {
    console.error(`Error syncing epic ${cleanEpicKey} from Jira:`, err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Synchronizes only recently created or updated issues from Jira (e.g. past 10 days).
 * Completely PRESERVES all existing data in the database (NO tables are deleted or truncated).
 * Uses Upsert (INSERT ... ON CONFLICT(id) DO UPDATE SET) to update or add new records.
 */
async function syncRecentFromJira(days = 10) {
  if (!jiraService.isConfigured) {
    console.log('Jira is not configured. Skipping sync.');
    return { success: false, message: 'Jira not configured' };
  }

  const db = getDb();
  let projectsSynced = 0;
  let tasksSynced = 0;
  const syncTime = new Date().toISOString();

  try {
    // 1. Fetch/Upsert Epics
    console.log(`[RECENT SYNC] Fetching epics from Jira...`);
    const epics = await jiraService.fetchEpics();
    const insertProject = db.prepare(`
      INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, labels, assignee, priority, linked_tasks, last_synced)
      VALUES (@id, @title, @description, @status, @capabilities, @category, @confluence_link, @start_date, @due_date, @labels, @assignee, @priority, @linked_tasks, @last_synced)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE projects.description END,
        status=excluded.status,
        capabilities=excluded.capabilities,
        category=excluded.category,
        confluence_link=excluded.confluence_link,
        start_date=COALESCE(excluded.start_date, projects.start_date),
        due_date=COALESCE(excluded.due_date, projects.due_date),
        labels=CASE WHEN excluded.labels IS NOT NULL AND excluded.labels != '' AND excluded.labels != '[]' THEN excluded.labels ELSE COALESCE(projects.labels, excluded.labels) END,
        assignee=COALESCE(excluded.assignee, projects.assignee),
        priority=COALESCE(excluded.priority, projects.priority),
        linked_tasks=COALESCE(excluded.linked_tasks, projects.linked_tasks),
        last_synced=excluded.last_synced
    `);

    db.transaction(() => {
      for (const epic of epics) {
        epic.last_synced = syncTime;
        if (!epic.capabilities) epic.capabilities = '';
        if (!epic.confluence_link) epic.confluence_link = null;
        if (!epic.labels) epic.labels = '[]';
        if (!epic.assignee) epic.assignee = null;
        if (!epic.priority) epic.priority = 'Medium';
        if (!epic.linked_tasks) epic.linked_tasks = '[]';
        insertProject.run(epic);
        projectsSynced++;
      }
    })();

    // 2. Fetch/Upsert Tasks modified or created in the past X days
    const cfg = jiraService.getJiraConfig();
    const projKeyStr = cfg.projectKey || '';
    let projectFilter = '';
    if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
      const projects = projKeyStr.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
      if (projects.length > 1) {
        projectFilter = `project IN (${projects.join(',')})`;
      } else if (projects.length === 1) {
        projectFilter = `project = ${projects[0]}`;
      }
    }

    const pastDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    const pastDateStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`;

    const searchJql = projectFilter
      ? `${projectFilter} AND issuetype != Epic AND (created >= "${pastDateStr}" OR updated >= "${pastDateStr}") ORDER BY created ASC`
      : `issuetype != Epic AND (created >= "${pastDateStr}" OR updated >= "${pastDateStr}") ORDER BY created ASC`;

    console.log(`[RECENT SYNC] Fetching recent ${days} days tasks: JQL = "${searchJql}"`);

    const searchRes = await jiraService.jiraSearch(searchJql, null, { timeout: 60000, retries: 2 });
    const rawIssues = (searchRes && searchRes.issues) ? searchRes.issues : [];
    console.log(`[RECENT SYNC] Raw issues returned from Jira for last ${days} days: ${rawIssues.length}`);

    const insertTask = db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, assignee, estimate_hours, spent_hours, start_date, created_at, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, is_subtask, parent_task_id, epic_id, parent_key, linked_tasks, last_synced)
      VALUES (@id, @project_id, @title, @description, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @created_at, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @is_subtask, @parent_task_id, @epic_id, @parent_key, @linked_tasks, @last_synced)
      ON CONFLICT(id) DO UPDATE SET
        project_id=excluded.project_id,
        title=excluded.title,
        description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE tasks.description END,
        status=excluded.status,
        assignee=excluded.assignee,
        estimate_hours=excluded.estimate_hours,
        spent_hours=excluded.spent_hours,
        start_date=excluded.start_date,
        created_at=excluded.created_at,
        due_date=excluded.due_date,
        is_waiting=excluded.is_waiting,
        waiting_for_team=excluded.waiting_for_team,
        waiting_reason=excluded.waiting_reason,
        sprint_name=excluded.sprint_name,
        sprint_start_date=excluded.sprint_start_date,
        sprint_end_date=excluded.sprint_end_date,
        priority=excluded.priority,
        labels=excluded.labels,
        component=excluded.component,
        sort_order=excluded.sort_order,
        is_subtask=excluded.is_subtask,
        parent_task_id=excluded.parent_task_id,
        epic_id=excluded.epic_id,
        parent_key=excluded.parent_key,
        linked_tasks=excluded.linked_tasks,
        last_synced=excluded.last_synced
    `);

    db.transaction(() => {
      for (let i = 0; i < rawIssues.length; i++) {
        const task = jiraService.parseTaskIssue(rawIssues[i], null, i);
        if (task && task.id) {
          task.last_synced = syncTime;
          insertTask.run(task);
          tasksSynced++;
        }
      }
    })();

    autoLinkTasksToEpics();
    updateProjectStats();
    saveDb();

    db.prepare(`INSERT INTO system_settings (key, value) VALUES ('LAST_SYNC_TIME', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(syncTime);

    return {
      success: true,
      projectsSynced,
      tasksSynced,
      days,
      message: `همگام‌سازی ۱۰ روز گذشته با موفقیت انجام شد (${projectsSynced} پروژه، ${tasksSynced} تسک).`
    };
  } catch (err) {
    console.error('Error during syncRecentFromJira:', err);
    return { success: false, message: err.message };
  }
}

function initCron() {
  if (jiraService.isConfigured) {
    cron.schedule(`*/${SYNC_INTERVAL} * * * *`, () => syncRecentFromJira(10));
    console.log(`Scheduled Jira sync every ${SYNC_INTERVAL} minutes`);
  }
}

module.exports = {
  syncFromJira,
  syncRecentFromJira,
  syncMonthlyLastYearFromJira,
  syncDateRangeFromJira,
  syncSingleMonthFromJira,
  syncSingleEpicFromJira,
  updateProjectStats,
  getLastSync,
  autoLinkTasksToEpics,
  initCron
};
