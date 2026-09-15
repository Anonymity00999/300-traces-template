import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanIds, cleanOpeningTimes, mergeOpeningTimes, recordOpening, ownLocalWitnesses, personalExport } from '../app/participant-data.ts';
test('personal archive has exactly four categories and strips operational/private fields', () => {
  const data = personalExport('test-code', [{ id:'a', kind:'trace', sourceUrl:'https://example.org/a', excerptZh:'not needed', metadata:'secret' }], {}, [{ id:'w', url:'https://example.org', contact:'private', participantKey:'secret', status:'pending', metadata:{} }]);
  assert.deepEqual(Object.keys(data), ['userCode','browsingData','readingTime','witnesses']);
  assert.deepEqual(data.witnesses, [{id:'w',url:'https://example.org'}]);
  assert.equal(data.browsingData[0].excerptZh, undefined);
});
test('local witnesses exclude other passes, legacy unassigned records and feedback', () => {
  const base={id:'w',createdAt:'2026-03-16',recordKind:'witness',record:{title:'mine'}};
  assert.deepEqual(ownLocalWitnesses([{...base,userCode:'a'}, {...base,userCode:'b'}, base, {...base,userCode:'a',recordKind:'feedback'}], 'a'), [{id:'w',createdAt:'2026-03-16',title:'mine'}]);
});
test('opening dates preserve first and latest dates without inventing duration', () => {
  const first=recordOpening({},'trace-a','2026-03-16T00:00:00Z');
  const next=recordOpening(first,'trace-a','2026-03-17T00:00:00Z');
  assert.deepEqual(next['trace-a'], {firstOpenedAt:'2026-03-16T00:00:00.000Z',lastOpenedAt:'2026-03-17T00:00:00.000Z'});
  assert.deepEqual(mergeOpeningTimes(next,first), next);
  assert.deepEqual(cleanOpeningTimes(null), {});
  assert.deepEqual(cleanOpeningTimes({'trace-a':{firstOpenedAt:'invalid',lastOpenedAt:'invalid'}}), {});
});
test('historical data has no fabricated times and supports more than 500 identifiers', () => {
  assert.deepEqual(personalExport('a',[{id:'old',kind:'trace'}],{},[]).readingTime, {});
  assert.equal(cleanIds(Array.from({length:650},(_,i)=>`trace-${i}`)).length,650);
  assert.deepEqual(cleanIds(['ok','ok','../private',null]),['ok']);
});
