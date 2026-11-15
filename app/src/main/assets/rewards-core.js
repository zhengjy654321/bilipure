(function(scope){
 const defaults=()=>({points:0,level:1,skin:1,settlements:{}});
 function valid(r){return r&&Number.isSafeInteger(r.points)&&r.points>=0&&Number.isInteger(r.level)&&r.level>=1&&r.level<=10&&Number.isInteger(r.skin)&&r.skin>=1&&r.skin<=r.level&&r.settlements&&typeof r.settlements==='object'&&!Array.isArray(r.settlements);}
 const done=(r,g)=>!!g?.id&&Object.prototype.hasOwnProperty.call(r.settlements,g.id);
 const base=pace=>pace<=1?10:15;
 const reserved=(r,g)=>g?.race&&!done(r,g)?5:0;
 function settle(r,g,success,now){if(!g?.id||done(r,g))return null;const delta=success?base(g.rewardPace??g.pace)+(g.race?5:0):g.race?-5:0;r.points=Math.max(0,r.points+delta);const result={success,delta,at:now,race:!!g.race};r.settlements[g.id]=result;g.result=result;return result;}
 function enroll(r,goal,race,previous,id){const continuing=previous?.id&&!done(r,previous);if(race&&!(continuing&&previous.race)&&r.points<5)throw Error('积分不足 5 分，暂不能参加比赛');if(continuing&&previous.race&&!race)throw Error('进行中的比赛须完成，或删除目标并按未完成扣 5 分');goal.id=continuing?previous.id:id;goal.race=!!race;goal.rewardPace=goal.pace;return goal;}
 function upgrade(r,g){if(r.level>=10)throw Error('已经解锁全部 10 档皮肤');if(r.points-reserved(r,g)<150)throw Error('可用积分不足 150 分（比赛期间预留 5 分）');r.points-=150;r.level++;r.skin=r.level;return r.level;}
 async function retry(task,{retries=15,cancelled=()=>false,onRetry=()=>{},sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){for(let n=0;n<=retries;n++){if(cancelled())return null;try{return await task(n);}catch(e){if(cancelled())return null;if(n===retries)throw e;onRetry(n+1,e);await sleep(Math.min(1000*2**n,8000));}}}
 scope.LemonRewards={defaults,valid,done,base,reserved,settle,enroll,upgrade,retry};if(typeof module!=='undefined'&&module.exports)module.exports=scope.LemonRewards;
})(globalThis);
