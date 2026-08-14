function buildProjectClause(projectKeyStr) {
  const pStr = (projectKeyStr || '').trim();
  if (!pStr || pStr === 'ALL' || pStr === '*') return '';
  const projects = pStr.split(',').map(p => {
    const clean = p.trim().toUpperCase();
    return /^[A-Z0-9_]+$/.test(clean) ? clean : `"${clean}"`;
  }).filter(Boolean);
  
  if (projects.length > 1) {
    return `project IN (${projects.join(',')})`;
  } else if (projects.length === 1) {
    return `project = ${projects[0]}`;
  }
  return '';
}

function buildJqlQuery(projectKeyStr, startDateStr, endDateStr, issueType) {
  const projClause = buildProjectClause(projectKeyStr);
  const clauses = [];
  
  if (projClause) clauses.push(projClause);
  if (startDateStr) clauses.push(`created >= "${startDateStr}"`);
  if (endDateStr) clauses.push(`created <= "${endDateStr}"`);
  if (issueType === 'Epic') {
    clauses.push('issuetype = Epic');
  } else if (issueType === 'noEpic') {
    clauses.push('issuetype != Epic');
  }

  const where = clauses.length > 0 ? clauses.join(' AND ') : '';
  return where ? `${where} ORDER BY created ASC` : 'ORDER BY created ASC';
}

describe('JQL Builder Unit Tests', () => {
  test('handles single project key correctly', () => {
    expect(buildProjectClause('ORD')).toBe('project = ORD');
  });

  test('handles multiple project keys correctly (project IN)', () => {
    expect(buildProjectClause('ORD, OPS')).toBe('project IN (ORD,OPS)');
    expect(buildProjectClause('ORD, OPS, CORE')).toBe('project IN (ORD,OPS,CORE)');
  });

  test('handles ALL / wildcard correctly without filter', () => {
    expect(buildProjectClause('ALL')).toBe('');
    expect(buildProjectClause('*')).toBe('');
    expect(buildProjectClause('')).toBe('');
  });

  test('builds full query with date range and issuetype', () => {
    const q = buildJqlQuery('OPS, ORD', '2026-06-01', '2026-06-30', 'noEpic');
    expect(q).toBe('project IN (OPS,ORD) AND created >= "2026-06-01" AND created <= "2026-06-30" AND issuetype != Epic ORDER BY created ASC');
  });

  test('builds Epic extraction query correctly', () => {
    const q = buildJqlQuery('ORD', null, null, 'Epic');
    expect(q).toBe('project = ORD AND issuetype = Epic ORDER BY created ASC');
  });
});
