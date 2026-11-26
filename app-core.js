/* 医路研途 · 静态共享数据层 v3。所有学习数据保存在当前浏览器。 */
(function (global) {
  'use strict';
  var BANK = global.QUESTIONS || [], VERSION = '2026.10.14.1';
  var errors = [], rollback = null, JOURNAL = 'yilu-write-journal';
  function storageError(){var message='本地存储空间不足或不可用，请导出学习备份。';if(errors[errors.length-1]!==message)errors.push(message);}
  function raw(k){return rollback&&Object.prototype.hasOwnProperty.call(rollback,k)?rollback[k]:localStorage.getItem(k);}
  function load(k,fallback){try{var v=JSON.parse(raw(k));return v==null?fallback:v;}catch(e){return fallback;}}
  function recoverWrite(){
    try{
      var text=localStorage.getItem(JOURNAL);if(!text)return true;
      var before=JSON.parse(text);
      var allowed=['yilu-records','yilu-daily','yilu-wrong','yilu-kp-srs','yilu-kp-new'];
      if(!before||typeof before!=='object'||Array.isArray(before)||Object.keys(before).some(function(k){return allowed.indexOf(k)<0||(before[k]!==null&&typeof before[k]!=='string');}))throw Error('invalid journal');
      rollback=before;
      Object.keys(before).forEach(function(k){if(before[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,before[k]);});
      localStorage.removeItem(JOURNAL);rollback=null;return true;
    }catch(e){storageError();return false;}
  }
  // Undo journal restores an interrupted multi-key write before loading learning data.
  // Keep the journal until rollback completes; reads use its previous values if storage stays unavailable.
  recoverWrite();
  function save(k,v){if(!recoverWrite())return false;try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){storageError();return false;}}
  function saveTogether(values){
    if(!recoverWrite())return false;
    var before={},encoded={},keys=Object.keys(values),started=false;
    try{
      keys.forEach(function(k){before[k]=localStorage.getItem(k);encoded[k]=JSON.stringify(values[k]);});
      localStorage.setItem(JOURNAL,JSON.stringify(before));started=true;
      keys.forEach(function(k){localStorage.setItem(k,encoded[k]);});
      localStorage.removeItem(JOURNAL);return true;
    }catch(e){if(started)recoverWrite();storageError();return false;}
  }
  function dayKey(ts) { var d=new Date(ts||Date.now()); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function hash(s) { var h=2166136261; for(var i=0;i<s.length;i++) h=Math.imul(h^s.charCodeAt(i),16777619); return (h>>>0).toString(36); }
  function oldKey(q,v) { var s=(q.stem||'').replace(/[\s（）()，。、．]/g,''); return 'y'+(q.year||0)+'|'+(v===2&&q.orig_num?'n'+q.orig_num+'|':'')+s.slice(0,v===2?24:40)+(v===2?'#'+(q.stem||'').length:''); }
  var keyMap=Object.create(null), aliases=Object.create(null), seen=Object.create(null);
  BANK.forEach(function(q) {
    if(!q.id) { var base='new-'+hash(JSON.stringify([q.set,q.year,q.orig_num,q.stem,q.options])); seen[base]=(seen[base]||0)+1; q.id=base+'-'+seen[base]; }
    if(keyMap[q.id]) throw new Error('题目 ID 重复：'+q.id);
    keyMap[q.id]=q;
    [oldKey(q,1),oldKey(q,2)].concat(q.legacy_keys||[]).forEach(function(k) { if(!aliases[k]) aliases[k]=[]; if(aliases[k].indexOf(q.id)<0) aliases[k].push(q.id); });
  });
  var updates=global.QUESTION_UPDATES;
  BANK.forEach(function(q){q.base_revision=q.revision||1;});
  if(updates&&Array.isArray(updates.items)) {
    updates.items.forEach(function(u) { var q=keyMap[u.id]; if(!q||!u.patch||u.baseRevision!==q.base_revision) return; var previousGrade=gradingSignature(q),previousRevision=q.revision||1; ['stem','options','subject','multi','answer','explain','point','extend','source','review_status','answer_status','knowledge_ids','chapter','content_source','explanation_source','extend_source','subject_aliases','answer_note','paper_type','point_source','chapter_ids','chapter_evidence'].forEach(function(k){ if(Object.prototype.hasOwnProperty.call(u.patch,k)) q[k]=u.patch[k]; }); q.revision=u.revision||(q.revision||1)+1;q.compatible_revisions=gradingSignature(q)===previousGrade?(q.compatible_revisions||[]).concat([previousRevision]):[]; });
    VERSION+='+'+(updates.version||'reviewed');
  }
  function qKey(q) { return q.id; }
  function byKey(k) { return keyMap[k]||(aliases[k]&&aliases[k].length===1?keyMap[aliases[k][0]]:null); }
  var LEARNING=['yilu-records','yilu-wrong','yilu-notes','yilu-resumes','yilu-resume','yilu-daily','yilu-tiku-cfg','yilu-settings','yilu-kp-srs','yilu-kp-new','yilu-exams','yilu-question-cache','yilu-feedback','yilu-approved','yilu-migration-v3','yilu-keyver'];
  function backupData() { var data={}; LEARNING.forEach(function(k){var v=load(k,null); if(v!==null)data[k]=v;}); return {format:'yilu-learning',schema:3,bankVersion:VERSION,exportedAt:Date.now(),data:data}; }
  function migrate() {
    if(!BANK.length||load('yilu-keyver',0)===3) return;
    var snap=backupData();
    if(!load('yilu-pre-v3-backup',null)&&!save('yilu-pre-v3-backup',snap)) return;
    var audit={at:Date.now(),unresolved:[],resumeWarnings:[]},migrationOK=true;
    ['yilu-records','yilu-wrong','yilu-notes'].forEach(function(store) {
      var data=load(store,{}); Object.keys(data).forEach(function(k) {
        if(keyMap[k])return;
        var candidates=aliases[k]||[];
        if(candidates.length===1) { if(data[candidates[0]]==null)data[candidates[0]]=data[k]; delete data[k]; }
        else audit.unresolved.push({store:store,key:k,candidates:candidates,value:data[k]});
      }); if(!save(store,data))migrationOK=false;
    });
    var rs=load('yilu-resumes',[]), legacy=load('yilu-resume',null);
    if(!rs.length&&legacy&&Array.isArray(legacy.ids))rs=[Object.assign({id:'legacy'},legacy)];
    rs.forEach(function(r){ r.ids=(r.ids||[]).map(function(k){if(keyMap[k])return k;var a=aliases[k]||[];if(a.length>1)audit.resumeWarnings.push({resume:r.id,key:k});return a.length?a[0]:k;});r.schema=r.results?3:2; });
    if(!save('yilu-resumes',rs))migrationOK=false;if(!save('yilu-migration-v3',audit))migrationOK=false;if(migrationOK)save('yilu-keyver',3);
  }
  migrate();
  var records=load('yilu-records',{}),wrong=load('yilu-wrong',{}),notes=load('yilu-notes',{}),resumes=load('yilu-resumes',[]),kp=load('yilu-kp-srs',{});
  var DEF_STAGES=[1,3,7,15,30], KP_NEW_LIMIT=20;
  function settingsLoad(){return load('yilu-settings',{stages:DEF_STAGES});}
  function settingsSave(s){return save('yilu-settings',s);}
  function stages(){var s=settingsLoad().stages;return Array.isArray(s)&&s.length>=2&&s.length<=8&&s.every(function(n){return Number.isInteger(n)&&n>0&&n<=365;})?s:DEF_STAGES;}
  function kpData(){return kp;}
  function kpNewRemaining(){var daily=load('yilu-kp-new',{});return Math.max(0,KP_NEW_LIMIT-(daily[dayKey()]||[]).length);}
  function kpGrade(id,ok){
    var next=Object.assign({},kp),e=Object.assign({},kp[id]||{stage:-1,streak:0,added:Date.now()}),st=stages(),values={};
    if(!kp[id]){var daily=load('yilu-kp-new',{}),today=dayKey(),ids=(daily[today]||[]).slice();if(ids.indexOf(id)<0){if(ids.length>=KP_NEW_LIMIT)return false;ids.push(id);daily[today]=ids;values['yilu-kp-new']=daily;}}
    if(ok){e.streak=(e.streak||0)+1;e.stage=Math.min((e.stage==null?-1:e.stage)+(e.streak>=3?2:1),st.length);e.graduated=e.stage>=st.length;e.due=e.graduated?null:Date.now()+st[e.stage]*86400000;}
    else{e.stage=0;e.streak=0;e.graduated=false;e.due=Date.now()+st[0]*86400000;}
    next[id]=e;values['yilu-kp-srs']=next;if(!saveTogether(values))return null;kp=next;return true;
  }
  function kpRemove(id){var next=Object.assign({},kp);delete next[id];if(!save('yilu-kp-srs',next))return false;kp=next;return true;}
  function cfgLoad(){return load('yilu-tiku-cfg',{mode:'practice',set:'ten',subject:'',year:'',count:20});}
  function cfgSave(c){save('yilu-tiku-cfg',c);}
  function hasAnswer(q){var a=Array.isArray(q.answer)?q.answer:[q.answer];return q.answer_status!=='disputed'&&q.answer_status!=='missing'&&q.answer_status!=='invalid'&&a.length>0&&new Set(a).size===a.length&&a.every(function(i){return Number.isInteger(i)&&i>=0&&i<q.options.length;});}
  function isMulti(q){return q.multi===true||Array.isArray(q.answer);}
  function ansText(q){return hasAnswer(q)?(Array.isArray(q.answer)?q.answer:[q.answer]).map(function(i){return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i];}).join(''):'待核对';}
  function checkAnswer(q,picked){if(!hasAnswer(q))return null;return (picked||[]).slice().sort(function(a,b){return a-b;}).join(',')===(Array.isArray(q.answer)?q.answer:[q.answer]).slice().sort(function(a,b){return a-b;}).join(',');}
  function recordAnswer(q,right,opts){
    opts=opts||{};var k=qKey(q),prev=records[k];
    if(opts.attemptId&&prev&&prev.attemptId===opts.attemptId)return true;
    var next=Object.assign({},records),nextWrong=Object.assign({},wrong),st=stages(),now=Date.now();
    next[k]={r:right?1:0,t:now,revision:q.revision||1,self:!!opts.self,attemptId:opts.attemptId||null};
    var daily=load('yilu-daily',{}),day=dayKey(),d=Object.assign({done:0,right:0},daily[day]);d.done++;if(right)d.right++;daily[day]=d;
    if(!right)nextWrong[k]={stage:0,streak:0,due:now+st[0]*86400000,added:wrong[k]?wrong[k].added:now};
    else if(wrong[k]){var e=Object.assign({},wrong[k]);e.streak=(e.streak||0)+1;e.stage=(e.stage||0)+(e.streak>=3?2:1);if(e.stage>=st.length)delete nextWrong[k];else{e.due=now+st[e.stage]*86400000;nextWrong[k]=e;}}
    if(!saveTogether({'yilu-records':next,'yilu-daily':daily,'yilu-wrong':nextWrong}))return false;
    records=next;wrong=nextWrong;return true;
  }
  function recordIsCurrent(q,r){var revision=r.revision||1;return revision===(q.revision||1)||(q.compatible_revisions||[]).indexOf(revision)>=0;}
  function stats(){var done=0,right=0,assessed=0,stale=0,bySub={},byYear={};BANK.forEach(function(q){var r=records[q.id];if(!r)return;done++;if(!recordIsCurrent(q,r)){stale++;return;}assessed++;if(r.r)right++;var s=q.subject||'待分类',y=q.year||'专项';bySub[s]=bySub[s]||{done:0,right:0};byYear[y]=byYear[y]||{done:0,right:0};bySub[s].done++;byYear[y].done++;if(r.r){bySub[s].right++;byYear[y].right++;}});return {done:done,right:right,assessed:assessed,stale:stale,acc:assessed?Math.round(right/assessed*100):0,bySub:bySub,byYear:byYear};}
  function todayStats(){return load('yilu-daily',{})[dayKey()]||{done:0,right:0};}
  function progressOf(pred){var total=0,done=0,right=0,assessed=0;BANK.forEach(function(q){if(!pred(q))return;total++;var r=records[q.id];if(r){done++;if(recordIsCurrent(q,r)){assessed++;if(r.r)right++;}}});return {total:total,done:done,acc:assessed?Math.round(right/assessed*100):null};}
  function removeWrong(q){var next=Object.assign({},wrong);delete next[q.id];if(!save('yilu-wrong',next))return false;wrong=next;return true;}
  function wrongList(dueOnly){return Object.keys(wrong).map(function(k){var q=byKey(k),e=wrong[k];return q&&(!dueOnly||e.due<=Date.now())?{q:q,stage:e.stage,due:e.due}:null;}).filter(Boolean).sort(function(a,b){return a.due-b.due;});}
  function wrongDueCount(){return wrongList(true).length;}
  function wrongGroups(dueOnly){var map={};wrongList(dueOnly).forEach(function(w){var p=(w.q.point||'').trim()||(w.q.subject+' · 考点待补'),g=map[p]||(map[p]={point:p,items:[],due:0,earliest:Infinity});g.items.push(w);if(w.due<=Date.now())g.due++;g.earliest=Math.min(g.earliest,w.due);});return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return b.due-a.due||a.earliest-b.earliest;});}
  function dueIdsGrouped(){return wrongGroups(true).reduce(function(a,g){return a.concat(g.items.map(function(w){return w.q.id;}));},[]);}
  function getNote(q){return notes[q.id]||'';}
  function setNote(q,t){if((notes[q.id]||'')===t)return true;var next=Object.assign({},notes);if(t)next[q.id]=t;else delete next[q.id];if(!save('yilu-notes',next))return false;notes=next;return true;}
  function resumeId(label,ids){return 'session-'+hash(label+'|'+ids.join('|'));}
  var questionCache=load('yilu-question-cache',{});
  function cacheQuestions(qs){var next=Object.assign({},questionCache),changed=false;var refs=qs.map(function(q){var clean={};['id','subject','year','orig_num','stem','options','answer','multi','point','explain','extend','answer_status','review_status','revision','source','knowledge_ids','chapter','content_source','explanation_source','extend_source','subject_aliases','answer_note','paper_type','point_source','chapter_ids','chapter_evidence'].forEach(function(k){if(q[k]!=null)clean[k]=q[k];});var serialized=JSON.stringify(clean),ref=q.id+'@'+hash(serialized);var suffix=0;while(next[ref]&&JSON.stringify(next[ref])!==serialized)ref=q.id+'@'+hash(serialized)+'-'+(++suffix);if(!next[ref]){next[ref]=clean;changed=true;}return ref;});if(changed&&!save('yilu-question-cache',next))return null;questionCache=next;return refs;}
  function cachedQuestions(refs){return (refs||[]).map(function(k){return questionCache[k]||null;});}
  function pruneCache(){var keep=new Set(),changed=false;load('yilu-resumes',[]).concat(load('yilu-exams',[])).forEach(function(e){(e.snapshotRefs||[]).concat(e.originalSnapshotRefs||[]).forEach(function(k){keep.add(k);});});Object.keys(questionCache).forEach(function(k){if(!keep.has(k)){delete questionCache[k];changed=true;}});if(changed)save('yilu-question-cache',questionCache);}
  function saveResume(label,ids,idx,details){if(!ids||!ids.length)return false;details=details||{};var id=details.id||resumeId(label,ids);var entry=Object.assign({},details,{id:id,label:label,ids:ids,idx:idx,ts:Date.now(),schema:3,bankVersion:details.bankVersion||VERSION});if(details.questions){entry.snapshotRefs=cacheQuestions(details.questions);if(!entry.snapshotRefs)return false;delete entry.questions;}var next=resumes.filter(function(r){return r.id!==id&&r.ids&&r.ids.length;});next.unshift(entry);if(!save('yilu-resumes',next.slice(0,6)))return false;resumes=next.slice(0,6);pruneCache();return true;}
  function getResumes(){return resumes.filter(function(r){return r.ids&&r.ids.length;});}
  function getResume(id){var l=getResumes(),r=id==null||id===true?l[0]||null:l.find(function(r){return r.id===id;})||null;if(r&&r.snapshotRefs)return Object.assign({},r,{questions:cachedQuestions(r.snapshotRefs)});return r;}
  function clearResume(id){var next=id==null?[]:resumes.filter(function(r){return r.id!==id;});if(!save('yilu-resumes',next))return false;resumes=next;return true;}
  function examRule(year){if(year===2016)return {count:180,total:300,minutes:180,weight:function(n){return n<=90?1.5:n<=120?2:n<=150?1.5:2;}};if(year>=2017&&year<=2025)return {count:165,total:300,minutes:180,weight:function(n){return n<=40?1.5:n<=115?2:n<=135?1.5:2;}};return null;}
  function paperProfile(year){var rule=examRule(+year),qs=BANK.filter(function(q){return q.year===+year&&!q.set;}),nums=new Set(qs.map(function(q){return q.orig_num;}));var complete=!!rule&&qs.length===rule.count&&nums.size===rule.count&&qs.every(function(q){return Number.isInteger(q.orig_num)&&q.orig_num>=1&&q.orig_num<=rule.count;});return {rule:rule,count:qs.length,complete:complete,pending:qs.filter(function(q){return !hasAnswer(q);}).length};}
  function weight(q,annual){var r=annual&&examRule(+annual);return r&&Number.isInteger(q.orig_num)&&q.orig_num>0&&q.orig_num<=r.count?r.weight(q.orig_num):1;}
  function scoreSession(qs,results,annual){var out={score:0,total:0,full:0,pending:0,pendingPoints:0,right:0,wrong:0,unanswered:0,reviewed:0,bySubject:{}};qs.forEach(function(q){var r=results[q.id]||{},w=weight(q,annual),ok=checkAnswer(q,r.picked||[]),s=out.bySubject[q.subject]||(out.bySubject[q.subject]={score:0,total:0,right:0,wrong:0,pending:0});out.full+=w;if(q.review_status==='reviewed')out.reviewed++;if(ok===null){out.pending++;out.pendingPoints+=w;s.pending++;return;}out.total+=w;s.total+=w;if(!r.picked||!r.picked.length){out.unanswered++;return;}if(ok){out.score+=w;out.right++;s.score+=w;s.right++;}else{out.wrong++;s.wrong++;}});out.coverage=out.full?Math.round(out.total/out.full*100):0;return out;}
  function saveExam(e){var entry=Object.assign({},e);entry.snapshotRefs=cacheQuestions(e.snapshots);if(!entry.snapshotRefs)return false;delete entry.snapshots;if(e.originalSnapshots){entry.originalSnapshotRefs=cacheQuestions(e.originalSnapshots);if(!entry.originalSnapshotRefs)return false;delete entry.originalSnapshots;}var list=load('yilu-exams',[]);var i=list.findIndex(function(x){return x.id===e.id;});if(i>=0)list[i]=entry;else list.unshift(entry);if(!save('yilu-exams',list.slice(0,30)))return false;pruneCache();return true;}
  function exams(){return load('yilu-exams',[]).map(function(e){var out=e.snapshotRefs?Object.assign({},e,{snapshots:cachedQuestions(e.snapshotRefs)}):e;if(e.originalSnapshotRefs)out.originalSnapshots=cachedQuestions(e.originalSnapshotRefs);return out;});}
  function scientificText(s){return String(s||'').replace(/[\s（）()，、。]/g,'').replace(/[−－]/g,'-').replace(/．/g,'.');}
  function gradingSignature(q){return q?hash(JSON.stringify([scientificText(q.stem),q.options.map(scientificText),q.answer,q.answer_status])):'missing';}
  function examChanged(e){return e.snapshots.some(function(q){if(!q)return true;var now=byKey(q.id);return e.regradedAgainst?gradingSignature(now)!==e.regradedAgainst[q.id]:gradingSignature(now)!==gradingSignature(q);});}
  function regradeExam(id){
    var e=exams().find(function(x){return x.id===id;});if(!e)return null;
    var originals=e.originalSnapshots||e.snapshots,originalResults=e.originalResults||JSON.parse(JSON.stringify(e.results)),nextResults=JSON.parse(JSON.stringify(originalResults)),notes={},against={};
    function normalized(s){return scientificText(s);}
    var current=originals.map(function(old){var q=byKey(old.id),res=nextResults[old.id]||(nextResults[old.id]={picked:[]});against[old.id]=gradingSignature(q);
      if(!q||normalized(old.stem)!==normalized(q.stem)||old.options.length!==q.options.length){notes[old.id]='题干或选项发生变更，原作答无法自动对齐';return Object.assign({},old,{answer_status:'disputed'});}
      var mapping=old.options.map(function(t){var matches=[];q.options.forEach(function(option,i){if(normalized(t)===normalized(option))matches.push(i);});return matches.length===1?matches[0]:-1;});
      if(mapping.some(function(i){return i<0;})||new Set(mapping).size!==q.options.length){notes[old.id]='选项内容发生变更，原作答无法自动对齐';return Object.assign({},old,{answer_status:'disputed'});}
      res.picked=(res.picked||[]).map(function(i){return mapping[i];});return JSON.parse(JSON.stringify(q));
    });
    current.forEach(function(q){var r=nextResults[q.id]||(nextResults[q.id]={picked:[]});r.right=checkAnswer(q,r.picked);r.judged=r.right!==null;r.pending=r.right===null;});
    e.originalSnapshots=originals;e.originalResults=originalResults;e.previousScore=e.score;e.scoreHistory=(e.scoreHistory||[]).concat([{score:e.score,bankVersion:e.bankVersion,at:e.regradedAt||e.finishedAt}]);e.score=scoreSession(current,nextResults,e.annual);e.snapshots=current;e.results=nextResults;e.regradeNotes=notes;e.regradedAgainst=against;e.bankVersion=VERSION;e.regradedAt=Date.now();if(!saveExam(e))throw Error('存储空间不足，未能保存重新核算结果。');return e;
  }
  function download(name,value,mime){var b=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:mime||'application/json;charset=utf-8'}),a=document.createElement('a'),url=URL.createObjectURL(b);a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
  function importBackup(b){
    if(!b||b.format!=='yilu-learning'||b.schema!==3||!b.data||typeof b.data!=='object'||Array.isArray(b.data))throw Error('请选择医路研途的学习备份文件。');
    var stack=[b.data];while(stack.length){var node=stack.pop();if(node&&typeof node==='object')Object.keys(node).forEach(function(k){if(k==='__proto__'||k==='constructor'||k==='prototype')throw Error('备份包含不支持的数据字段');if(node[k]&&typeof node[k]==='object')stack.push(node[k]);});}
    var maps=['yilu-records','yilu-wrong','yilu-notes','yilu-question-cache','yilu-daily','yilu-kp-srs','yilu-kp-new'],arrays=['yilu-resumes','yilu-exams','yilu-feedback','yilu-approved'];
    LEARNING.forEach(function(k){var v=b.data[k];if(v==null)return;if(maps.indexOf(k)>=0&&(!v||typeof v!=='object'||Array.isArray(v)))throw Error('备份字段格式不正确：'+k);if(arrays.indexOf(k)>=0&&!Array.isArray(v))throw Error('备份列表格式不正确：'+k);});
    var original=backupData(),next={},audit=JSON.parse(JSON.stringify(migrationInfo())),auditChanged=false;
    LEARNING.forEach(function(k){if(!Object.prototype.hasOwnProperty.call(b.data,k)||k==='yilu-keyver'||k==='yilu-migration-v3')return;var incoming=b.data[k],existing=load(k,null);
      if(maps.indexOf(k)>=0){
        if(['yilu-records','yilu-wrong','yilu-notes'].indexOf(k)>=0){var translated={};Object.keys(incoming).forEach(function(id){var candidates=aliases[id]||[],target=keyMap[id]?id:candidates.length===1?candidates[0]:id;translated[target]=incoming[id];if(!keyMap[target]&&!audit.unresolved.some(function(e){return e.store===k&&e.key===id;})){audit.unresolved.push({store:k,key:id,candidates:candidates,value:incoming[id]});auditChanged=true;}});incoming=translated;}
        var merged=Object.assign({},incoming,existing||{});if(k==='yilu-records')Object.keys(incoming).forEach(function(id){if(!existing||existing[id]==null||incoming[id].t>(existing[id].t||0))merged[id]=incoming[id];});next[k]=merged;
      }
      else if(Array.isArray(incoming)){var list=(existing||[]).slice();incoming.forEach(function(x){if(x&&x.id&&!list.some(function(y){return y.id===x.id;}))list.push(x);});next[k]=list.slice(0,k==='yilu-resumes'?6:k==='yilu-exams'?30:500);}
      else if(existing==null)next[k]=incoming;
    });
    if(auditChanged)next['yilu-migration-v3']=audit;
    if(!save('yilu-before-import',original))throw Error('无法保存恢复前备份，请先导出当前记录。');
    var keys=Object.keys(next),written=[];for(var i=0;i<keys.length;i++){var k=keys[i];if(!save(k,next[k])){written.forEach(function(key){if(original.data[key]!=null)save(key,original.data[key]);else try{localStorage.removeItem(key);}catch(e){}});throw Error('存储空间不足，恢复已中止，原记录保留。');}written.push(k);}
    return true;
  }
  function migrationInfo(){return load('yilu-migration-v3',{unresolved:[],resumeWarnings:[]});}
  function resolveLegacy(store,key,id){var audit=migrationInfo(),entry=audit.unresolved.find(function(e){return e.store===store&&e.key===key;});if(!entry||entry.candidates.indexOf(id)<0)return false;var data=load(store,{});if(data[id]!=null)return false;data[id]=entry.value;delete data[key];if(!save(store,data))return false;audit.unresolved=audit.unresolved.filter(function(e){return e!==entry;});save('yilu-migration-v3',audit);return true;}
  function feedback(){return load('yilu-feedback',[]);}
  function approvedUpdates(){return load('yilu-approved',[]);}
  function approveFeedback(id,update){var list=feedback(),f=list.find(function(x){return x.id===id;});if(!f||!byKey(update.id))return false;f.status='approved';f.reviewedAt=Date.now();save('yilu-feedback',list);var a=approvedUpdates().filter(function(x){return x.id!==update.id;});a.push(update);return save('yilu-approved',a);}
  function submitFeedback(q,fields){if(!fields.detail||!fields.detail.trim())throw Error('请写明问题和修改建议。');var f={id:'fb-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),questionId:q.id,revision:q.revision||1,bankVersion:VERSION,type:fields.type||'其他',detail:fields.detail.trim().slice(0,5000),source:(fields.source||'').trim().slice(0,2000),createdAt:Date.now(),status:'pending'};var list=feedback();list.unshift(f);save('yilu-feedback',list);return f;}
  function importFeedback(b){if(!b||b.format!=='yilu-feedback'||!Array.isArray(b.items))throw Error('请选择题目纠错反馈文件。');var list=feedback();b.items.slice(0,500).forEach(function(f){if(f&&typeof f.id==='string'&&byKey(f.questionId)&&typeof f.detail==='string'&&!list.some(function(x){return x.id===f.id;}))list.push({id:f.id,questionId:f.questionId,revision:f.revision,bankVersion:f.bankVersion,type:String(f.type||'其他'),detail:f.detail.slice(0,5000),source:String(f.source||'').slice(0,2000),createdAt:Number(f.createdAt)||Date.now(),status:'pending'});});save('yilu-feedback',list);return list.length;}
  function related(q){return BANK.filter(function(x){return x.id!==q.id&&x.subject===q.subject&&(q.point?x.point===q.point:q.chapter&&x.chapter===q.chapter);}).slice(0,20);}
  function knowledgeFor(q){var kb=global.KNOWLEDGE||[];return kb.filter(function(k){return (q.knowledge_ids||[]).indexOf(k.id)>=0||(q.year&&q.orig_num&&k.year===q.year&&k.qnum===q.orig_num);});}
  function filter(o){return BANK.filter(function(q){return (!o.subject||q.subject===o.subject||(q.subject_aliases||[]).indexOf(o.subject)>=0)&&(!o.year||String(q.year)===String(o.year))&&(!o.onlyWrong||records[q.id]&&!records[q.id].r)&&(o.type!=='multi'||isMulti(q))&&(o.type!=='single'||!isMulti(q));});}
  global.App={bank:BANK,version:VERSION,qKey:qKey,byKey:byKey,hasAnswer:hasAnswer,isMulti:isMulti,ansText:ansText,checkAnswer:checkAnswer,filter:filter,subjects:function(){return Array.from(new Set(BANK.reduce(function(a,q){return a.concat([q.subject],q.subject_aliases||[]);},[]))).sort();},years:function(){return Array.from(new Set(BANK.map(function(q){return q.year;}).filter(Boolean))).sort(function(a,b){return b-a;});},examDays:function(){return Math.max(0,Math.ceil((new Date('2026-12-26T08:30:00+08:00')-Date.now())/86400000));},
    recordAnswer:recordAnswer,stats:stats,todayStats:todayStats,progressOf:progressOf,wrongList:wrongList,wrongDueCount:wrongDueCount,removeWrong:removeWrong,wrongGroups:wrongGroups,dueIdsGrouped:dueIdsGrouped,getNote:getNote,setNote:setNote,saveResume:saveResume,getResume:getResume,getResumes:getResumes,clearResume:clearResume,resumeId:resumeId,cfgLoad:cfgLoad,cfgSave:cfgSave,stages:stages,settingsLoad:settingsLoad,settingsSave:settingsSave,STAGES:DEF_STAGES,kpData:kpData,kpGrade:kpGrade,kpRemove:kpRemove,kpNewRemaining:kpNewRemaining,KP_NEW_LIMIT:KP_NEW_LIMIT,
    paperProfile:paperProfile,examRule:examRule,scoreSession:scoreSession,weight:weight,saveExam:saveExam,exams:exams,examChanged:examChanged,regradeExam:regradeExam,download:download,backupData:backupData,preMigrationBackup:function(){return load('yilu-pre-v3-backup',null);},importBackup:importBackup,migrationInfo:migrationInfo,resolveLegacy:resolveLegacy,feedback:feedback,submitFeedback:submitFeedback,importFeedback:importFeedback,approvedUpdates:approvedUpdates,approveFeedback:approveFeedback,related:related,knowledgeFor:knowledgeFor,storageErrors:function(){return errors;},dayKey:dayKey};
})(window);
