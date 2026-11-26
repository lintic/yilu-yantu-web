(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);},launch;
  try{launch=JSON.parse(sessionStorage.getItem('yilu-launch')||'null');}catch(e){}
  var resume=launch&&launch.resume?App.getResume(launch.resume):null;
  var review=launch&&launch.review?App.exams().find(function(e){return e.id===launch.review;}):null;
  var state=review?Object.assign({},review,{questions:review.snapshots,mode:'exam',idx:0}):resume||launch||{ids:App.bank.slice(0,20).map(App.qKey),mode:'practice',label:'专项练习'};
  var qs=state.questions||((state.ids||[]).map(App.byKey));
  if(!qs.length||qs.some(function(q){return !q;})){$('quiz-content').innerHTML='<div class="card empty">部分题目暂时无法定位。原断点仍然保留，请先恢复对应题库版本。<br><a class="text-link" href="tiku.html">返回题库</a></div>';return;}
  qs=JSON.parse(JSON.stringify(qs));
  var ids=qs.map(App.qKey),idx=Math.min(state.idx||0,qs.length-1),mode=state.mode||'practice',results=state.results||{},finished=!!review||!!state.completed;
  var sessionId=review?review.id:resume?resume.id:'run-'+Date.now()+'-'+Math.random().toString(36).slice(2,9),sessionLabel=state.label||'专项练习';
  var annual=state.annual||null,duration=state.durationMs||(mode==='exam'?60*60000:0),elapsed=state.elapsedMs||0,start=Date.now(),bankVersion=state.bankVersion||App.version;
  var saveTimer,noteTimer,lastScore=review?review.score:state.score||null,saveFailed=false,finishedElapsed=finished?state.elapsedMs:null,pendingExam=null,noteDrafts=state.noteDrafts||{},resumeFailed=false;
  $('quiz-title').textContent=sessionLabel;
  document.title=sessionLabel+' · 医路研途';
  if(resume&&resume.schema<3){var n=document.createElement('div');n.className='notice';n.textContent='这是旧版断点：恢复原位置，旧版没有保存完整选项和计时。';$('quiz-content').prepend(n);}
  document.body.classList.toggle('exam-focus',mode==='exam'&&!finished);
  $('quiz-modes').hidden=mode==='exam';$('exam-tag').hidden=mode!=='exam';$('btn-submit-exam').hidden=mode!=='exam';
  function totalElapsed(){return finishedElapsed==null?elapsed+Date.now()-start:finishedElapsed;}
  function sessionEntry(){return {id:sessionId,label:sessionLabel,ids:ids,idx:idx,mode:mode,results:results,questions:qs,elapsedMs:totalElapsed(),annual:annual,durationMs:duration,paperComplete:state.paperComplete,bankVersion:bankVersion,noteDrafts:noteDrafts,completed:finished,score:lastScore};}
  function hasPending(){if(review)return false;return Object.keys(noteDrafts).length||qs.some(function(q){return answerResult(q).recordSaved===false;});}
  function updateSaveWarning(){
    var pending=hasPending()||resumeFailed||!!pendingExam;
    $('learning-save-warning').hidden=!pending;
    $('learning-save-status').textContent='部分作答或笔记尚未保存。请重试保存；离开或刷新前可下载本轮备份。';
  }
  function saveState(){
    if(review||(finished&&!hasPending()&&!pendingExam&&!resumeFailed))return;
    var ok=App.saveResume(sessionLabel,ids,idx,sessionEntry());resumeFailed=!ok;
    if(!ok&&!saveFailed){saveFailed=true;UI.toast('断点未能写入，请下载本轮备份');}if(ok)saveFailed=false;
    updateSaveWarning();return ok;
  }
  function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveState,180);}
  function saveNote(q,value){
    if(App.setNote(q,value)){delete noteDrafts[q.id];updateSaveWarning();return true;}
    noteDrafts[q.id]=value;updateSaveWarning();return false;
  }
  function flushNote(){clearTimeout(noteTimer);if($('q-note')&&$('q-note').dataset.q){var q=qs.find(function(x){return x.id===$('q-note').dataset.q;});if(q)return saveNote(q,$('q-note').value.trim());}return true;}
  function retryLearning(){
    qs.forEach(function(q){var r=answerResult(q);if(r.recordSaved===false)r.recordSaved=App.recordAnswer(q,r.right,{self:!!r.self,attemptId:sessionId+'|'+q.id});});
    Object.keys(noteDrafts).forEach(function(id){var q=qs.find(function(q){return q.id===id;});if(q)saveNote(q,noteDrafts[id]);});
    if(pendingExam&&App.saveExam(pendingExam))pendingExam=null;
    if(finished&&!hasPending()&&!pendingExam){resumeFailed=!App.clearResume(sessionId);}
    else saveState();
    updateSaveWarning();UI.toast(hasPending()||resumeFailed||pendingExam?'仍未保存，请下载本轮备份':'已保存');
  }
  function downloadCurrent(){
    flushNote();var data={'yilu-resumes':[sessionEntry()]};
    if(pendingExam)data['yilu-exams']=[pendingExam];
    var draftNotes={};Object.keys(noteDrafts).forEach(function(id){draftNotes[id]=noteDrafts[id];});if(Object.keys(draftNotes).length)data['yilu-notes']=draftNotes;
    App.download('医路研途-本轮学习备份.json',{format:'yilu-learning',schema:3,bankVersion:bankVersion,exportedAt:Date.now(),data:data});
  }
  function go(n){flushNote();idx=n;render();saveState();window.scrollTo({top:0,behavior:'instant'});}
  function answerResult(q){return results[q.id]||(results[q.id]={picked:[],judged:false,right:null,flag:false});}
  function explanation(q,res){
    // Refresh explanations for unchanged questions while preserving saved answer snapshots.
    var current=App.byKey(q.id);
    function gradeContent(x){return JSON.stringify([x.stem,x.options,x.answer,x.answer_status,!!x.multi]);}
    if(current&&gradeContent(current)===gradeContent(q))q=current;
    var has=App.hasAnswer(q),text=res.self?'自评：'+(res.right?'记得':'需要复习'):has?(res.right?'回答正确':'回答错误 · 正确答案 '+App.ansText(q)):'这道题答案待核对，已保留作答';$('verdict').textContent=text;$('verdict').className='verdict '+(!has?'pending':res.right?'':'bad');$('explain-text').textContent=q.explain||'解析仍在完善。可结合原题资料核对，或提交补充建议。';$('source-note').textContent=(q.source&&q.source.label||'题库导入')+(q.source&&q.source.page?' · 第 '+q.source.page+' 页':'')+' · '+(q.review_status==='reviewed'?'原题已按资料核对':'原题尚未人工核对')+(q.explanation_source&&q.explanation_source.method==='visual_notes'?' · 解析已按笔记核读':'');$('point-text').textContent=q.point||(q.chapter?'章节：'+q.chapter:'考点标注仍在完善');$('extend-details').hidden=!q.extend;$('extend-text').textContent=q.extend||'';
    var cite=q.explanation_source;if(cite)$('explain-text').textContent+='\n\n解析来源：'+cite.label+' · PDF 第 '+(cite.pages||[]).join('、')+' 页'+(cite.section?' · '+cite.section:'');if(q.answer_note)$('source-note').textContent+=' · '+q.answer_note;var kb=App.knowledgeFor(q);$('knowledge-details').hidden=!kb.length;$('knowledge-title').textContent='知识点卡片 · '+kb.length;$('knowledge-text').textContent=kb.map(function(k){return 'No.'+k.no+' · '+k.year+' 年原题关联\n'+k.text;}).join('\n\n');
    var related=App.related(q),exact=related.length>0;if(!exact)related=App.bank.filter(function(x){return x.id!==q.id&&x.subject===q.subject;}).slice(0,20);$('related-btn').hidden=!related.length;$('related-btn').textContent=exact?(q.point?'练习同考点题':'练习同章节题'):'继续同科目练习';$('related-btn').onclick=function(){UI.launch(related.map(App.qKey),{label:exact?(q.point?'同考点练习 · '+q.point:'同章节练习 · '+q.chapter):'同科目练习 · '+q.subject});};
    $('q-note').value=Object.prototype.hasOwnProperty.call(noteDrafts,q.id)?noteDrafts[q.id]:App.getNote(q);$('q-note').dataset.q=q.id;
  }
  function render(){var q=qs[idx],res=answerResult(q),reveal=finished||(mode!=='exam'&&res.judged);$('question-card').hidden=false;$('result-content').hidden=true;$('back-result').hidden=!finished;$('question-number').textContent=(idx+1)+' / '+qs.length;$('quiz-prog').style.width=((idx+1)/qs.length*100)+'%';$('subject-tag').textContent=q.subject+(q.year?' · '+q.year+' 年':'');$('type-tag').textContent=App.isMulti(q)?'多选题':'单选题';$('pending-tag').hidden=App.hasAnswer(q);$('orig-tag').hidden=!q.orig_num;$('orig-tag').textContent='原卷第 '+q.orig_num+' 题';$('stem').textContent=UI.stem(q);$('explanation').hidden=!reveal;$('self-actions').hidden=true;$('btn-prev').disabled=idx===0;$('btn-flag').textContent=res.flag?'已标疑问':'标记疑问';$('btn-flag').setAttribute('aria-pressed',String(!!res.flag));
    var options=$('options');options.innerHTML='';q.options.forEach(function(t,i){var b=document.createElement('button');b.className='opt';b.type='button';b.setAttribute('aria-pressed',String(res.picked.indexOf(i)>=0));if(res.picked.indexOf(i)>=0)b.classList.add('selected');if(reveal&&App.hasAnswer(q)&&!res.self){var ans=Array.isArray(q.answer)?q.answer:[q.answer];if(ans.indexOf(i)>=0)b.classList.add('right');else if(res.picked.indexOf(i)>=0)b.classList.add('wrong');}b.disabled=finished||res.judged;b.innerHTML='<span class="letter">'+'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i]+'</span><span>'+UI.esc(t)+'</span>';b.onclick=function(){pick(i);};options.appendChild(b);});
    if(reveal)explanation(q,res);
    var needsConfirm=!res.judged&&(App.isMulti(q)||mode==='self'||!App.hasAnswer(q));$('btn-skip').hidden=finished||res.judged||mode==='exam';$('btn-main').disabled=needsConfirm&&!res.picked.length;$('btn-main').textContent=finished?(idx+1===qs.length?'返回报告':'下一题'):needsConfirm&&mode!=='exam'?(mode==='self'||!App.hasAnswer(q)?'查看答案与自评':'确认答案'):idx+1===qs.length?(mode==='exam'?'检查并交卷':'完成练习'):'下一题';
    if(mode==='exam')$('btn-main').disabled=false;
    $('quiz-hint').textContent=mode==='exam'&&!finished?'交卷前隐藏解析 · 选项可修改 · 疑问题可在答题卡定位':App.isMulti(q)&&!res.judged?'选完后确认答案，少选或多选均按错误记录':'键盘 A–G 选项 · ← → 切题 · 回车确认';
  }
  function pick(i){if(finished)return;var q=qs[idx],res=answerResult(q);if(res.judged)return;
    if(App.isMulti(q)){var at=res.picked.indexOf(i);if(at>=0)res.picked.splice(at,1);else res.picked.push(i);}else res.picked=[i];
    if(mode==='practice'&&App.hasAnswer(q)&&!App.isMulti(q))judge();else render();scheduleSave();
  }
  function judge(){var q=qs[idx],res=answerResult(q);if(res.judged||!res.picked.length||mode==='exam')return;var ok=App.checkAnswer(q,res.picked);if(ok===null||mode==='self'){showSelf();return;}res.judged=true;res.right=ok;res.recordSaved=App.recordAnswer(q,ok,{attemptId:sessionId+'|'+q.id});updateSaveWarning();render();saveState();}
  function showSelf(){var q=qs[idx],res=answerResult(q);$('explanation').hidden=false;explanation(q,Object.assign({},res,{right:null}));$('verdict').textContent=App.hasAnswer(q)?'参考答案 '+App.ansText(q)+' · 对照后如实自评':'答案待核对 · 自评结果单独标记';$('verdict').className='verdict pending';$('self-actions').hidden=false;$('btn-main').disabled=true;}
  function selfJudge(ok){var q=qs[idx],res=answerResult(q);if(res.judged||finished)return;res.judged=true;res.right=ok;res.self=true;res.recordSaved=App.recordAnswer(q,ok,{self:true,attemptId:sessionId+'|'+q.id});updateSaveWarning();render();saveState();}
  function next(){if(finished){if(idx+1<qs.length)go(idx+1);else showReport();return;}var q=qs[idx],res=answerResult(q);if(mode!=='exam'&&!res.judged&&(App.isMulti(q)||mode==='self'||!App.hasAnswer(q))){judge();return;}if(idx+1<qs.length)go(idx+1);else requestFinish();}
  function skip(){if(idx+1<qs.length)go(idx+1);else requestFinish();}
  function sheet(){var m=UI.openModal('答题卡','<p class="muted" style="font-size:12px">'+(finished?'查看每题作答与解析':'绿色边框为已选题，圆点为疑问题。点击题号返回作答。')+'</p><div class="sheet-grid" id="sheet-grid"></div>'+(mode==='exam'&&!finished?'<button class="btn" id="sheet-submit">检查并交卷</button>':''));var grid=m.querySelector('#sheet-grid');qs.forEach(function(q,i){var r=answerResult(q),b=document.createElement('button');b.textContent=i+1;b.className=(r.picked.length?'picked ':'')+(i===idx?'cur ':'')+(r.flag?'flag ':'')+(finished&&r.judged&&!r.self?(r.right?'right':'wrong'):'');b.setAttribute('aria-label','第 '+(i+1)+' 题'+(r.flag?'，标记疑问':''));b.onclick=function(){UI.closeModal();go(i);};grid.appendChild(b);});if(m.querySelector('#sheet-submit'))m.querySelector('#sheet-submit').onclick=function(){UI.closeModal();requestFinish();};}
  function requestFinish(){if(finished)return;flushNote();var unanswered=qs.filter(function(q){return !answerResult(q).picked.length;}).length;var m=UI.openModal(mode==='exam'?'确认交卷':'完成这组练习','<p class="muted">'+(unanswered?'还有 '+unanswered+' 道题没有作答。':'所有题目均已选择答案。')+(mode==='exam'?'交卷后计算得分并开放解析。':'已确认的答题记录继续保留。')+'</p><div class="form-actions"><button class="btn" id="confirm-finish">'+(mode==='exam'?'确认交卷':'查看报告')+'</button><button class="btn btn-ghost" data-close>继续作答</button></div>');m.querySelector('#confirm-finish').onclick=function(){UI.closeModal();finish();};}
  function finish(){if(finished)return;flushNote();finishedElapsed=totalElapsed();finished=true;clearTimeout(saveTimer);var saved=true;
    if(mode==='exam'){
      qs.forEach(function(q){var r=answerResult(q),ok=App.checkAnswer(q,r.picked);r.right=ok;r.judged=ok!==null;r.pending=ok===null;if(r.picked.length&&ok!==null)r.recordSaved=App.recordAnswer(q,ok,{attemptId:sessionId+'|'+q.id});});
      lastScore=App.scoreSession(qs,results,annual);
      pendingExam={id:sessionId,label:sessionLabel,annual:annual,paperComplete:state.paperComplete,bankVersion:bankVersion,finishedAt:Date.now(),elapsedMs:totalElapsed(),snapshots:qs,results:results,score:lastScore};
      saved=App.saveExam(pendingExam);if(saved)pendingExam=null;
    }
    if(saved&&!hasPending())resumeFailed=!App.clearResume(sessionId);else saveState();
    updateSaveWarning();$('btn-submit-exam').hidden=true;$('quiz-modes').hidden=true;showReport();
  }
  function showReport(){finished=true;document.body.classList.remove('exam-focus');$('question-card').hidden=true;$('result-content').hidden=false;$('quiz-prog').style.width='100%';var score=lastScore||App.scoreSession(qs,results,null);var judged=qs.filter(function(q){return answerResult(q).judged;}),right=judged.filter(function(q){return answerResult(q).right;}).length;
    var reviewed=score.reviewed==null?qs.filter(function(q){return q.review_status==='reviewed';}).length:score.reviewed;
    $('report-kicker').textContent=mode==='exam'?(annual?'年度模考 · 参考得分':'专项测试 · 参考得分'):'练习复盘';$('report-score').textContent=mode==='exam'?score.score:right;$('report-total').textContent='/ '+(mode==='exam'?score.total:judged.length);$('report-desc').textContent=mode==='exam'?'可判定部分 · 评分覆盖 '+score.coverage+'% · 按资料核对 '+reviewed+'/'+qs.length+' 题'+(score.pending?' · '+score.pending+' 题 / '+score.pendingPoints+' 分待核对':''):'已确认 '+judged.length+' 题 · 自评结果已单独标记';$('report-time').textContent=Math.ceil(totalElapsed()/60000)+' 分钟';$('report-right').textContent=mode==='exam'?score.right:right;$('report-wrong').textContent=mode==='exam'?score.wrong:judged.length-right;$('report-unanswered').textContent=mode==='exam'?score.unanswered:qs.length-judged.length;$('exam-tag').textContent='模考已完成';$('timer').textContent='用时 '+Math.ceil(totalElapsed()/60000)+' 分钟';$('quiz-hint').textContent='答卷已完成 · 点击逐题复盘查看解析';
    var subs=mode==='exam'?score.bySubject:{};if(mode!=='exam')judged.forEach(function(q){var s=subs[q.subject]||(subs[q.subject]={score:0,total:0});s.total++;if(results[q.id].right)s.score++;});$('report-subjects').innerHTML=Object.keys(subs).sort(function(a,b){return (subs[a].score/(subs[a].total||1))-(subs[b].score/(subs[b].total||1));}).map(function(s){var v=subs[s],pct=v.total?Math.round(v.score/v.total*100):0;return '<div class="subject-row"><span class="name">'+UI.esc(s)+'</span><span class="track"><i style="width:'+pct+'%;'+(pct<60?'background:var(--coral)':'')+'"></i></span><span class="val">'+(v.total?pct+'%':'待核对')+' · '+v.score+'/'+v.total+'</span></div>';}).join('')||'<p class="muted">完成几道题后，这里会显示各科情况。</p>';
    var wrongQs=qs.filter(function(q){var r=answerResult(q);return r.judged&&!r.right&&(mode!=='exam'||r.picked.length);});$('report-wrong-btn').hidden=!wrongQs.length;$('report-wrong-btn').onclick=function(){UI.launch(wrongQs.map(App.qKey),{label:'本轮错题巩固'});};$('report-review-btn').onclick=function(){go(0);};$('report-export').disabled=!wrongQs.length;$('report-export').onclick=function(){var lines=['#separator:tab','#html:false'];wrongQs.forEach(function(q){lines.push(q.stem.replace(/[\t\n]/g,' ')+'\t'+(App.ansText(q)+' · '+(q.explain||q.extend||'解析待完善')).replace(/[\t\n]/g,' '));});App.download('医路研途-本轮错题Anki.txt','\ufeff'+lines.join('\n'),'text/plain;charset=utf-8');};
    $('report-pending').hidden=!score.pending;$('report-pending').textContent=score.pending+' 道待核对题保留在答卷中，未计入可判定部分满分。'+(state.regradeNotes&&Object.keys(state.regradeNotes).length?'其中 '+Object.keys(state.regradeNotes).length+' 道原题内容变更，作答无法自动对齐。':'');$('report-paper-notice').hidden=mode!=='exam';$('report-paper-notice').textContent=annual?'评分分段按原卷题号。参考答案按资料导入，仍需逐题核对；计时为自选模拟时长。':'专项测试按每题 1 分计，成绩用于该组题的自测。';
  }
  $('retry-learning-save').onclick=retryLearning;$('download-learning-session').onclick=downloadCurrent;
  $('btn-main').onclick=next;$('btn-prev').onclick=function(){if(idx>0)go(idx-1);};$('btn-skip').onclick=skip;$('btn-sheet').onclick=sheet;$('btn-submit-exam').onclick=requestFinish;$('back-result').onclick=showReport;$('btn-flag').onclick=function(){var r=answerResult(qs[idx]);r.flag=!r.flag;render();scheduleSave();};$('btn-feedback').onclick=function(){UI.feedback(qs[idx]);};$('self-right').onclick=function(){selfJudge(true);};$('self-wrong').onclick=function(){selfJudge(false);};
  $('btn-exit').onclick=function(){flushNote();saveState();if(hasPending()||resumeFailed||pendingExam){updateSaveWarning();UI.toast('保存尚未完成，请重试或下载备份后离开');return;}var back;try{back=JSON.parse(sessionStorage.getItem('yilu-return'));}catch(e){}location.href=['index.html','tiku.html','wrong.html','knowledge.html','stats.html'].indexOf(back)>=0?back:'tiku.html';};
  $('q-note').oninput=function(){clearTimeout(noteTimer);var id=this.dataset.q,value=this.value;noteTimer=setTimeout(function(){var q=qs.find(function(x){return x.id===id;});if(q){saveNote(q,value.trim());scheduleSave();}},350);};
  document.querySelectorAll('[data-quiz-mode]').forEach(function(b){b.classList.toggle('on',b.dataset.quizMode===mode);b.onclick=function(){if(mode==='exam'||finished)return;mode=b.dataset.quizMode;document.querySelectorAll('[data-quiz-mode]').forEach(function(c){c.classList.toggle('on',c===b);});render();saveState();};});
  document.addEventListener('keydown',function(e){if(document.querySelector('.modal')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Enter'&&e.target.closest('button,a,summary'))return;var n='ABCDEFG'.indexOf(e.key.toUpperCase());if(n<0)n='1234567'.indexOf(e.key);if(n>=0&&n<qs[idx].options.length){e.preventDefault();pick(n);}if(e.key==='Enter'){e.preventDefault();next();}if(e.key==='ArrowLeft'&&idx>0){e.preventDefault();go(idx-1);}if(e.key==='ArrowRight'){e.preventDefault();skip();}});
  window.addEventListener('pagehide',function(){flushNote();saveState();});document.addEventListener('visibilitychange',function(){if(document.hidden){flushNote();saveState();}});
  function tick(){if(finished)return;var ms=mode==='exam'?Math.max(0,duration-totalElapsed()):totalElapsed(),sec=Math.floor(ms/1000);$('timer').textContent=(mode==='exam'?'剩余 ':'')+('0'+Math.floor(sec/3600)).slice(-2)+':'+('0'+Math.floor(sec/60)%60).slice(-2)+':'+('0'+sec%60).slice(-2);if(mode==='exam'&&ms<=0){UI.closeModal();finish();UI.toast(hasPending()||pendingExam||resumeFailed?'模拟时间结束，请保存本轮备份':'模拟时间结束，答卷已保存');}}
  setInterval(tick,1000);setInterval(saveState,15000);render();if(finished){if(!review&&mode==='exam'){pendingExam={id:sessionId,label:sessionLabel,annual:annual,paperComplete:state.paperComplete,bankVersion:bankVersion,finishedAt:state.ts||Date.now(),elapsedMs:totalElapsed(),snapshots:qs,results:results,score:lastScore};}$('btn-submit-exam').hidden=true;showReport();}else {saveState();tick();}updateSaveWarning();
})();
