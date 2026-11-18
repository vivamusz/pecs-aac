'use strict';
const D=window.PECS_DATA,$=id=>document.getElementById(id);
const FITZ={'Люди и семья':'people','Профессии':'people','Действия':'action','Эмоции':'desc','Цвета':'desc','Формы':'desc','Размер и количество':'desc','Пространство':'desc','Признаки и качества':'desc','Время':'desc','Коммуникация':'social','Социальное взаимодействие':'social','Места и здания':'place','Улица':'place','Дом':'place'};
const DEF={phase:4,hidden:{},order:{},cap:{},fitz:true,speakTap:true,lang:'ru',rate:0.9,voice:'',size:'m',fav:[],recent:[],choice:[],starter:'Я хочу',useStarter:true,core:null,log:[]};
let S=Object.assign({},DEF,JSON.parse(localStorage.getItem('pecs_s')||'{}'));delete S.pin;
const PIN_STORE='pecs_pin_v1';
const I18=window.PECS_I18N||{r2k:{},k:{}};const KK=()=>S.lang==='kk';const L=t=>(KK()&&I18.r2k[t])||t;const LK=(key,ru)=>(KK()&&I18.k[key])||ru;
const save=()=>{const o=Object.assign({},S);delete o.pin;localStorage.setItem('pecs_s',JSON.stringify(o))};
function pinRec(){try{return JSON.parse(localStorage.getItem(PIN_STORE)||'null')}catch(e){return null}}
async function hashPin(pin,salt){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+pin));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function setPin(pin){const salt=crypto.getRandomValues(new Uint8Array(16)).reduce((s,b)=>s+b.toString(16).padStart(2,'0'),'');const hash=await hashPin(pin,salt);localStorage.setItem(PIN_STORE,JSON.stringify({salt,hash,v:1}));}
async function checkPin(pin){const r=pinRec();if(!r)return false;return (await hashPin(pin,r.salt))===r.hash}
function setZoom(on){const m=document.querySelector('meta[name=viewport]');if(m)m.setAttribute('content',on?'width=device-width,initial-scale=1':'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no')}
function askPersist(){try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}}
function pinPad(title,mode){return new Promise(resolve=>{
  const html='<h3>'+title+'</h3><div id="pinDisp" style="font:28px/1.2 monospace;letter-spacing:6px;text-align:center;min-height:36px;margin:8px 0">· · · ·</div><div id="pinErr" style="color:#c00;font-size:14px;min-height:18px;text-align:center"></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:240px;margin:0 auto">'+
    [1,2,3,4,5,6,7,8,9,'←',0,'OK'].map(k=>'<button type="button" class="btn pinK" data-k="'+k+'" style="font-size:22px;padding:14px 0">'+(k==='OK'?'✓':k)+'</button>').join('')+
    '</div><p style="font-size:13px;color:#64748b;text-align:center;margin-top:10px">'+(mode==='setup'?L('4–8 цифр, два раза'):L('Удерживайте ⚙ 3 сек, затем введите PIN'))+'</p><button class="btn" id="pinCancel" style="margin-top:8px;width:100%">'+L('Отмена')+'</button>';
  modal(html);let buf='',first='';
  const disp=$('pinDisp'),err=$('pinErr');
  const show=()=>{disp.textContent=buf?('•'.repeat(buf.length)):('· · · ·');err.textContent=''};
  $('pinCancel').onclick=()=>{closeM();resolve(null)};
  $('mbox').querySelectorAll('.pinK').forEach(b=>b.onclick=async()=>{
    const k=b.dataset.k;
    if(k==='←'){buf=buf.slice(0,-1);show();return}
    if(k==='OK'){
      if(buf.length<4||buf.length>8){err.textContent=L('Нужно 4–8 цифр');return}
      if(mode==='setup'){
        if(!first){first=buf;buf='';disp.textContent=L('ещё раз');err.textContent=L('Повторите PIN');return}
        if(buf!==first){first='';buf='';show();err.textContent=L('Не совпало, сначала заново');return}
        await setPin(buf);closeM();resolve(true);return
      }
      if(await checkPin(buf)){closeM();resolve(true)}else{buf='';show();err.textContent=L('Неверный PIN')}
      return
    }
    if(buf.length>=8)return;buf+=k;show()
  })
})}
/* PIN спрашивается только при входе в режим специалиста; первый раз — создать; «Отмена» просто закрывает окно */
async function askPin(){if(!pinRec())return !!(await pinPad(L('Создайте PIN специалиста'),'setup'))&&!!pinRec();return !!(await pinPad(L('PIN специалиста'),'unlock'))}
/* язык интерфейса RU/KZ (S.lang: ru|kk) — тексты страницы */
function applyStatic(){const k=KK();document.documentElement.lang=k?'kk':'ru';document.title=L('AYMABA — коммуникатор пиктограмм');
 document.querySelectorAll('[data-i18n]').forEach(e=>{e.textContent=L(e.dataset.i18n)});
 document.querySelectorAll('[data-i18n-title]').forEach(e=>{const t=L(e.dataset.i18nTitle);e.title=t;e.setAttribute('aria-label',t)});
 $('strip').dataset.empty=L('Нажмите на карточку');
 document.querySelectorAll('#langSw [data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===(k?'kk':'ru'))))}
function setLang(l){S.lang=l==='kk'?'kk':'ru';save();render()}

let custom=[],spec=false,cur=null,strip=[],hist=[];
// IndexedDB
let db;function idb(){return new Promise(r=>{try{const q=indexedDB.open('pecs',1);q.onupgradeneeded=()=>q.result.createObjectStore('cards',{keyPath:'id'});q.onsuccess=()=>{db=q.result;r()};q.onerror=()=>r()}catch(e){r()}})}
function idbAll(){return new Promise(r=>{if(!db)return r([]);const q=db.transaction('cards').objectStore('cards').getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>r([])})}
function idbPut(c){return new Promise(r=>{if(!db)return r();const t=db.transaction('cards','readwrite');t.objectStore('cards').put(c);t.oncomplete=r})}
function idbDel(id){return new Promise(r=>{if(!db)return r();const t=db.transaction('cards','readwrite');t.objectStore('cards').delete(id);t.oncomplete=r})}
const allCards=()=>D.cards.concat(custom);
const card=id=>allCards().find(c=>c.id===id);
const word=c=>{const k=S.cap[c.id]||{};return KK()?(k.kz||c.kk||k.ru||c.word):(k.ru||c.word)};
const catName=c=>{const k=S.cap[c.id]||{};return KK()?(k.kz||c.kk||k.ru||c.name):(k.ru||c.name)};
const catOf=id=>D.cats.find(c=>c.id===id);
const fz=c=>{if(!S.fitz)return '';const cat=catOf(c.cat);return 'fz-'+(FITZ[cat&&cat.name]||'noun')};
// speech
let voices=[];function loadV(){try{voices=speechSynthesis.getVoices()}catch(e){}}if('speechSynthesis'in window){loadV();speechSynthesis.onvoiceschanged=loadV}
function pickVoice(){if(S.voice){const v=voices.find(v=>v.voiceURI===S.voice);if(v)return v}
 if(S.lang==='kk'){const v=voices.find(v=>/^kk/i.test(v.lang));if(v)return v}return voices.find(v=>/^ru/i.test(v.lang))}
function say(t){if(!('speechSynthesis'in window)||!t)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);const v=pickVoice();if(v){u.voice=v;u.lang=v.lang}else u.lang='ru-RU';u.rate=S.rate;speechSynthesis.speak(u)}
function logPhrase(t){S.log.push({t:new Date().toISOString(),p:t,ph:S.phase});if(S.log.length>5000)S.log.shift();save()}
// ordering/visibility
function cardsIn(cat){let l=allCards().filter(c=>c.cat===cat);const o=S.order[cat]||[];l.sort((a,b)=>{const ia=o.indexOf(a.id),ib=o.indexOf(b.id);return (ia<0?1e4:ia)-(ib<0?1e4:ib)});return spec?l:l.filter(c=>!S.hidden[c.id])}
function cats(){let l=D.cats.slice();const o=S.order._cats||[];l.sort((a,b)=>{const ia=o.indexOf(a.id),ib=o.indexOf(b.id);return (ia<0?1e4+a.num:ia)-(ib<0?1e4+b.num:ib)});return spec?l:l.filter(c=>!S.hidden[c.id])}
function move(list,key,id,d){const ids=list.map(x=>x.id);const i=ids.indexOf(id),j=i+d;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];S.order[key]=ids;save();render()}
// element builders
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function cardEl(c,onTap,cls){const e=el('div','card '+(cls||'')+' '+fz(c)+(S.hidden[c.id]?' hidden':''));e.innerHTML='<img loading="lazy" alt="" src="'+c.img+'"><div class="lbl">'+esc(word(c))+'</div>';e.onclick=()=>onTap(c);return e}
// main tap handler
function tapCard(c){S.recent=[c.id].concat(S.recent.filter(x=>x!==c.id)).slice(0,24);save();
 if(S.phase<=2||S.phase===3){showBig(c);say(word(c));logPhrase(word(c));return}
 strip.push(c.id);drawStrip();if(S.speakTap)say(word(c))}
function showBig(c){const b=$('big');b.innerHTML='<img src="'+c.img+'"><div>'+esc(word(c))+'</div>';b.style.display='flex';b.onclick=()=>b.style.display='none';setTimeout(()=>b.style.display='none',4000)}
/* Optional per-card Kazakh forms, filled later from the user's table, never invented:
   card.kkWant or card.kkForms={acc,dat,loc,abl,ins,poss1,pl,want,pres,neg}
   Only kkWant / kkForms.want is used in phrases today. */
function stripKey(){const p=[];if(S.phase>=4&&S.useStarter&&strip.length)p.push('start:'+S.starter);return p.concat(strip).join('+')}
function kkWantOf(c){return (c&&(c.kkWant||(c.kkForms&&c.kkForms.want)))||''}
function phraseParts(){
  const cards=strip.map(id=>card(id)).filter(Boolean);
  const use=S.phase>=4&&S.useStarter&&cards.length;
  if(KK()&&use&&S.starter==='Я хочу'){
    const split=I18.kkStarterSplit&&I18.kkStarterSplit['Я хочу'];
    if(split){
      const wantIdx=[...cards].map((c,i)=>kkWantOf(c)?i:-1).filter(i=>i>=0).pop();
      const mid=wantIdx==null?cards:cards.filter((_,i)=>i!==wantIdx);
      const parts=[{kind:'text',text:split.pre}];
      mid.forEach(c=>parts.push({kind:'card',card:c,text:word(c)}));
      if(wantIdx!=null){const w=cards[wantIdx];parts.push({kind:'card',card:w,text:kkWantOf(w)})}
      else parts.push({kind:'text',text:split.post});
      return parts;
    }
  }
  const parts=[];
  if(use)parts.push({kind:'text',text:L(S.starter)});
  cards.forEach(c=>parts.push({kind:'card',card:c,text:word(c)}));
  return parts;
}
function phrase(){
  if(KK()&&S.phase>=4&&S.useStarter&&strip.length){const fix=(I18.kkFix||{})[stripKey()];if(fix)return fix}
  return phraseParts().map(p=>p.text).filter(Boolean).join(' ');
}
function drawStrip(){
  const s=$('strip');s.innerHTML='';
  const fix=KK()&&S.phase>=4&&S.useStarter&&strip.length&&(I18.kkFix||{})[stripKey()];
  if(fix){
    s.appendChild(el('div','sc starter sc-fix',esc(fix)));
    strip.forEach(id=>{const c=card(id);if(!c)return;s.appendChild(el('div','sc '+fz(c),'<img src="'+c.img+'"><div>'+esc(word(c))+'</div>'))});
  }else{
    phraseParts().forEach(p=>{
      if(p.kind==='text')s.appendChild(el('div','sc starter',esc(p.text)));
      else s.appendChild(el('div','sc '+fz(p.card),'<img src="'+p.card.img+'"><div>'+esc(p.text)+'</div>'));
    });
  }
  s.scrollLeft=1e5;updateFixBtn();
}
function updateFixBtn(){const w=$('fixWrap');if(w)w.style.display=(spec&&S.phase>=4&&strip.length)?'flex':'none'}
function ruStripNames(){const n=[];if(S.phase>=4&&S.useStarter&&strip.length)n.push(S.starter);strip.forEach(id=>{const c=card(id);if(c)n.push(c.word)});return n}
function reportPhrase(){
  if(!strip.length)return;
  const key=stripKey(),rus=ruStripNames(),now=phrase();
  const copy='Карточки: '+rus.join(' + ')+' | Сейчас: '+now+' | Ключ: '+key+' | Надо: ';
  modal('<h3>Ошибка во фразе</h3><p><b>Карточки:</b> '+esc(rus.join(' + '))+'</p><p><b>Сейчас:</b> '+esc(now)+'</p><p style="word-break:break-all"><b>Ключ:</b> '+esc(key)+'</p><p style="font-size:14px;color:#64748b">Скопируйте текст и после «Надо:» допишите правильную фразу.</p><div class="row"><button class="btn pri" id="bFixCopy">Копировать</button><button class="btn" onclick="closeM()">'+L('Закрыть')+'</button></div>');
  $('bFixCopy').onclick=async()=>{let ok=false;try{await navigator.clipboard.writeText(copy);ok=true}catch(e){}
    if(!ok){try{const t=document.createElement('textarea');t.value=copy;t.style.position='fixed';t.style.left='-9999px';document.body.appendChild(t);t.select();ok=document.execCommand('copy');t.remove()}catch(e){}}
    $('bFixCopy').textContent=ok?'Скопировано':'Не удалось скопировать'};
}
function speakStrip(){const p=phrase();if(!p)return;say(p);logPhrase(p)}
// render
function render(){applyStatic();document.body.className='g-'+S.size+(S.phase<=2?' phase1':'')+(spec?' spec':'');
 $('top').style.display=S.phase>=4?'flex':'none';
 const st=$('starters');st.style.display=S.phase>=5?'flex':'none';st.innerHTML='';
 ['Я хочу','Я вижу','Я слышу','У меня есть'].forEach(t=>{const b=el('button','btn'+(S.starter===t?' pri':''),esc(L(t)));b.onclick=()=>{S.starter=t;save();render()};st.appendChild(b)});
 drawQuick();drawStrip();
 $('specInfo').textContent=spec?LK('comm.spec.phase',L('🔓 Специалист · фаза {n}')).replace('{n}',['','I','II','III','IV','V','VI'][S.phase]):'';
 $('bSpec').textContent=spec?'🔒':'⚙';
 const g=$('grid');g.innerHTML='';$('choice').style.display='none';
 if(S.phase===3&&!spec){$('choice').style.display='block';$('title').textContent=L('Выбор');const cg=$('choiceGrid');cg.innerHTML='';
  S.choice.map(card).filter(Boolean).forEach(c=>cg.appendChild(cardEl(c,tapCard)));if(!S.choice.length)cg.textContent=L('Специалист: выберите 2–5 карточек (⚙ → карточка → «В поле»).');return}
 if(!cur){$('title').textContent=L('Категории');
  if(S.fav.length)g.appendChild(catTile({id:'_fav',name:L('★ Избранное')},card(S.fav[0])));
  if(S.recent.length)g.appendChild(catTile({id:'_rec',name:L('🕘 Недавние')},card(S.recent[0])));
  const cl=cats();cl.forEach(c=>{const f=cardsIn(c.id)[0]||allCards().find(x=>x.cat===c.id);const t=catTile(c,f);if(spec)t.appendChild(tools(c,cl,'_cats'));g.appendChild(t)});
  if(spec){const a=el('div','card','<div style="font-size:60px">＋</div><div class="lbl">'+L('Своя карточка')+'</div>');a.onclick=()=>addCustom(null);g.appendChild(a)}
  return}
 let list,title;
 if(cur==='_fav'){list=S.fav.map(card).filter(Boolean);title=L('Избранное')}else if(cur==='_rec'){list=S.recent.map(card).filter(Boolean);title=L('Недавние')}else{list=cardsIn(cur);title=catName(catOf(cur))}
 $('title').textContent=title;
 list.forEach(c=>{const e=cardEl(c,spec?editCard:tapCard);if(spec&&cur[0]!=='_')e.appendChild(tools(c,list,cur));g.appendChild(e)});
 if(spec&&cur[0]!=='_'){const a=el('div','card','<div style="font-size:60px">＋</div><div class="lbl">'+L('Фото-карточка')+'</div>');a.onclick=()=>addCustom(cur);g.appendChild(a)}}
function catTile(c,f){const e=el('div','card cat'+(S.hidden[c.id]?' hidden':''),(f?'<img loading="lazy" src="'+f.img+'">':'')+'<div class="lbl">'+esc(c.name[0]==='★'||c.name[0]==='🕘'?c.name:catName(c))+'</div>');e.onclick=()=>{hist.push(cur);cur=c.id;render();scrollTo(0,0)};return e}
function tools(o,list,key){const t=el('div','edit');const mk=(l,f)=>{const b=el('button','',l);b.onclick=e=>{e.stopPropagation();f()};t.appendChild(b)};
 mk(S.hidden[o.id]?'🙈':'👁',()=>{S.hidden[o.id]=!S.hidden[o.id];save();render()});mk('◀',()=>move(list,key,o.id,-1));mk('▶',()=>move(list,key,o.id,1));
 if(key==='_cats')mk('✎',()=>{const n=prompt(L('Название категории'),catName(o));if(n!=null){S.cap[o.id]={ru:n};save();render()}});return t}
function drawQuick(){const q=$('quick');q.innerHTML='';if(S.phase<4){q.style.display='none';return}q.style.display='flex';
 let ids=S.core;if(!ids){const want=['да','нет','ещё','еще','стоп','помоги','помогите','всё','дай','хочу','пить','есть','туалет','не хочу'];ids=[];want.forEach(w=>{const c=D.cards.find(c=>c.word.toLowerCase()===w);if(c&&!ids.includes(c.id))ids.push(c.id)});S.core=ids;save()}
 ids.map(card).filter(Boolean).forEach(c=>{const e=el('div','card q '+fz(c),'<img src="'+c.img+'"><div>'+esc(word(c))+'</div>');e.onclick=()=>tapCard(c);q.appendChild(e)})}
// modals
function modal(html){$('mbox').innerHTML=html;$('modal').classList.add('on')}
function closeM(){$('modal').classList.remove('on')}
$('modal').onclick=e=>{if(e.target.id==='modal')closeM()};
function editCard(c){const k=S.cap[c.id]||{};const isC=c.id.startsWith('u_');
 modal('<h3>'+LK('comm.edit.title',L('Карточка: {слово}')).replace(/\{[^}]*\}/,esc(word(c)))+'</h3><img src="'+c.img+'" style="height:120px"><label>'+L('Подпись RU')+'<input id="eRu" value="'+esc(k.ru||'')+'" placeholder="'+esc(c.word)+'"></label><label>'+L('Подпись KZ')+'<input id="eKz" value="'+esc(k.kz||'')+'"></label><div class="row"><button class="btn pri" id="eOk">'+L('Сохранить')+'</button><button class="btn" id="eFav">'+(S.fav.includes(c.id)?L('★ Убрать из избранного'):L('☆ В избранное'))+'</button><button class="btn" id="eCore">'+(S.core.includes(c.id)?L('Убрать из быстрой панели'):L('В быструю панель'))+'</button><button class="btn" id="eCh">'+(S.choice.includes(c.id)?L('Убрать из поля (фаза III)'):L('В поле выбора (фаза III)'))+'</button>'+(isC?'<button class="btn no" id="eDel">'+L('Удалить')+'</button>':'')+'<button class="btn" onclick="closeM()">'+L('Отмена')+'</button></div>');
 $('eOk').onclick=()=>{S.cap[c.id]={ru:$('eRu').value.trim(),kz:$('eKz').value.trim()};save();closeM();render()};
 const tg=(a,lim)=>{const i=S[a].indexOf(c.id);if(i>=0)S[a].splice(i,1);else{if(lim&&S[a].length>=lim)return alert(LK('comm.alert.max',L('Не больше {n}')).replace('{n}',lim));S[a].push(c.id)}save();closeM();render()};
 $('eFav').onclick=()=>tg('fav');$('eCore').onclick=()=>tg('core');$('eCh').onclick=()=>tg('choice',5);
 if(isC)$('eDel').onclick=async()=>{if(!confirm(L('Удалить карточку?')))return;await idbDel(c.id);custom=custom.filter(x=>x.id!==c.id);closeM();render()}}
function addCustom(cat){modal('<h3>'+L('Своя карточка')+'</h3><label>'+L('Слово')+'<input id="nW"></label><label>'+L('Категория')+'<select id="nC">'+D.cats.map(c=>'<option value="'+c.id+'"'+(c.id===cat?' selected':'')+'>'+esc(catName(c))+'</option>').join('')+'</select></label><div class="row"><button class="btn pri" id="nPh">'+L('📷 Фото / файл')+'</button><button class="btn" onclick="closeM()">'+L('Отмена')+'</button></div>');
 $('nPh').onclick=()=>{const w=$('nW').value.trim();if(!w)return alert(L('Введите слово'));const ct=$('nC').value;const f=$('file');f.value='';f.onchange=()=>{const file=f.files[0];if(!file)return;const img=new Image();const r=new FileReader();r.onload=()=>{img.onload=async()=>{const s=Math.min(1,400/Math.max(img.width,img.height));const cv=document.createElement('canvas');cv.width=img.width*s;cv.height=img.height*s;cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);const c={id:'u_'+Date.now(),cat:ct,word:w,img:cv.toDataURL('image/jpeg',0.85)};await idbPut(c);custom.push(c);closeM();cur=ct;render()};img.src=r.result};r.readAsDataURL(file)};f.click()}}
function download(name,text,type){const b=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function csv(){const q=s=>'"'+String(s).replace(/"/g,'""')+'"';return '\ufeff'+LK('comm.log.csv_header',L('Дата;Время;Фаза;Фраза'))+'\r\n'+S.log.map(l=>{const d=new Date(l.t);return [d.toLocaleDateString('ru-RU'),d.toLocaleTimeString('ru-RU'),l.ph||'',q(l.p)].join(';')}).join('\r\n')}
function settings(){const vs=voices.filter(v=>/^(ru|kk)/i.test(v.lang));
 modal('<h3>'+L('Режим специалиста')+'</h3><label>'+L('Фаза обучения')+'<select id="sPh">'+[[1,L('I — обмен одной карточкой')],[2,L('II — дистанция/настойчивость')],[3,L('III — выбор из 2–5')],[4,L('IV — фраза «Я хочу…»')],[5,L('V — ответ на «Что ты хочешь?»')],[6,L('VI — комментарии (вижу/слышу/есть)')]].map(p=>'<option value="'+p[0]+'"'+(S.phase==p[0]?' selected':'')+'>'+p[1]+'</option>').join('')+'</select></label>'+
 '<label>'+L('Размер сетки')+'<select id="sSz"><option value="s">'+L('Мелкие')+'</option><option value="m">'+L('Средние')+'</option><option value="l">'+L('Крупные')+'</option></select></label>'+
 '<label>'+L('Язык озвучки')+'<select id="sLg"><option value="ru">'+L('Русский')+'</option><option value="kk">'+L('Қазақша (если есть голос, иначе рус.)')+'</option></select></label>'+
 '<label>'+L('Голос')+'<select id="sV"><option value="">'+L('Авто')+'</option>'+vs.map(v=>'<option value="'+esc(v.voiceURI)+'"'+(S.voice===v.voiceURI?' selected':'')+'>'+esc(v.name+' ('+v.lang+')')+'</option>').join('')+'</select></label>'+
 '<label>'+L('Скорость речи')+': <span id="rv">'+S.rate+'</span><input type="range" id="sR" min="0.5" max="1.5" step="0.1" value="'+S.rate+'"></label>'+
 '<label><input type="checkbox" id="sSt" style="width:auto"'+(S.useStarter?' checked':'')+'> '+L('Начало «Я хочу» в полосе')+'</label><br>'+
 '<label><input type="checkbox" id="sT" style="width:auto"'+(S.speakTap?' checked':'')+'> '+L('Озвучивать карточку при нажатии')+'</label><br>'+
 '<label><input type="checkbox" id="sF" style="width:auto"'+(S.fitz?' checked':'')+'> '+L('Цветные рамки Фицджеральда')+'</label>'+
 '<label>'+L('Новый PIN (4–8 цифр)')+'<input id="sPin" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="new-password" maxlength="8" placeholder="'+L('оставьте пустым')+'"></label>'+
 '<div class="row"><button class="btn pri" id="sOk">'+L('Сохранить')+'</button><button class="btn" onclick="say(L(\'Проверка голоса\'))">'+L('▶ Тест')+'</button></div><hr>'+
 '<h4>'+LK('comm.log.title',L('Журнал фраз ({n})')).replace('{n}',S.log.length)+'</h4><div class="row"><button class="btn" id="sCsv">'+L('⬇ Экспорт CSV')+'</button><button class="btn" id="sLogC">'+L('Очистить журнал')+'</button></div>'+
 '<table>'+S.log.slice(-30).reverse().map(l=>'<tr><td>'+new Date(l.t).toLocaleString('ru-RU')+'</td><td>'+esc(l.p)+'</td></tr>').join('')+'</table><hr>'+
 '<h4>'+L('Резервная копия')+'</h4><div class="row"><button class="btn" id="sExp">'+L('⬇ Экспорт (JSON)')+'</button><button class="btn" id="sImp">'+L('⬆ Импорт')+'</button><button class="btn" id="sRst">'+L('Сброс настроек')+'</button></div>'+
 '<p style="font-size:14px;color:#64748b">'+L('В режиме специалиста: 👁 скрыть/показать, ◀▶ порядок, нажатие на карточку — подписи, избранное, быстрая панель, поле выбора.')+'</p><button class="btn" onclick="closeM()">'+L('Закрыть')+'</button>');
 $('sSz').value=S.size;$('sLg').value=S.lang;$('sR').oninput=e=>$('rv').textContent=e.target.value;
 $('sOk').onclick=async()=>{S.phase=+$('sPh').value;S.size=$('sSz').value;S.lang=$('sLg').value;S.voice=$('sV').value;S.rate=+$('sR').value;S.useStarter=$('sSt').checked;S.speakTap=$('sT').checked;S.fitz=$('sF').checked;const p=$('sPin').value.trim();if(p){if(!/^[0-9]{4,8}$/.test(p))return alert(L('PIN: 4–8 цифр'));await setPin(p)}save();closeM();render()};
 $('sCsv').onclick=()=>download('pecs_log_'+new Date().toISOString().slice(0,10)+'.csv',csv(),'text/csv;charset=utf-8');
 $('sLogC').onclick=()=>{if(confirm(L('Очистить журнал?'))){S.log=[];save();settings()}};
 $('sExp').onclick=()=>{const st=Object.assign({},S);delete st.pin;download('pecs_backup_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({settings:st,custom}),'application/json')};
 $('sImp').onclick=()=>{const f=document.createElement('input');f.type='file';f.accept='.json,application/json';f.onchange=()=>{const r=new FileReader();r.onload=async()=>{try{const o=JSON.parse(r.result);S=Object.assign({},DEF,o.settings);delete S.pin;save();for(const c of o.custom||[])await idbPut(c);custom=o.custom||[];closeM();render();alert(L('Импортировано'))}catch(e){alert(L('Ошибка файла'))}};r.readAsText(f.files[0])};f.click()};
 $('sRst').onclick=()=>{if(confirm(L('Сбросить все настройки (журнал и свои карточки сохранятся)?'))){S=Object.assign({},DEF,{log:S.log});delete S.pin;save();closeM();render()}}}
// buttons
$('strip').onclick=speakStrip;$('bSpeak').onclick=speakStrip;$('bFix').onclick=reportPhrase;
$('bDel').onclick=()=>{strip.pop();drawStrip()};$('bClr').onclick=()=>{strip=[];drawStrip()};
$('bHome').onclick=()=>{cur=null;hist=[];render()};$('bBack').onclick=()=>{cur=hist.length?hist.pop():null;render()};
$('bYes').onclick=()=>{say(L('Да'));logPhrase(L('Да'))};$('bNo').onclick=()=>{say(L('Нет'));logPhrase(L('Нет'))};
let holdT=null,holdDone=false;
$('bSpec').onpointerdown=e=>{holdDone=false;if(spec)return;holdT=setTimeout(async()=>{holdDone=true;if(!(await askPin()))return;spec=true;setZoom(true);askPersist();render();settings()},3000)};
$('bSpec').onpointerup=$('bSpec').onpointerleave=$('bSpec').onpointercancel=()=>{clearTimeout(holdT);holdT=null};
$('bSpec').onclick=()=>{if(holdDone){holdDone=false;return}if(spec){spec=false;setZoom(false);render()}};
document.querySelectorAll('#langSw [data-lang]').forEach(b=>b.onclick=()=>setLang(b.dataset.lang));
$('specInfo').onclick=()=>spec&&settings();
window.closeM=closeM;window.say=say;window.__pecs={csv,get S(){return S},strip:()=>phrase(),key:()=>stripKey(),setSpec(v){spec=!!v;render()},setStrip(ids){strip=(ids||[]).slice();drawStrip()},refresh(){save();render()}};
(async()=>{await idb();custom=await idbAll();askPersist();render()})();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
