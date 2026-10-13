"use strict";
// Профиль вошедшего пользователя — заполняет auth.js по ответу сервера /me (права проверяет сервер)
let ME={group:false,dirs:[],role:null,full_name:'',login:''};
// ================= CONSTANTS =================
const COS=[
  {code:'access',name:'Ансар Аксес',short:'Аксес',color:'var(--c-access)'},
  {code:'techno',name:'Ансар Техно',short:'Техно',color:'var(--c-techno)'},
  {code:'bijou',name:'Ансар Бижутерия',short:'Бижутерия',color:'var(--c-bijou)'}];
const CO=c=>COS.find(x=>x.code===c);
const TH={coverLow:14,coverHigh:180,excessKeep:90,deadDays:90,drop:-.10};
const DIMS={pt:'Точка',ch:'Канал',cat:'Категория',p:'Товар',emp:'Менеджер',cl:'Клиент'};
const DIMS_PL={pt:'Точки',ch:'Каналы',cat:'Категории',p:'Товары',emp:'Менеджеры',cl:'Клиенты'};
const KINDS=['Отгрузка','Розничная продажа','Возврат покупателя','Возврат (розница)'];
const C={};
let T='';
// Дата, по которую есть данные конкретной компании (компании выгружаются в разные дни)
const TC=code=>{ if(!code||!C[code]) return T; const m=C[code].meta, a=m.asOf; if(!a||a>=T) return T;
  // выгрузка сделана в тот же день, что и последние данные → этот день неполный, берём предыдущий
  return m.exported.slice(0,10)>a?a:addD(a,-1); };
// Обрезать период по дате данных компании; период сравнения сдвигается на столько же дней — сравнение остаётся «день в день»
function clipR(code,r){
  if(!code||!C[code]) return r; const t=TC(code); if(r.to<=t) return r;
  const o={...r,to:t,clipped:true,dataTo:t};
  if(t<r.from){ o.nodataC=true; o.to=r.from; return o; }
  if(r.pf){ const n=daysBetween(r.from,t); o.pt=addD(r.pf,n); if(o.pt>r.pt) o.pt=r.pt; }
  o.label=r.label+' (данные по '+dLab(t)+')'; return o; }
const S={co:null,view:'overview',f:{},path:[],per:'mtd',cmp:'prev',inc:false,seg:{},sort:{},q:{},more:{}};
const HIST=[];
const $=s=>document.querySelector(s);

// ================= FORMAT =================
const nf0=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
const nf1=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});
const nf2=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
function money(v){ if(v==null||!isFinite(v)) return '—'; const a=Math.abs(v);
  if(a>=1e9) return nf2.format(v/1e9)+' млрд ₸'; if(a>=1e6) return nf1.format(v/1e6)+' млн ₸'; if(a>=1e4) return nf0.format(v/1e3)+' тыс ₸'; return nf0.format(v)+' ₸'; }
function short(v){ const a=Math.abs(v); if(a>=1e9) return nf1.format(v/1e9)+' млрд'; if(a>=1e6) return nf1.format(v/1e6)+' млн'; if(a>=1e3) return nf0.format(v/1e3)+' тыс'; return nf0.format(v); }
function smoney(v){ return (v>0?'+':v<0?'−':'')+money(Math.abs(v)); }
function pct(v,d=1){ return v==null||!isFinite(v)?'—':(v*100).toFixed(d).replace('.',',')+'%'; }
function spct(v,d=0){ return v==null||!isFinite(v)?'—':(v>0?'+':v<0?'−':'')+Math.abs(v*100).toFixed(d).replace('.',',')+'%'; }
function pp(v){ return v==null||!isFinite(v)?'—':(v>0?'+':v<0?'−':'')+Math.abs(v*100).toFixed(1).replace('.',',')+' п.п.'; }
function num(v,d=0){ return v==null||!isFinite(v)?'—':(d?nf1:nf0).format(v); }
function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function dl(cur,prev,{ppm=false,inv=false}={}){
  if(cur==null||prev==null||!isFinite(cur)||!isFinite(prev)) return '<span class="delta fl">—</span>';
  let v,t; if(ppm){ v=cur-prev; t=pp(v); } else { if(!prev) return '<span class="delta fl">—</span>'; v=cur/prev-1; t=spct(v,1); }
  const good=inv?v<0:v>0; const cls=Math.abs(v)<0.005?'fl':(good?'up':'dn');
  return `<span class="delta ${cls}">${v>=0?'▲':'▼'} ${t}</span>`; }

// ================= DATES =================
const DAY=864e5;
const toD=s=>new Date(s+'T00:00:00Z'), ds=d=>d.toISOString().slice(0,10);
const addD=(s,n)=>ds(new Date(toD(s).getTime()+n*DAY));
const mStart=s=>s.slice(0,8)+'01';
function mEnd(s){ const d=toD(mStart(s)); d.setUTCMonth(d.getUTCMonth()+1); return addD(ds(d),-1); }
const prevMo=mo=>{ const d=toD(mo+'-01'); d.setUTCMonth(d.getUTCMonth()-1); return ds(d).slice(0,7); };
const nextMo=mo=>{ const d=toD(mo+'-01'); d.setUTCMonth(d.getUTCMonth()+1); return ds(d).slice(0,7); };
const daysBetween=(a,b)=>Math.round((toD(b)-toD(a))/DAY);
const wdOf=s=>(toD(s).getUTCDay()+6)%7;
const WD=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const MON=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const MONs=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const MONg=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const monName=mo=>MON[+mo.slice(5,7)-1]+' '+mo.slice(0,4);
const dLab=s=>(+s.slice(8))+' '+MONg[+s.slice(5,7)-1];
const dShort=s=>s.slice(8)+'.'+s.slice(5,7)+'.'+s.slice(2,4);

// ================= LOAD =================
function prep(code,j){
  const m=j.meta, D=j.docs, L=j.lines, n=D.d.length;
  const c={meta:m,code,n,products:j.products,stockRaw:j.stock,clients:j.clients,fin:j.fin};
  c.d=Int32Array.from(D.d); c.k=Int8Array.from(D.k); c.pt=Int16Array.from(D.pt); c.ch=Int16Array.from(D.ch); c.emp=Int16Array.from(D.emp); c.cl=Int32Array.from(D.cl);
  c.rev=Float64Array.from(D.rev); c.cost=Float64Array.from(D.cost); c.qty=Float64Array.from(D.qty); c.paid=Float64Array.from(D.paid); c.no=D.no; c.t=D.t;
  c.ldi=Int32Array.from(L.di); c.lp=Int32Array.from(L.p); c.lq=Float64Array.from(L.q); c.lrev=Float64Array.from(L.rev); c.lcost=Float64Array.from(L.cost);
  c.lcat=Int32Array.from(L.p,p=>j.products[p][2]);
  c.pcat=Int32Array.from(j.products,p=>p[2]);
  c.dayN=daysBetween(m.dataStart,m.asOf)+1;
  c.dayStr=[]; for(let i=0;i<c.dayN+1;i++) c.dayStr.push(addD(m.dataStart,i));
  c.lineFromD=daysBetween(m.dataStart,m.lineFrom);
  // первый документ, у которого есть позиции
  c.firstLineDoc=n; for(let i=0;i<n;i++) if(c.d[i]>=c.lineFromD){ c.firstLineDoc=i; break; }
  // doc index -> first line index
  c.docLine=new Int32Array(n+1).fill(-1); for(let i=L.di.length-1;i>=0;i--) c.docLine[c.ldi[i]]=i;
  { let nxt=c.ldi.length; for(let i=n;i>=0;i--){ if(c.docLine[i]<0) c.docLine[i]=nxt; else nxt=c.docLine[i]; } }
  // выходные дни недели
  const wd=new Array(7).fill(0); for(let i=0;i<n;i++){ if(c.ch[i]===m.intCh) continue; const s=c.dayStr[c.d[i]]; if(daysBetween(s,m.asOf)<56) wd[wdOf(s)]+=c.rev[i]; }
  const avg=wd.reduce((a,b)=>a+b,0)/7; c.off=[0,1,2,3,4,5,6].filter(k=>wd[k]<avg*0.05);
  C[code]=c;
}
const codes=()=>COS.map(x=>x.code).filter(x=>C[x]);
const dIdx=(c,s)=>daysBetween(c.meta.dataStart,s);
function lb(arr,v,lo,hi){ while(lo<hi){ const m=(lo+hi)>>1; if(arr[m]<v) lo=m+1; else hi=m; } return lo; }

// ================= PERIODS =================
function periodOptions(){
  const ms=new Set(); for(const x of codes()){ const c=C[x]; for(let mo=c.meta.dataStart.slice(0,7);mo<=T.slice(0,7);mo=nextMo(mo)) ms.add(mo); }
  const o=[['mtd',MON[+T.slice(5,7)-1][0].toUpperCase()+MON[+T.slice(5,7)-1].slice(1)+' 1–'+(+T.slice(8))+' (текущий)'],['d7','Последние 7 дней'],['d30','Последние 30 дней'],['d90','Последние 90 дней']];
  for(const mo of [...ms].sort().reverse()) if(mo!==T.slice(0,7)) o.push(['m:'+mo,monName(mo)]);
  return o;
}
function rng(per=S.per,cmp=S.cmp,code=S.co){
  let from,to,pf,pt,label,cl;
  if(per==='mtd'){ from=mStart(T); to=T; const pm=prevMo(T.slice(0,7)); pf=pm+'-01'; pt=pm+'-'+String(Math.min(+T.slice(8),+mEnd(pf).slice(8))).padStart(2,'0'); label=MON[+T.slice(5,7)-1]+' 1–'+(+T.slice(8)); cl='те же дни прошлого месяца'; }
  else if(per[0]==='d'){ const n=+per.slice(1); from=addD(T,-(n-1)); to=T; pf=addD(T,-(2*n-1)); pt=addD(T,-n); label=n+' дней по '+dLab(T); cl='предыдущие '+n+' дней'; }
  else { const mo=per.slice(2); from=mo+'-01'; to=mEnd(from); const pm=prevMo(mo); pf=pm+'-01'; pt=mEnd(pf); label=monName(mo); cl=monName(pm); }
  if(cmp==='ly'){ pf=(+from.slice(0,4)-1)+from.slice(4); pt=(+to.slice(0,4)-1)+to.slice(4); cl='тот же период год назад'; }
  return clipR(code,{from,to,pf,pt,label,cl});
}

// ================= SCAN ENGINE =================
// f: {pt,ch,emp,cl,cat,p,k}; dim: ключ группировки или null
const needLines=(f,dim)=>f.cat!=null||f.p!=null||dim==='cat'||dim==='p';
let SCACHE=new Map();
function scan(code,from,to,f,dim){
  const key=code+'|'+from+'|'+to+'|'+JSON.stringify(f)+'|'+dim+'|'+S.inc;
  if(SCACHE.has(key)) return SCACHE.get(key);
  const c=C[code], m=c.meta; const out=new Map(); let partial=false, nodata=false;
  if(to<m.dataStart||from>T) nodata=true;
  const a=Math.max(0,dIdx(c,from)), b=Math.min(c.dayN-1,dIdx(c,to));
  if(from<m.dataStart) partial=true;
  const i0=lb(c.d,a,0,c.n), i1=lb(c.d,b+1,0,c.n);
  const inc=S.inc, ic=m.intCh;
  const get=k=>{ let x=out.get(k); if(!x){ x={rev:0,cost:0,qty:0,docs:0,ret:0,cls:new Set(),anon:0,last:-1}; out.set(k,x); } return x; };
  const docOk=i=>!((!inc&&c.ch[i]===ic)||(f.pt!=null&&c.pt[i]!==f.pt)||(f.ch!=null&&c.ch[i]!==f.ch)||(f.emp!=null&&c.emp[i]!==f.emp)||(f.cl!=null&&c.cl[i]!==f.cl));
  const dk=(i)=>dim==='pt'?c.pt[i]:dim==='ch'?c.ch[i]:dim==='emp'?c.emp[i]:dim==='cl'?c.cl[i]:dim==='day'?c.d[i]:dim==='mo'?c.dayStr[c.d[i]].slice(0,7):dim==='k'?c.k[i]:'all';
  let lineLimited=false;
  if(!nodata){
    if(needLines(f,dim)){
      if(a<c.lineFromD) lineLimited=true;
      const l0=c.docLine[i0], l1=c.docLine[i1];
      for(let l=l0;l<l1;l++){
        const i=c.ldi[l]; if(!docOk(i)) continue;
        const p=c.lp[l], cat=c.lcat[l];
        if(f.p!=null&&p!==f.p) continue; if(f.cat!=null&&cat!==f.cat) continue;
        const k=dim==='p'?p:dim==='cat'?cat:dk(i);
        const x=get(k); x.rev+=c.lrev[l]; x.cost+=c.lcost[l]; x.qty+=c.lq[l];
        if(x.last!==i){ x.last=i; if(c.k[i]<2){ x.docs++; if(c.cl[i]>=0) x.cls.add(c.cl[i]); else x.anon++; } else x.ret++; }
      }
    } else {
      for(let i=i0;i<i1;i++){
        if(!docOk(i)) continue;
        const x=get(dk(i)); x.rev+=c.rev[i]; x.cost+=c.cost[i]; x.qty+=c.qty[i];
        if(c.k[i]<2){ x.docs++; if(c.cl[i]>=0) x.cls.add(c.cl[i]); else x.anon++; } else x.ret++;
      }
    }
  }
  for(const x of out.values()){ x.gp=x.rev-x.cost; x.m=x.rev>0?x.gp/x.rev:null; x.avg=x.docs?x.rev/x.docs:null; x.ncl=x.cls.size; }
  const res={map:out,partial,nodata,lineLimited}; SCACHE.set(key,res); return res;
}
const Z={rev:0,cost:0,qty:0,docs:0,ret:0,cls:new Set(),anon:0,gp:0,m:null,avg:null,ncl:0};
function tot(code,from,to,f){ const r=scan(code,from,to,f,null); return {...(r.map.get('all')||Z),partial:r.partial,nodata:r.nodata,lineLimited:r.lineLimited}; }
function hasCmp(code,r){ return r.pf>=C[code].meta.dataStart; }
// строки сравнения по измерению
function compare(code,r,f,dim){
  const cur=scan(code,r.from,r.to,f,dim).map, okP=hasCmp(code,r), prv=okP?scan(code,r.pf,r.pt,f,dim).map:new Map();
  const keys=new Set([...cur.keys(),...prv.keys()]); const rows=[];
  for(const k of keys){ const a=cur.get(k)||Z, b=prv.get(k)||Z;
    if(Math.abs(a.rev)<1&&Math.abs(b.rev)<1&&!a.docs&&!b.docs) continue;
    rows.push({key:k,name:dimName(code,dim,k),rev:a.rev,prev:okP?b.rev:null,d:okP?a.rev-b.rev:null,gp:a.gp,gpPrev:b.gp,m:a.m,mPrev:okP?b.m:null,docs:a.docs,docsPrev:b.docs,avg:a.avg,avgPrev:b.avg,ncl:a.ncl,nclPrev:b.ncl,anon:a.anon,qty:a.qty,qtyPrev:b.qty,ret:a.ret,cur:a,prv:b}); }
  const tr=rows.reduce((s,x)=>s+x.rev,0); for(const x of rows) x.share=tr>0?x.rev/tr:null;
  return rows;
}
function dimName(code,dim,k){ const c=C[code], m=c.meta;
  if(dim==='pt') return m.points[k]; if(dim==='ch') return m.channels[k]; if(dim==='emp') return m.emps[k];
  if(dim==='cat') return m.cats[k]?m.cats[k][0]:'?'; if(dim==='p') return c.products[k]?c.products[k][0]:'?';
  if(dim==='cl') return k<0?'Розничные / без клиента':(c.clients[k]?c.clients[k][0]:'?');
  if(dim==='k') return KINDS[k]; return String(k); }
function dimsAvail(code){ const m=C[code].meta; return ['pt','ch','cat','p','emp','cl'].filter(d=>d==='pt'?m.points.length>1:d==='ch'?m.channels.filter((x,i)=>i!==m.intCh||S.inc).length>1:true); }

// ================= WORKING DAYS / FORECAST =================
let LIVE=false; // последний день данных ещё идёт (выгрузка в тот же день)
const TODAY=()=>LIVE?T:'';
const staleMo=code=>TC(code).slice(0,7)<T.slice(0,7); // по компании нет данных за текущий месяц
const isWork=(code,s)=>!C[code].off.includes(wdOf(s));
function forecast(code,f){
  const T=TC(code);
  const ms=mStart(T), me=mEnd(T);
  let wdLeft=0,wdTotal=0,wdDone=0; for(let s=ms;s<=me;s=addD(s,1)){ if(!isWork(code,s)) continue; wdTotal++; if(s<T) wdDone++; else wdLeft++; }
  const fact=tot(code,ms,T,f).rev, factY=T>ms?tot(code,ms,addD(T,-1),f).rev:0;
  const dm=scan(code,addD(T,-45),addD(T,-1),f,'day').map; const c=C[code];
  const days=[]; for(let s=addD(T,-1);days.length<14&&s>=c.meta.dataStart&&s>=addD(T,-45);s=addD(s,-1)) if(isWork(code,s)) days.push(s);
  const rr=days.length?days.reduce((a,s)=>a+((dm.get(dIdx(c,s))||Z).rev),0)/days.length:0;
  const fc=factY+rr*wdLeft;
  return {fact,factY,rr,fc,wdLeft,wdTotal,wdDone,rrDays:days.length};
}
function planOf(code,mo){
  const m=C[code].meta; if(m.plan&&m.plan[mo]) return {v:m.plan[mo],auto:false};
  const full=[]; for(let x=prevMo(mo);full.length<3&&x>=m.dataStart.slice(0,7);x=prevMo(x)) if(x+'-01'>=m.dataStart) full.push(x);
  if(!full.length) return null;
  const S0=S.inc; S.inc=false; const avg=full.reduce((s,x)=>s+tot(code,x+'-01',mEnd(x+'-01'),{}).rev,0)/full.length; S.inc=S0;
  return {v:Math.round(avg*1.05/1e5)*1e5,auto:true,base:full};
}

// План/факт для выбранного месяца: закрытый месяц — итог, текущий — прогноз
function planFact(code,f={}){
  const T=TC(code);
  const mo=S.per.startsWith('m:')?S.per.slice(2):T.slice(0,7); const closed=mo<T.slice(0,7);
  const pl=Object.keys(f).length?null:planOf(code,mo);
  if(closed){ const fact=tot(code,mo+'-01',mEnd(mo+'-01'),f).rev; return {mo,closed,pl,fact,factY:fact,fc:fact,rr:null,wdLeft:0,wdTotal:0}; }
  return {mo,closed,pl,...forecast(code,f)};
}
// ================= STOCK MODEL (компания целиком, скорость — последние 28 дней, без внутренних) =================
const _SM={};
function SM(code){
  const T=TC(code);
  if(_SM[code]) return _SM[code];
  const c=C[code], m=c.meta, P=c.products.length;
  const q28=new Float64Array(P), r28=new Float64Array(P), c28=new Float64Array(P), q56=new Float64Array(P), r56=new Float64Array(P), last=new Int32Array(P).fill(-1);
  const a28=dIdx(c,addD(T,-27)), a56=dIdx(c,addD(T,-55));
  for(let l=0;l<c.ldi.length;l++){ const i=c.ldi[l]; if(c.ch[i]===m.intCh) continue; const p=c.lp[l], d=c.d[i];
    if(d>=a28){ q28[p]+=c.lq[l]; r28[p]+=c.lrev[l]; c28[p]+=c.lcost[l]; } else if(d>=a56){ q56[p]+=c.lq[l]; r56[p]+=c.lrev[l]; }
    if(c.lq[l]>0&&d>last[p]) last[p]=d; }
  const hist=Math.min(28,daysBetween(m.lineFrom,T)+1), win=daysBetween(m.lineFrom,T)+1;
  const deadLim=Math.min(TH.deadDays,win);
  const stock=new Map(); for(const r of c.stockRaw) stock.set(r[0],r);
  const items=[]; const seen=new Set();
  const mk=p=>{ const s=stock.get(p); const qty=s?s[1]:0, uc=s?s[2]:0, sp=s?s[3]:0; const q=Math.max(0,qty);
    const perDay=q28[p]/hist; const cover=perDay>0?q/perDay:(q>0?Infinity:0);
    const lastDay=last[p]>=0?c.dayStr[last[p]]:null; const idle=lastDay?daysBetween(lastDay,T):Infinity;
    const val=q*uc; let flag=null;
    if(q>0&&q28[p]<=0&&idle>=deadLim) flag='dead';
    else if(q28[p]>0&&cover<TH.coverLow) flag='def';
    else if(q28[p]>0&&cover>TH.coverHigh) flag='excess';
    else if(q>0&&q28[p]<=0) flag='slow';
    const excessVal=perDay>0&&cover>TH.excessKeep?(q-perDay*TH.excessKeep)*uc:0;
    return {p,n:c.products[p][0],code:c.products[p][1],cat:c.pcat[p],qty,uc,sp,val,q28:q28[p],rev28:r28[p],gp28:r28[p]-c28[p],q56:q56[p],rev56:r56[p],perDay,cover,lastDay,idle,flag,excessVal,st:s?s[4]:[]}; };
  for(const r of c.stockRaw){ items.push(mk(r[0])); seen.add(r[0]); }
  for(let p=0;p<P;p++) if(!seen.has(p)&&(q28[p]||r28[p])) items.push(mk(p));
  const sorted=items.filter(x=>x.rev28>0).sort((a,b)=>b.rev28-a.rev28); const tr=sorted.reduce((s,x)=>s+x.rev28,0); let acc=0; for(const x of sorted){ acc+=x.rev28; x.abc=acc/tr<=.8?'A':acc/tr<=.95?'B':'C'; }
  const byP=new Map(items.map(x=>[x.p,x]));
  return _SM[code]={items,byP,hist,win,deadLim};
}
function stockSum(code,f={}){
  const sm=SM(code); let val=0,dead=0,excess=0,cogs=0,def=0,defA=0,sku=0,deadN=0,excN=0;
  for(const x of sm.items){ if(f.cat!=null&&x.cat!==f.cat) continue; if(f.p!=null&&x.p!==f.p) continue;
    val+=x.val; cogs+=x.rev28-x.gp28; if(x.qty>0) sku++;
    if(x.flag==='dead'){ dead+=x.val; deadN++; } excess+=x.excessVal; if(x.excessVal>0) excN++;
    if(x.flag==='def'){ def++; if(x.abc==='A') defA++; } }
  return {val,dead,excess,deadN,excN,def,defA,sku,turn:cogs>0?val/(cogs/sm.hist):null};
}

// ================= CLIENT STATS (вся история документов) =================
const _CS={};
function CS(code){
  const T=TC(code);
  if(_CS[code]) return _CS[code];
  const c=C[code], m=c.meta, N=c.clients.length;
  const st=Array.from({length:N},(_,i)=>({i,n:c.clients[i][0],debt:c.clients[i][1],adv:c.clients[i][2],first:null,last:null,dall:0,all:0,r90:0,g90:0,emp:new Map(),pts:new Map(),months:new Map()}));
  const a90=dIdx(c,addD(T,-89));
  for(let i=0;i<c.n;i++){ const k=c.cl[i]; if(k<0||c.ch[i]===m.intCh) continue; const x=st[k]; const s=c.dayStr[c.d[i]];
    x.all+=c.rev[i]; if(c.k[i]<2){ x.dall++; if(!x.first) x.first=s; x.last=s; }
    if(c.d[i]>=a90){ x.r90+=c.rev[i]; x.g90+=c.rev[i]-c.cost[i]; }
    x.emp.set(c.emp[i],(x.emp.get(c.emp[i])||0)+c.rev[i]); x.pts.set(c.pt[i],(x.pts.get(c.pt[i])||0)+c.rev[i]);
    const mo=s.slice(0,7); x.months.set(mo,(x.months.get(mo)||0)+c.rev[i]); }
  for(const x of st){ let be=-1,bv=-Infinity; for(const [e,v] of x.emp) if(v>bv){bv=v;be=e;} x.mainEmp=be;
    x.idle=x.last?daysBetween(x.last,T):null;
    // средний интервал между покупками
    x.gapAvg=x.dall>1&&x.first?daysBetween(x.first,x.last)/(x.dall-1):null;
    x.sleep=x.dall>=3&&x.idle!=null&&x.idle>Math.max(21,(x.gapAvg||0)*2)&&x.idle<=150;
    x.debtor=x.debt>0; }
  return _CS[code]=st;
}

// ================= DECOMPOSITION: клиенты × покупок на клиента × средний чек =================
function decomp(a,b){
  if(!a||!b||!b.rev||a.rev<=0||!a.docs||!b.docs) return null;
  const L=(x,y)=>x>0&&y>0?Math.log(x/y):0; const f=[];
  const useCl=(a.ncl+b.ncl)>0&&(a.anon+b.anon)<(a.docs+b.docs)*0.5;
  if(useCl){ const fa=(a.docs-a.anon)/Math.max(1,a.ncl), fb=(b.docs-b.anon)/Math.max(1,b.ncl);
    f.push({k:'Клиенты',a:a.ncl,b:b.ncl,e:L(a.ncl,b.ncl),fmt:num,why:['меньше клиентов','больше клиентов']});
    f.push({k:'Покупок на клиента',a:fa,b:fb,e:L(fa,fb),fmt:v=>num(v,1),why:['реже покупают','чаще покупают']}); }
  else f.push({k:'Чеки / документы',a:a.docs,b:b.docs,e:L(a.docs,b.docs),fmt:num,why:['меньше чеков','больше чеков']});
  f.push({k:'Средний чек',a:a.avg,b:b.avg,e:L(a.avg,b.avg),fmt:money,why:['ниже средний чек','выше средний чек']});
  const totE=L(a.rev,b.rev); const main=[...f].sort((x,y)=>Math.abs(y.e)-Math.abs(x.e));
  const parts=main.filter(x=>Math.abs(x.e)>0.03&&Math.sign(x.e)===Math.sign(totE)).map(x=>x.why[x.e<0?0:1]);
  return {f,totE,useCl,text:parts.length?parts.join(' и '):'структура без существенных изменений'};
}

// ================= WHY ENGINE: иерархический поиск причины =================
const ORDER=['pt','ch','cat','emp','p'];
function whyChain(code,r,f,depth=3){
  const chain=[]; let ff={...f};
  const base=tot(code,r.from,r.to,ff), prv=tot(code,r.pf,r.pt,ff); let dTot=base.rev-prv.rev;
  if(!hasCmp(code,r)||!prv.rev||Math.abs(dTot)<Math.max(prv.rev*0.02,1e4)) return {chain,dTot,base,prv};
  const lineOk=dIdx(C[code],r.pf)>=C[code].lineFromD;
  for(let step=0;step<depth;step++){
    let best=null;
    for(const dim of ORDER){
      if(ff[dim]!=null) continue; if(!dimsAvail(code).includes(dim)) continue;
      if((dim==='cat'||dim==='p')&&!lineOk) continue;
      if(dim==='p'&&ff.cat==null) continue;
      const rows=compare(code,r,ff,dim).filter(x=>x.d!=null&&Math.sign(x.d)===Math.sign(dTot));
      if(rows.length<1) continue; const top=rows.sort((a,b)=>Math.abs(b.d)-Math.abs(a.d))[0];
      const share=top.d/dTot; const nrows=compare(code,r,ff,dim).length; if(nrows<2) continue;
      const score=share*(dim==='pt'?1.15:dim==='ch'?1.1:dim==='cat'?1.05:1);
      if(share>=0.3&&(!best||score>best.score)) best={dim,row:top,share,score};
    }
    if(!best) break;
    chain.push({...best,f:{...ff}});
    ff={...ff,[best.dim]:best.row.key}; dTot=best.row.d;
    if(best.dim==='p') break;
  }
  return {chain,dTot:base.rev-prv.rev,base,prv};
}
// маржа: какой элемент сильнее всего потянул маржу
function marginDriver(code,r,f){
  const c=C[code]; if(!hasCmp(code,r)) return null;
  const a=tot(code,r.from,r.to,f), b=tot(code,r.pf,r.pt,f); if(a.m==null||b.m==null) return null;
  const dm=a.m-b.m; if(Math.abs(dm)<0.01) return {dm,a,b};
  const dims=['cat','pt','ch','emp'].filter(d=>f[d]==null&&dimsAvail(code).includes(d)&&!((d==='cat')&&dIdx(c,r.pf)<c.lineFromD));
  let best=null;
  for(const dim of dims){ for(const x of compare(code,r,f,dim)){ if(x.rev<=0) continue;
    // эффект ставки (маржа внутри элемента) + эффект структуры (доля элемента с маржой отличной от средней)
    const rate=x.mPrev!=null?(x.rev/a.rev)*(x.m-x.mPrev):0;
    const mix=x.prev!=null&&b.rev?((x.rev/a.rev)-(x.prev/b.rev))*((x.mPrev??x.m)-b.m):0;
    const e=rate+mix; if(Math.sign(e)!==Math.sign(dm)) continue;
    if(!best||Math.abs(e)>Math.abs(best.e)) best={dim,row:x,e,rate,mix}; } }
  return {dm,a,b,best};
}

// ================= SIGNALS (риски и возможности) =================
function signals(code,f={}){
  const c=C[code], m=c.meta, out=[], r=rng(S.per,S.cmp,code);
  const noF=!Object.keys(f).length;
  if(noF&&!(staleMo(code)&&!S.per.startsWith('m:'))){ const q=planFact(code,{}), pl=q.pl;
    if(pl){ const p=q.fc/pl.v; const sev=p>=1?'g':p>=.9?'y':'r'; const mn=MON[+q.mo.slice(5)-1];
      out.push({sev,opp:p>=1.05,area:'План',title:q.closed?`${CO(code).short}: ${mn} закрыт на ${pct(p,0)} плана`:`${CO(code).short}: прогноз ${pct(p,0)} плана`,text:q.closed?`Факт ${money(q.fact)} при плане ${money(pl.v)}${pl.auto?' (автоплан)':''}: ${q.fact>=pl.v?'перевыполнение на '+money(q.fact-pl.v):'не хватило '+money(pl.v-q.fact)}.`:`Факт ${money(q.fact)} из ${money(pl.v)}${pl.auto?' (автоплан)':''}. Прогноз ${money(q.fc)}. ${p<1&&q.wdLeft?`Нужно ${money(Math.max(0,pl.v-q.factY)/q.wdLeft)} в рабочий день при темпе ${money(q.rr)}.`:''}`,go:{co:code,view:'overview',f:{},path:[]}}); } }
  if(hasCmp(code,r)){
    const w=whyChain(code,r,f,3); const a=w.base, b=w.prv;
    if(b.rev){ const v=a.rev/b.rev-1;
      if(v<TH.drop&&w.chain.length){ const last=w.chain[w.chain.length-1]; const path=[],ff={...f}; for(const s of w.chain){ ff[s.dim]=s.row.key; path.push(s.dim); }
        out.push({sev:v<-.25?'r':'y',area:'Выручка',title:`${CO(code).short}: выручка ${spct(v)} к ${r.cl}`,text:'Главный вклад: '+w.chain.map(s=>`${DIMS[s.dim].toLowerCase()} «${s.row.name}» ${smoney(s.row.d)}`).join(' → ')+'.',go:{co:code,view:'overview',f:ff,path:[...Object.keys(f),...path]}}); }
      else if(v>.15&&w.chain.length){ const s=w.chain[0]; out.push({sev:'g',opp:true,area:'Рост',title:`${CO(code).short}: выручка ${spct(v)}`,text:`Рост даёт ${DIMS[s.dim].toLowerCase()} «${s.row.name}» ${smoney(s.row.d)}.`,go:{co:code,view:'overview',f:{...f,[s.dim]:s.row.key},path:[...Object.keys(f),s.dim]}}); } }
    const md=marginDriver(code,r,f);
    if(md&&md.dm<-.015&&md.best){ const x=md.best.row;
      out.push({sev:md.dm<-.03?'r':'y',area:'Маржа',title:`${CO(code).short}: маржа ${pp(md.dm)}${a.rev>b.rev?' при росте оборота':''}`,text:`${pct(md.a.m)} против ${pct(md.b.m)}. Сильнее всего тянет ${DIMS[md.best.dim].toLowerCase()} «${x.name}»: маржа ${pct(x.mPrev)} → ${pct(x.m)}${x.prev?`, доля ${pct(x.prev/b.rev,0)} → ${pct(x.rev/a.rev,0)}`:''}.`,go:{co:code,view:'overview',f:{...f,[md.best.dim]:x.key},path:[...Object.keys(f),md.best.dim]}}); }
  }
  const ss=stockSum(code,f), sm=SM(code); const stockOk=f.pt==null&&f.ch==null&&f.emp==null&&f.cl==null;
  if(stockOk&&ss.defA) { const top=sm.items.filter(x=>x.flag==='def'&&x.abc==='A'&&(f.cat==null||x.cat===f.cat)).sort((a,b)=>b.rev28-a.rev28).slice(0,3);
    out.push({sev:'r',area:'Дефицит',title:`${CO(code).short}: ${ss.defA} ходовых SKU (группа A) закончатся < ${TH.coverLow} дн.`,text:top.map(x=>`${x.n} — ${x.qty<=0?'нет в наличии':'через '+Math.round(x.cover)+' дн.'}`).join('; ')+'.',go:{co:code,view:'stock',f:{...f},path:[...Object.keys(f)],seg:'def'}}); }
  if(stockOk&&ss.val>0&&ss.excess/ss.val>.3) out.push({sev:ss.excess/ss.val>.5?'r':'y',area:'Избыток',title:`${CO(code).short}: ${money(ss.excess)} — запас сверх ${TH.excessKeep} дн. продаж`,text:`${pct(ss.excess/ss.val,0)} стоимости склада (${money(ss.val)}). Оборачиваемость ${ss.turn?Math.round(ss.turn)+' дн.':'—'}. По этим позициям закупку остановить.`,go:{co:code,view:'stock',f:{...f},path:[...Object.keys(f)],seg:'excess'}});
  if(stockOk&&ss.dead>0) out.push({sev:ss.dead/ss.val>.15?'r':'y',area:'Неликвид',title:`${CO(code).short}: неликвид ${money(ss.dead)}`,text:`${ss.deadN} SKU без продаж ${sm.deadLim}+ дн. — ${pct(ss.dead/ss.val,0)} склада.`,go:{co:code,view:'stock',f:{...f},path:[...Object.keys(f)],seg:'dead'}});
  if(noF||f.emp!=null||f.pt!=null){ const cs=CS(code).filter(x=>(f.emp==null||x.mainEmp===f.emp));
    const debt=cs.filter(x=>x.debt>0), old=debt.filter(x=>x.idle==null||x.idle>60); const dsum=debt.reduce((s,x)=>s+x.debt,0), osum=old.reduce((s,x)=>s+x.debt,0);
    if(dsum>0&&f.pt==null){ const top=[...debt].sort((a,b)=>b.debt-a.debt)[0];
      out.push({sev:osum>1e7?'r':'y',area:'Дебиторка',title:`${CO(code).short}: клиенты должны ${money(dsum)}`,text:`${osum?`${money(osum)} — у ${old.length} клиентов без отгрузок 60+ дн. `:''}Крупнейший: ${top.n} — ${money(top.debt)}${top.idle!=null?`, последняя отгрузка ${top.idle} дн. назад`:''}.`,go:{co:code,view:'clients',f:{...f},path:[...Object.keys(f)],seg:'debt'}}); }
    const sl=cs.filter(x=>x.sleep); if(sl.length&&f.pt==null) out.push({sev:'y',opp:true,area:'Клиенты',title:`${CO(code).short}: ${sl.length} постоянных клиентов «уснули»`,text:`Покупали регулярно (3+ раз, всего ${money(sl.reduce((s,x)=>s+x.all,0))}), но пауза уже вдвое дольше обычной. Обзвон — быстрый способ вернуть выручку.`,go:{co:code,view:'clients',f:{...f},path:[...Object.keys(f)],seg:'sleep'}}); }
  const order={r:0,y:1,g:2}; out.sort((x,y)=>(x.opp?1:0)-(y.opp?1:0)||order[x.sev]-order[y.sev]);
  return out;
}
// ================= ACTIONS REGISTRY =================
let ACTS=[];
const act=o=>'data-a="'+(ACTS.push(o)-1)+'"';
function snapshot(){ return JSON.stringify({co:S.co,view:S.view,f:S.f,path:S.path,per:S.per,cmp:S.cmp,seg:S.seg,op:S.op}); }
function nav(patch,push=true){
  if(!ME.group&&('co' in patch)&&!patch.co) patch={...patch,co:codes()[0],view:'overview',f:{},path:[]};
  if(push) HIST.push(snapshot());
  Object.assign(S,patch); if(patch.seg&&typeof patch.seg==='string'){ S.seg={...S.seg,[S.view]:patch.seg}; }
  render(); window.scrollTo({top:0});
}
function back(){ if(!HIST.length) return; const s=JSON.parse(HIST.pop()); Object.assign(S,s); syncCtl(); render(); }
function up(){ // на уровень выше
  if(!S.co) return;
  if(S.view!=='overview') return nav({view:'overview'});
  if(S.path.length){ const path=S.path.slice(0,-1); const f={}; for(const d of path) f[d]=S.f[d]; return nav({f,path}); }
  if(ME.group) nav({co:null,view:'overview',f:{},path:[]});
}
function drill(dim,key,view='overview'){
  const f={...S.f,[dim]:key}; const path=S.path.filter(d=>d!==dim).concat(dim);
  nav({f,path,view});
}
function runAct(a){
  if(a.go){ const g={...a.go}; const seg=g.seg; delete g.seg; if(seg) g.seg={...S.seg,[g.view]:seg}; nav(g); }
  else if(a.drill) drill(a.drill[0],a.drill[1],a.drill[2]);
  else if(a.view){ const p={view:a.view}; if(a.seg) p.seg={...S.seg,[a.view]:a.seg}; if(a.sort) S.sort[a.view]=a.sort; nav(p); }
  else if(a.co!==undefined) nav({co:a.co,view:'overview',f:{},path:[]});
  else if(a.per){ HIST.push(snapshot()); S.per=a.per; syncCtl(); render(); }
  else if(a.op) openOp(a.op[0],a.op[1]);
  else if(a.crumb!=null){ const path=S.path.slice(0,a.crumb); const f={}; for(const d of path) f[d]=S.f[d]; nav({f,path,view:'overview'}); }
  else if(a.rm){ const path=S.path.filter(d=>d!==a.rm); const f={...S.f}; delete f[a.rm]; nav({f,path}); }
  else if(a.fn) a.fn();
}

// ================= SMALL COMPONENTS =================
function kpi(k,v,d,s,a,help){ const tag=a!=null?'button':'div';
  return `<${tag} class="kpi ${s||''}" ${a!=null?act(a):''} ${help?`title="${esc(help)}"`:''}><div class="k"><span>${k}</span></div><div class="v">${v}</div><div class="d">${d||'&nbsp;'}</div>${a!=null?'<span class="go">→</span>':''}</${tag}>`; }
const pill=(s,t)=>`<span class="pill ${s}">${t}</span>`;
function sec(t,p,more){ return `<div class="sec"><h2>${t}</h2>${p?`<p>${p}</p>`:''}${more?`<button class="more" ${act(more[1])}>${more[0]} →</button>`:''}</div>`; }
const lim=t=>`<div class="lim"><b>Ограничение данных.</b> ${t}</div>`;
const light=(v,g,y)=>v==null||!isFinite(v)?'n':v>=g?'g':v>=y?'y':'r';

// generic sortable table
const TABREG={};
function table(id,cols,rows,opts={}){
  const st=S.sort[id]||opts.sort||{k:(cols.find(c=>c.n)||cols[0]).k,d:-1};
  const sorted=[...rows].sort((a,b)=>{ const x=a[st.k],y=b[st.k]; const bx=x==null||(typeof x==='number'&&!isFinite(x)), by=y==null||(typeof y==='number'&&!isFinite(y)); if(bx&&by) return 0; if(bx) return 1; if(by) return -1; return (x>y?1:x<y?-1:0)*st.d; });
  const cap=S.more[id]?5000:(opts.max||60); const shown=sorted.slice(0,cap); TABREG[id]={rows:shown,click:opts.click};
  const bars={}; cols.filter(c=>c.bar).forEach(c=>bars[c.k]=Math.max(1,...rows.map(r=>Math.abs(r[c.k]||0))));
  const head=`<thead><tr>${cols.map(c=>`<th class="${c.n?'':'l'}" data-sort="${id}|${c.k}" scope="col" ${c.t?`title="${esc(c.t)}"`:''}>${c.l}${st.k===c.k?(st.d<0?' ↓':' ↑'):''}</th>`).join('')}</tr></thead>`;
  const body=shown.map((r,i)=>`<tr class="${opts.click?'click':''}" data-t="${id}" data-i="${i}" ${opts.click?'tabindex="0"':''}>${cols.map(c=>{ const v=r[c.k]; let out=c.f?c.f(v,r):esc(v??'—');
      if(c.bar) out+=` <span class="sbar" style="width:${Math.round(40*Math.abs(v||0)/bars[c.k])}px"></span>`;
      return `<td class="${c.n?'n':'l'}">${out}</td>`; }).join('')}</tr>`).join('');
  const foot=opts.total?`<tr class="tot">${cols.map((c,j)=>`<td class="${c.n?'n':'l'}">${opts.total[c.k]!=null?(c.f?c.f(opts.total[c.k],opts.total):esc(opts.total[c.k])):''}</td>`).join('')}</tr>`:'';
  return `<div class="tw"><table>${head}<tbody>${body||`<tr><td colspan="${cols.length}" class="l note">Нет данных за выбранный период</td></tr>`}${foot}</tbody></table></div>${sorted.length>shown.length?`<p class="note">Показано ${shown.length} из ${sorted.length}. <button class="more" data-more="${id}">Показать все</button></p>`:''}`;
}
// ячейки
const cM=v=>money(v), cN=v=>num(v), cP=v=>pct(v);
const cDelta=(v,r)=>r.prev==null?'<span class="fl">—</span>':`${dl(r.rev,r.prev)}<span class="sm">${smoney(r.rev-r.prev)}</span>`;
const cMarg=(v,r)=>`${pct(r.m)}<span class="sm">${r.mPrev!=null&&r.m!=null?pp(r.m-r.mPrev):''}</span>`;
function cContrib(maxAbs){ return (v,r)=>{ if(r.d==null) return '—'; const w=Math.round(46*Math.abs(r.d)/Math.max(1,maxAbs)); return `<span class="num ${r.d<0?'dn':'up'}">${smoney(r.d)}</span> <span class="cbar ${r.d<0?'neg':'pos'}" style="width:${w}px"></span>`; }; }

// ================= CHARTS =================
function niceMax(v){ if(v<=0) return 1; const st=v/4; const p=10**Math.floor(Math.log10(st)); const n=st/p; return 4*(n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p; }
function yAxis(max,W,H,pl,pt){ let s=''; for(let i=0;i<=4;i++){ const v=max*i/4, y=pt+H-H*i/4; s+=`<line x1="${pl}" x2="${W-4}" y1="${y}" y2="${y}" stroke="var(--grid)"/><text x="${pl-6}" y="${y+3}" text-anchor="end">${short(v)}</text>`; } return s; }
// дневной график: столбцы текущего периода + линия сравнения (со сдвигом)
function dayChart(code,r,f,W=760){
  const T=TC(code);
  const c=C[code]; const days=[]; for(let s=r.from;s<=r.to&&s<=T;s=addD(s,1)) days.push(s);
  if(days.length>100||!days.length) return '<p class="note">Дневной график доступен для периодов до 3 месяцев.</p>';
  const cur=scan(code,r.from,r.to,f,'day').map, okP=hasCmp(code,r), prv=okP?scan(code,r.pf,r.pt,f,'day').map:new Map();
  const off=daysBetween(r.pf,r.from);
  const H=170,pl=62,pt=8,pb=22; const vals=days.map(s=>(cur.get(dIdx(c,s))||Z).rev), pv=days.map(s=>{ const ps=addD(s,-off); return ps<=r.pt?((prv.get(dIdx(c,ps))||Z).rev):null; });
  const max=niceMax(Math.max(1,...vals,...pv.filter(x=>x!=null))*1.05); const n=days.length, bw=Math.max(3,(W-pl-8)/n-3), x=i=>pl+(W-pl-8)*i/n+1.5, y=v=>pt+H-H*Math.max(0,v)/max;
  let s=`<svg viewBox="0 0 ${W} ${H+pt+pb}" role="img" aria-label="Выручка по дням">${yAxis(max,W,H,pl,pt)}`;
  days.forEach((d,i)=>{ const v=vals[i]; const h=Math.max(0,H*Math.max(0,v)/max); const offd=!isWork(code,d);
    s+=`<rect x="${x(i).toFixed(1)}" y="${(pt+H-h).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5,h).toFixed(1)}" rx="1.5" fill="${offd?'var(--c-prev)':'var(--brand)'}" ${d===T?'opacity=".5"':''}/>`;
    if(n<=35?(i%Math.ceil(n/12)===0):(i%7===0)) s+=`<text x="${(x(i)+bw/2).toFixed(1)}" y="${pt+H+15}" text-anchor="middle">${+d.slice(8)}</text>`;
    const tip=`<b>${dLab(d)}, ${WD[wdOf(d)]}</b>${d===T?' · день не закончен':''}${offd?' · выходной':''}<br>Выручка: ${money(v)}${pv[i]!=null?`<br>Сравнение (${dLab(addD(d,-off))}): ${money(pv[i])}`:''}`;
    s+=`<rect class="hit" x="${x(i)-1}" y="${pt}" width="${bw+2}" height="${H}" fill="transparent" data-tip="${esc(tip)}" ${act({fn:()=>openDay(code,d,f)})}/>`; });
  if(okP){ const pts=pv.map((v,i)=>v==null?null:`${(x(i)+bw/2).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean); if(pts.length>1) s+=`<polyline points="${pts.join(' ')}" fill="none" stroke="var(--c-plan)" stroke-width="1.5" stroke-dasharray="4 3"/>`; }
  return s+`</svg><div class="legend"><span><i style="background:var(--brand)"></i>Выручка по дням</span>${okP?`<span><i class="ln" style="background:var(--c-plan)"></i>${esc(r.cl)}</span>`:''}<span><i style="background:var(--c-prev)"></i>Выходной</span><span class="note">Клик по дню — операции дня</span></div>`;
}
// помесячный: столбцы выручки + линия маржи; клик — выбрать месяц
function monthChart(series,{stack=null,margin=true,W=760}={}){ // series: [{mo, rev, gp, parts:{key:val}, partial}]
  if(!series.length) return '';
  const H=170,pl=62,pt=10,pb=22,pr=40; const max=niceMax(Math.max(1,...series.map(x=>x.rev))*1.08);
  const n=series.length, bw=Math.min(48,(W-pl-pr)/n*0.62), step=(W-pl-pr)/n, x=i=>pl+step*i+(step-bw)/2, y=v=>pt+H-H*Math.max(0,v)/max;
  let s=`<svg viewBox="0 0 ${W} ${H+pt+pb}" role="img" aria-label="Выручка по месяцам">${yAxis(max,W-pr+4,H,pl,pt)}`;
  series.forEach((m,i)=>{ let base=0;
    if(stack){ for(const st of stack){ const v=m.parts[st.key]||0; if(v<=0) continue; s+=`<rect x="${x(i).toFixed(1)}" y="${y(base+v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(base)-y(base+v)).toFixed(1)}" fill="${st.color}" ${m.partial?'opacity=".55"':''}/>`; base+=v; } }
    else s+=`<rect x="${x(i).toFixed(1)}" y="${y(m.rev).toFixed(1)}" width="${bw.toFixed(1)}" height="${(pt+H-y(m.rev)).toFixed(1)}" rx="2" fill="var(--brand)" ${m.partial?'opacity=".55"':''}/>`;
    s+=`<text x="${(x(i)+bw/2).toFixed(1)}" y="${pt+H+15}" text-anchor="middle">${MONs[+m.mo.slice(5)-1]}${m.mo.slice(5)==='01'||i===0?' '+m.mo.slice(2,4):''}</text>`;
    const tip=`<b>${monName(m.mo)}</b>${m.partial?' · неполный':''}<br>Выручка: ${money(m.rev)}<br>Вал. прибыль: ${money(m.gp)}<br>Маржа: ${pct(m.rev?m.gp/m.rev:null)}`+(stack?'<br>'+stack.map(st=>`${esc(st.label)}: ${money(m.parts[st.key]||0)}`).join('<br>'):'')+'<br><i>Клик — открыть месяц</i>';
    s+=`<rect class="hit" x="${(pl+step*i).toFixed(1)}" y="${pt}" width="${step.toFixed(1)}" height="${H}" fill="transparent" data-tip="${esc(tip)}" ${act({per:'m:'+m.mo})}/>`; });
  if(margin){ const ms=series.map(m=>m.rev>0?m.gp/m.rev:null); const mm=Math.max(.05,...ms.filter(v=>v!=null))*1.15; const ym=v=>pt+H-H*v/mm;
    const pts=ms.map((v,i)=>v==null?null:`${(x(i)+bw/2).toFixed(1)},${ym(v).toFixed(1)}`).filter(Boolean);
    if(pts.length>1) s+=`<polyline points="${pts.join(' ')}" fill="none" stroke="var(--warn)" stroke-width="2"/>`;
    ms.forEach((v,i)=>{ if(v!=null) s+=`<circle cx="${(x(i)+bw/2).toFixed(1)}" cy="${ym(v).toFixed(1)}" r="3" fill="var(--warn)"/>`; });
    s+=`<text x="${W-pr+6}" y="${pt+8}" style="fill:var(--warn)">маржа</text>`; }
  return s+`</svg><div class="legend">${stack?stack.map(st=>`<span><i style="background:${st.color}"></i>${esc(st.label)}</span>`).join(''):'<span><i style="background:var(--brand)"></i>Выручка</span>'}${margin?'<span><i class="ln" style="background:var(--warn)"></i>Маржа</span>':''}<span class="note">Бледный столбец — неполный месяц</span></div>`;
}
function monthSeries(code,f,from){
  const T=TC(code);
  const c=C[code]; const mm=scan(code,from||c.meta.dataStart,T,f,'mo').map; const out=[];
  for(let mo=(from||c.meta.dataStart).slice(0,7);mo<=T.slice(0,7);mo=nextMo(mo)){ const x=mm.get(mo)||Z; out.push({mo,rev:x.rev,gp:x.gp,partial:mo===T.slice(0,7)||mo+'-01'<c.meta.dataStart}); }
  return out;
}

// ================= TOOLTIP =================
document.addEventListener('mouseover',e=>{ const t=e.target.closest('[data-tip]'); const tip=$('#tip'); if(!t){ tip.hidden=true; return; } tip.innerHTML=t.getAttribute('data-tip'); tip.hidden=false; });
document.addEventListener('mousemove',e=>{ const tip=$('#tip'); if(tip.hidden) return; const w=tip.offsetWidth,h=tip.offsetHeight; let x=e.clientX+14,y=e.clientY+14; if(x+w>innerWidth-8) x=e.clientX-w-14; if(y+h>innerHeight-8) y=e.clientY-h-14; tip.style.left=x+'px'; tip.style.top=y+'px'; });
// ================= VIEW HELPERS =================
const TODO={
  'План':s=>'Распределить недостающий объём по менеджерам и точкам',
  'Выручка':s=>'Разобрать падение с ответственным: '+(s.who||'по цепочке причин'),
  'Маржа':s=>'Проверить скидки и цены: '+(s.who||'позиции с падением маржи'),
  'Дефицит':s=>'Дозаказать ходовые позиции до обнуления остатка',
  'Избыток':s=>'Остановить закупку по позициям с запасом > '+TH.excessKeep+' дн., перераспределить товар',
  'Неликвид':s=>'Вывести неликвид: распродажа, комплекты, возврат поставщику',
  'Дебиторка':s=>'Связаться с должниками, начиная с тех, у кого нет отгрузок 60+ дн.',
  'Клиенты':s=>'Обзвонить «уснувших» постоянных клиентов',
  'Рост':s=>'Разобрать, что сработало, и масштабировать'};
function sliceTitle(code){ if(!S.path.length) return CO(code).name; const d=S.path[S.path.length-1]; return dimName(code,d,S.f[d]); }
function sliceSub(code){ return S.path.length?S.path.map(d=>DIMS[d]+': '+dimName(code,d,S.f[d])).join(' · '):'Вся компания'; }
function nextDim(code,f){ return ['pt','ch','cat','emp','p'].find(d=>f[d]==null&&dimsAvail(code).includes(d))||'ops'; }
function limits(code,r,f,{dimsUsed=[]}={}){
  const T=TC(code);
  const c=C[code], m=c.meta, out=[];
  if(T===TODAY()&&r.to>=T&&daysBetween(r.from,T)<3) out.push(`Период включает сегодняшний день (${dLab(T)}), он ещё не закончился: сравнение с полными днями прошлого периода занижает результат. Для итогов выберите «${monName(prevMo(T.slice(0,7)))}».`);
  if(!hasCmp(code,r)) out.push(`Учёт в МойСклад начат ${dLab(m.dataStart)} ${m.dataStart.slice(0,4)}: сравнения с периодом «${r.cl}» нет.`);
  if((needLines(f,null)||dimsUsed.some(d=>d==='cat'||d==='p'))&&(r.from<m.lineFrom||(hasCmp(code,r)&&r.pf<m.lineFrom))) out.push(`Товары и категории выгружены с ${dLab(m.lineFrom)}: за более ранние даты разрез по товарам недоступен${r.pf<m.lineFrom&&r.from>=m.lineFrom?', поэтому сравнение по товарам неполное':''}.`);
  if(r.nodataC) out.push(`Данные ${CO(code).short} выгружены по ${dLab(TC(code))}: за выбранный период их нет. Недостаточно данных — выберите более ранний период или обновите выгрузку.`);
  else if(r.clipped) out.push(`Данные ${CO(code).short} выгружены по ${dLab(TC(code))}: период сокращён до этой даты, сравнение — за то же число дней.`);
  if(f.ch!=null&&code==='access') out.push('В Аксес канал «Опт»/«Розница» определён по типу документа и контрагенту: поле «Канал продаж» в МойСклад заполняется непостоянно.');
  return out;
}

// ================= VERDICT =================
function verdict(code,r,f){
  const T=TC(code);
  const c=C[code]; const a=tot(code,r.from,r.to,f), okP=hasCmp(code,r), b=okP?tot(code,r.pf,r.pt,f):null;
  const lineBad=needLines(f,null)&&(r.pf<c.meta.lineFrom);
  // ЧТО ПРОИЗОШЛО
  const isNew=b&&!lineBad&&a.rev>0&&b.rev<a.rev*0.1;
  let what=`<p>Выручка <b>${money(a.rev)}</b>${isNew?` — новое направление: за ${esc(r.cl)} было всего ${money(b.rev)}`:b&&b.rev&&!lineBad?` — ${dl(a.rev,b.rev)} к ${esc(r.cl)} (${smoney(a.rev-b.rev)})`:''}.</p><p>Валовая прибыль ${money(a.gp)}, маржа ${pct(a.m)}${b&&b.m!=null&&!lineBad?` (${pp(a.m-b.m)})`:''}. ${a.docs} док., средний чек ${money(a.avg)}.</p>`;
  // ПОЧЕМУ
  let why='';
  if(!okP||lineBad) why='<p class="note">Нет сопоставимого периода для сравнения — причины изменения не рассчитываются.</p>';
  else {
    const w=whyChain(code,r,f,3);
    if(!w.chain.length){ const dc=decomp(a,b); why=`<p>${Math.abs(a.rev/b.rev-1)<0.02?'Выручка на уровне сравниваемого периода.':'Изменение распределено равномерно, без одного главного источника.'}</p>${dc?`<p>Структура: ${dc.text}.</p>`:''}`; }
    else {
      const parts=[]; let ff={...f}; const path=[...S.path];
      w.chain.forEach((s,i)=>{ ff={...ff,[s.dim]:s.row.key}; path.push(s.dim);
        const go={co:code,view:'overview',f:{...ff},path:[...path]};
        const lab=`${DIMS[s.dim].toLowerCase()} <button class="lnk" ${act({go})}>${esc(s.row.name)}</button>`;
        let t=i===0?`Основная причина — ${lab}: ${smoney(s.row.d)} (${s.share>1.05?'больше всего изменения: остальные в обратную сторону':pct(s.share,0)+' изменения'})`:`внутри — ${lab}: ${smoney(s.row.d)}`;
        if(s.dim==='emp'||s.dim==='pt'){ const dc=decomp(s.row.cur,s.row.prv); if(dc&&dc.text) t+=` — ${dc.text}`; }
        parts.push(t); });
      why=`<p>${parts.join('; ')}.</p>`;
      if(code==='techno'&&(w.chain[0].dim==='pt'||w.chain[0].dim==='ch')) why+='<p class="note">С августа 2026 Техно оформляет продажи отгрузками вместо касс: перетоки «Касса → Отгрузки» и «Розница → Опт» частично отражают смену учёта, а не спроса.</p>';
    }
    const md=marginDriver(code,r,f);
    if(md&&md.best&&Math.abs(md.dm)>=0.01){ const x=md.best.row; const up=a.rev>b.rev;
      why+=`<p>${up&&md.dm<0?'Оборот растёт, но маржа падает':'Маржа '+(md.dm<0?'снизилась':'выросла')} (${pp(md.dm)}) — сильнее всего ${DIMS[md.best.dim].toLowerCase()} <button class="lnk" ${act({drill:[md.best.dim,x.key]})}>${esc(x.name)}</button>: ${x.mPrev!=null?`маржа ${pct(x.mPrev)} → ${pct(x.m)}`:`маржа ${pct(x.m)}`}${Math.abs(md.best.mix)>Math.abs(md.best.rate)?`, доля продаж ${x.prev!=null&&md.b.rev?pct(x.prev/md.b.rev,0):'0%'} → ${pct(x.rev/md.a.rev,0)}`:''}.</p>`; }
  }
  // ЧТО БУДЕТ
  let will='';
  const noF=!Object.keys(f).length;
  if(f.cl!=null){ /* по клиенту прогноз выручки не строим — только ритм покупок */ }
  else { const q=planFact(code,f), pl=q.pl;
    if(q.closed&&(S.per.startsWith('m:'))){
      will+=`<p>${MON[+q.mo.slice(5)-1][0].toUpperCase()+MON[+q.mo.slice(5)-1].slice(1)} закрыт: <b>${money(q.fact)}</b>${pl?` — ${pct(q.fact/pl.v,0)} плана ${money(pl.v)}${pl.auto?' (автоплан)':''}, ${q.fact>=pl.v?'перевыполнение '+money(q.fact-pl.v):'не хватило '+money(pl.v-q.fact)}`:''}.</p>`;
      const cur=T.slice(0,7); const fc=forecast(code,f); const pc=Object.keys(f).length?null:planOf(code,cur);
      will+=`<p>${MON[+cur.slice(5)-1][0].toUpperCase()+MON[+cur.slice(5)-1].slice(1)}: при темпе последних ${fc.rrDays} раб. дн. (${money(fc.rr)} в день) — прогноз <b>${money(fc.fc)}</b>${pc?` · ${pct(fc.fc/pc.v,0)} ${pc.auto?'автоплана':'плана'} ${money(pc.v)}`:''}.</p>`;
    } else if(r.to>=T){ const fc=q;
      will+=`<p>Прогноз на конец ${MONg[+T.slice(5,7)-1]}: <b>${money(fc.fc)}</b>${pl?` — ${pct(fc.fc/pl.v,0)} плана ${money(pl.v)}${pl.auto?' (автоплан)':''}`:''}.</p>`;
      if(pl&&fc.fc<pl.v&&fc.wdLeft) will+=`<p>Не хватает ${money(pl.v-fc.fc)}: нужно ${money(Math.max(0,pl.v-fc.factY)/fc.wdLeft)} в рабочий день против ${money(fc.rr)} сейчас.</p>`;
      if(!pl&&noF) will+='<p class="note">План не задан.</p>'; if(!noF) will+=`<p class="note">Темп ${money(fc.rr)} в рабочий день, осталось ${fc.wdLeft} раб. дн.</p>`; }
    else will+='<p class="note">Прогноз считается для текущего месяца; выбран закрытый период.</p>'; }
  if(f.pt==null&&f.ch==null&&f.emp==null&&f.cl==null){
    const sm=SM(code); const risk=sm.items.filter(x=>x.flag==='def'&&(x.abc==='A'||x.abc==='B')&&(f.cat==null||x.cat===f.cat)&&(f.p==null||x.p===f.p)).sort((x,y)=>y.rev28-x.rev28).slice(0,f.p!=null?1:3);
    if(f.p!=null&&!risk.length){ const x=sm.byP.get(f.p); if(x&&x.perDay>0) will+=`<p>При текущем темпе (${num(x.perDay,1)} шт/день) остатка ${num(x.qty)} шт хватит на ${isFinite(x.cover)?Math.round(x.cover)+' дн':'—'}.</p>`; }
    if(risk.length) will+='<ul>'+risk.map(x=>`<li><button class="lnk" ${act({drill:['p',x.p]})}>${esc(x.n)}</button> ${x.qty<=0?'— уже нет в наличии':`закончится через ${Math.max(1,Math.round(x.cover))} дн.`} при темпе ${num(x.perDay,1)} шт/день</li>`).join('')+'</ul>';
  }
  if(f.cl!=null){ const x=CS(code)[f.cl]; if(x&&x.gapAvg) will+=`<p>Обычно покупает раз в ${Math.round(x.gapAvg)} дн.; ${x.idle>x.gapAvg*1.5?`пауза уже ${x.idle} дн. — клиент может уйти`:'следующая покупка ожидается в ближайшие '+Math.max(1,Math.round(x.gapAvg-x.idle))+' дн.'}.</p>`; }
  // ЧТО ДЕЛАТЬ
  const sig=signals(code,f).filter(s=>s.area!=='План'||s.sev!=='g').slice(0,4);
  const acts=sig.map(s=>{ const who=s.area==='Выручка'||s.area==='Маржа'?(s.go.path.length?dimName(code,s.go.path[s.go.path.length-1],s.go.f[s.go.path[s.go.path.length-1]]):''):'';
    return `<li><button class="act" ${act({go:s.go})}>${pill(s.opp?'g':s.sev,s.area)}<span>${esc((TODO[s.area]||(()=>s.title))({...s,who}))}</span></button></li>`; });
  if(f.cl!=null){ const x=CS(code)[f.cl]; if(x){ if(x.debt>0) acts.unshift(`<li><div class="act">${pill('r','Долг')}<span>Связаться с клиентом: долг ${money(x.debt)}${x.idle!=null?`, последняя отгрузка ${x.idle} дн. назад`:''}</span></div></li>`); else if(x.sleep) acts.unshift(`<li><div class="act">${pill('y','Клиент')}<span>Позвонить клиенту: пауза ${x.idle} дн. при обычных ${Math.round(x.gapAvg)} дн.</span></div></li>`); } }
  const doH=acts.length?`<ul>${acts.join('')}</ul>`:'<p class="note">Критичных отклонений нет.</p>';
  return `<section class="verdict" aria-label="Выводы"><div><h4><i>1</i>Что произошло</h4>${what}</div><div><h4><i>2</i>Почему</h4>${why}</div><div><h4><i>3</i>Что будет</h4>${will}</div><div><h4><i>4</i>Что делать</h4>${doH}</div></section>`;
}

// ================= COMPANY / SLICE OVERVIEW =================
function viewOverview(code){
  const T=TC(code);
  const c=C[code], m=c.meta, r=rng(), f=S.f; const a=tot(code,r.from,r.to,f), okP=hasCmp(code,r), b=okP?tot(code,r.pf,r.pt,f):null;
  const lineBad=needLines(f,null)&&r.pf<m.lineFrom; const B=lineBad?null:b;
  let h=limits(code,r,f).map(lim).join('');
  if(r.nodataC){ h+=`<div class="empty"><b class="nd">Недостаточно данных.</b> По ${esc(CO(code).name)} есть данные только по ${dLab(TC(code))} — выберите в периоде закрытый месяц (например, «${monName(TC(code).slice(0,7))}») или обновите выгрузку.</div>`; h+=sec('Динамика по месяцам','вся история в МойСклад · клик по месяцу — выбрать период'); h+=`<div class="panel">${monthChart(monthSeries(code,f,null),{W:1200})}</div>`; return h; }
  if(needLines(f,null)&&r.from<m.lineFrom){ h+=`<div class="empty">Для этого среза нужны позиции документов, а они есть только с ${dLab(m.lineFrom)}. Выберите период позже.</div>`; return h; }
  h+=verdict(code,r,f);
  const nd=nextDim(code,f); const onlyCo=f.pt==null&&f.ch==null&&f.emp==null&&f.cl==null;
  const ss=onlyCo?stockSum(code,f):null;
  const debt=(f.pt==null&&f.ch==null&&f.cat==null&&f.p==null)?CS(code).filter(x=>(f.emp==null||x.mainEmp===f.emp)&&(f.cl==null||x.i===f.cl)).reduce((s,x)=>s+x.debt,0):null;
  h+=`<div class="kpis">
    ${kpi('Выручка',money(a.rev),B?dl(a.rev,B.rev)+' '+smoney(a.rev-B.rev):esc(r.label),'',{view:nd==='ops'?'ops':nd},'Выручка без внутренних продаж, за вычетом возвратов')}
    ${kpi('Валовая прибыль',money(a.gp),B?dl(a.gp,B.gp):'','',{view:f.p!=null?'ops':f.cat!=null?'p':'cat',sort:{k:'gp',d:-1}})}
    ${kpi('Маржа',pct(a.m),B?dl(a.m,B.m,{ppm:true}):'',light(a.m,.25,.2),{view:f.p!=null?'ops':f.cat!=null?'p':'cat',sort:{k:'m',d:1}})}
    ${kpi('Документы',num(a.docs),B?dl(a.docs,B.docs):'','',{view:f.emp!=null?'ops':'emp',sort:{k:'docs',d:-1}})}
    ${kpi('Средний чек',money(a.avg),B?dl(a.avg,B.avg):'','',{view:f.emp!=null?'ops':'emp',sort:{k:'avg',d:-1}})}
    ${f.cl==null?kpi('Клиенты',num(a.ncl),(B?dl(a.ncl,B.ncl)+' ':'')+(a.anon?`+${num(a.anon)} розн. чеков`:''),'',{view:'clients'},'Уникальные именованные клиенты; розничные чеки без клиента — отдельно'):''}
    ${ss?kpi('Склад',money(ss.val),`оборачиваемость ${ss.turn?Math.round(ss.turn)+' дн.':'—'}`,ss.turn>180?'r':ss.turn>90?'y':'g',{view:'stock'}):''}
    ${ss&&f.p==null?kpi('Неликвид + избыток',money(ss.dead+ss.excess),`неликвид ${money(ss.dead)}`,ss.val&&(ss.dead+ss.excess)/ss.val>.4?'r':'y',{view:'stock',seg:'excess'}):''}
    ${debt!=null?kpi('Дебиторка',money(debt),f.emp!=null?'клиенты менеджера':'по отчёту контрагентов',debt>0?'y':'g',{view:'clients',seg:'debt'}):''}
  </div>`;
  h+=cmpStrip(code,f);
  // Разделы по типу среза
  if(f.p!=null) h+=productPanel(code,f.p);
  if(f.emp!=null) h+=managerPanel(code,r,f);
  if(f.cl!=null) h+=clientPanel(code,f.cl);
  // план + дни
  const noF=!Object.keys(f).length;
  const q=noF&&(S.per==='mtd'||S.per.startsWith('m:'))?planFact(code,{}):null; const pl=q?q.pl:null;
  const empty=!a.docs&&!a.ret&&Math.abs(a.rev)<1;
  if(empty) h+=`<div class="empty" style="margin-top:14px">За период «${esc(r.label)}» продаж в этом срезе нет. Выберите другой период вверху${f.cl!=null?' — ниже показаны все операции клиента':''}.</div>`;
  if(!empty){
  h+=`<div class="grid ${pl?'g32':''}" style="margin-top:14px">`;
  h+=`<div class="panel"><h3>Выручка по дням</h3><p class="sub">${esc(r.label)}${okP?' · пунктир — '+esc(r.cl):''}</p>${dayChart(code,r,f,pl?760:1200)}</div>`;
  if(pl){ const fc=q; const mx=Math.max(pl.v,fc.fc)*1.08; const W=x=>pct(Math.min(1,x/mx),2).replace(',','.'); const mn=MON[+q.mo.slice(5)-1];
    h+=`<div class="panel plan"><h3>План на ${mn}${q.closed?' · месяц закрыт':''}</h3><p class="sub">${pl.auto?'Автоплан: среднее за '+pl.base.length+' полных мес. +5% — утверждённого плана нет':'План утверждён'}</p>
      <div class="ptrack"><div class="f" style="width:${W(fc.fact)}"></div>${q.closed?'':`<div class="fc" style="left:${W(fc.fact)};width:${pct(Math.max(0,fc.fc-fc.fact)/mx,2).replace(',','.')}"></div>`}<div class="mk" style="left:${W(pl.v)}" title="План"></div></div>`
      +(q.closed?`<div class="prow"><div>Факт<b>${money(fc.fact)}</b>${pill(light(fc.fact/pl.v,1,.9),pct(fc.fact/pl.v,0)+' плана')}</div><div>План<b>${money(pl.v)}</b>&nbsp;</div><div>${fc.fact>=pl.v?'Перевыполнение':'Не хватило'}<b>${money(Math.abs(fc.fact-pl.v))}</b>&nbsp;</div></div>`
      :`<div class="prow"><div>Факт<b>${money(fc.fact)}</b>${pct(fc.fact/pl.v,0)} плана</div><div>Прогноз<b>${money(fc.fc)}</b>${pct(fc.fc/pl.v,0)} ${pill(light(fc.fc/pl.v,1,.9),fc.fc>=pl.v?'выполним':'риск')}</div><div>План<b>${money(pl.v)}</b>&nbsp;</div></div>
      <div class="prow"><div>Темп<b>${money(fc.rr)}</b>в раб. день (14 дн.)</div><div>Нужно<b>${fc.factY>=pl.v?'план выполнен':fc.wdLeft?money(Math.max(0,pl.v-fc.factY)/fc.wdLeft):'—'}</b>${fc.factY>=pl.v?'&nbsp;':'в раб. день'}</div><div>Осталось<b>${fc.wdLeft} дн.</b>выходной: ${c.off.map(i=>WD[i]).join(', ')||'нет'}</div></div>`)+`</div>`; }
  h+='</div>'; }
  // драйверы
  const dims=['pt','ch','cat','emp','p'].filter(d=>f[d]==null&&dimsAvail(code).includes(d)&&!(d==='p'&&f.cat==null&&f.p!=null));
  if(dims.length&&!empty){ h+=sec('Что двигает результат',okP?`вклад в изменение к периоду «${esc(r.cl)}» · клик — углубиться`:'структура выручки · клик — углубиться');
    const single=[]; const panels=dims.map(d=>{ const rows=compare(code,r,f,d); if(rows.length===1){ single.push(`${DIMS[d]}: <button class="lnk" ${act({drill:[d,rows[0].key]})}>${esc(rows[0].name)}</button>`); return ''; } return driverMini(code,r,f,d); }).filter(Boolean);
    if(single.length) h+=`<p class="note" style="margin:0 0 10px">Единственное значение в срезе — ${single.join(' · ')}</p>`;
    h+='<div class="grid g2">'+panels.join('')+'</div>'; }
  // помесячно
  h+=sec('Динамика по месяцам',f.cat!=null||f.p!=null?'по товарам — с '+dLab(m.lineFrom):'вся история в МойСклад · клик по месяцу — выбрать период');
  h+=`<div class="panel">${monthChart(monthSeries(code,f,needLines(f,null)?m.lineFrom:null),{W:1200})}</div>`;
  // операции
  if(f.cl!=null){ h+=sec('Операции клиента','вся история'); h+=opsTable(code,{from:m.dataStart,to:T},f,30,'ov_ops'); }
  else { h+=sec('Последние операции',sliceSub(code),['Все операции',{view:'ops'}]); h+=opsTable(code,r,f,8,'ov_ops'); }
  return h;
}
function driverMini(code,r,f,dim){
  const c=C[code]; if((dim==='cat'||dim==='p')&&r.from<c.meta.lineFrom) return `<div class="panel"><h3>${DIMS_PL[dim]}</h3><p class="note">Разрез по товарам доступен с ${dLab(c.meta.lineFrom)}.</p></div>`;
  let rows=compare(code,r,f,dim); const okP=hasCmp(code,r)&&!((dim==='cat'||dim==='p')&&r.pf<c.meta.lineFrom);
  if(!okP) rows.forEach(x=>{x.d=null;x.prev=null;});
  rows.sort((a,b)=>okP?Math.abs(b.d)-Math.abs(a.d):b.rev-a.rev); const top=rows.slice(0,6); const mx=Math.max(1,...top.map(x=>Math.abs(x.d||0)));
  const id='mini_'+dim;
  const cols=[{k:'name',l:DIMS[dim]},{k:'rev',l:'Выручка',n:1,f:cM},...(okP?[{k:'d',l:'Вклад в Δ',n:1,f:cContrib(mx)}]:[{k:'share',l:'Доля',n:1,f:cP}]),{k:'m',l:'Маржа',n:1,f:cMarg}];
  return `<div class="panel"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h3>${DIMS_PL[dim]}</h3><button class="more" ${act({view:dim==='cl'?'clients':dim})}>Все ${rows.length} →</button></div><p class="sub">${okP?'Сортировка по вкладу в изменение выручки':'Сортировка по выручке'}</p>${table(id,cols,top,{click:x=>drill(dim,x.key),sort:{k:okP?'__none':'rev',d:-1},max:6})}</div>`;
}

// ================= DIMENSION VIEW =================
function viewDim(code,dim){
  { const r0=rng(); if(r0.nodataC) return limits(code,r0,S.f).map(lim).join('')+'<div class="empty"><b class="nd">Недостаточно данных</b> за выбранный период.</div>'; }
  const c=C[code], r=rng(), f=S.f; let h=limits(code,r,f,{dimsUsed:[dim]}).map(lim).join('');
  if((dim==='cat'||dim==='p')&&r.from<c.meta.lineFrom) return h+`<div class="empty">Разрез по товарам доступен с ${dLab(c.meta.lineFrom)}.</div>`;
  const okP=hasCmp(code,r)&&!((dim==='cat'||dim==='p')&&r.pf<c.meta.lineFrom);
  let rows=compare(code,r,f,dim); if(!okP) rows.forEach(x=>{x.d=null;x.prev=null;x.mPrev=null;});
  const a=tot(code,r.from,r.to,f), b=okP?tot(code,r.pf,r.pt,f):null;
  // авто-вывод
  if(okP&&rows.length>1){ const dn=[...rows].sort((x,y)=>x.d-y.d)[0], upr=[...rows].sort((x,y)=>y.d-x.d)[0];
    let t=`Итого ${money(a.rev)} (${spct(b.rev?a.rev/b.rev-1:null,1)}). `;
    if(dn.d<0) t+=`Сильнее всего упал${dim==='cat'?'а':''} <button class="lnk" ${act({drill:[dim,dn.key]})}>${esc(dn.name)}</button>: ${smoney(dn.d)}${(dim==='emp'||dim==='pt')&&decomp(dn.cur,dn.prv)?' — '+decomp(dn.cur,dn.prv).text:''}. `;
    if(upr.d>0) t+=`Больше всего вырос${dim==='cat'?'ла':''} <button class="lnk" ${act({drill:[dim,upr.key]})}>${esc(upr.name)}</button>: ${smoney(upr.d)}.`;
    h+=`<div class="panel" style="margin-bottom:12px"><p style="margin:0">${t}</p></div>`; }
  const mx=Math.max(1,...rows.map(x=>Math.abs(x.d||0)));
  const cols=[{k:'name',l:DIMS[dim]},{k:'rev',l:'Выручка',n:1,f:cM,bar:1}];
  if(okP) cols.push({k:'dp',l:'Δ к сравн.',n:1,f:cDelta},{k:'d',l:'Вклад в Δ',n:1,f:cContrib(mx)});
  cols.push({k:'share',l:'Доля',n:1,f:cP},{k:'gp',l:'Вал. прибыль',n:1,f:cM},{k:'m',l:'Маржа',n:1,f:cMarg},{k:'docs',l:'Документы',n:1,f:cN},{k:'avg',l:'Ср. чек',n:1,f:cM});
  if(dim==='emp'||dim==='pt'||dim==='ch') cols.push({k:'ncl',l:'Клиенты',n:1,f:(v,r)=>num(v)+(r.anon?`<span class="sm">+${num(r.anon)} розн.</span>`:'')});
  if(dim==='emp'&&okP) cols.push({k:'why',l:'Причина',f:v=>`<span class="note">${esc(v||'')}</span>`});
  if(dim==='p'||dim==='cat') cols.push({k:'qty',l:'Кол-во',n:1,f:v=>num(v)});
  if(dim==='p'){ const sm=SM(code); for(const x of rows){ const s=sm.byP.get(x.key); x.stock=s?s.qty:null; x.cover=s&&isFinite(s.cover)?s.cover:null; x.flag=s?s.flag:null; }
    cols.push({k:'stock',l:'Остаток',n:1,f:cN},{k:'cover',l:'Дней запаса',n:1,f:(v,r)=>v==null?'—':Math.round(v)+(r.flag==='def'?' '+pill('r','дефицит'):r.flag==='excess'?' '+pill('y','избыток'):'')}); }
  if(dim==='cat'){ const sm=SM(code); const agg=new Map(); for(const x of sm.items){ const g=agg.get(x.cat)||{v:0,dead:0,cogs:0}; g.v+=x.val; if(x.flag==='dead') g.dead+=x.val; g.cogs+=x.rev28-x.gp28; agg.set(x.cat,g); }
    for(const x of rows){ const g=agg.get(x.key); x.stock=g?g.v:0; x.turn=g&&g.cogs>0?g.v/(g.cogs/sm.hist):null; x.dead=g?g.dead:0; }
    cols.push({k:'stock',l:'Склад',n:1,f:cM},{k:'turn',l:'Оборач., дн',n:1,f:v=>v==null?'—':Math.round(v)},{k:'dead',l:'Неликвид',n:1,f:cM}); }
  for(const x of rows){ x.dp=x.d; if(dim==='emp'&&okP){ const dc=decomp(x.cur,x.prv); x.why=dc&&Math.abs(x.d)>0?dc.text:''; } }
  const total={name:'Итого',rev:a.rev,prev:b?b.rev:null,d:b?a.rev-b.rev:null,dp:b?a.rev-b.rev:null,share:1,gp:a.gp,m:a.m,mPrev:b?b.m:null,docs:a.docs,avg:a.avg,ncl:a.ncl,qty:a.qty};
  h+=table('dim_'+dim,cols,rows,{click:x=>drill(dim,x.key),sort:{k:okP?'rev':'rev',d:-1},total,max:dim==='p'?100:60});
  return h;
}

// ================= STOCK VIEW =================
function viewStock(code){
  const sm=SM(code), f=S.f, c=C[code]; let h='';
  if(f.pt!=null||f.ch!=null||f.emp!=null||f.cl!=null) h+=lim('Остатки и скорость продаж считаются по компании целиком (фильтры точки, канала, менеджера и клиента здесь не применяются). Остатки по складам — в карточке товара.');
  h+=`<p class="note" style="margin:0 0 10px">Скорость — продажи за последние ${sm.hist} дн. без внутренних. Дефицит — запаса меньше ${TH.coverLow} дн.; избыток — больше ${TH.coverHigh} дн.; неликвид — остаток без продаж ${sm.deadLim}+ дн. Сумма «сверх ${TH.excessKeep} дн.» — стоимость запаса выше 90-дневной потребности.</p>`;
  let items=sm.items.filter(x=>(f.cat==null||x.cat===f.cat)&&(f.p==null||x.p===f.p));
  const segs=[['all','Все',items.filter(x=>x.qty>0||x.q28>0)],['def','Дефицит',items.filter(x=>x.flag==='def')],['excess','Избыток',items.filter(x=>x.excessVal>0)],['dead','Неликвид',items.filter(x=>x.flag==='dead')],['grow','Растут',items.filter(x=>x.rev56>0&&x.rev28>x.rev56*1.3&&x.rev28>1e5)],['fall','Падают',items.filter(x=>x.rev56>1e5&&x.rev28<x.rev56*.7)]];
  const seg=S.seg.stock||'all'; const cur=(segs.find(s=>s[0]===seg)||segs[0]);
  h+=`<div class="seg">${segs.map(s=>`<button aria-pressed="${s[0]===cur[0]}" ${act({fn:()=>{S.seg={...S.seg,stock:s[0]};render();}})}>${s[1]}<span class="c">${s[2].length}</span></button>`).join('')}</div>`;
  const ss=stockSum(code,f);
  h+=`<div class="kpis" style="margin:0 0 12px">${kpi('Стоимость склада',money(ss.val),num(ss.sku)+' SKU в наличии')}${kpi('Оборачиваемость',ss.turn?Math.round(ss.turn)+' дн.':'—','по себестоимости продаж 28 дн.',ss.turn>180?'r':ss.turn>90?'y':'g')}${kpi('Сверх 90 дн. запаса',money(ss.excess),ss.excN+' SKU','y')}${kpi('Неликвид',money(ss.dead),ss.deadN+' SKU','r')}${kpi('Дефицит',num(ss.def)+' SKU',ss.defA+' из группы A',ss.defA?'r':'g')}</div>`;
  const rows=cur[2].map(x=>({...x,catN:c.meta.cats[x.cat]?c.meta.cats[x.cat][0]:'',growth:x.rev56>0?x.rev28/x.rev56-1:null,
    action:x.flag==='def'?'Дозаказать':x.flag==='dead'?'Вывести: распродажа / возврат':x.excessVal>0?'Остановить закупку':x.flag==='slow'?'Проверить выкладку и цену':''}));
  const cols=[{k:'n',l:'Товар',f:(v,r)=>`${esc(v)}<span class="sm">${esc(r.catN)}${r.code?' · '+esc(r.code):''}</span>`},{k:'abc',l:'ABC',n:1,f:v=>v||'—'},{k:'qty',l:'Остаток, шт',n:1,f:cN},{k:'val',l:'Стоимость',n:1,f:cM,bar:1},{k:'q28',l:`Продано ${sm.hist} дн.`,n:1,f:cN},{k:'rev28',l:'Выручка 28 дн.',n:1,f:cM},{k:'growth',l:'Δ к пред. 28 дн.',n:1,f:v=>v==null?'—':`<span class="${v<0?'dn':'up'}">${spct(v)}</span>`},{k:'cover',l:'Дней запаса',n:1,f:v=>v==null||!isFinite(v)?'∞':Math.round(v)},{k:'excessVal',l:`Сверх ${TH.excessKeep} дн.`,n:1,f:cM},{k:'idle',l:'Без продаж, дн',n:1,f:(v,r)=>isFinite(v)?num(v):`> ${sm.win}`},{k:'action',l:'Действие',f:v=>v?`<span class="note">${esc(v)}</span>`:''}];
  const sortBy={all:{k:'val',d:-1},def:{k:'rev28',d:-1},excess:{k:'excessVal',d:-1},dead:{k:'val',d:-1},grow:{k:'rev28',d:-1},fall:{k:'rev56',d:-1}}[cur[0]];
  h+=table('stock_'+cur[0],cols,rows,{click:x=>drill('p',x.p),sort:sortBy,max:100});
  return h;
}

// ================= CLIENTS VIEW =================
function viewClients(code){
  { const r0=rng(); if(r0.nodataC) return limits(code,r0,S.f).map(lim).join('')+'<div class="empty"><b class="nd">Недостаточно данных</b> за выбранный период.</div>'; }
  const c=C[code], r=rng(), f=S.f, cs=CS(code); let h=limits(code,r,f).map(lim).join('');
  const okP=hasCmp(code,r);
  const cmp=compare(code,r,f,'cl'); const byK=new Map(cmp.map(x=>[x.key,x]));
  const anon=byK.get(-1);
  if(anon&&anon.rev) h+=`<p class="note" style="margin:0 0 8px">Розничные продажи без клиента: ${money(anon.rev)} (${num(anon.docs)} чеков) — в клиентскую аналитику не входят.</p>`;
  const base=cs.filter(x=>(f.emp==null||x.mainEmp===f.emp||byK.has(x.i))).map(x=>{ const k=byK.get(x.i)||{}; return {...x,rev:k.rev||0,prev:k.prev??null,d:k.d??null,gp:k.gp||0,m:k.m,mPrev:k.mPrev,docs:k.docs||0,empN:x.mainEmp>=0?c.meta.emps[x.mainEmp]:'—'}; });
  const inSlice=x=>byK.has(x.i);
  const big=base.filter(inSlice).sort((a,b)=>b.rev-a.rev); const cut=Math.max(10,Math.ceil(big.length*.1));
  const segs=[['big','Крупные',big.slice(0,cut)],['grow','Растущие',okP?base.filter(x=>inSlice(x)&&x.prev>0&&x.rev>x.prev*1.3&&x.rev-x.prev>2e5):[]],['fall','Падают',okP?base.filter(x=>x.prev>2e5&&x.rev<x.prev*.7):[]],['sleep','Уснувшие',base.filter(x=>x.sleep)],['debt','Должники',base.filter(x=>x.debt>0)],['all','Все',base.filter(x=>inSlice(x)||x.debt>0)]];
  const seg=S.seg.clients||'big'; const cur=segs.find(s=>s[0]===seg)||segs[0];
  h+=`<div class="seg">${segs.map(s=>`<button aria-pressed="${s[0]===cur[0]}" ${act({fn:()=>{S.seg={...S.seg,clients:s[0]};render();}})}>${s[1]}<span class="c">${s[2].length}</span></button>`).join('')}</div>`;
  const hint={big:'Топ-10% клиентов по выручке за период.',grow:'Выручка выросла больше чем на 30% к периоду сравнения.',fall:'Выручка упала больше чем на 30% к периоду сравнения.',sleep:'Покупали 3+ раз, но пауза уже вдвое дольше обычной (и больше 21 дня).',debt:'Долг по отчёту «Контрагенты» МойСклад (баланс взаиморасчётов). Учитывайте, что часть оплат может быть не проведена.',all:''}[cur[0]];
  if(cur[0]==='debt'){ const s=cur[2].reduce((a,x)=>a+x.debt,0), old=cur[2].filter(x=>x.idle==null||x.idle>60); h+=`<div class="kpis" style="margin:0 0 12px">${kpi('Дебиторка',money(s),cur[2].length+' клиентов','y')}${kpi('Без отгрузок 60+ дн.',money(old.reduce((a,x)=>a+x.debt,0)),old.length+' клиентов','r')}</div>`; }
  if(hint) h+=`<p class="note" style="margin:0 0 8px">${hint}${f.pt!=null||f.ch!=null?' Долг и «уснувшие» считаются по клиенту в целом, не по точке.':''}</p>`;
  const cols=[{k:'n',l:'Клиент',f:(v,r)=>`${esc(v)}<span class="sm">${esc(r.empN)}</span>`},{k:'rev',l:'Выручка за период',n:1,f:cM,bar:1}];
  if(okP) cols.push({k:'d',l:'Δ к сравн.',n:1,f:(v,r)=>r.prev==null?'—':`<span class="${v<0?'dn':'up'}">${smoney(v)}</span>`});
  cols.push({k:'m',l:'Маржа',n:1,f:cP},{k:'r90',l:'Выручка 90 дн.',n:1,f:cM},{k:'dall',l:'Покупок всего',n:1,f:cN},{k:'gapAvg',l:'Интервал, дн',n:1,f:v=>v==null?'—':Math.round(v)},{k:'idle',l:'Посл. покупка, дн назад',n:1,f:v=>v==null?'—':num(v)},{k:'debt',l:'Долг',n:1,f:(v)=>v>0?`<span class="dn">${money(v)}</span>`:'—'});
  const sortBy={big:{k:'rev',d:-1},grow:{k:'d',d:-1},fall:{k:'d',d:1},sleep:{k:'all',d:-1},debt:{k:'debt',d:-1},all:{k:'rev',d:-1}}[cur[0]];
  h+=table('cl_'+cur[0],cols,cur[2],{click:x=>drill('cl',x.i),sort:sortBy,max:80});
  return h;
}

// ================= OPERATIONS =================
function opsRows(code,r,f,limit){
  const c=C[code], m=c.meta; const a=Math.max(0,dIdx(c,r.from)), b=dIdx(c,r.to); const i0=lb(c.d,a,0,c.n), i1=lb(c.d,b+1,0,c.n); const out=[];
  for(let i=i1-1;i>=i0;i--){ if(!S.inc&&c.ch[i]===m.intCh) continue; if(f.pt!=null&&c.pt[i]!==f.pt) continue; if(f.ch!=null&&c.ch[i]!==f.ch) continue; if(f.emp!=null&&c.emp[i]!==f.emp) continue; if(f.cl!=null&&c.cl[i]!==f.cl) continue;
    let rev=c.rev[i], cost=c.cost[i];
    if(f.cat!=null||f.p!=null){ if(c.d[i]<c.lineFromD) continue; rev=0; cost=0; let hit=false; for(let l=c.docLine[i];l<c.docLine[i+1];l++){ if((f.p!=null&&c.lp[l]!==f.p)||(f.cat!=null&&c.lcat[l]!==f.cat)) continue; hit=true; rev+=c.lrev[l]; cost+=c.lcost[l]; } if(!hit) continue; }
    out.push({i,date:c.dayStr[c.d[i]]+' '+c.t[i],no:c.no[i],kind:KINDS[c.k[i]],pt:m.points[c.pt[i]],emp:m.emps[c.emp[i]],cl:c.cl[i]>=0?c.clients[c.cl[i]][0]:'—',rev,gp:rev-cost,m:rev?(rev-cost)/rev:null,sum:c.rev[i],paid:c.paid[i],unpaid:c.k[i]===0?Math.max(0,c.rev[i]-c.paid[i]):0});
    if(limit&&out.length>=limit) break; }
  return out;
}
function opsCols(){ return [{k:'date',l:'Дата',f:v=>`<span class="num">${esc(dShort(v.slice(0,10)))} ${esc(v.slice(11))}</span>`},{k:'no',l:'№',f:(v,r)=>`${esc(v)}<span class="sm">${esc(r.kind)}</span>`},{k:'pt',l:'Точка'},{k:'emp',l:'Менеджер'},{k:'cl',l:'Клиент'},{k:'rev',l:'Сумма',n:1,f:cM},{k:'gp',l:'Прибыль',n:1,f:cM},{k:'m',l:'Маржа',n:1,f:(v)=>`<span class="${v!=null&&v<0.1?'dn':''}">${pct(v)}</span>`},{k:'unpaid',l:'Не оплачено',n:1,f:v=>v>0?`<span class="dn">${money(v)}</span>`:'—'}]; }
function opsTable(code,r,f,limit,id){ const rows=opsRows(code,r,f,limit); return table(id,opsCols(),rows,{click:x=>openOp(code,x.i),sort:{k:'date',d:-1},max:limit||200}); }
function viewOps(code){
  { const r0=rng(); if(r0.nodataC) return limits(code,r0,S.f).map(lim).join('')+'<div class="empty"><b class="nd">Недостаточно данных</b> за выбранный период.</div>'; }
  const r=rng(), f=S.f, c=C[code]; let h=limits(code,r,f).map(lim).join('');
  const rows=opsRows(code,r,f,0); const q=(S.q.ops||'').toLowerCase();
  const fl=q?rows.filter(x=>(x.no+' '+x.cl+' '+x.emp+' '+x.pt).toLowerCase().includes(q)):rows;
  h+=`<div class="tool"><input id="opsq" type="search" placeholder="Поиск: номер, клиент, менеджер" value="${esc(S.q.ops||'')}"><span class="note">${num(fl.length)} операций · ${money(fl.reduce((s,x)=>s+x.rev,0))}${f.cat!=null||f.p!=null?' · суммы — только по позициям выбранного товара/категории':''}</span></div>`;
  h+=table('ops',opsCols(),fl,{click:x=>openOp(code,x.i),sort:{k:'date',d:-1},max:200});
  return h;
}
function openDay(code,day,f){ const r={from:day,to:day}; drawer(`<div class="eyebrow">${esc(CO(code).name)} · ${esc(sliceSub(code))}</div><h2>${dLab(day)}, ${WD[wdOf(day)]}</h2>`,(()=>{ const rows=opsRows(code,r,f,0); return `<p class="note">${rows.length} операций · ${money(rows.reduce((s,x)=>s+x.rev,0))}</p>`+table('day_ops',opsCols(),rows,{click:x=>openOp(code,x.i),sort:{k:'rev',d:-1},max:300}); })()); }

// ================= CARDS / PANELS =================
function productPanel(code,p){
  const T=TC(code);
  const c=C[code], sm=SM(code), x=sm.byP.get(p), pr=c.products[p]; let h=sec('Карточка товара',esc(pr[0])+(pr[1]?' · код '+esc(pr[1]):''));
  if(!x) return h+'<div class="empty">Нет остатков и продаж за последние 28 дней.</div>';
  const st=(x.st||[]).map(([si,q])=>`<tr><td class="l">${esc(c.meta.stores[si]||'?')}</td><td class="n">${num(q)}</td></tr>`).join('');
  const status=x.flag==='def'?pill('r','Дефицит'):x.flag==='dead'?pill('r','Неликвид'):x.excessVal>0?pill('y','Избыток'):x.flag==='slow'?pill('y','Нет продаж 28 дн.'):pill('g','В норме');
  const actn=x.flag==='def'?`Дозаказать: на ${TH.excessKeep>0?30:30} дней нужно ≈${num(Math.max(0,x.perDay*30-Math.max(0,x.qty)))} шт.`:x.flag==='dead'?'Вывести из ассортимента: распродажа, комплект, возврат поставщику. Закупку остановить.':x.excessVal>0?`Остановить закупку: запас на ${isFinite(x.cover)?Math.round(x.cover):'∞'} дн. Перераспределить между точками или стимулировать продажи.`:'Действий не требуется.';
  h+=`<div class="grid g2"><div class="panel"><div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">${status}${x.abc?pill('n','ABC: '+x.abc):''}</div><dl class="kv">
    <dt>Остаток</dt><dd>${num(x.qty)} шт · ${money(x.val)} по себестоимости</dd>
    <dt>Себестоимость / цена</dt><dd>${money(x.uc)} / ${money(x.sp)}${x.sp&&x.uc?` · наценка ${pct(x.sp/x.uc-1,0)}`:''}</dd>
    <dt>Продажи ${sm.hist} дн.</dt><dd>${num(x.q28,1)} шт · ${money(x.rev28)} · маржа ${pct(x.rev28?x.gp28/x.rev28:null)}</dd>
    <dt>Предыдущие 28 дн.</dt><dd>${num(x.q56,1)} шт · ${money(x.rev56)} ${x.rev56?dl(x.rev28,x.rev56):''}</dd>
    <dt>Темп</dt><dd>${num(x.perDay,2)} шт/день</dd>
    <dt>Хватит на</dt><dd>${x.perDay>0?(x.qty<=0?'<b class="dn">нет в наличии</b>':`<b>${Math.round(x.cover)} дн.</b> — до ${dShort(addD(T,Math.round(x.cover)))}`):'продаж нет'}</dd>
    <dt>Последняя продажа</dt><dd>${x.lastDay?dLab(x.lastDay)+' ('+x.idle+' дн. назад)':'не было с '+dLab(c.meta.lineFrom)}</dd></dl>
    <p class="verdict" style="display:block;padding:10px 12px;margin:12px 0 0;border-radius:10px"><b>Действие:</b> ${actn}</p></div>
    <div class="panel"><h3>Остатки по складам</h3><p class="sub">Текущий остаток, шт</p>${st?`<div class="tw"><table><tbody>${st}</tbody></table></div>`:'<p class="note">Разбивки по складам нет (один склад).</p>'}</div></div>`;
  return h;
}
function managerPanel(code,r,f){
  const a=tot(code,r.from,r.to,f), b=hasCmp(code,r)?tot(code,r.pf,r.pt,f):null; const dc=decomp(a,b);
  let h=sec('Разбор менеджера','выручка = клиенты × покупок на клиента × средний чек');
  if(!dc) return h+'<div class="empty">Нет базы сравнения для разложения.</div>';
  h+=`<div class="panel"><div class="why">${dc.f.map(x=>`<div>${x.k}<b>${x.fmt(x.a)}</b>было ${x.fmt(x.b)} · ${dl(x.a,x.b)}</div>`).join('')}<div>Выручка<b>${money(a.rev)}</b>было ${money(b.rev)} · ${dl(a.rev,b.rev)}</div></div>
    <p style="margin:6px 0 0">Вывод: ${Math.abs(a.rev/b.rev-1)<0.02?'результат на уровне прошлого периода':(a.rev<b.rev?'выручка ниже':'выручка выше')+' — '+dc.text}.</p></div>`;
  const e=f.emp; const sl=CS(code).filter(x=>x.mainEmp===e&&x.sleep).sort((x,y)=>y.all-x.all).slice(0,8);
  if(sl.length) h+=`<div class="panel" style="margin-top:12px"><h3>Уснувшие клиенты менеджера</h3><p class="sub">Покупали регулярно, пауза вдвое дольше обычной — позвонить</p>${table('mgr_sleep',[{k:'n',l:'Клиент'},{k:'all',l:'Выручка за всё время',n:1,f:cM},{k:'gapAvg',l:'Обычный интервал, дн',n:1,f:v=>v?Math.round(v):'—'},{k:'idle',l:'Пауза, дн',n:1,f:cN},{k:'debt',l:'Долг',n:1,f:v=>v>0?money(v):'—'}],sl,{click:x=>drill('cl',x.i),sort:{k:'all',d:-1},max:8})}</div>`;
  return h;
}
function clientPanel(code,k){
  const T=TC(code);
  const c=C[code], x=CS(code)[k]; if(!x) return '';
  const st=[]; if(x.debt>0) st.push(pill('r','Должник')); if(x.sleep) st.push(pill('y','Уснул')); if(x.idle!=null&&x.idle<=30) st.push(pill('g','Активен'));
  const mos=[...x.months.entries()].sort();
  const series=mos.map(([mo,v])=>({mo,rev:v,gp:0,partial:mo===T.slice(0,7)}));
  let h=sec('Карточка клиента',esc(x.n));
  h+=`<div class="grid g2"><div class="panel"><div style="display:flex;gap:6px;margin-bottom:10px">${st.join('')}</div><dl class="kv">
   <dt>Долг</dt><dd>${x.debt>0?`<b class="dn">${money(x.debt)}</b>`:'нет'}${x.adv>0?` · аванс ${money(x.adv)}`:''}</dd>
   <dt>Первая / последняя покупка</dt><dd>${x.first?dLab(x.first)+' '+x.first.slice(0,4):'—'} / ${x.last?dLab(x.last)+' ('+x.idle+' дн. назад)':'—'}</dd>
   <dt>Покупок</dt><dd>${num(x.dall)}${x.gapAvg?` · в среднем раз в ${Math.round(x.gapAvg)} дн.`:''}</dd>
   <dt>Выручка всего / 90 дн.</dt><dd>${money(x.all)} / ${money(x.r90)} · маржа 90 дн. ${pct(x.r90?x.g90/x.r90:null)}</dd>
   <dt>Основной менеджер</dt><dd>${x.mainEmp>=0?`<button class="lnk" ${act({go:{co:code,view:'overview',f:{emp:x.mainEmp},path:['emp']}})}>${esc(c.meta.emps[x.mainEmp])}</button>`:'—'}</dd>
   <dt>Точки</dt><dd>${[...x.pts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([p,v])=>esc(c.meta.points[p])+' '+money(v)).join('; ')}</dd></dl></div>
   <div class="panel"><h3>Покупки по месяцам</h3>${monthChart(series,{margin:false})}</div></div>`;
  return h;
}
function openOp(code,i){
  const c=C[code], m=c.meta; const cl=c.cl[i]; const rev=c.rev[i], cost=c.cost[i];
  let lines='';
  if(c.d[i]>=c.lineFromD){ const rows=[]; for(let l=c.docLine[i];l<c.docLine[i+1];l++) rows.push({p:c.lp[l],n:c.products[c.lp[l]][0],q:c.lq[l],price:c.lq[l]?c.lrev[l]/c.lq[l]:0,rev:c.lrev[l],gp:c.lrev[l]-c.lcost[l],m:c.lrev[l]?(c.lrev[l]-c.lcost[l])/c.lrev[l]:null});
    lines=table('op_lines',[{k:'n',l:'Товар'},{k:'q',l:'Кол-во',n:1,f:v=>num(v,v%1?1:0)},{k:'price',l:'Цена',n:1,f:cM},{k:'rev',l:'Сумма',n:1,f:cM},{k:'gp',l:'Прибыль',n:1,f:cM},{k:'m',l:'Маржа',n:1,f:v=>`<span class="${v!=null&&v<0.1?'dn':''}">${pct(v)}</span>`}],rows,{click:x=>{closeDrawer();drill('p',x.p);},sort:{k:'rev',d:-1},max:500}); }
  else lines=lim(`Позиции документов выгружены с ${dLab(m.lineFrom)}; для этой операции доступны только итоги.`);
  const unpaid=c.k[i]===0?Math.max(0,rev-c.paid[i]):0;
  drawer(`<div class="eyebrow">Уровень 7 · Операция · ${esc(CO(code).name)} · ${KINDS[c.k[i]]}</div><h2>№ ${esc(c.no[i])} от ${dLab(c.dayStr[c.d[i]])} ${c.dayStr[c.d[i]].slice(0,4)}, ${esc(c.t[i])}</h2>`,
   `<div class="kpis" style="margin:0 0 12px">${kpi('Сумма',money(rev))}${kpi('Прибыль',money(rev-cost),'маржа '+pct(rev?(rev-cost)/rev:null),light(rev?(rev-cost)/rev:null,.25,.15))}${kpi('Оплачено',money(c.paid[i]),unpaid>0?'не оплачено '+money(unpaid):'полностью',unpaid>0?'r':'g')}</div>
    <div class="panel" style="margin-bottom:12px"><dl class="kv"><dt>Точка</dt><dd><button class="lnk" ${act({fn:()=>{closeDrawer();nav({co:code,view:'overview',f:{pt:c.pt[i]},path:['pt']});}})}>${esc(m.points[c.pt[i]])}</button></dd>
    <dt>Канал</dt><dd>${esc(m.channels[c.ch[i]])}</dd>
    <dt>Менеджер</dt><dd><button class="lnk" ${act({fn:()=>{closeDrawer();nav({co:code,view:'overview',f:{emp:c.emp[i]},path:['emp']});}})}>${esc(m.emps[c.emp[i]])}</button></dd>
    <dt>Клиент</dt><dd>${cl>=0?`<button class="lnk" ${act({fn:()=>{closeDrawer();nav({co:code,view:'overview',f:{cl},path:['cl']});}})}>${esc(c.clients[cl][0])}</button>${c.clients[cl][1]>0?` · <span class="dn">долг ${money(c.clients[cl][1])}</span>`:''}`:'розничный покупатель'}</dd></dl></div>
    <h3 style="font-size:14.5px;margin:0 0 8px">Позиции</h3>${lines}`);
}
function drawer(head,body){ $('#layer').innerHTML=`<div class="drawer" role="dialog" aria-modal="true"><div class="scrim" data-close></div><div class="pane"><div class="hd"><div>${head}</div><button class="x" data-close aria-label="Закрыть">×</button></div>${body}</div></div>`; $('#layer .x').focus(); }
function closeDrawer(){ $('#layer').innerHTML=''; }
// ================= ГЛОССАРИЙ =================
const GLOSS=[
  ['Выручка','Сумма продаж клиентам за период минус возвраты. Продажи между компаниями группы («внутренние») не входят.','Показывает масштаб и динамику бизнеса. Падение выручки — сигнал разобрать, какая точка, канал или менеджер тянет вниз.','Сумма позиций отгрузок и розничных чеков − возвраты. Сверено с отчётом прибыльности МойСклад.'],
  ['Валовая прибыль','Выручка минус себестоимость проданного товара. Это не чистая прибыль: аренда, зарплаты и прочие расходы в МойСклад не ведутся.','Показывает, сколько денег реально зарабатывает товар. Помогает понять, растёт ли бизнес «в деньгах», а не только в обороте.','Выручка − себестоимость по отчёту прибыльности МойСклад.'],
  ['Маржа','Доля валовой прибыли в выручке, в процентах.','Помогает увидеть, где скидки, цены или ассортимент «съедают» заработок. Если оборот растёт, а маржа падает — проверить цены и скидки у конкретной категории, товара или менеджера.','Валовая прибыль ÷ выручка. Изменение показано в процентных пунктах (п.п.).'],
  ['План / факт','План — цель по выручке на месяц; факт — сколько уже продано.','Показывает, успевает ли компания к цели, и сколько нужно продавать в день, чтобы её догнать.','Сентябрь: утверждённые планы. Без плана — автоплан: среднее за 3 полных месяца + 5%.'],
  ['Прогноз','Ожидаемая выручка на конец месяца, если продажи пойдут в текущем темпе.','Даёт время отреагировать до конца месяца: усилить продажи, перераспределить план, запустить акцию.','Факт до вчера + средняя выручка за последние 14 рабочих дней × оставшиеся рабочие дни. Выходной определяется по продажам.'],
  ['Средний чек','Средняя сумма одного документа продажи (чека или отгрузки).','Помогает понять причину изменения выручки: стало меньше покупок или покупают на меньшую сумму. Низкий чек — повод для допродаж и комплектов.','Выручка ÷ число документов продажи (возвраты не считаются).'],
  ['Дебиторка','Деньги, которые клиенты должны компании за отгруженный товар.','Показывает, где заморожены деньги. Помогает решить, кому звонить, кому остановить отгрузки в долг.','Баланс взаиморасчётов из отчёта «Контрагенты» МойСклад. Часть оплат может быть не проведена — нужна сверка.'],
  ['Оборачиваемость','За сколько дней продастся текущий склад при нынешнем темпе продаж.','Показывает, сколько денег «спит» в товаре. Высокая оборачиваемость (много дней) — сократить закупки и распродать лишнее.','Стоимость склада по себестоимости ÷ себестоимость продаж за 28 дней × 28.'],
  ['Неликвид','Товар на складе, который давно не продаётся.','Помогает решить, что распродать, отдать в комплект, вернуть поставщику или больше не закупать.','Остаток > 0 и нет продаж 90+ дней (или за всю доступную историю, если она короче).'],
  ['Избыток','Товар, который продаётся, но его на складе намного больше, чем нужно.','Помогает остановить лишние закупки и перераспределить товар между точками.','Запас больше 180 дней продаж. В сумме «сверх 90 дн.» — стоимость запаса сверх 90-дневной потребности.'],
  ['Дефицит','Ходовой товар, который скоро закончится.','Помогает вовремя дозаказать и не потерять продажи. Сначала — группа A.','Остаток меньше чем на 14 дней продаж (по темпу последних 28 дней).'],
  ['ABC-анализ','Деление товаров по вкладу в выручку: A — дают 80% выручки, B — следующие 15%, C — остальные 5%.','Показывает, на каких товарах держится бизнес: A нельзя допускать в дефицит, по C — не держать большой запас.','По выручке за последние 28 дней.'],
  ['Каналы продаж','Способ, которым товар дошёл до клиента: розница, опт, маркетплейсы, сайт.','Помогает сравнить доходность каналов и решить, куда вкладывать силы и товар.','Розница/опт — по типу документа и контрагенту; Kaspi, Wildberries, ansartechno.kz — по контрагенту. В Аксес маркетплейсов нет.'],
  ['Операции','Конкретные документы МойСклад: отгрузки, розничные продажи, возвраты.','Позволяют дойти до первоисточника: кто продал, кому, по какой цене и марже, оплачено ли.','Проведённые документы; позиции товаров доступны с 1 июня (для бижутерии — с 22 августа).'],
];
function renderGloss(){
  $('#gloss').innerHTML=`<div class="sec" style="margin-top:0"><h2>Словарь показателей</h2><p>что это и какое решение помогает принять</p></div>
  <div class="gl">${GLOSS.map(([t,what,why,how])=>`<details class="gli"><summary><b>${esc(t)}</b><span>${esc(what)}</span></summary><dl><dt>Какое решение помогает принять</dt><dd>${esc(why)}</dd><dt>Как считается в AnsarOS</dt><dd>${esc(how)}</dd></dl></details>`).join('')}</div>`;
}

// ================= AI CONTEXT =================
const R0=v=>v==null||!isFinite(v)?null:Math.round(v);
const P1=v=>v==null||!isFinite(v)?null:Math.round(v*1000)/10;
function slim(x){ return {rev:R0(x.rev),gp:R0(x.gp),marginPct:P1(x.m),docs:x.docs,avgCheck:R0(x.avg),clients:x.ncl,anonChecks:x.anon}; }
function rowsCtx(code,r,f,dim,n=8){
  const c=C[code]; if((dim==='cat'||dim==='p')&&r.from<c.meta.lineFrom) return 'нет данных по товарам за этот период';
  const okP=hasCmp(code,r)&&!((dim==='cat'||dim==='p')&&r.pf<c.meta.lineFrom);
  const rows=compare(code,r,f,dim);
  const pick=okP?[...rows].sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,n):[];
  const topRev=[...rows].sort((a,b)=>b.rev-a.rev).slice(0,n);
  const m=new Map(); for(const x of [...pick,...topRev]) m.set(x.key,x);
  return {count:rows.length,rows:[...m.values()].map(x=>{ const o={name:x.name,rev:R0(x.rev),share:P1(x.share),gp:R0(x.gp),marginPct:P1(x.m),docs:x.docs,avgCheck:R0(x.avg)};
    if(okP){ o.prevRev=R0(x.prev); o.delta=R0(x.d); o.prevMarginPct=P1(x.mPrev); }
    if(dim==='emp'||dim==='pt'){ o.clients=x.ncl; if(okP){ o.prevClients=x.nclPrev; o.prevDocs=x.docsPrev; o.prevAvgCheck=R0(x.avgPrev); const dc=decomp(x.cur,x.prv); if(dc) o.why=dc.text; } }
    return o; })};
}
function stockCtx(code,f){
  const sm=SM(code), ss=stockSum(code,f); const it=sm.items.filter(x=>(f.cat==null||x.cat===f.cat)&&(f.p==null||x.p===f.p));
  const pr=x=>({name:x.n,abc:x.abc||null,qty:R0(x.qty),value:R0(x.val),soldPerDay:Math.round(x.perDay*100)/100,daysOfCover:isFinite(x.cover)?R0(x.cover):null,rev28:R0(x.rev28),daysNoSale:isFinite(x.idle)?x.idle:'>'+sm.win});
  return {stockValue:R0(ss.val),turnoverDays:R0(ss.turn),deadValue:R0(ss.dead),deadSku:ss.deadN,excessOver90dValue:R0(ss.excess),deficitSku:ss.def,deficitSkuA:ss.defA,
    deficitTop:it.filter(x=>x.flag==='def').sort((a,b)=>b.rev28-a.rev28).slice(0,12).map(pr),
    excessTop:it.filter(x=>x.excessVal>0).sort((a,b)=>b.excessVal-a.excessVal).slice(0,10).map(x=>({...pr(x),excessValue:R0(x.excessVal)})),
    deadTop:it.filter(x=>x.flag==='dead').sort((a,b)=>b.val-a.val).slice(0,10).map(pr),
    fallingTop:it.filter(x=>x.rev56>1e5&&x.rev28<x.rev56*.7).sort((a,b)=>(a.rev28-a.rev56)-(b.rev28-b.rev56)).slice(0,8).map(x=>({...pr(x),rev28prev:R0(x.rev56)}))};
}
function clientsCtx(code,f){
  const c=C[code]; const cs=CS(code).filter(x=>f.emp==null||x.mainEmp===f.emp);
  const cl=x=>({name:x.name||x.n,debt:R0(x.debt),lastPurchaseDaysAgo:x.idle,purchases:x.dall,usualGapDays:R0(x.gapAvg),revAllTime:R0(x.all),rev90:R0(x.r90),manager:x.mainEmp>=0?c.meta.emps[x.mainEmp]:null});
  const debt=cs.filter(x=>x.debt>0);
  return {debtTotal:R0(debt.reduce((s,x)=>s+x.debt,0)),debtors:debt.length,debtTop:[...debt].sort((a,b)=>b.debt-a.debt).slice(0,12).map(cl),
    sleepingCount:cs.filter(x=>x.sleep).length,sleepingTop:cs.filter(x=>x.sleep).sort((a,b)=>b.all-a.all).slice(0,12).map(cl)};
}
function aiContext(){
  const r=rng(); const base={today:T,period:r.label,periodDates:[r.from,r.to],comparedWith:r.cl,compareDates:[r.pf,r.pt],includesInternalSales:S.inc,currency:'KZT (₸)'};
  if(!S.co){
    base.level='Группа компаний';
    base.companies=codes().map(code=>{ const r=rng(S.per,S.cmp,code); const a=tot(code,r.from,r.to,{}), ok=!r.nodataC&&hasCmp(code,r), b=ok?tot(code,r.pf,r.pt,{}):null, fc=planFact(code,{}), pl=fc.pl, ss=stockSum(code,{});
      const w=ok?whyChain(code,r,{},2):{chain:[]};
      return {company:CO(code).name,dataStart:C[code].meta.dataStart,dataUpTo:TC(code),periodUsed:r.nodataC?'нет данных за период':[r.from,r.to],current:slim(a),previous:b?slim(b):'нет базы сравнения',
        planMonth:fc.mo,monthClosed:fc.closed,monthPlan:pl?R0(pl.v):null,planIsAuto:pl?pl.auto:null,forecastMonthEnd:fc.closed?undefined:R0(fc.fc),factMonth:R0(fc.fact),
        stock:{value:R0(ss.val),turnoverDays:R0(ss.turn),dead:R0(ss.dead),excessOver90d:R0(ss.excess),deficitSkuA:ss.defA},
        debt:R0(CS(code).reduce((s,x)=>s+x.debt,0)),
        mainDrivers:w.chain.map(s=>({dimension:DIMS[s.dim],name:s.row.name,delta:R0(s.row.d)})),
        signals:signals(code,{}).map(s=>s.title+' — '+s.text),
        topDeficit:SM(code).items.filter(x=>x.flag==='def'&&x.abc==='A').sort((a,b)=>b.rev28-a.rev28).slice(0,5).map(x=>({name:x.n,qty:R0(x.qty),daysOfCover:isFinite(x.cover)?R0(x.cover):null})),
        topDead:SM(code).items.filter(x=>x.flag==='dead').sort((a,b)=>b.val-a.val).slice(0,5).map(x=>({name:x.n,value:R0(x.val)})),
        limitations:C[code].meta.notes}; });
    return base;
  }
  const code=S.co, f=S.f, c=C[code];
  base.company=CO(code).name; base.level=S.path.length?DIMS[S.path[S.path.length-1]]:'Компания'; base.openTab=VIEWS[S.view];
  base.activeFilters=S.path.map(d=>({dimension:DIMS[d],value:dimName(code,d,f[d])}));
  base.dataStart=c.meta.dataStart; base.productDetailFrom=c.meta.lineFrom;
  const a=tot(code,r.from,r.to,f), ok=hasCmp(code,r)&&!(needLines(f,null)&&r.pf<c.meta.lineFrom), b=ok?tot(code,r.pf,r.pt,f):null;
  base.current=slim(a); base.previous=b?slim(b):'нет базы сравнения';
  if(ok){ const w=whyChain(code,r,f,3); base.mainDrivers=w.chain.map(s=>({dimension:DIMS[s.dim],name:s.row.name,delta:R0(s.row.d),shareOfChangePct:P1(s.share),structure:(s.dim==='emp'||s.dim==='pt')&&decomp(s.row.cur,s.row.prv)?decomp(s.row.cur,s.row.prv).text:undefined}));
    const md=marginDriver(code,r,f); if(md&&md.best) base.marginDriver={marginChangePp:P1(md.dm),dimension:DIMS[md.best.dim],name:md.best.row.name,itsMarginPct:P1(md.best.row.m),itsPrevMarginPct:P1(md.best.row.mPrev)};
    const dc=decomp(a,b); if(dc) base.structure=dc.f.map(x=>({factor:x.k,now:Math.round(x.a*10)/10,before:Math.round(x.b*10)/10})); }
  if(f.cl==null){ const q=planFact(code,f); if(q.closed) base.closedMonth={month:q.mo,fact:R0(q.fact),plan:q.pl?R0(q.pl.v):null,planIsAuto:q.pl?q.pl.auto:null}; const fc=forecast(code,f); const pl=Object.keys(f).length?null:planOf(code,T.slice(0,7)); base.forecast={month:T.slice(0,7),monthFact:R0(fc.fact),forecastMonthEnd:R0(fc.fc),runRatePerWorkDay:R0(fc.rr),workDaysLeft:fc.wdLeft,plan:pl?R0(pl.v):'план задан только на компанию целиком',planIsAuto:pl?pl.auto:null}; }
  base.breakdowns={}; for(const d of ['pt','ch','cat','emp','p'].filter(d=>f[d]==null&&dimsAvail(code).includes(d)&&!(d==='p'&&f.cat==null&&S.view!=='p'))) base.breakdowns[DIMS_PL[d]]=rowsCtx(code,r,f,d);
  if(f.cat!=null&&f.p==null) base.breakdowns['Товары']=rowsCtx(code,r,f,'p',12);
  if(f.pt==null&&f.ch==null&&f.emp==null&&f.cl==null) base.stock=stockCtx(code,f); else base.stock='остатки считаются только по компании/категории/товару — снимите фильтр точки, канала, менеджера или клиента';
  if(f.pt==null&&f.ch==null&&f.cat==null&&f.p==null) base.clients=clientsCtx(code,f);
  if(f.cl!=null){ const x=CS(code)[f.cl]; if(x) base.client={name:x.n,debt:R0(x.debt),firstPurchase:x.first,lastPurchase:x.last,daysSinceLast:x.idle,purchases:x.dall,usualGapDays:R0(x.gapAvg),revAllTime:R0(x.all),rev90:R0(x.r90),mainManager:x.mainEmp>=0?c.meta.emps[x.mainEmp]:null}; }
  if(f.p!=null){ const x=SM(code).byP.get(f.p); if(x) base.product={name:x.n,qty:R0(x.qty),unitCost:R0(x.uc),salePrice:R0(x.sp),soldLast28:x.q28,soldPrev28:x.q56,perDay:Math.round(x.perDay*100)/100,daysOfCover:isFinite(x.cover)?R0(x.cover):null,lastSale:x.lastDay,abc:x.abc||null,status:x.flag}; }
  base.recentOperations=opsRows(code,r,f,10).map(o=>({date:o.date,no:o.no,type:o.kind,point:o.pt,manager:o.emp,client:o.cl,sum:R0(o.rev),profit:R0(o.gp),unpaid:R0(o.unpaid)}));
  base.signals=signals(code,f).map(s=>s.title+' — '+s.text);
  base.limitations=[...limits(code,r,f),...c.meta.notes,...(c.meta.missingCost>1e6?['У части товаров нет себестоимости: маржа по ним завышена.']:[])];
  return base;
}

// ================= AI CHAT =================
const AI={sample:undefined,turns:[],busy:false,ctl:null,off:false};
const AI_EX=['Почему изменилась выручка?','Почему упала выручка?','Какая точка тянет результат вниз?','Что срочно дозаказать?','Какой неликвид нужно распродать?','Какие менеджеры просели и почему?','Где у нас заморожены деньги?','Кто из клиентов перестал покупать?'];
function aiScope(){ const r=rng(); return (S.co?CO(S.co).name+(S.path.length?' · '+sliceSub(S.co):''):'Группа компаний')+' · '+r.label+' · сравнение: '+r.cl; }
function renderAI(){
  const box=$('#ai'); if(!box.dataset.init){ box.dataset.init=1;
    box.innerHTML=`<div class="sec" style="margin-top:0"><h2>AI-помощник руководителя</h2><p>отвечает по текущей компании, периоду и фильтрам</p></div>
    <div class="panel aip"><p class="note" style="margin:0 0 8px">Контекст: <b id="aictx"></b></p>
      <div class="qs" id="aiqs">${AI_EX.map(q=>`<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="chat" id="ailog" aria-live="polite"></div>
      <form class="ask" id="aiform"><textarea id="aiq" rows="2" placeholder="Спросите обычным языком, например: почему упала маржа у менеджера?"></textarea><div class="askb"><button class="btn p" id="aigo" type="submit">Спросить</button><button class="btn" id="aistop" type="button" hidden>Стоп</button></div></form>
      <p class="note" id="ainote" style="margin:8px 0 0">AI видит только цифры AnsarOS по текущему срезу и не придумывает данные. Ответ тратит лимит вашего аккаунта Claude.</p></div>`;
    $('#aiform').addEventListener('submit',e=>{ e.preventDefault(); aiAsk($('#aiq').value); });
    $('#aiq').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); aiAsk($('#aiq').value); } });
    $('#aiqs').addEventListener('click',e=>{ const b=e.target.closest('[data-q]'); if(b) aiAsk(b.dataset.q); });
    $('#aistop').addEventListener('click',()=>AI.ctl&&AI.ctl.abort());
  }
  $('#aictx').textContent=aiScope();
  if(AI.off){ $('#aiform').hidden=true; $('#aiqs').hidden=true; $('#ainote').textContent='AI-помощник подключается к серверу AnsarOS — будет доступен на следующем шаге.'; }
}
function md(t){ // безопасный мини-markdown: **жирный**, списки, заголовки
  const lines=esc(t).split('\n'); let out='',ul=false;
  for(let l of lines){ l=l.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
    const li=l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/); const h=l.match(/^#{1,4}\s+(.*)$/);
    if(li){ if(!ul){ out+='<ul>'; ul=true; } out+='<li>'+li[1]+'</li>'; continue; }
    if(ul){ out+='</ul>'; ul=false; }
    if(h) out+='<h5>'+h[1]+'</h5>'; else if(l.trim()) out+='<p>'+l+'</p>'; }
  if(ul) out+='</ul>'; return out; }
function aiMsg(role,html){ const d=document.createElement('div'); d.className='msg '+role; d.innerHTML=html; $('#ailog').appendChild(d); return d; }
const AI_ERR={rate_limited:'Слишком много запросов или исчерпан лимит — попробуйте чуть позже.',session_expired:'Сессия истекла — войдите в claude.ai заново.',refused:'AI отказался отвечать на такой запрос — переформулируйте.',prompt_too_large:'Слишком много данных в срезе — сузьте фильтр.',empty_completion:'Пустой ответ — переформулируйте вопрос.'};
async function aiAsk(q){
  q=(q||'').trim(); if(!q||AI.busy) return;
  if(AI.sample===undefined){ const cl=window.claude; AI.sample=cl&&cl.use?await cl.use('sample').catch(()=>null):null; }
  if(!AI.sample){ AI.off=true; renderAI(); return; }
  AI.busy=true; $('#aiq').value=''; $('#aigo').disabled=true; $('#aistop').hidden=false;
  const scope=aiScope();
  aiMsg('u',esc(q)+`<small>${esc(scope)}</small>`);
  const out=aiMsg('a','<p class="note">Думаю… (обычно 10–40 секунд)</p>');
  out.scrollIntoView({behavior:'smooth',block:'nearest'});
  let ctx=JSON.stringify(aiContext()); if(ctx.length>120000) ctx=ctx.slice(0,120000)+'…(обрезано)';
  const RULES=`Ты — AI-помощник руководителя в AnsarOS (группа компаний «Ансар», Казахстан: Ансар Аксес — аксессуары и запчасти для телефонов, Ансар Техно — бытовая техника, Ансар Бижутерия). Руководитель смотрит на срез: ${scope}.
Правила:
1. ${LANG==='kk'?'Отвечай на казахском языке (қазақ тілінде), коротко и по делу, как опытный финансовый директор. Названия товаров, клиентов и сотрудников оставляй как в данных':'Отвечай по-русски, коротко и по делу, как опытный финансовый директор'}.
2. Используй ТОЛЬКО цифры из JSON ниже. Ничего не придумывай и не экстраполируй. Если для ответа данных нет — прямо скажи, чего не хватает, и подскажи, какой уровень или вкладку AnsarOS открыть (Точки, Каналы, Категории, Товары, Менеджеры, Клиенты, Операции, Склад).
3. Структура ответа строго:
**Факт** — что произошло, 1–3 пункта с цифрами (суммы в ₸ с «млн»/«тыс», проценты, дни).
**Возможные причины** — 2–4 гипотезы. Это предположения, не доказанные причины: так и пиши («вероятно», «возможно»). Проверь: количество продаж, средний чек, наличие товара, изменение цены/маржи, динамику менеджеров, структуру продаж.
**Доказательства** — для каждой гипотезы цифры из JSON за или против, с названиями точек, товаров, менеджеров, клиентов.
**Рекомендации** — 2–4 конкретных действия: кто/что/с чем, и на каком уровне AnsarOS проверить (Точки, Каналы, Категории, Товары, Менеджеры, Клиенты, Операции, Склад).
**Недостаточно данных** — чего не хватает для вывода (обязательно, если гипотезу нельзя проверить). Не подставляй нули и оценки вместо отсутствующих данных.
4. Выручка — без внутренних продаж; валовая прибыль — не чистая прибыль; дебиторка требует сверки.
Поля JSON: rev — выручка, gp — валовая прибыль, marginPct — маржа %, docs — документы продаж, avgCheck — средний чек, delta — изменение выручки к периоду сравнения, prev* — значения периода сравнения.

Данные AnsarOS (JSON):
${ctx}`;
  const hist=AI.turns.slice(-6);
  const input=[{role:'user',content:RULES},...hist,{role:'user',content:q}];
  const ctl=new AbortController(); AI.ctl=ctl;
  try{
    const res=await AI.sample(input,{cache:false,signal:ctl.signal,onText:({text})=>{ out.innerHTML=md(text); }});
    out.innerHTML=md(res.text)+(res.truncated?'<p class="note">Ответ обрезан — задайте вопрос уже.</p>':'');
    AI.turns.push({role:'user',content:q},{role:'assistant',content:res.text});
  }catch(e){
    const keep=e&&e.text?md(e.text):'';
    if(e&&(e.code==='not_granted'||e.code==='sampling_disabled'||e.code==='not_declared'||e.code==='capability_disabled'||e.code==='capability_removed')){ AI.off=true; out.innerHTML='<p class="note">AI-помощник недоступен: доступ не разрешён.</p>'; renderAI(); }
    else if(e&&e.code==='cancelled') out.innerHTML=keep||'<p class="note">Остановлено.</p>';
    else out.innerHTML=keep+`<p class="note">${esc((e&&AI_ERR[e.code])||'Связь прервалась — задайте вопрос ещё раз.')}</p>`;
  }finally{ AI.busy=false; AI.ctl=null; $('#aigo').disabled=false; $('#aistop').hidden=true; }
}
// ================= GROUP VIEW =================
function viewGroup(){
  const r=rng(); const cs=codes(); const rows=[]; let A={rev:0,gp:0,docs:0,prev:0,gpPrev:0,plan:0,fc:0,stock:0,dead:0,excess:0,debt:0,fact:0};
  let allPrev=true; const Q=planFact(codes()[0],{}); const QM=MON[+Q.mo.slice(5)-1];
  for(const code of cs){ const rc=rng(S.per,S.cmp,code); const a=tot(code,rc.from,rc.to,{}), okP=!rc.nodataC&&hasCmp(code,rc), b=okP?tot(code,rc.pf,rc.pt,{}):null; if(!okP) allPrev=false;
    const noPF=staleMo(code)&&!S.per.startsWith('m:');
    const fc=noPF?{fc:null,fact:null}:planFact(code,{}), pl=noPF?null:fc.pl, ss=stockSum(code,{}), debt=CS(code).reduce((s,x)=>s+x.debt,0);
    const row={code,name:CO(code).name,stale:rc.clipped?rc.dataTo:null,nodata:!!rc.nodataC,rev:a.rev,prev:b?b.rev:null,d:b?a.rev-b.rev:null,gp:a.gp,m:a.m,mPrev:b?b.m:null,docs:a.docs,avg:a.avg,plan:pl?pl.v:null,planAuto:pl?pl.auto:false,fc:fc.fc,fcp:pl?fc.fc/pl.v:null,noPF,stock:ss.val,turn:ss.turn,bad:ss.dead+ss.excess,dead:ss.dead,debt,okP};
    rows.push(row); A.rev+=a.rev; A.gp+=a.gp; A.docs+=a.docs; if(b){A.prev+=b.rev;A.gpPrev+=b.gp;} A.plan+=pl?pl.v:0; A.fc+=fc.fc||0; A.fact+=fc.fact||0; A.stock+=ss.val; A.dead+=ss.dead; A.excess+=ss.excess; A.debt+=debt; }
  const cmpRows=rows.filter(x=>x.okP); const prevAll=cmpRows.reduce((s,x)=>s+x.prev,0), revCmp=cmpRows.reduce((s,x)=>s+x.rev,0);
  const gm=A.rev?A.gp/A.rev:null, gmP=A.prev?A.gpPrev/A.prev:null;
  let h=`<div class="head"><div><div class="eyebrow">Уровень 0 · Группа компаний</div><h1>Группа «Ансар»</h1><p>${esc(r.label)} · сравнение: ${esc(r.cl)} · данные МойСклад на ${dLab(T)} ${T.slice(0,4)}</p></div></div>`;
  const stale=rows.filter(x=>x.stale);
  if(stale.length) h+=lim(`Данные компаний выгружены на разные даты: ${cs.map(code=>CO(code).short+' — по '+dLab(TC(code))).join(', ')}. ${stale.map(x=>CO(x.code).short+(x.nodata?': за выбранный период данных нет (недостаточно данных)':': период сокращён до '+dLab(x.stale)+', сравнение — за то же число дней')).join('; ')}. Итог группы за период поэтому неполный.`);
  // verdict
  const what=`<p>Выручка группы <b>${money(A.rev)}</b>${prevAll?` — ${dl(revCmp,prevAll)} к ${esc(r.cl)} (сопоставимо: ${cmpRows.map(x=>CO(x.code).short).join(', ')})`:''}.</p><p>Валовая прибыль ${money(A.gp)}, маржа ${pct(gm)}${cmpRows.length===rows.length&&gmP!=null?` (${pp(gm-gmP)})`:''}.</p>`;
  let why='';
  if(cmpRows.length){ const srt=[...cmpRows].sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)); const top=srt[0]; const dAll=revCmp-prevAll;
    why+=`<p>${Math.abs(dAll)<prevAll*0.02?'Выручка на уровне сравниваемого периода.':`${dAll<0?'Падение':'Рост'} даёт в основном <button class="lnk" ${act({co:top.code})}>${esc(CO(top.code).short)}</button>: ${smoney(top.d)}${Math.sign(top.d)===Math.sign(dAll)&&dAll?` (${pct(Math.min(1,top.d/dAll),0)} изменения)`:''}.`}</p>`;
    const w=whyChain(top.code,rng(S.per,S.cmp,top.code),{},2); if(w.chain.length){ let ff={},path=[]; why+='<p>Внутри: '+w.chain.map(s=>{ ff={...ff,[s.dim]:s.row.key}; path.push(s.dim); return `${DIMS[s.dim].toLowerCase()} <button class="lnk" ${act({go:{co:top.code,view:'overview',f:{...ff},path:[...path]}})}>${esc(s.row.name)}</button> ${smoney(s.row.d)}`; }).join(' → ')+'.</p>'; }
    for(const x of rows) if(x.okP&&x.m!=null&&x.mPrev!=null&&x.m-x.mPrev<-0.015) why+=`<p>${esc(CO(x.code).short)}: маржа ${pp(x.m-x.mPrev)}${x.d>0?' при росте оборота':''}.</p>`;
    const noP=rows.filter(x=>!x.okP); if(noP.length) why+=`<p class="note">${noP.map(x=>CO(x.code).short+(x.nodata?': нет данных за период (выгрузка по '+dLab(TC(x.code))+')':': нет базы сравнения (учёт начат недавно)')).join('; ')}.</p>`; }
  let will=Q.closed?`<p>${QM[0].toUpperCase()+QM.slice(1)} закрыт: группа <b>${money(A.fc)}</b>${A.plan?` — ${pct(A.fc/A.plan,0)} плана ${money(A.plan)}`:''}.</p><ul>${rows.map(x=>`<li><button class="lnk" ${act({co:x.code})}>${esc(CO(x.code).short)}</button>: ${money(x.fc)}${x.plan?` · ${pill(light(x.fcp,1,.9),pct(x.fcp,0)+' плана')}`:''}</li>`).join('')}</ul>`
   :`<p>Прогноз группы на конец ${MONg[+T.slice(5,7)-1]}: <b>${money(A.fc)}</b>${A.plan?` — ${pct(A.fc/A.plan,0)} плана ${money(A.plan)}`:''}.</p><ul>${rows.map(x=>`<li><button class="lnk" ${act({co:x.code})}>${esc(CO(x.code).short)}</button>: ${x.noPF?`<span class="nd">Недостаточно данных</span> — выгрузка по ${dLab(TC(x.code))}`:`${money(x.fc)}${x.plan?` · ${pct(x.fcp,0)} ${pill(light(x.fcp,1,.9),x.fcp>=1?'выполнит':'риск')}`:''}`}</li>`).join('')}</ul>${rows.some(x=>x.noPF)?'<p class="note">Прогноз группы — только по компаниям с данными за текущий месяц.</p>':''}`;
  if(Q.closed){ const cur=T.slice(0,7); let fsum=0,psum=0,auto=false; const stl=cs.filter(staleMo); for(const code of cs.filter(x=>!staleMo(x))){ const fc=forecast(code,{}), pc=planOf(code,cur); fsum+=fc.fc; if(pc){ psum+=pc.v; auto=auto||pc.auto; } }
    will+=`<p>${MON[+cur.slice(5)-1][0].toUpperCase()+MON[+cur.slice(5)-1].slice(1)}: при темпе последних 14 раб. дн. — прогноз группы <b>${money(fsum)}</b>${psum?` · ${pct(fsum/psum,0)} ${auto?'автоплана':'плана'} ${money(psum)}`:''}.${auto?' Утверждённых планов на '+MON[+cur.slice(5)-1]+' нет.':''}${stl.length?' Без '+stl.map(x=>CO(x).short).join(', ')+': нет данных за этот месяц.':''}</p>`; }
  const sig=cs.flatMap(code=>signals(code,{}).map(s=>({...s,code})));
  const bad=sig.filter(s=>!s.opp&&s.sev!=='g').slice(0,5);
  const doH=bad.length?'<ul>'+bad.map(s=>`<li><button class="act" ${act({go:s.go})}>${pill(s.sev,CO(s.code).short)}<span>${esc((TODO[s.area]||(()=>s.title))({...s,who:''}))}</span></button></li>`).join('')+'</ul>':'<p class="note">Критичных отклонений нет.</p>';
  h+=`<section class="verdict"><div><h4><i>1</i>Что произошло</h4>${what}</div><div><h4><i>2</i>Почему</h4>${why||'<p class="note">Нет базы сравнения.</p>'}</div><div><h4><i>3</i>Что будет</h4>${will}</div><div><h4><i>4</i>Что делать</h4>${doH}</div></section>`;
  const sortG=k=>({fn:()=>{S.sort.grp={k,d:-1};render();document.getElementById('grp')?.scrollIntoView({behavior:'smooth'});}});
  h+=`<div class="kpis">${kpi('Выручка',money(A.rev),prevAll?dl(revCmp,prevAll)+' (сопост.)':'','',sortG('rev'))}${kpi('Валовая прибыль',money(A.gp),'','',sortG('gp'))}${kpi('Маржа',pct(gm),gmP!=null&&cmpRows.length===rows.length?dl(gm,gmP,{ppm:true}):'',light(gm,.25,.2),sortG('m'))}
    ${kpi(Q.closed?'План / факт':'План / прогноз',A.plan?pct(A.fc/A.plan,0):'—',`${Q.closed?'факт '+QM:'прогноз'} ${money(A.fc)} из ${money(A.plan)}`,light(A.plan?A.fc/A.plan:null,1,.9),sortG('fcp'))}${kpi('Склад',money(A.stock),'по себестоимости','',sortG('stock'))}${kpi('Неликвид + избыток',money(A.dead+A.excess),`неликвид ${money(A.dead)}`,A.stock&&(A.dead+A.excess)/A.stock>.4?'r':'y',sortG('bad'))}${kpi('Дебиторка',money(A.debt),'требует сверки оплат','y',sortG('debt'))}</div>`;
  h+=cmpStrip(null,{});
  h+=sec('Сравнение компаний','клик — перейти в компанию');
  const cols=[{k:'name',l:'Компания',f:(v,r)=>`<span class="lnk">${esc(v)}</span>${r.stale?`<span class="sm">${r.nodata?'нет данных за период':'данные по '+dLab(r.stale)}</span>`:''}`},{k:'rev',l:'Выручка',n:1,f:cM,bar:1},{k:'dp',l:'Δ к сравн.',n:1,f:(v,r)=>r.okP?cDelta(v,r):'<span class="fl">нет базы</span>'},{k:'gp',l:'Вал. прибыль',n:1,f:cM},{k:'m',l:'Маржа',n:1,f:cMarg},{k:'docs',l:'Документы',n:1,f:cN},{k:'avg',l:'Ср. чек',n:1,f:cM},{k:'plan',l:'План мес.',n:1,f:(v,r)=>v?money(v)+(r.planAuto?'<span class="sm">автоплан</span>':''):'—'},{k:'fcp',l:Q.closed?'Факт, % плана':'Прогноз, % плана',n:1,f:(v)=>v==null?'—':`${pill(light(v,1,.9),pct(v,0))}`},{k:'stock',l:'Склад',n:1,f:cM},{k:'turn',l:'Оборач., дн',n:1,f:v=>v?Math.round(v):'—'},{k:'bad',l:'Неликвид+избыток',n:1,f:cM},{k:'debt',l:'Дебиторка',n:1,f:cM}];
  rows.forEach(x=>x.dp=x.d);
  h+=`<div id="grp">${table('grp',cols,rows,{click:x=>nav({co:x.code,view:'overview',f:{},path:[]}),sort:{k:'rev',d:-1},total:{name:'Группа',rev:A.rev,gp:A.gp,m:gm,docs:A.docs,avg:A.docs?A.rev/A.docs:null,plan:A.plan||null,fcp:A.plan?A.fc/A.plan:null,stock:A.stock,bad:A.dead+A.excess,debt:A.debt,okP:false}})}</div>`;
  // помесячно стеком
  const from='2026-01'; const ser=[]; const ms=cs.map(code=>({code,map:scan(code,C[code].meta.dataStart,T,{},'mo').map}));
  for(let mo=from;mo<=T.slice(0,7);mo=nextMo(mo)){ const parts={}; let rev=0,gp=0; for(const x of ms){ const v=x.map.get(mo)||Z; parts[x.code]=v.rev; rev+=v.rev; gp+=v.gp; } ser.push({mo,rev,gp,parts,partial:mo===T.slice(0,7)}); }
  h+=`<div class="grid g32" style="margin-top:14px"><div class="panel"><h3>Выручка группы по месяцам</h3><p class="sub">Бижутерия — с 22 августа 2026 · клик по месяцу — выбрать период</p>${monthChart(ser,{stack:cs.map(code=>({key:code,label:CO(code).short,color:CO(code).color}))})}</div>
    <div class="panel"><h3>Риски и возможности</h3><p class="sub">Клик — к причине</p>${sig.slice(0,9).map(s=>`<div style="display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line)">${s.opp?pill('g','Возможность'):pill(s.sev,{r:'Риск',y:'Внимание',g:'Норма'}[s.sev])}<div style="min-width:0"><button class="lnk" ${act({go:s.go})}>${esc(s.title)}</button><div class="note">${esc(s.text)}</div></div></div>`).join('')}</div></div>`;
  h+=dataQuality(cs);
  h+=notesFoot(cs);
  return h;
}
function notesFoot(list){ return `<div class="foot"><div class="eyebrow">Ограничения данных</div>${list.map(code=>`<div><b style="font-size:12.5px">${esc(CO(code).name)}</b> <span class="note">· выгрузка ${esc(C[code].meta.exported)} · товары с ${dLab(C[code].meta.lineFrom)}</span><ul>${C[code].meta.notes.map(n=>`<li>${esc(n)}</li>`).join('')}${C[code].meta.missingCost>1e6?`<li>У части товаров нет себестоимости в МойСклад (≈${esc(money(C[code].meta.missingCost))} выручки за всю историю): по ним маржа завышена до ~100%.</li>`:''}</ul></div>`).join('')}<p class="note">Доступ к МойСклад — только чтение. Выручка без внутренних продаж между компаниями группы (переключатель «внутренние» включает их).</p></div>`; }


// ================= СРАВНЕНИЕ ПЕРИОДОВ: текущий · предыдущий · год назад =================
const ND='<span class="nd">Недостаточно данных</span>';
function cmpBase(code,f,cmp){ // {r,a,b|null,why}
  const r=rng(S.per,cmp,code), c=C[code];
  if(r.nodataC) return {r,a:null,b:null,why:'нет данных за период'};
  const a=tot(code,r.from,r.to,f);
  if(!hasCmp(code,r)) return {r,a,b:null,why:'учёт в МойСклад с '+dLab(c.meta.dataStart)+' '+c.meta.dataStart.slice(0,4)};
  if(needLines(f,null)&&r.pf<c.meta.lineFrom) return {r,a,b:null,why:'товары выгружены с '+dLab(c.meta.lineFrom)};
  return {r,a,b:tot(code,r.pf,r.pt,f),why:''};
}
function sumT(list){ const o={rev:0,gp:0,docs:0}; for(const x of list){ o.rev+=x.rev; o.gp+=x.gp; o.docs+=x.docs; } o.m=o.rev>0?o.gp/o.rev:null; o.avg=o.docs?o.rev/o.docs:null; return o; }
function cmpStrip(code,f){ // code=null — группа
  const list=code?[code]:codes();
  const P=list.map(x=>cmpBase(x,f,'prev')), Y=list.map(x=>cmpBase(x,f,'ly'));
  const hasA=P.filter(x=>x.a), a=hasA.length?sumT(hasA.map(x=>x.a)):null;
  // база сравнения — только по компаниям, у которых она есть; текущий для Δ — по тем же компаниям
  const pP=P.filter(x=>x.a&&x.b), pY=Y.filter(x=>x.a&&x.b);
  const b=pP.length?sumT(pP.map(x=>x.b)):null, aP=pP.length?sumT(pP.map(x=>x.a)):null;
  const y=pY.length?sumT(pY.map(x=>x.b)):null, aY=pY.length?sumT(pY.map(x=>x.a)):null;
  const whyP=P.filter(x=>!x.b).map((x,i)=>(code?'':CO(list[P.indexOf(x)]).short+': ')+x.why);
  const whyY=Y.filter(x=>!x.b).map((x)=>(code?'':CO(list[Y.indexOf(x)]).short+': ')+x.why);
  const subP=!code&&pP.length&&pP.length<list.length?' Изменение к предыдущему — только по '+pP.map(x=>CO(list[P.indexOf(x)]).short).join(', ')+'.':'';
  const subY=!code&&pY.length&&pY.length<list.length?' Изменение к прошлому году — только по '+pY.map(x=>CO(list[Y.indexOf(x)]).short).join(', ')+'.':'';
  const M=[['Выручка','rev',money],['Валовая прибыль','gp',money],['Маржа','m',v=>pct(v)],['Документы продаж','docs',v=>num(v)],['Средний чек','avg',money]];
  const cell=(cur,base,k)=>{ if(!base||!cur) return `<td class="n" colspan="2">${ND}</td>`; const v=cur[k],w=base[k];
    if(v==null||w==null) return `<td class="n" colspan="2">${ND}</td>`;
    if(k==='m') return `<td class="n">${pct(w)}</td><td class="n">${dl(v,w,{ppm:true})}</td>`;
    const fm=k==='docs'?(z=>(z>0?'+':z<0?'−':'')+num(Math.abs(z))):smoney;
    return `<td class="n">${k==='docs'?num(w):money(w)}</td><td class="n">${dl(v,w)}<span class="sm">${fm(v-w)}</span></td>`; };
  const r0=P[0].r, r1=Y[0].r;
  let h=`<div class="panel" style="margin-top:14px"><h3>Сравнение периодов</h3><p class="sub">Текущий: ${esc(code?r0.label:rng(S.per,'prev',null).label)} · предыдущий: ${esc(r0.cl)} · год назад: ${esc(r1.cl)}</p>
  <div class="tw"><table><thead><tr><th class="l">Показатель</th><th>Текущий</th><th>Предыдущий</th><th>Изменение</th><th>Год назад</th><th>Изменение</th></tr></thead><tbody>`;
  for(const [l,k,fm] of M){ h+=`<tr><td class="l">${l}</td><td class="n"><b>${a&&a[k]!=null?fm(a[k]):ND}</b></td>${cell(aP,b,k)}${cell(aY,y,k)}</tr>`; }
  h+=`</tbody></table></div>`;
  const notes=[]; if(whyP.length) notes.push('Предыдущий период — недостаточно данных: '+whyP.join('; ')+'.'); if(whyY.length) notes.push('Год назад — недостаточно данных: '+whyY.join('; ')+'.');
  if(subP) notes.push(subP); if(subY) notes.push(subY);
  if(notes.length) h+=`<p class="note" style="margin:8px 0 0">${esc(notes.join(' '))}</p>`;
  return h+'</div>';
}

// ================= КАЧЕСТВО ДАННЫХ =================
function dqMonths(code){ // выручка модели (все документы, включая внутренние) против отчёта прибыльности МойСклад
  const c=C[code], m=c.meta, by=new Map();
  for(let i=0;i<c.n;i++){ const mo=c.dayStr[c.d[i]].slice(0,7); by.set(mo,(by.get(mo)||0)+c.rev[i]); }
  return Object.keys(m.check||{}).sort().map(mo=>{ const rep=m.check[mo], mod=by.get(mo)||0; return {mo,rep,mod,diff:mod-rep,dp:rep?(mod-rep)/rep:null}; });
}
function dqAgg(code){ // детализация сходится с итогом?
  let r=rng(S.per,S.cmp,code); const f={}; if(r.nodataC) r=rng('m:'+TC(code).slice(0,7),'prev',code);
  const t=tot(code,r.from,r.to,f).rev, out=[];
  for(const d of ['pt','ch','emp','cl']){ const sum=compare(code,r,f,d).reduce((s,x)=>s+x.rev,0); out.push([DIMS_PL[d],sum-t]); }
  if(r.from>=C[code].meta.lineFrom) for(const d of ['cat','p']){ const sum=compare(code,r,f,d).reduce((s,x)=>s+x.rev,0); out.push([DIMS_PL[d],sum-t]); }
  out.per=r.label; return out;
}
function dataQuality(list){
  let h=sec('Качество данных','источник, дата выгрузки, полнота, сверка');
  h+='<div class="grid '+(list.length>1?'g3':'g2')+'">';
  for(const code of list){ const c=C[code], m=c.meta; const mm=dqMonths(code); const bad=mm.filter(x=>x.dp!=null&&Math.abs(x.dp)>0.005&&x.mo<T.slice(0,7));
    const ag=dqAgg(code); const agBad=ag.filter(x=>Math.abs(x[1])>1);
    h+=`<div class="panel"><h3>${esc(CO(code).name)}</h3><dl class="kv" style="margin-top:8px">
      <dt>Источник</dt><dd>${code==='bijou'?'МойСклад (UMAG/Wildberries не подключены)':'МойСклад'} · только чтение</dd>
      <dt>Выгрузка</dt><dd>${esc(m.exported)} · данные по ${dLab(TC(code))}${TC(code)<T?' '+pill('y','устарели'):''}</dd>
      <dt>История</dt><dd>документы с ${dLab(m.dataStart)} ${m.dataStart.slice(0,4)}, товары с ${dLab(m.lineFrom)}</dd>
      <dt>Сверка с отчётом</dt><dd>${mm.length?(bad.length?pill('y','расхождение')+' '+bad.map(x=>monName(x.mo)+' '+pct(x.dp,1)).join(', '):pill('g','сходится')+' '+mm.length+' мес., отклонение < 0,5%'):'<span class="nd">Недостаточно данных</span>'}</dd>
      <dt>Детализация = итог</dt><dd>${ag.length?(agBad.length?pill('r','не сходится')+' '+agBad.map(x=>x[0]+' '+smoney(x[1])).join(', '):pill('g','сходится')+' '+ag.map(x=>x[0].toLowerCase()).join(', ')+' · '+esc(ag.per)):'<span class="nd">Недостаточно данных</span>'}</dd>
      <dt>Без себестоимости</dt><dd>${m.missingCost>0?money(m.missingCost)+' выручки — маржа по ним завышена':'нет'}</dd>
      <dt>Не рассчитывается</dt><dd>чистая прибыль (нет расходов), конверсия (нет данных о посетителях/лидах), кредиторка (оплаты поставщикам не проводятся)</dd></dl></div>`; }
  return h+'</div>';
}

// ================= RENDER =================
const VIEWS={overview:'Обзор',pt:'Точки',ch:'Каналы',cat:'Категории',p:'Товары',emp:'Менеджеры',clients:'Клиенты',ops:'Операции',stock:'Склад'};
const LEVEL={pt:2,ch:3,cat:4,p:5,emp:6,cl:6};
function renderTop(){
  $('#cos').innerHTML=[...(ME.group?[`<button aria-pressed="${!S.co}" ${act({co:null})}>Группа</button>`]:[]),...codes().map(code=>`<button aria-pressed="${S.co===code}" ${act({co:code})}><span class="dot" style="background:${CO(code).color}"></span>${esc(CO(code).short)}</button>`)].join('');
}
function renderCtx(){
  const r=rng(); let cr=ME.group?`<button ${act({co:null})}>Группа</button>`:'';
  if(S.co){ cr+=(ME.group?`<span class="sep">›</span>`:'')+(S.path.length||S.view!=='overview'?`<button ${act({crumb:0})}>${esc(CO(S.co).short)}</button>`:`<span class="cur">${esc(CO(S.co).short)}</span>`);
    S.path.forEach((d,i)=>{ const last=i===S.path.length-1&&S.view==='overview'; cr+=`<span class="sep">›</span>`+(last?`<span class="cur"><small>${DIMS[d]}</small>${esc(dimName(S.co,d,S.f[d]))}</span>`:`<button ${act({crumb:i+1})}><small>${DIMS[d]}</small>${esc(dimName(S.co,d,S.f[d]))}</button>`); });
    if(S.view!=='overview') cr+=`<span class="sep">›</span><span class="cur">${VIEWS[S.view]}</span>`; }
  else cr=`<span class="cur">Группа компаний</span>`;
  const chips=`<span class="chip per">${esc(r.label)} · vs ${esc(r.cl)}</span>`+(S.co?S.path.map(d=>`<span class="chip"><b>${DIMS[d]}</b>${esc(dimName(S.co,d,S.f[d]))}<button ${act({rm:d})} aria-label="Снять фильтр">×</button></span>`).join(''):'')+(S.inc?'<span class="chip per">с внутренними</span>':'');
  $('#ctx').innerHTML=`<button class="back" ${act({fn:back})} ${HIST.length?'':'disabled'}>← Назад</button><button class="back" ${act({fn:up})} ${S.co&&(ME.group||S.path.length||S.view!=='overview')?'':'disabled'}>↑ Выше</button><nav class="crumbs" aria-label="Путь">${cr}</nav><div class="chips">${chips}</div>`;
}
function render(){
  if(!S.co&&!ME.group) S.co=codes()[0];
  ACTS=[]; renderTop(); renderCtx();
  const main=$('#main'); let h='';
  if(!S.co) h=viewGroup();
  else { const code=S.co, f=S.f;
    const lvl=S.view==='ops'?7:S.path.length?Math.max(...S.path.map(d=>LEVEL[d])):1;
    h+=`<div class="head"><div><div class="eyebrow">Уровень ${lvl} · ${S.path.length?DIMS[S.path[S.path.length-1]]:'Компания'}${S.view!=='overview'?' · '+VIEWS[S.view]:''}</div><h1>${esc(sliceTitle(code))}</h1><p>${esc(CO(code).name)} · ${esc(sliceSub(code))} · ${esc(rng().label)}</p></div></div>`;
    const tabs=['overview',...['pt','ch','cat','p','emp'].filter(d=>f[d]==null&&dimsAvail(code).includes(d)),...(f.cl==null?['clients']:[]),'ops','stock'];
    h+=`<div class="tabs" role="tablist">${tabs.map(v=>`<button role="tab" aria-selected="${S.view===v}" ${act({view:v})}>${VIEWS[v]}</button>`).join('')}</div>`;
    const v=S.view;
    h+= v==='overview'?viewOverview(code): v==='clients'?viewClients(code): v==='ops'?viewOps(code): v==='stock'?viewStock(code): viewDim(code,v);
    if(S.view==='overview'&&!S.path.length) h+=dataQuality([code]);
    h+=notesFoot([code]);
  }
  main.innerHTML=h;
  renderAI();
}
function syncCtl(){ $('#per').value=S.per; $('#cmp').value=S.cmp; $('#inc').checked=S.inc; }

// ================= EVENTS =================
document.addEventListener('click',e=>{
  const cl=e.target.closest('[data-close]'); if(cl){ closeDrawer(); return; }
  const a=e.target.closest('[data-a]'); if(a){ e.preventDefault(); runAct(ACTS[+a.dataset.a]); return; }
  const th=e.target.closest('th[data-sort]'); if(th){ const [id,k]=th.dataset.sort.split('|'); const st=S.sort[id]; S.sort[id]={k,d:st&&st.k===k?-st.d:-1}; if(th.closest('#layer')){ return; } render(); return; }
  const mo=e.target.closest('[data-more]'); if(mo){ S.more[mo.dataset.more]=1; render(); return; }
  const tr=e.target.closest('tr[data-t]'); if(tr){ const R=TABREG[tr.dataset.t]; if(R&&R.click) R.click(R.rows[+tr.dataset.i]); }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('#layer').innerHTML){ closeDrawer(); return; }
  if(e.key==='Enter'){ const tr=e.target.closest&&e.target.closest('tr[data-t]'); if(tr){ const R=TABREG[tr.dataset.t]; if(R&&R.click) R.click(R.rows[+tr.dataset.i]); } }
  if(e.key==='Backspace'&&e.altKey) back();
});
let qT=null;
document.addEventListener('input',e=>{ if(e.target.id==='opsq'){ S.q.ops=e.target.value; clearTimeout(qT); qT=setTimeout(()=>{ const pos=e.target.selectionStart; render(); const el=$('#opsq'); if(el){ el.focus(); el.setSelectionRange(pos,pos); } },250); } });
$('#per').addEventListener('change',e=>{ HIST.push(snapshot()); S.per=e.target.value; render(); });
$('#cmp').addEventListener('change',e=>{ HIST.push(snapshot()); S.cmp=e.target.value; render(); });
$('#inc').addEventListener('change',e=>{ S.inc=e.target.checked; for(const k in _CS) delete _CS[k]; render(); });
$('#home').addEventListener('click',()=>nav({co:null,view:'overview',f:{},path:[]}));
$('#btn-ai').addEventListener('click',()=>{ $('#ai').scrollIntoView({behavior:'smooth'}); setTimeout(()=>{ const q=$('#aiq'); if(q) q.focus({preventScroll:true}); },400); });

// ================= INIT =================
async function startApp(){
  try{
    const res=await Promise.allSettled(COS.filter(x=>ME.dirs.includes(x.code)).map(async x=>{ const j=await API.data(x.code); $('#lmsg').textContent='Загружено: '+x.short; return [x.code,j]; }));
    for(const x of res) if(x.status==='fulfilled') prep(x.value[0],x.value[1]); else console.error(x.reason);
    if(!codes().length) throw new Error(ME.dirs.length?'данных по вашему направлению пока нет':'нет доступных направлений');
    if(!ME.group) S.co=codes()[0];
    T=codes().map(x=>C[x].meta.asOf||C[x].meta.exported.slice(0,10)).sort().pop(); // последний день с данными, а не дата выгрузки — утренняя выгрузка не даёт ложного «период сокращён»
    LIVE=codes().some(x=>C[x].meta.asOf===T&&C[x].meta.exported.slice(0,10)===T);
    if(+T.slice(8)<=5) S.per='m:'+prevMo(T.slice(0,7));
    $('#asof').textContent='на '+dShort(T);
    $('#per').innerHTML=periodOptions().map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('');
    $('#cmp').innerHTML='<option value="prev">к прошлому периоду</option><option value="ly">к прошлому году</option>';
    syncCtl(); renderGloss(); render();
  }catch(err){ $('#main').innerHTML=`<div class="empty">Не удалось загрузить данные: ${esc(err.message)}. Обновите страницу.</div>`; console.error(err); }
}

// ================= ТЕМА (день/ночь) И ЯЗЫК (RU/KZ) =================
const PREF={get(k,d){ try{ return localStorage.getItem('ansaros.'+k)||d; }catch(e){ return d; } },set(k,v){ try{ localStorage.setItem('ansaros.'+k,v); }catch(e){} }};
let LANG=PREF.get('lang','ru');
function sysDark(){ try{ return matchMedia('(prefers-color-scheme: dark)').matches; }catch(e){ return false; } }
function curTheme(){ return document.documentElement.dataset.theme||(sysDark()?'dark':'light'); }
function applyTheme(t){ document.documentElement.dataset.theme=t; const b=$('#btn-theme'); if(b){ b.textContent=t==='dark'?'☀':'☾'; b.setAttribute('aria-label',t==='dark'?(LANG==='kk'?'Күндізгі режим':'Дневной режим'):(LANG==='kk'?'Түнгі режим':'Ночной режим')); b.title=b.getAttribute('aria-label'); } }

// Казахский словарь интерфейса: фразы заменяются целиком, длинные первыми
const KK=[
 ['AI-помощник подключается к серверу AnsarOS — будет доступен на следующем шаге.','AI-көмекші AnsarOS серверіне қосылуда — келесі қадамда қолжетімді болады.'],
 ['данных по вашему направлению пока нет','сіздің бағытыңыз бойынша деректер әзірге жоқ'],
 ['Не удалось загрузить данные','Деректерді жүктеу мүмкін болмады'],
 ['Пользователи','Пайдаланушылар'],
 ['Журнал','Журнал'],
 ['Выйти','Шығу'],
 // крупные фразы
 ['Нет сопоставимого периода для сравнения — причины изменения не рассчитываются','Салыстыруға келетін кезең жоқ — өзгеріс себептері есептелмейді'],
 ['Изменение распределено равномерно, без одного главного источника','Өзгеріс біркелкі бөлінген, бір басты көзі жоқ'],
 ['Прогноз считается для текущего месяца; выбран закрытый период','Болжам ағымдағы айға есептеледі; жабық кезең таңдалған'],
 ['Остатки и скорость продаж считаются по компании целиком (фильтры точки, канала, менеджера и клиента здесь не применяются). Остатки по складам — в карточке товара','Қалдықтар мен сату жылдамдығы бүкіл компания бойынша есептеледі (нүкте, арна, менеджер және клиент сүзгілері мұнда қолданылмайды). Қоймалар бойынша қалдықтар — тауар карточкасында'],
 ['Доступ к МойСклад — только чтение. Выручка без внутренних продаж между компаниями группы (переключатель «внутренние» включает их)','МойСклад-қа рұқсат — тек оқу. Түсім топ компаниялары арасындағы ішкі сатусыз («ішкі» қосқышы оларды қосады)'],
 ['он ещё не закончился: сравнение с полными днями прошлого периода занижает результат. Для итогов выберите «','ол әлі аяқталмаған: өткен кезеңнің толық күндерімен салыстыру нәтижені төмендетеді. Қорытынды үшін таңдаңыз: «'],
 ['Долг по отчёту «Контрагенты» МойСклад (баланс взаиморасчётов). Учитывайте, что часть оплат может быть не проведена','МойСклад «Контрагенттер» есебі бойынша борыш (өзара есеп айырысу балансы). Төлемдердің бір бөлігі өткізілмеген болуы мүмкін'],
 ['AI видит только цифры AnsarOS по текущему срезу и не придумывает данные. Ответ тратит лимит вашего аккаунта Claude.','AI тек ағымдағы кесінді бойынша AnsarOS сандарын көреді және деректерді ойдан шығармайды. Жауап Claude аккаунтыңыздың лимитін жұмсайды.'],
 ['Спросите обычным языком, например: почему упала маржа у менеджера?','Қарапайым тілмен сұраңыз, мысалы: менеджердің маржасы неге төмендеді?'],
 ['Покупали 3+ раз, но пауза уже вдвое дольше обычной (и больше 21 дня).','3+ рет сатып алған, бірақ үзіліс әдеттегіден екі есе ұзақ (және 21 күннен көп).'],
 ['Покупали регулярно, пауза вдвое дольше обычной — позвонить','Тұрақты сатып алған, үзіліс әдеттегіден екі есе ұзақ — қоңырау шалу'],
 ['Выручка выросла больше чем на 30% к периоду сравнения.','Түсім салыстыру кезеңіне қарағанда 30%-дан астам өсті.'],
 ['Выручка упала больше чем на 30% к периоду сравнения.','Түсім салыстыру кезеңіне қарағанда 30%-дан астам төмендеді.'],
 ['Топ-10% клиентов по выручке за период.','Кезеңдегі түсім бойынша клиенттердің үздік 10%-ы.'],
 ['Долг и «уснувшие» считаются по клиенту в целом, не по точке.','Борыш пен «ұйықтаған» клиенттер нүкте бойынша емес, клиент бойынша жалпы есептеледі.'],
 ['Связаться с должниками, начиная с тех, у кого нет отгрузок 60+ дн.','60+ күн жөнелтілім болмаған борышкерлерден бастап хабарласу.'],
 ['Распределить недостающий объём по менеджерам и точкам','Жетіспейтін көлемді менеджерлер мен нүктелерге бөлу'],
 ['Дозаказать ходовые позиции до обнуления остатка','Қалдық бітпей тұрып өтімді позицияларға қосымша тапсырыс беру'],
 ['Вывести неликвид: распродажа, комплекты, возврат поставщику','Өтімсіз тауарды шығару: сатып жіберу, жиынтықтар, жеткізушіге қайтару'],
 ['Обзвонить «уснувших» постоянных клиентов','«Ұйықтаған» тұрақты клиенттерге қоңырау шалу'],
 ['Разобрать, что сработало, и масштабировать','Не нәтиже бергенін талдап, кеңейту'],
 ['Разобрать падение с ответственным','Төмендеуді жауапты адаммен талдау'],
 ['по цепочке причин','себептер тізбегі бойынша'],
 ['Проверить скидки и цены','Жеңілдіктер мен бағаларды тексеру'],
 ['позиции с падением маржи','маржасы төмендеген позициялар'],
 ['Остановить закупку по позициям с запасом >','Қоры келесіден көп позицияларды сатып алуды тоқтату: >'],
 ['дн., перераспределить товар','күн, тауарды қайта бөлу'],
 ['Критичных отклонений нет.','Маңызды ауытқулар жоқ.'],
 ['Сортировка по вкладу в изменение выручки','Түсім өзгерісіне үлесі бойынша сұрыптау'],
 ['Сортировка по выручке','Түсім бойынша сұрыптау'],
 ['вклад в изменение к периоду «','өзгеріске үлес, салыстыру кезеңі «'],
 ['структура выручки · клик — углубиться','түсім құрылымы · басу — тереңдеу'],
 ['клик — углубиться','басу — тереңдеу'],
 ['вся история в МойСклад · клик по месяцу — выбрать период','МойСклад-тағы бүкіл тарих · айды басу — кезеңді таңдау'],
 ['клик по месяцу — выбрать период','айды басу — кезеңді таңдау'],
 ['Бледный столбец — неполный месяц','Бозғылт баған — толық емес ай'],
 ['Клик по дню — операции дня','Күнді басу — күн операциялары'],
 ['Клик — открыть месяц','Басу — айды ашу'],
 ['Клик — к причине','Басу — себепке өту'],
 ['клик — перейти в компанию','басу — компанияға өту'],
 ['Бижутерия — с 22 августа 2026','Бижутерия — 2026 жылғы 22 тамыздан'],
 ['что это и какое решение помогает принять','бұл не және қандай шешім қабылдауға көмектеседі'],
 ['отвечает по текущей компании, периоду и фильтрам','ағымдағы компания, кезең және сүзгілер бойынша жауап береді'],
 ['Дневной график доступен для периодов до 3 месяцев.','Күндік график 3 айға дейінгі кезеңдер үшін қолжетімді.'],
 ['Нет данных за выбранный период','Таңдалған кезеңде деректер жоқ'],
 ['Нет остатков и продаж за последние 28 дней.','Соңғы 28 күнде қалдық та, сату да жоқ.'],
 ['Разбивки по складам нет (один склад).','Қоймалар бойынша бөліну жоқ (бір қойма).'],
 ['Нет базы сравнения для разложения.','Жіктеу үшін салыстыру базасы жоқ.'],
 ['результат на уровне прошлого периода','нәтиже өткен кезең деңгейінде'],
 ['Выручка на уровне сравниваемого периода.','Түсім салыстырылатын кезең деңгейінде.'],
 ['структура без существенных изменений','құрылымда елеулі өзгеріс жоқ'],
 ['больше всего изменения: остальные в обратную сторону','өзгерістің ең үлкені: қалғандары кері бағытта'],
 ['Оборот растёт, но маржа падает','Айналым өсуде, бірақ маржа төмендеуде'],
 ['при росте оборота','айналым өскенде'],
 ['новое направление: за','жаңа бағыт:'],
 ['было всего','барлығы болған'],
 ['Недостаточно данных','Деректер жеткіліксіз'],
 ['Ограничение данных.','Деректер шектеуі.'],
 ['Ограничения данных','Деректер шектеулері'],
 ['Период включает сегодняшний день','Кезеңге бүгінгі күн кіреді'],
 ['План утверждён','Жоспар бекітілген'],
 ['месяц закрыт','ай жабылды'],
 ['план выполнен','жоспар орындалды'],
 ['в раб. день (14 дн.)','жұмыс күніне (14 күн)'],
 ['в рабочий день против','жұмыс күніне, қазіргі'],
 ['в рабочий день при темпе','жұмыс күніне, қарқын'],
 ['в рабочий день, осталось','жұмыс күніне, қалды'],
 ['раб. дн.','жұмыс күні'],
 ['в раб. день','жұмыс күніне'],
 ['Прогноз на конец','Соңына болжам:'],
 ['Прогноз группы на конец','Топтың соңына болжамы:'],
 ['закончится через','бітеді, қалған мерзім:'],
 ['уже нет в наличии','қазір қолда жоқ'],
 ['нет в наличии','қолда жоқ'],
 ['при темпе','қарқынмен'],
 ['шт/день','дана/күн'],
 ['Основная причина —','Негізгі себеп —'],
 ['внутри —','ішінде —'],
 ['изменения)','өзгерістің)'],
 ['меньше клиентов','клиенттер азырақ'],
 ['больше клиентов','клиенттер көбірек'],
 ['реже покупают','сирек сатып алады'],
 ['чаще покупают','жиі сатып алады'],
 ['ниже средний чек','орташа чек төмен'],
 ['выше средний чек','орташа чек жоғары'],
 ['меньше чеков','чектер азырақ'],
 ['больше чеков','чектер көбірек'],
 ['те же дни прошлого месяца','өткен айдың сол күндері'],
 ['тот же период год назад','бір жыл бұрынғы сол кезең'],
 ['к прошлому периоду','өткен кезеңмен'],
 ['к прошлому году','өткен жылмен'],
 ['Сильнее всего упал','Ең көп төмендеген:'],
 ['Больше всего вырос','Ең көп өскен:'],
 ['Сильнее всего тянет','Ең көп әсер етуші:'],
 ['сильнее всего','ең көп'],
 ['док., средний чек','құжат, орташа чек'],
 ['Валовая прибыль','Жалпы пайда'],
 ['валовая прибыль','жалпы пайда'],
 ['Вал. прибыль','Жалпы пайда'],
 ['Средний чек','Орташа чек'],
 ['средний чек','орташа чек'],
 ['Ср. чек','Орт. чек'],
 ['Неликвид + избыток','Өтімсіз + артық қор'],
 ['Неликвид+избыток','Өтімсіз+артық'],
 ['Сверх 90 дн. запаса','90 күннен артық қор'],
 ['запас сверх','артық қор'],
 ['Стоимость склада','Қойма құны'],
 ['по себестоимости продаж 28 дн.','28 күндік сату өзіндік құны бойынша'],
 ['по себестоимости','өзіндік құн бойынша'],
 ['оборачиваемость','айналымдылық'],
 ['Оборачиваемость','Айналымдылық'],
 ['Оборач., дн','Айналым, күн'],
 ['по отчёту контрагентов','контрагенттер есебі бойынша'],
 ['требует сверки оплат','төлемдерді салыстыруды қажет етеді'],
 ['клиенты менеджера','менеджердің клиенттері'],
 ['розн. чеков','бөлшек чек'],
 ['Выручка по дням','Күндер бойынша түсім'],
 ['Выручка по месяцам','Айлар бойынша түсім'],
 ['Выручка группы по месяцам','Айлар бойынша топ түсімі'],
 ['Динамика по месяцам','Айлар бойынша динамика'],
 ['Что двигает результат','Нәтижені не қозғайды'],
 ['Последние операции','Соңғы операциялар'],
 ['Все операции','Барлық операциялар'],
 ['Операции клиента','Клиент операциялары'],
 ['Сравнение компаний','Компанияларды салыстыру'],
 ['Сравнение периодов','Кезеңдерді салыстыру'],
 ['Риски и возможности','Тәуекелдер мен мүмкіндіктер'],
 ['Карточка товара','Тауар карточкасы'],
 ['Карточка клиента','Клиент карточкасы'],
 ['Разбор менеджера','Менеджерді талдау'],
 ['Уснувшие клиенты менеджера','Менеджердің ұйықтаған клиенттері'],
 ['Остатки по складам','Қоймалар бойынша қалдықтар'],
 ['Текущий остаток, шт','Ағымдағы қалдық, дана'],
 ['Покупки по месяцам','Айлар бойынша сатып алулар'],
 ['Словарь показателей','Көрсеткіштер сөздігі'],
 ['AI-помощник руководителя','Басшының AI-көмекшісі'],
 ['Какое решение помогает принять','Қандай шешім қабылдауға көмектеседі'],
 ['Как считается в AnsarOS','AnsarOS-та қалай есептеледі'],
 ['Почему упала выручка?','Түсім неге төмендеді?'],
 ['Какая точка тянет результат вниз?','Қай нүкте нәтижені төмен тартады?'],
 ['Что срочно дозаказать?','Нені шұғыл қосымша тапсырыс беру керек?'],
 ['Какой неликвид нужно распродать?','Қандай өтімсіз тауарды сатып жіберу керек?'],
 ['Какие менеджеры просели и почему?','Қай менеджерлердің көрсеткіші түсті және неге?'],
 ['Где у нас заморожены деньги?','Ақшамыз қайда тұрып қалған?'],
 ['Кто из клиентов перестал покупать?','Қай клиенттер сатып алуды тоқтатты?'],
 ['Думаю… (обычно 10–40 секунд)','Ойланып жатырмын… (әдетте 10–40 секунд)'],
 ['Поиск: номер, клиент, менеджер','Іздеу: нөмір, клиент, менеджер'],
 ['Первая / последняя покупка','Бірінші / соңғы сатып алу'],
 ['Себестоимость / цена','Өзіндік құн / баға'],
 ['Последняя продажа','Соңғы сату'],
 ['Основной менеджер','Негізгі менеджер'],
 ['Выручка всего / 90 дн.','Барлық түсім / 90 күн'],
 ['Выручка за всё время','Барлық уақыттағы түсім'],
 ['Выручка за период','Кезеңдегі түсім'],
 ['Выручка 28 дн.','Түсім 28 күн'],
 ['Выручка 90 дн.','Түсім 90 күн'],
 ['Посл. покупка, дн назад','Соңғы сатып алу, күн бұрын'],
 ['Обычный интервал, дн','Әдеттегі аралық, күн'],
 ['Интервал, дн','Аралық, күн'],
 ['Пауза, дн','Үзіліс, күн'],
 ['Без продаж, дн','Сатусыз, күн'],
 ['Дней запаса','Қор күндері'],
 ['Остаток, шт','Қалдық, дана'],
 ['Покупок всего','Барлық сатып алу'],
 ['Вклад в Δ','Δ-ға үлес'],
 ['Δ к сравн.','Салыст. Δ'],
 ['Не оплачено','Төленбеген'],
 ['Прогноз, % плана','Болжам, жоспардың %'],
 ['Факт, % плана','Факт, жоспардың %'],
 ['План мес.','Ай жоспары'],
 ['План / прогноз','Жоспар / болжам'],
 ['План / факт','Жоспар / факт'],
 ['План на','Жоспар:'],
 ['Автоплан: среднее за','Автожоспар: орташа,'],
 ['полных мес. +5% — утверждённого плана нет','толық ай +5% — бекітілген жоспар жоқ'],
 ['(автоплан)','(автожоспар)'],
 ['автоплана','автожоспардың'],
 ['автоплан','автожоспар'],
 ['Показать все','Барлығын көрсету'],
 ['Показано','Көрсетілген'],
 ['Снять фильтр','Сүзгіні алу'],
 ['Группа компаний','Компаниялар тобы'],
 ['Группа «Ансар»','«Ансар» тобы'],
 ['Выручка группы','Топ түсімі'],
 ['Вся компания','Бүкіл компания'],
 ['данные МойСклад на','МойСклад деректері, күні:'],
 ['сравнение:','салыстыру:'],
 ['Что произошло','Не болды'],
 ['Что будет','Не болады'],
 ['Что делать','Не істеу керек'],
 ['Почему','Неге'],
 ['Возможность','Мүмкіндік'],
 ['Внимание','Назар аударыңыз'],
 ['Недостаток','Кемшілік'],
 ['перевыполнение','асыра орындау'],
 ['Перевыполнение','Асыра орындау'],
 ['не хватило','жетпеді'],
 ['Не хватило','Жетпеді'],
 ['Не хватает','Жетіспейді'],
 ['выполнит','орындайды'],
 ['выполним','орындалады'],
 ['закрыт:','жабылды:'],
 ['закрыт на','жабылды:'],
 ['при плане','жоспар'],
 ['Розничная продажа','Бөлшек сату'],
 ['Возврат покупателя','Сатып алушы қайтаруы'],
 ['Возврат (розница)','Қайтару (бөлшек)'],
 ['Розничные / без клиента','Бөлшек / клиентсіз'],
 ['розничный покупатель','бөлшек сатып алушы'],
 ['Без ответственного','Жауаптысыз'],
 ['Без категории','Санатсыз'],
 ['Последние 7 дней','Соңғы 7 күн'],
 ['Последние 30 дней','Соңғы 30 күн'],
 ['Последние 90 дней','Соңғы 90 күн'],
 ['(текущий)','(ағымдағы)'],
 ['дней по','күн, соңғысы'],
 ['Загружаю данные МойСклад…','МойСклад деректері жүктелуде…'],
 ['Уровень','Деңгей'],
 ['Компания','Компания'],
 ['Показатель','Көрсеткіш'],
 ['Текущий','Ағымдағы'],
 ['Предыдущий','Алдыңғы'],
 ['Год назад','Бір жыл бұрын'],
 ['Изменение','Өзгеріс'],
 ['Действие','Әрекет'],
 ['Действий не требуется.','Әрекет қажет емес.'],
 ['Дозаказать','Қосымша тапсырыс беру'],
 ['Остановить закупку','Сатып алуды тоқтату'],
 ['Вывести: распродажа / возврат','Шығару: сатып жіберу / қайтару'],
 ['Проверить выкладку и цену','Сөре мен бағаны тексеру'],
 ['Растущие','Өсіп келе жатқандар'],
 ['Уснувшие','Ұйықтағандар'],
 ['Должники','Борышкерлер'],
 ['Крупные','Ірілер'],
 ['Падают','Төмендеуде'],
 ['Растут','Өсуде'],
 ['Должник','Борышкер'],
 ['Активен','Белсенді'],
 ['Уснул','Ұйықтады'],
 ['В норме','Қалыпты'],
 ['Продано','Сатылды'],
 ['Позиции','Позициялар'],
 ['Оплачено','Төленді'],
 ['полностью','толық'],
 ['Прибыль','Пайда'],
 ['Кол-во','Саны'],
 ['Цена','Баға'],
 ['Сумма','Сома'],
 ['Дата','Күні'],
 ['Итого','Барлығы'],
 ['Доля','Үлес'],
 ['Темп','Қарқын'],
 ['Нужно','Қажет'],
 ['Осталось','Қалды'],
 ['выходной:','демалыс:'],
 ['Выходной','Демалыс'],
 ['выходной','демалыс'],
 ['день не закончен','күн аяқталмаған'],
 ['Сравнение','Салыстыру'],
 ['Выручка','Түсім'],
 ['выручка','түсім'],
 ['Маржа','Маржа'],
 ['Документы','Құжаттар'],
 ['Клиенты','Клиенттер'],
 ['клиентов','клиент'],
 ['Склад','Қойма'],
 ['Неликвид','Өтімсіз тауар'],
 ['неликвид','өтімсіз тауар'],
 ['Избыток','Артық қор'],
 ['Дефицит','Тапшылық'],
 ['дефицит','тапшылық'],
 ['избыток','артық қор'],
 ['Дебиторка','Дебиторлық берешек'],
 ['Прогноз','Болжам'],
 ['прогноз','болжам'],
 ['Обзор','Шолу'],
 ['Точки','Нүктелер'],
 ['Каналы','Арналар'],
 ['Категории','Санаттар'],
 ['Товары','Тауарлар'],
 ['Менеджеры','Менеджерлер'],
 ['Операции','Операциялар'],
 ['Операция','Операция'],
 ['Точка','Нүкте'],
 ['Канал','Арна'],
 ['Категория','Санат'],
 ['Товар','Тауар'],
 ['Менеджер','Менеджер'],
 ['Клиент','Клиент'],
 ['Розница','Бөлшек сауда'],
 ['Опт','Көтерме'],
 ['Внутренние','Ішкі'],
 ['внутренние','ішкі'],
 ['Отгрузки','Жөнелтулер'],
 ['Отгрузка','Жөнелту'],
 ['Касса','Касса'],
 ['Группа','Топ'],
 ['Назад','Артқа'],
 ['Выше','Жоғары'],
 ['Спросить AI','AI-дан сұрау'],
 ['Спросить','Сұрау'],
 ['Стоп','Тоқта'],
 ['Контекст:','Контекст:'],
 ['План','Жоспар'],
 ['плана','жоспардың'],
 ['Факт','Факт'],
 ['Риск','Тәуекел'],
 ['риск','тәуекел'],
 ['Норма','Қалыпты'],
 ['Рост','Өсу'],
 ['Долг','Борыш'],
 ['долг','борыш'],
 ['Нет базы сравнения','Салыстыру базасы жоқ'],
 ['нет базы сравнения','салыстыру базасы жоқ'],
 ['нет базы','база жоқ'],
 ['сопост.','салыст.'],
 ['Все','Барлығы'],
 ['предыдущий:','алдыңғы:'],
 ['год назад:','бір жыл бұрын:'],
 ['Текущий:','Ағымдағы:'],
 ['Остановить закупку по позициям с запасом > 90 дн., перераспределить товар','Қоры 90 күннен асатын позицияларды сатып алуды тоқтату, тауарды қайта бөлу'],
 ['Разобрать падение с ответственным:','Төмендеуді жауапты адаммен талдау:'],
 ['Проверить скидки и цены:','Жеңілдіктер мен бағаларды тексеру:'],
 ['Связаться с клиентом: долг','Клиентпен хабарласу: борыш'],
 ['Позвонить клиенту: пауза','Клиентке қоңырау шалу: үзіліс'],
 ['Рост даёт в основном','Өсімді негізінен береді:'],
 ['Падение даёт в основном','Төмендеуді негізінен береді:'],
 ['Главный вклад:','Басты үлес:'],
 ['Внутри:','Ішінде:'],
 ['Качество данных','Деректер сапасы'],
 ['источник, дата выгрузки, полнота, сверка','дереккөз, жүктеу күні, толықтығы, салыстыру'],
 ['Источник','Дереккөз'],
 ['Выгрузка','Жүктеу'],
 ['История','Тарих'],
 ['Сверка с отчётом','Есеппен салыстыру'],
 ['Детализация = итог','Толықтыру = қорытынды'],
 ['Без себестоимости','Өзіндік құнсыз'],
 ['Не рассчитывается','Есептелмейді'],
 ['не сходится','сәйкес емес'],
 ['сходится','сәйкес'],
 ['только чтение','тек оқу'],
 ['данные по','деректер, соңғы күн:'],
 ['документы с','құжаттар, бастап:'],
 ['товары с','тауарлар, бастап:'],
 ['выгрузка','жүктеу'],
 ['нужно','қажет'],
 ['сейчас','қазір'],
 ['точка','нүкте'],
 ['канал','арна'],
 ['категория','санат'],
 ['товар','тауар'],
 ['клиент','клиент'],
 ['менеджер','менеджер'],
 ['и','және'],
 ['или','немесе'],
 ['к те же дни прошлого месяца','өткен айдың сол күндерімен салыстырғанда'],
 ['к тот же период год назад','бір жыл бұрынғы сол кезеңмен салыстырғанда'],
 ['к','салыст.:'],
 // месяцы и дни
 ['января','қаңтар'],['февраля','ақпан'],['марта','наурыз'],['апреля','сәуір'],['мая','мамыр'],['июня','маусым'],['июля','шілде'],['августа','тамыз'],['сентября','қыркүйек'],['октября','қазан'],['ноября','қараша'],['декабря','желтоқсан'],
 ['январь','қаңтар'],['февраль','ақпан'],['март','наурыз'],['апрель','сәуір'],['май','мамыр'],['июнь','маусым'],['июль','шілде'],['август','тамыз'],['сентябрь','қыркүйек'],['октябрь','қазан'],['ноябрь','қараша'],['декабрь','желтоқсан'],
 ['Январь','Қаңтар'],['Февраль','Ақпан'],['Март','Наурыз'],['Апрель','Сәуір'],['Май','Мамыр'],['Июнь','Маусым'],['Июль','Шілде'],['Август','Тамыз'],['Сентябрь','Қыркүйек'],['Октябрь','Қазан'],['Ноябрь','Қараша'],['Декабрь','Желтоқсан'],
 ['янв','қаң'],['фев','ақп'],['мар','нау'],['апр','сәу'],['июн','мау'],['июл','шіл'],['авг','там'],['сен','қыр'],['окт','қаз'],['ноя','қар'],['дек','жел'],
 ['Пн','Дс'],['Вт','Сс'],['Чт','Бс'],['Пт','Жм'],['Сб','Сн'],['Вс','Жс'],
 // единицы
 ['млрд ₸','млрд ₸'],['тыс ₸','мың ₸'],['тыс','мың'],['п.п.','п.т.'],['дн.','күн'],['дн','күн'],['шт','дана'],
];
// компилируем: экранирование + границы слов для кириллицы
const KKRX=KK.slice().sort((a,b)=>b[0].length-a[0].length).map(([ru,kk])=>{ const e=ru.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return [new RegExp('(^|[^А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІіA-Za-z])'+e+'(?![А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІіA-Za-z])','g'),kk,ru]; });
const KKEXACT=new Map(KK.map(([ru,kk])=>[ru,kk]));
function trText(s){ if(!s||!/[А-Яа-яЁё]/.test(s)) return s; const t=s.trim(); if(KKEXACT.has(t)) return s.replace(t,KKEXACT.get(t)); let o=s; for(const [rx,kk,ru] of KKRX){ if(o.indexOf(ru)<0) continue; o=o.replace(rx,(m,p)=>p+kk); } return o; }
// элементы с названиями из данных — только точные совпадения целиком
const RAW_SEL='td.l, .lnk, .chip:not(.per), .crumbs, .cos, .msg, tr.click td:first-child, .kv dd';
function trNode(root){
  if(LANG!=='kk'||!root) return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null); const nodes=[]; let n; while((n=w.nextNode())) nodes.push(n);
  for(const t of nodes){ const p=t.parentElement; if(!p||p.closest('script,style,.msg,textarea')) continue;
    const v=t.nodeValue; if(!/[А-Яа-яЁё]/.test(v)) continue;
    if(p.closest(RAW_SEL)){ const tt=v.trim(); if(KKEXACT.has(tt)) t.nodeValue=v.replace(tt,KKEXACT.get(tt)); continue; }
    const nv=trText(v); if(nv!==v) t.nodeValue=nv; }
  if(root.querySelectorAll) for(const el of root.querySelectorAll('[title],[placeholder],[aria-label],[data-tip]')){
    for(const a of ['title','placeholder','aria-label','data-tip']){ const v=el.getAttribute(a); if(v&&/[А-Яа-яЁё]/.test(v)){ const nv=a==='data-tip'?v.replace(/>([^<]+)</g,(m,x)=>'>'+trText(x)+'<').replace(/^([^<]+)/,x=>trText(x)):trText(v); if(nv!==v) el.setAttribute(a,nv); } } }
}
const MO=new MutationObserver(ms=>{ if(LANG!=='kk') return; for(const m of ms) for(const nd of m.addedNodes){ if(nd.nodeType===1) trNode(nd); else if(nd.nodeType===3&&nd.parentElement) trNode(nd.parentElement); } });
MO.observe(document.body,{childList:true,subtree:true});

const GLOSS_KK=[
  ['Түсім','Кезеңдегі клиенттерге сату сомасы, қайтарулар шегерілген. Топ компаниялары арасындағы сату («ішкі») кірмейді.','Бизнестің ауқымы мен динамикасын көрсетеді. Түсімнің төмендеуі — қай нүкте, арна немесе менеджер төмен тартатынын талдау белгісі.','Жөнелтулер мен бөлшек чектер позицияларының сомасы − қайтарулар. МойСклад пайдалылық есебімен салыстырылған.'],
  ['Жалпы пайда','Түсім минус сатылған тауардың өзіндік құны. Бұл таза пайда емес: жалға алу, жалақы және басқа шығындар МойСклад-та жүргізілмейді.','Тауар шын мәнінде қанша ақша табатынын көрсетеді. Бизнес тек айналымда емес, «ақшада» өсіп жатқанын түсінуге көмектеседі.','Түсім − МойСклад пайдалылық есебі бойынша өзіндік құн.'],
  ['Маржа','Жалпы пайданың түсімдегі үлесі, пайызбен.','Жеңілдіктер, бағалар немесе ассортимент табысты қай жерде «жейтінін» көруге көмектеседі. Айналым өсіп, маржа түссе — нақты санаттың, тауардың немесе менеджердің бағалары мен жеңілдіктерін тексеру.','Жалпы пайда ÷ түсім. Өзгеріс пайыздық тармақпен (п.т.) көрсетіледі.'],
  ['Жоспар / факт','Жоспар — айлық түсім мақсаты; факт — қазірдің өзінде қанша сатылғаны.','Компания мақсатқа үлгеретінін және оған жету үшін күніне қанша сату керектігін көрсетеді.','Бекітілген жоспарлар (қыркүйек, қазан). Жоспар болмаса — автожоспар: 3 толық айдың орташасы + 5%.'],
  ['Болжам','Сату ағымдағы қарқынмен жүрсе, ай соңындағы күтілетін түсім.','Ай аяқталғанға дейін әрекет етуге уақыт береді: сатуды күшейту, жоспарды қайта бөлу, акция іске қосу.','Кешегі күнге дейінгі факт + соңғы 14 жұмыс күнінің орташа түсімі × қалған жұмыс күндері. Демалыс күні сату бойынша анықталады.'],
  ['Орташа чек','Бір сату құжатының (чектің немесе жөнелтудің) орташа сомасы.','Түсім өзгерісінің себебін түсінуге көмектеседі: сатып алу азайды ма, әлде аз сомаға сатып алады ма. Төмен чек — қосымша сату мен жиынтықтарға себеп.','Түсім ÷ сату құжаттарының саны (қайтарулар есептелмейді).'],
  ['Дебиторлық берешек','Клиенттердің жөнелтілген тауар үшін компанияға қарызы.','Ақша қайда тұрып қалғанын көрсетеді. Кімге қоңырау шалу, кімге қарызға жөнелтуді тоқтату керектігін шешуге көмектеседі.','МойСклад «Контрагенттер» есебіндегі өзара есеп айырысу балансы. Төлемдердің бір бөлігі өткізілмеген болуы мүмкін — салыстыру қажет.'],
  ['Айналымдылық','Қазіргі сату қарқынымен ағымдағы қойма неше күнде сатылатыны.','Тауарда қанша ақша «ұйықтап» жатқанын көрсетеді. Күн саны көп болса — сатып алуды қысқартып, артығын сату.','Қойманың өзіндік құн бойынша құны ÷ 28 күндік сатудың өзіндік құны × 28.'],
  ['Өтімсіз тауар','Қоймада ұзақ уақыт сатылмай тұрған тауар.','Нені сатып жіберу, жиынтыққа қосу, жеткізушіге қайтару немесе енді сатып алмау керектігін шешуге көмектеседі.','Қалдық > 0 және 90+ күн бойы сату жоқ (немесе қолжетімді тарих қысқа болса — бүкіл тарихта).'],
  ['Артық қор','Сатылып жатқан, бірақ қоймада қажеттен әлдеқайда көп тауар.','Артық сатып алуды тоқтатуға және тауарды нүктелер арасында қайта бөлуге көмектеседі.','Қор 180 күндік сатудан көп. «90 күннен артық» сомасы — 90 күндік қажеттіліктен асатын қор құны.'],
  ['Тапшылық','Жақында бітетін өтімді тауар.','Уақытында қосымша тапсырыс беріп, сатуды жоғалтпауға көмектеседі. Алдымен — A тобы.','Қалдық 14 күндік сатуға жетпейді (соңғы 28 күндегі қарқын бойынша).'],
  ['ABC-талдау','Тауарларды түсімге үлесі бойынша бөлу: A — түсімнің 80%-ы, B — келесі 15%, C — қалған 5%.','Бизнес қай тауарларға сүйенетінін көрсетеді: A тобын тапшылыққа жібермеу, C бойынша үлкен қор ұстамау.','Соңғы 28 күндегі түсім бойынша.'],
  ['Сату арналары','Тауардың клиентке жеткен жолы: бөлшек, көтерме, маркетплейстер, сайт.','Арналардың табыстылығын салыстырып, күш пен тауарды қайда салу керектігін шешуге көмектеседі.','Бөлшек/көтерме — құжат түрі мен контрагент бойынша; Kaspi, Wildberries, ansartechno.kz — контрагент бойынша. Аксес-те маркетплейстер жоқ.'],
  ['Операциялар','МойСклад-тағы нақты құжаттар: жөнелтулер, бөлшек сатулар, қайтарулар.','Бастапқы көзге дейін жетуге мүмкіндік береді: кім сатты, кімге, қандай бағамен және маржамен, төленді ме.','Өткізілген құжаттар; тауар позициялары соңғы 4 айда қолжетімді.'],
];
const _GLOSS_RU=GLOSS.slice();
function setLang(l){
  LANG=l; PREF.set('lang',l); document.documentElement.lang=l==='kk'?'kk':'ru';
  GLOSS.length=0; (l==='kk'?GLOSS_KK:_GLOSS_RU).forEach(x=>GLOSS.push(x));
  const sw=$('#lang'); if(sw) sw.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.l===l)));
  if(!codes().length) return;
  // перерисовать всё из исходных (русских) шаблонов, затем перевести
  const per=$('#per'); if(per){ const v=per.value; per.innerHTML=periodOptions().map(([v2,lb])=>`<option value="${v2}">${esc(lb)}</option>`).join(''); per.value=v; }
  const cmp=$('#cmp'); if(cmp){ const v=cmp.value; cmp.innerHTML='<option value="prev">к прошлому периоду</option><option value="ly">к прошлому году</option>'; cmp.value=v; }
  const btn=$('#btn-ai'); if(btn) btn.textContent='Спросить AI';
  const lab=$('#inc')?.parentElement; if(lab&&lab.lastChild) lab.lastChild.nodeValue=' внутренние';
  // AI-блок: сохранить переписку и пересобрать
  const ai=$('#ai'); const log=$('#ailog')?.innerHTML||''; if(ai){ ai.dataset.init=''; ai.innerHTML=''; }
  renderGloss(); render(); const lg=$('#ailog'); if(lg) lg.innerHTML=log;
  if(l==='kk') trNode(document.querySelector('.top')); applyTheme(curTheme());
}
// кнопки в шапке
(function(){
  const t=document.querySelector('.tctl'); if(!t) return;
  const sw=document.createElement('div'); sw.id='lang'; sw.className='lang'; sw.setAttribute('role','group'); sw.setAttribute('aria-label','Язык / Тіл');
  sw.innerHTML='<button type="button" data-l="ru" aria-pressed="true">RU</button><button type="button" data-l="kk" aria-pressed="false">KZ</button>';
  const th=document.createElement('button'); th.type='button'; th.id='btn-theme'; th.className='tbtn icon';
  t.appendChild(sw); t.appendChild(th);
  sw.addEventListener('click',e=>{ const b=e.target.closest('[data-l]'); if(b&&b.dataset.l!==LANG) setLang(b.dataset.l); });
  th.addEventListener('click',()=>{ const nt=curTheme()==='dark'?'light':'dark'; PREF.set('theme',nt); applyTheme(nt); });
  const saved=PREF.get('theme',''); applyTheme(saved||curTheme());
  sw.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.l===LANG)));
  if(LANG==='kk'){ document.documentElement.lang='kk'; GLOSS.length=0; GLOSS_KK.forEach(x=>GLOSS.push(x)); trNode(document.querySelector('.top')); }
})();
