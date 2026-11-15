/* Pure goal math; durations in seconds, timestamps in milliseconds. */
(function(scope){
 const BUFFER=300, clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const point=(rows,cursor)=>{const i=rows.findIndex(r=>r.bvid===cursor?.bvid&&r.p===Number(cursor?.p));if(i<0)return null;return rows.slice(0,i).reduce((n,r)=>n+r.duration,0)+clamp(Number(cursor.time)||0,0,rows[i].duration);};
 function create({courseId,rows,start,target,deadline},now){
  if(!rows.length||rows.some(r=>!Number.isFinite(r.duration)||r.duration<=0))throw Error('课程时长未完整读取');
  const a=point(rows,start),b=point(rows,target),end=rows.find(r=>r.bvid===target.bvid&&r.p===Number(target.p));
  if(!end||!Number.isFinite(target.time)||target.time<0||target.time>end.duration)throw Error('目标时间超出该分 P 时长');
  if(a===null||b===null||b<=a)throw Error('目标必须在当前学习位置之后');
  const available=(deadline-now)/1000-BUFFER;
  if(!Number.isFinite(available)||available<=0)throw Error('完成时间须在 5 分钟以后，以预留暂停缓冲');
  return {version:1,courseId,rows:rows.map(r=>({...r})),start:{...start},target:{...target},startOffset:a,targetOffset:b,distance:b-a,createdAt:now,deadline,available,pace:(b-a)/available,lastAt:now,running:false,pauseUsed:0,workElapsed:0};
 }
 function valid(g){return g?.version===1&&Array.isArray(g.rows)&&g.rows.length>0&&g.rows.every(r=>r&&typeof r.bvid==='string'&&Number.isInteger(r.p)&&r.p>0&&Number.isFinite(r.duration)&&r.duration>0)&&Number.isFinite(g.startOffset)&&g.startOffset>=0&&Number.isFinite(g.targetOffset)&&g.targetOffset>g.startOffset&&Number.isFinite(g.distance)&&g.distance>0&&Math.abs(g.distance-(g.targetOffset-g.startOffset))<.001&&Number.isFinite(g.available)&&g.available>0&&Number.isFinite(g.deadline)&&Number.isFinite(g.lastAt)&&Number.isFinite(g.workElapsed)&&g.workElapsed>=0&&Number.isFinite(g.pauseUsed)&&g.pauseUsed>=0&&g.pauseUsed<=BUFFER;}
 function tick(g,now,running){if(!valid(g))return;const end=Math.min(now,g.deadline),dt=Math.max(0,(end-g.lastAt)/1000);let exempt=0;if(!g.running){exempt=Math.min(dt,Math.max(0,BUFFER-g.pauseUsed));g.pauseUsed+=exempt;}g.workElapsed+=dt-exempt;g.lastAt=Math.max(g.lastAt,now);g.running=!!running;}
 function locate(g,fraction){let t=g.startOffset+g.distance*clamp(fraction);for(let i=0;i<g.rows.length;i++){const row=g.rows[i];if(t<=row.duration||i===g.rows.length-1)return {...row,time:clamp(t,0,row.duration)};t-=row.duration;}}
 function metrics(g,cursor,now){const p=point(g.rows,cursor),actual=p===null?0:clamp((p-g.startOffset)/g.distance),peer=clamp(g.workElapsed/g.available),remaining=g.distance*(1-actual),free=Math.max(0,BUFFER-g.pauseUsed),available=Math.max(0,(g.deadline-now)/1000-free);const speed=remaining<=0?0:available>0?remaining/available:Infinity;
  return {actual,peer,speed,likely:Number.isFinite(speed)&&speed<=1.5,pauseLeft:free,lag:Math.max(0,(peer-actual)*g.distance),expired:now>=g.deadline,expected:locate(g,peer)};
 }
 scope.LemonGoal={BUFFER,create,valid,tick,metrics,point,locate};if(typeof module!=='undefined'&&module.exports)module.exports=scope.LemonGoal;
})(globalThis);
