import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('reproduction has code, API, materials, history and no inherited audience records',()=>{
  for(const file of ['api/progress.ts','api/participant-export.ts','app/participant-data.ts','materials/catalog.json','replication-manifest.json','.env.example','AGENTS.md']) assert.ok(fs.existsSync(file), file);
  const catalog=JSON.parse(fs.readFileSync('materials/catalog.json'));
  assert.equal(catalog.articleCount,294);
  assert.equal(catalog.mainVideo.bilibili,null);
  for(const asset of catalog.publicAssetFiles) assert.ok(fs.statSync(asset).size>0,asset);
  const snapshot=JSON.parse(fs.readFileSync('app/data/public-snapshot.json'));
  for(const key of ['traces','guestbook','media','events']) assert.equal(snapshot[key].length,0);
  assert.doesNotMatch(fs.readFileSync('app/api-base.ts','utf8'),/esthergather\.cn/);
});
