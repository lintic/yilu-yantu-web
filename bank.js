(function(){
  var $=function(id){return document.getElementById(id);};
  var cfg=App.cfgLoad(),mode='practice',set=cfg.set||'ten',pg=0,kw='',chapterUI;
  if(new URLSearchParams(location.search).get('tab')==='exam')mode='exam';
  var sources=[['ten','近十年真题'],['old','往年真题'],['xc','学成选择题'],['all','全部题库']];
  $('set').innerHTML=sources.map(function(o){return '<option value="'+o[0]+'">'+o[1]+'</option>';}).join('');
  $('set').value=set;
  $('subject').innerHTML='<option value="">全部科目</option>'+App.subjects().map(function(s){return '<option>'+UI.esc(s)+'</option>';}).join('');
  $('subject').value=cfg.subject||'';
  $('count').value=cfg.count||20;
  $('order').value=cfg.order==='random'?'random':'seq';
  function sourceLabel(){return (sources.find(function(o){return o[0]===set;})||sources[0])[1];}
  function scope(q){return set==='ten'?q.year>=2016&&q.year<=2025:set==='old'?q.year>=2006&&q.year<=2015:set==='xc'?q.set==='xc':true;}
  function pool(){return App.bank.filter(function(q){return (!chapterUI||chapterUI.matches(q))&&scope(q)&&(!$('subject').value||(q.subject===$('subject').value||(q.subject_aliases||[]).indexOf($('subject').value)>=0))&&(!$('year').value||q.year===+$('year').value)&&(mode==='exam'||!kw||q.stem.indexOf(kw)>=0||(q.point||'').indexOf(kw)>=0);});}
  function orderedPool(randomize){
    var qs=pool().sort(function(a,b){return (Number(b.year)||0)-(Number(a.year)||0)||(Number(a.orig_num)||0)-(Number(b.orig_num)||0);});
    if(randomize&&$('order').value==='random')for(var i=qs.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=qs[i];qs[i]=qs[j];qs[j]=t;}
    return qs;
  }
  function selection(){return orderedPool(true).slice(0,$('count').value==='all'?undefined:+$('count').value).map(App.qKey);}
  function orderLabel(){return $('order').value==='random'?'随机':'顺序';}
  function fillYears(){
    var selected=$('year').value;
    var years=Array.from(new Set(App.bank.filter(scope).map(function(q){return q.year;}).filter(Boolean))).sort(function(a,b){return b-a;});
    $('year').innerHTML='<option value="">全部年份</option>'+years.map(function(y){return '<option>'+y+'</option>';}).join('');
    $('year').value=years.indexOf(+selected)>=0?selected:'';
  }
  fillYears();if(cfg.year)$('year').value=cfg.year;
  function remember(){App.cfgSave({set:set,subject:$('subject').value,year:$('year').value,count:$('count').value==='all'?'all':+$('count').value,order:$('order').value,mode:mode,chapter:chapterUI?chapterUI.selected():''});}
  var settings=$('bank-settings'),oldOverflow='';
  function closeSettings(){if(settings.open)settings.close();}
  $('settings-open').onclick=function(){oldOverflow=document.body.style.overflow;settings.showModal();document.body.style.overflow='hidden';};
  $('settings-close').onclick=$('settings-done').onclick=closeSettings;
  settings.addEventListener('close',function(){document.body.style.overflow=oldOverflow;});
  settings.addEventListener('click',function(e){var r=settings.getBoundingClientRect();if(e.target===settings&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))closeSettings();});
  function startPractice(){closeSettings();UI.launch(selection(),{mode:mode==='self'?'self':'practice',label:(chapterUI&&chapterUI.selected()?Chapters.label(chapterUI.selected()):$('subject').value||sourceLabel())+' · '+(mode==='self'?'背题':'专项练习')+' · '+orderLabel()});}
  function annual(year){
    var p=App.paperProfile(year);
    var ids=App.bank.filter(function(q){return q.year===year&&!q.set;}).sort(function(a,b){return (a.orig_num||0)-(b.orig_num||0);}).map(App.qKey);
    var m=UI.openModal(year+' 年度模考','<div class="notice">'+(p.complete?'题号覆盖 '+p.count+' 题。':'当前收录 '+p.count+' 题，试卷题号或数量尚未完整核对。')+' '+(p.pending?p.pending+' 题答案待核对，结算时单列。':'参考答案已导入，人工核对状态见题目。')+'</div><p class="muted" style="font-size:13px">交卷前隐藏答案与解析，允许改选、标疑问和保存退出。评分按原卷题号与分值；计时默认 180 分钟，可调整。</p><label class="form-label" for="exam-minutes">模拟时长（分钟）</label><input id="exam-minutes" type="number" min="1" max="360" value="180"><div class="form-actions"><button class="btn" id="begin-exam">开始年度模考</button><button class="btn btn-ghost" data-close>稍后再考</button></div>');
    m.querySelector('#begin-exam').onclick=function(){var minutes=+m.querySelector('#exam-minutes').value;if(!Number.isInteger(minutes)||minutes<1||minutes>360)return UI.toast('请输入 1–360 分钟');UI.launch(ids,{mode:'exam',label:year+' 年度模考',annual:year,durationMs:minutes*60000,paperComplete:p.complete});};
  }
  function paginate(total,size,unit){
    var pages=Math.max(1,Math.ceil(total/size));pg=Math.max(0,Math.min(pg,pages-1));
    $('page-no').textContent=(pg+1)+' / '+pages+' · '+total+' '+unit;
    $('page-prev').disabled=pg===0;$('page-next').disabled=pg>=pages-1;$('pagination').hidden=total===0;
  }
  function renderYears(){
    var years=App.years().filter(function(y){return y>=2016&&y<=2025&&(!$('year').value||y===+$('year').value)&&(!kw||String(y).indexOf(kw)>=0);}).sort(function(a,b){return b-a;});
    paginate(years.length,4,'套');$('bank-count').textContent='年度真题 · 共 '+years.length+' 套 · 原卷顺序';
    $('year-list').innerHTML=years.slice(pg*4,pg*4+4).map(function(y){
      var p=App.paperProfile(y),progress=App.progressOf(function(q){return q.year===y;});
      return '<article class="card year-card"><div class="row-between"><h2>'+y+'</h2><span class="badge '+(p.pending?'warn':'')+'">'+(p.pending?p.pending+' 题待核对':'参考答案已导入')+'</span></div><p>'+p.count+' 题 · 原卷 300 分 · 默认 180 分钟</p><div class="bar"><i style="width:'+(progress.total?progress.done/progress.total*100:0)+'%"></i></div><div class="row-between"><small>学习进度 '+progress.done+'/'+progress.total+'</small><small>'+(progress.acc!=null?progress.acc+'% 正确率':'尚未练习')+'</small></div><div class="year-actions"><button class="btn" data-annual="'+y+'">开始模考</button><button class="btn btn-ghost" data-year-practice="'+y+'">按卷练习</button></div></article>';
    }).join('')||'<div class="empty">没有匹配的模考年份</div>';
    $('year-list').querySelectorAll('[data-annual]').forEach(function(b){b.onclick=function(){annual(+b.dataset.annual);};});
    $('year-list').querySelectorAll('[data-year-practice]').forEach(function(b){b.onclick=function(){var year=+b.dataset.yearPractice;UI.launch(App.bank.filter(function(q){return q.year===year&&!q.set;}).sort(function(a,b){return (a.orig_num||0)-(b.orig_num||0);}).map(App.qKey),{label:year+' 年真题练习'});};});
  }
  function render(){
    if(chapterUI)chapterUI.refresh();remember();var qs=orderedPool(false),isExam=mode==='exam',label=isExam?'专项测试':mode==='self'?'背题':'专项练习';
    $('filter-caption').textContent=label+'设置';$('settings-open').textContent=isExam?'测试设置':'练习设置';
    $('settings-note').textContent=isExam?'设置用于专项测试；下方年度模考按完整原卷作答。':'选择范围、题数与顺序，设置会自动记住。';
    $('selection-caption').textContent=isExam?'自定义专项测试':'本轮'+label;
    $('selection-summary').textContent=[sourceLabel(),chapterUI&&chapterUI.selected()?Chapters.label(chapterUI.selected()):$('subject').value||'全部科目',$('year').value?$('year').value+' 年':'全部年份',$('count').value==='all'?'当前范围全部':$('count').value+' 题',orderLabel()].join(' · ');
    $('search').placeholder=isExam?'搜索模考年份，例如 2025':'搜索题干或考点';$('search').setAttribute('aria-label',isExam?'搜索模考年份':'搜索题干或考点');
    $('filter-go').textContent=$('bank-start').textContent='开始'+label;$('filter-go').disabled=$('bank-start').disabled=!qs.length;
    $('page-heading-title').textContent=isExam?'把知识放进真实判断':'从一道题，学会一个考点';
    $('bank-desc').textContent=isExam?'选择年度整卷，或按自己的范围开始专项测试。':'设置一组题开始练习，或浏览题目进行单题精练。';
    $('filter-go').onclick=isExam?function(){closeSettings();UI.launch(selection(),{mode:'exam',label:(chapterUI&&chapterUI.selected()?Chapters.label(chapterUI.selected()):$('subject').value||'混合科目')+' · 专项测试 · '+orderLabel(),durationMs:60*60000});}:startPractice;
    $('year-list').hidden=!isExam;$('question-list').hidden=isExam;
    if(isExam){renderYears();return;}
    paginate(qs.length,6,'题');$('bank-count').textContent='共 '+qs.length+' 道题 · 每页 6 道';
    $('question-list').innerHTML=qs.slice(pg*6,pg*6+6).map(function(q){return '<button class="question-row" data-q="'+q.id+'"><span class="tag">'+UI.esc(q.subject)+'</span> <span class="tag">'+(q.year?q.year+' 年 · '+(q.orig_num?'第 '+q.orig_num+' 题':'真题'):'学成专项')+'</span> '+(!App.hasAnswer(q)?'<span class="badge warn">答案待核对</span>':'')+'<p>'+UI.esc(UI.stem(q).length>95?UI.stem(q).slice(0,95)+'…':UI.stem(q))+'</p></button>';}).join('')||'<div class="empty">这个范围没有匹配题目</div>';
    $('question-list').querySelectorAll('[data-q]').forEach(function(b){b.onclick=function(){UI.launch([b.dataset.q],{mode:mode,label:'单题精练'});};});
  }
/* Directory controller: current subject/source/year remain the scope for counts. */
function setupChapterUI(){
  var selected=cfg.chapter||'',dialog=$('chapter-directory'),oldScroll='',directorySubject=$('directory-subject');
  if(selected!=='pending'&&!Chapters.byId(selected))selected='';
  function baseQuestions(){return App.bank.filter(function(q){return scope(q)&&(!$('subject').value||q.subject===$('subject').value||(q.subject_aliases||[]).indexOf($('subject').value)>=0)&&(!$('year').value||q.year===+$('year').value);});}
  function choose(id){var node=Chapters.byId(id);selected=id;if(node)$('subject').value=node.subject;kw='';$('search').value='';pg=0;render();if(dialog.open)dialog.close();}
  function refresh(){
    var qs=baseQuestions(),counts=Chapters.counts(qs),select=$('chapter-jump');
    if(selected&&selected!=='pending'){var node=Chapters.byId(selected);if($('subject').value&&node.subject!==$('subject').value)selected='';}
    select.innerHTML='<option value="">全部章节</option>'+Chapters.forSubject($('subject').value).filter(function(n){return !n.parent;}).map(function(parent){var children=Chapters.nodes.filter(function(n){return n.parent===parent.id;});return '<optgroup label="'+UI.esc(parent.subject+' · '+parent.title)+'"><option value="'+parent.id+'">'+UI.esc(parent.title)+' · '+(counts[parent.id]||0)+' 题</option>'+children.map(function(child){return '<option value="'+child.id+'">'+UI.esc(child.title)+' · '+(counts[child.id]||0)+' 题</option>';}).join('')+'</optgroup>';}).join('')+'<option value="pending">章节待定位 · '+counts.pending+' 题</option>';
    select.value=selected;$('chapter-current').textContent=selected?Chapters.label(selected):'按章节学习';$('chapter-coverage').textContent='当前范围已定位 '+counts.assigned+' / '+counts.total+' 题';
    $('chapter-clear').hidden=!selected;
    directorySubject.innerHTML='<option value="">全部科目</option>'+App.subjects().map(function(s){return '<option>'+UI.esc(s)+'</option>';}).join('');directorySubject.value=$('subject').value;
    if(dialog.open)renderDirectory();
  }
  function renderDirectory(){
    var subject=directorySubject.value;
    var qs=App.bank.filter(function(q){return scope(q)&&(!subject||q.subject===subject||(q.subject_aliases||[]).indexOf(subject)>=0)&&(!$('year').value||q.year===+$('year').value);});
    var counts=Chapters.counts(qs);$('directory-summary').textContent=sourceLabel()+' · '+($('year').value?$('year').value+' 年':'全部年份')+' · 已定位 '+counts.assigned+' / '+counts.total+' 题';
    $('directory-tree').innerHTML=Chapters.forSubject(subject).filter(function(n){return !n.parent;}).map(function(parent){var children=Chapters.nodes.filter(function(n){return n.parent===parent.id;});return '<details class="directory-system"'+((counts[parent.id]||selected===parent.id)?' open':'')+'><summary>'+UI.esc(parent.subject+' · '+parent.title)+'<span>'+(counts[parent.id]||0)+' 题</span></summary><button class="directory-chapter '+(selected===parent.id?'active':'')+'" data-chapter="'+parent.id+'">本系统全部题目 <span>'+(counts[parent.id]||0)+' 题</span></button>'+children.map(function(child){var count=counts[child.id]||0;return '<button class="directory-chapter '+(selected===child.id?'active':'')+'" data-chapter="'+child.id+'"><span>'+UI.esc(child.title)+'</span><small>'+(count?count+' 题':'当前范围待关联')+'</small></button>';}).join('')+'</details>';}).join('')+'<button class="directory-chapter" data-chapter="pending"><span>章节待定位</span><small>'+counts.pending+' 题</small></button>';
    $('directory-tree').querySelectorAll('[data-chapter]').forEach(function(b){b.onclick=function(){if(subject)$('subject').value=subject;choose(b.dataset.chapter);};});
  }
  $('chapter-open').onclick=function(){refresh();renderDirectory();oldScroll=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';};
  $('directory-close').onclick=function(){dialog.close();};dialog.addEventListener('close',function(){document.body.style.overflow=oldScroll;});
  directorySubject.onchange=renderDirectory;$('chapter-jump').onchange=function(){choose(this.value);};$('chapter-clear').onclick=function(){choose('');};
  return {selected:function(){return selected;},matches:function(q){return Chapters.matches(q,selected);},refresh:refresh};
}

  if(typeof Chapters!=='undefined'&&$('chapter-directory'))chapterUI=setupChapterUI();
  $('bank-start').onclick=function(){$('filter-go').onclick();};
  document.querySelectorAll('[data-mode]').forEach(function(b){b.onclick=function(){mode=b.dataset.mode;kw='';$('search').value='';document.querySelectorAll('[data-mode]').forEach(function(c){c.classList.toggle('on',c===b);});pg=0;render();};b.classList.toggle('on',b.dataset.mode===mode);});
  $('set').onchange=function(){set=this.value;pg=0;fillYears();render();};['subject','year','count','order'].forEach(function(id){$(id).onchange=function(){pg=0;render();};});
  var timer;$('search').oninput=function(){clearTimeout(timer);timer=setTimeout(function(){kw=$('search').value.trim();pg=0;render();},180);};
  $('page-prev').onclick=function(){pg--;render();};$('page-next').onclick=function(){pg++;render();};render();
})();
