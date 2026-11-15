const assert=require('node:assert/strict');const G=require('../app/src/main/assets/goal-core.js');
const rows=[{bvid:'a',p:1,duration:300},{bvid:'a',p:2,duration:450},{bvid:'b',p:1,duration:300},{bvid:'b',p:2,duration:450}];const now=1800000000000;
const make=()=>G.create({courseId:'c',rows,start:{bvid:'a',p:1,time:0},target:{bvid:'b',p:2,time:450},deadline:now+1500000},now);
let g=make();assert.equal(g.distance,1500);assert.equal(g.pace,1.25);assert(G.metrics(g,g.start,now).likely);assert.equal(G.point(rows,{bvid:'b',p:2,time:60}),1110);
G.tick(g,now+120000,false);assert.equal(g.pauseUsed,120);assert.equal(g.workElapsed,0);G.tick(g,now+180000,true);assert.equal(g.pauseUsed,180);G.tick(g,now+300000,false);assert.equal(g.workElapsed,120);G.tick(g,now+480000,false);assert.equal(g.pauseUsed,300);assert.equal(g.workElapsed,180);assert.equal(G.metrics(g,g.start,now+480000).peer,.15);G.tick(g,now+600000,false);assert.equal(g.workElapsed,300);assert.equal(g.pauseUsed,300);
const m=G.metrics(g,{bvid:'a',p:2,time:75},now+600000);assert.equal(m.actual,.25);assert.equal(m.peer,.25);assert.equal(m.lag,0);assert.equal(G.metrics(g,{bvid:'a',p:1,time:0},now+600000).lag,375);
// Peer is wall-clock based, independent of video playbackRate; unused pause yields early completion.
g=make();g.running=true;G.tick(g,now+1200000,true);assert.equal(G.metrics(g,g.start,now+1200000).peer,1);
g=make();G.tick(g,now+300000,true);G.tick(g,now+1500000,true);assert.equal(G.metrics(g,g.start,now+1500000).peer,1);assert.equal(G.metrics(g,g.start,now+1500000).speed,Infinity);assert.equal(G.metrics(g,g.target,now+1500000).actual,1);
const last=g.workElapsed;G.tick(g,now+1900000,false);assert.equal(g.workElapsed,last);G.tick(g,now+100000,false);assert.equal(g.workElapsed,last,'backward clock must not rewind');
// Saved/reloaded session counts absence as paused, consuming only the remaining shared buffer.
g=make();g.running=true;G.tick(g,now+100000,true);g=JSON.parse(JSON.stringify(g));g.running=false;G.tick(g,now+500000,false);assert.equal(g.pauseUsed,300);assert.equal(g.workElapsed,200);
assert.throws(()=>G.create({courseId:'c',rows,start:{bvid:'b',p:2,time:100},target:{bvid:'a',p:1,time:1},deadline:now+999999},now));assert.throws(()=>G.create({courseId:'c',rows,start:{bvid:'a',p:1,time:0},target:{bvid:'b',p:2,time:451},deadline:now+999999},now));assert.throws(()=>G.create({courseId:'c',rows,start:{bvid:'a',p:1,time:0},target:{bvid:'b',p:2,time:450},deadline:now+300000},now));
assert.equal(G.metrics(make(),{bvid:'a',p:1,time:0},now).speed,1.25);assert(!G.valid({version:1}));console.log('PASS goal math: weighted cross-video targets, speed, shared 5-minute buffer, pause/resume, excess pause, deadline, rewind, reload and validation');
