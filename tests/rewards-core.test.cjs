const assert=require('node:assert/strict'),R=require('../app/src/main/assets/rewards-core.js');
(async()=>{let r=R.defaults();const make=(id,pace,race=false)=>({id,pace,rewardPace:pace,race});
for(const [pace,expected] of [[.8,10],[1,10],[1.01,15],[1.5,15],[2.5,15]]){const g=make('p'+pace,pace);assert.equal(R.settle(r,g,true,1).delta,expected);assert.equal(R.settle(r,g,true,2),null);}
const balance=r.points;r=JSON.parse(JSON.stringify(r));assert.equal(R.settle(r,make('p1',1),true,3),null);assert.equal(r.points,balance);
assert.equal(R.settle(r,make('lost',1),false,1).delta,0);assert.equal(R.settle(r,make('wonrace',2,true),true,1).delta,20);assert.equal(R.settle(r,make('lostrace',2,true),false,1).delta,-5);
r=R.defaults();assert.throws(()=>R.enroll(r,make('x',1),true,null,'x'));r.points=5;let g=R.enroll(r,{pace:1.5},true,null,'race');assert.equal(g.race,true);assert.throws(()=>R.enroll(r,{pace:1},false,g,'edit'));let edited=R.enroll(r,{pace:2},true,g,'edit');assert.equal(edited.id,'race');assert.equal(edited.rewardPace,2);R.settle(r,edited,false,1);assert.equal(r.points,0);assert.equal(R.settle(r,edited,false,2),null);
r=R.defaults();r.points=150;g=make('pending',1,true);assert.throws(()=>R.upgrade(r,g));r.points=155;assert.equal(R.upgrade(r,g),2);assert.equal(r.points,5);R.settle(r,g,false,2);assert.equal(r.points,0);
r.points=150*8;for(let i=3;i<=10;i++)assert.equal(R.upgrade(r,null),i);assert.equal(r.skin,10);assert.equal(r.points,0);assert.throws(()=>R.upgrade(r,null));assert(R.valid(JSON.parse(JSON.stringify(r))));assert(!R.valid({...r,level:11}));
let calls=0,retries=[];await assert.rejects(()=>R.retry(async()=>{calls++;throw Error('failed');},{sleep:async()=>{},onRetry:n=>retries.push(n)}));assert.equal(calls,16);assert.deepEqual(retries,Array.from({length:15},(_,i)=>i+1));
calls=0;const result=await R.retry(async()=>{calls++;if(calls<4)throw Error();return 42;},{sleep:async()=>{}});assert.equal(result,42);assert.equal(calls,4);
let cancelled=false;calls=0;assert.equal(await R.retry(async()=>{calls++;throw Error();},{sleep:async()=>{cancelled=true;},cancelled:()=>cancelled}),null);assert.equal(calls,1);
console.log('PASS rewards: thresholds, race gate/bonus/penalty, exactly-once after reload, edit identity, reserved points, all 9 upgrades, backup shape, 15 retries, early success, cancellation');})().catch(e=>{console.error(e);process.exit(1)});
