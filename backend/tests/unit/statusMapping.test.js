const jiraMapping = require('../../src/jiraMapping');

describe('Status Mapping Unit Tests', () => {
  const mapping = jiraMapping.statusMapping;

  test('maps completed Jira statuses to standard Done', () => {
    expect(mapping['Done']).toBe('Done');
    expect(mapping['Completed']).toBe('Done');
    expect(mapping['Resolved']).toBe('Done');
    expect(mapping['Closed']).toBe('Done');
  });

  test('maps in-progress Jira statuses to In Progress', () => {
    expect(mapping['In Progress']).toBe('In Progress');
    expect(mapping['In Development']).toBe('In Progress');
    expect(mapping['Testing']).toBe('In Progress');
    expect(mapping['QA']).toBe('In Progress');
  });

  test('maps blocked/waiting Jira statuses to Waiting', () => {
    expect(mapping['OnHolding']).toBe('Waiting');
    expect(mapping['Waiting']).toBe('Waiting');
    expect(mapping['Blocked']).toBe('Waiting');
    expect(mapping['On Hold']).toBe('Waiting');
    expect(mapping['منتظر تایید']).toBe('Waiting');
    expect(mapping['در انتظار پیمانکار']).toBe('Waiting');
  });

  test('maps backlog / new Jira statuses to To Do', () => {
    expect(mapping['To Do']).toBe('To Do');
    expect(mapping['Backlog']).toBe('To Do');
    expect(mapping['Open']).toBe('To Do');
  });
});
