(function(){
  document.getElementById('home-primary').disabled=false;
  document.getElementById('home-primary').removeAttribute('aria-busy');
  var st=App.stats(),today=App.todayStats(),due=App.wrongDueCount();
  document.getElementById('home-bank').textContent=App.bank.length;
  document.getElementById('today-done').textContent=today.done;
  document.getElementById('overall-acc').textContent=st.assessed?st.acc+'%':'—';
  document.getElementById('due-count').textContent=due;
  document.getElementById('done-hint').textContent=st.done+' 道题已有记录'+(st.stale?' · '+st.stale+' 道参考内容更新':'');
  document.getElementById('home-primary').textContent=due?'复习 '+due+' 道到期错题':'开始今日练习';
  document.getElementById('home-primary').onclick=function(){if(due)UI.launch(App.dueIdsGrouped(),{label:'到期错题复习'});else {var pool=App.bank.filter(function(q){return q.year>=2016&&q.year<=2025;});for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=pool[i];pool[i]=pool[j];pool[j]=t;}UI.launch(pool.slice(0,20).map(App.qKey),{label:'今日练习 · 20 题'});}};
  var resumes=App.getResumes().slice(0,3),box=document.getElementById('resume-list');
  if(resumes.some(function(r){return r.schema<3;}))document.querySelector('#resume-section .muted').textContent='旧版断点恢复位置，新版保存完整状态';
  document.getElementById('resume-section').hidden=!resumes.length;
  resumes.forEach(function(r){var d=document.createElement('div');d.className='card resume-row';d.innerHTML=UI.icon('play')+'<div class="info"><b>'+UI.esc(r.label)+'</b><small>第 '+(r.idx+1)+' / '+r.ids.length+' 题 · '+(r.mode==='exam'?'模考':r.mode==='self'?'背题':'练习')+'</small></div><button class="btn btn-ghost" data-continue>继续</button><button class="drop" aria-label="放弃这套断点">×</button>';d.querySelector('[data-continue]').onclick=function(){UI.launch([],{resume:r.id});};d.querySelector('[data-continue]').onclick=function(){sessionStorage.setItem('yilu-launch',JSON.stringify({resume:r.id}));sessionStorage.setItem('yilu-return',JSON.stringify('index.html'));location.href='quiz.html';};d.querySelector('.drop').onclick=function(){var m=UI.openModal('放弃这套断点？','<p class="muted">已保存的答题记录与笔记继续保留。</p><div class="form-actions"><button class="btn" id="confirm-drop">放弃断点</button><button class="btn btn-ghost" data-close>保留</button></div>');m.querySelector('#confirm-drop').onclick=function(){App.clearResume(r.id);location.reload();};};box.appendChild(d);});
  document.querySelectorAll('[data-icon]').forEach(function(e){e.innerHTML=UI.icon(e.dataset.icon);});
})();
