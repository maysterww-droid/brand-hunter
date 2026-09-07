const A=["av","ae","el","en","ka","ke","li","lu","mi","na","ne","no","on","or","ra","re","sa","se","ta","ve","za","io","aro","eno","uma","iri"];
const B=["r","l","m","n","v","k","q","x","z","d","t","s"];
const C=["a","e","i","o","u","io","ia","eo","ai"];

const BAD=["health","fit","nutri","bio","med","pharma","vita","vyta","ora","yra","via","lynt","lyn","tech","ai"];
const BAD_END=["iq","yq","qq","xq","qx","zz","xx"];
const BAD_CLUSTERS=["ftiq","teti","netem","qti","tqi","xq","qq","kkk","ttt","iii","eee","aaa"];
const COMMONISH=["NOVA","LUNA","NEXA","VITA","VIVA","AURA","NORA","MIRA","VERA","LINA","SENA","ELLA","ARIA","NOAH","OMNI"];

const HUMAN_NAMES=new Set([
 "ARVIN","ARVIN","ORVIN","ERVIN","IRVIN","IRVING","ELVIN","ALVIN","ENVAN","ERWAN","ARWEN",
 "KEVIN","KELVIN","MARTIN","MARVIN","NOLAN","ROMAN","RONAN","ORSON","ARON","AARON","ERIK",
 "ERIC","IVAN","EVAN","OWEN","LEON","NOEL","ELI","MILO","MIRA","VERA","NORA","LENA","LINA",
 "SENA","ELLA","ARIA","MAYA","MIA","NINA","LUNA","AVA","ELENA","NELA","TARA","SARA"
]);
const PHARMA_SUFFIX=["XEN","ZOL","VIR","MAB","NIB","CIN","MYCIN","STAT","DOL","LEX","MED","PHARM"];
const CHEAP_TECH_SUFFIX=["IQ","LY","IFY","BOT","GPT","AI","APP","X","Q"];
const STRONG_ENDINGS=["A","O","EN","EL","ON","AR","OR","IS","UM","EO","IO"];
const SOFT_STARTS=["A","E","O","L","M","N","S","V","R"];
const AWKWARD=["VUK","RUK","KUK","QTI","FTI","TII","TEM","VAN","VIN","LYQ","QOQ","XIQ"];

const ONSETS=["","b","br","c","cl","d","dr","f","fl","g","gl","k","kr","l","m","n","p","pr","r","s","sl","t","tr","v","z"];
const NUCLEI=["a","ae","e","ei","i","io","o","oa","u","ui","y"];
const CODAS=["","l","m","n","r","s","t","v","k","d"];
const SYL2=["ra","re","ri","ro","ru","la","le","li","lo","lu","na","ne","ni","no","nu","sa","se","si","so","su","va","ve","vi","vo","ka","ke","ki","ko","ta","te","ti","to","ma","me","mi","mo"];
const ROOTS=["sens","clar","luma","mira","vero","nexa","navi","soma","tide","halo","weav","pulse","aero","sora","nelo","mero","talo","selo","varo","reno","avel","elin","suno","melo","arve","eno","orve","alor","reva","noro","seva","lino"];
const ENDS=["a","o","en","el","ar","is","on","um","eo","io","in","or","as","an","al","er","os"];
const PREFIXES=["a","ae","e","el","en","o","or","ar","i","io","u","ve","re","se","na","ne","mi","lo","ka","ta"];

function randWeighted(arr){return arr[Math.floor(Math.random()*arr.length)]}
function phoneticConstruct(){
  const syl=()=>randWeighted(ONSETS)+randWeighted(NUCLEI)+randWeighted(CODAS);
  const mode=Math.random();
  if(mode<0.30) return norm(syl()+syl());
  if(mode<0.48) return norm(randWeighted(PREFIXES)+randWeighted(SYL2)+randWeighted(ENDS));
  if(mode<0.65) return norm(randWeighted(ROOTS)+randWeighted(ENDS));
  if(mode<0.82) return norm(randWeighted(SYL2)+randWeighted(SYL2)+randWeighted(CODAS));
  if(mode<0.93) return norm(randWeighted(PREFIXES)+randWeighted(ROOTS).slice(-3)+randWeighted(ENDS));
  return norm(syl()+randWeighted(SYL2));
}
function genName(){
  let n=phoneticConstruct();
  if(n.length>=5 && Math.random()<0.30){
    const i=1+Math.floor(Math.random()*(n.length-2));
    const swaps={"A":"E","E":"A","I":"Y","O":"U","U":"O","Y":"I"};
    if(swaps[n[i]]) n=n.slice(0,i)+swaps[n[i]]+n.slice(i+1);
  }
  return n;
}
function dist(a,b){
  a=norm(a);b=norm(b);
  const p=[...Array(b.length+1).keys()];
  for(let i=1;i<=a.length;i++){
    const c=[i];
    for(let j=1;j<=b.length;j++) c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(a[i-1]!==b[j-1]));
    for(let j=0;j<c.length;j++)p[j]=c[j];
  }
  return p[b.length];
}
function phoneticScore(n){
  let s=100;
  if(n.length<4||n.length>8)s-=25;
  const vowels=[...n].filter(x=>"AEIOUY".includes(x)).length;
  const ratio=vowels/n.length;
  if(ratio<0.28||ratio>0.62)s-=22;
  if(/[^AEIOUY]{3,}/.test(n))s-=18;
  if(/[AEIOUY]{3,}/.test(n))s-=16;
  if(/(.)\1/.test(n))s-=12;
  for(const x of BAD_CLUSTERS) if(n.toLowerCase().includes(x))s-=30;
  let trans=0;
  for(let i=1;i<n.length;i++) if("AEIOUY".includes(n[i])!=="AEIOUY".includes(n[i-1])) trans++;
  s+=Math.min(10,trans*2);
  return Math.max(0,Math.min(100,s));
}
function memorabilityScore(n){
  let s=92;
  if(n.length===5||n.length===6)s+=8;
  if(n.length===4||n.length===7)s+=3;
  if(new Set(n).size/n.length<0.6)s-=18;
  if(COMMONISH.includes(n))s-=20;
  if(/[QX]{2}/.test(n))s-=20;
  return Math.max(0,Math.min(100,s));
}
function premiumScore(n){
  let s=85;
  if(/[QX]/.test(n))s-=8;
  if(n.endsWith("IQ"))s-=18;
  if(/^[AEIOU]/.test(n))s+=6;
  if(/(EL|EN|OR|AR|VE|RE)/.test(n))s+=5;
  if(BAD_END.some(x=>n.toLowerCase().endsWith(x)))s-=20;
  return Math.max(0,Math.min(100,s));
}
function distinctivenessScore(n){
  let s=88;
  for(const x of BAD) if(n.toLowerCase().includes(x))s-=25;
  if(dead.has(n))return 0;
  for(const d of dead){
    if(Math.abs(n.length-d.length)<=1){
      const dd=dist(n,d);
      if(dd===0)return 0;
      if(dd===1){s-=45;break}
      if(dd===2)s-=12;
    }
  }
  return Math.max(0,Math.min(100,s));
}
function internationalScore(n){
  let s=92;
  if(/[QX]/.test(n))s-=7;
  if(/J|W/.test(n))s-=5;
  if(/[^A-Z]/.test(n))s-=20;
  if(n.length>7)s-=8;
  return Math.max(0,Math.min(100,s));
}
function scoreBreakdown(n){
  const phon=phoneticScore(n), memo=memorabilityScore(n), prem=premiumScore(n), distn=distinctivenessScore(n), intl=internationalScore(n);
  let identity=92, semantic=90, namePenalty=0, pharmaPenalty=0, techPenalty=0, awkwardPenalty=0;
  if(HUMAN_NAMES.has(n)) namePenalty=42;
  if([...HUMAN_NAMES].some(x=>x.length===n.length && dist(n,x)===1)) namePenalty=Math.max(namePenalty,22);
  for(const s of PHARMA_SUFFIX) if(n.endsWith(s)||n.includes(s)) pharmaPenalty=Math.max(pharmaPenalty,24);
  for(const s of CHEAP_TECH_SUFFIX) if(n.endsWith(s)) techPenalty=Math.max(techPenalty,s==="X"||s==="Q"?8:18);
  for(const s of AWKWARD) if(n.includes(s)) awkwardPenalty=Math.max(awkwardPenalty,18);
  if(STRONG_ENDINGS.some(e=>n.endsWith(e))) identity+=4;
  if(SOFT_STARTS.includes(n[0])) identity+=3;
  if(n.length===5||n.length===6) identity+=4;
  if(/[QX]/.test(n)) identity-=7;
  if(/^[A-Z]{4,5}$/.test(n) && HUMAN_NAMES.has(n)) identity-=18;
  const low=n.toLowerCase();
  if(["fit","nutri","food","sleep","med","care","clinic","diet","body"].some(x=>low.includes(x))) semantic-=30;
  if(["vita","health","well"].some(x=>low.includes(x))) semantic-=18;
  identity=Math.max(0,Math.min(100,identity-namePenalty-pharmaPenalty-techPenalty-awkwardPenalty));
  semantic=Math.max(0,Math.min(100,semantic-pharmaPenalty));
  let total=Math.round(phon*.20+memo*.17+prem*.15+distn*.17+intl*.10+identity*.13+semantic*.08);
  const weakest=Math.min(phon,memo,prem,distn,intl,identity,semantic);
  if(weakest<70) total=Math.min(total,84);
  if(weakest<55) total=Math.min(total,76);
  if(namePenalty>=22) total=Math.min(total,78);
  if(pharmaPenalty>=24) total=Math.min(total,80);
  if(awkwardPenalty>=18) total=Math.min(total,82);
  return {total:Math.max(0,Math.min(96,total)),phon,memo,prem,distn,intl,identity,semantic,penalties:{namePenalty,pharmaPenalty,techPenalty,awkwardPenalty}};
}
function score(n){return scoreBreakdown(n).total}

let dead=new Set(JSON.parse(localStorage.getItem("bh_dead")||"[]"));
let seen=new Set(JSON.parse(localStorage.getItem("bh_seen")||"[]"));
let finalists=JSON.parse(localStorage.getItem("bh_finalists")||"[]");
let current=[];
let cancel=false;
let deferredPrompt=null;
const $=s=>document.querySelector(s);
const rand=a=>a[Math.floor(Math.random()*a.length)];
const norm=s=>s.toUpperCase().replace(/[^A-Z0-9]/g,"");
let backendScreening=false;

async function backendHealth(){try{const r=await fetch("/api/screen",{cache:"no-store"});if(!r.ok)return false;const j=await r.json();return !!j.ok}catch(e){return false}}
async function screenChunk(names){const r=await fetch("/api/screen",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({names}),cache:"no-store"});if(!r.ok)throw new Error(`Backend ${r.status}`);return await r.json()}
function externalRiskToScore(candidate,result){const risk=Number(result?.riskScore||0);const label=result?.riskLabel||"UNKNOWN";let penalty=Math.round(risk*0.48);if(label==="UNKNOWN")penalty=15;const final=Math.max(0,Math.min(100,candidate.score-penalty));return{final,risk,label,result}}
async function autoBackendScreen(){
  if(!current.length)return;backendScreening=true;$("#cancelBtn").disabled=false;$("#status").textContent="Проверяю TOP‑25 на сервере: web / health AI / apps / companies / domains…";$("#progress").value=0;
  const original=[...current].slice(0,25),resultMap=new Map(),chunks=[];for(let i=0;i<original.length;i+=5)chunks.push(original.slice(i,i+5));
  try{
    for(let ci=0;ci<chunks.length;ci++){if(cancel)throw new Error("cancelled");const chunk=chunks[ci];const data=await screenChunk(chunk.map(x=>x.name));for(const r of(data.results||[]))resultMap.set(r.name,r);$("#progress").value=Math.round(((ci+1)/chunks.length)*100);$("#status").textContent=`Backend screening: ${Math.min((ci+1)*5,original.length)} / ${original.length}`}
    current=original.map(c=>{const r=resultMap.get(c.name);const scored=externalRiskToScore(c,r);return{...c,external:r||null,webRisk:scored.risk,riskLabel:scored.label,finalScore:scored.final,status:`WEB ${scored.label}`}}).sort((a,b)=>b.finalScore-a.finalScore||b.score-a.score||(a.webRisk||999)-(b.webRisk||999));
    save();render();switchTab("winner");const w=current[0];$("#status").textContent=w?`Готово. WINNER после серверной проверки: ${w.name} • ${w.finalScore}/100 • ${w.riskLabel}`:"Готово.";
  }catch(e){console.error(e);$("#status").textContent="Backend screening недоступен. Локальный TOP‑25 сохранён; нажми «Проверить» для ручного поиска."}finally{backendScreening=false;$("#cancelBtn").disabled=true}
}
function save(){localStorage.setItem("bh_dead",JSON.stringify([...dead]));localStorage.setItem("bh_seen",JSON.stringify([...seen]));localStorage.setItem("bh_finalists",JSON.stringify(finalists));updateStats()}
function updateStats(){$("#seenCount").textContent=seen.size;$("#rejectedCount").textContent=dead.size;$("#finalistCount").textContent=Math.min(3,current.length)}
function switchTab(tabName){document.querySelectorAll(".tab,.view").forEach(x=>x.classList.remove("active"));const tab=document.querySelector(`.tab[data-tab="${tabName}"]`),view=document.getElementById(tabName);if(tab)tab.classList.add("active");if(view)view.classList.add("active");window.scrollTo({top:0,behavior:"smooth"})}
function render(){const box=$("#top25");box.innerHTML="";current.slice(0,25).forEach((x,i)=>box.appendChild(card(x,i+1)));const top3=[...current].slice(0,3);$("#top3").innerHTML="";top3.forEach((x,i)=>$("#top3").appendChild(card(x,i+1)));$("#winner").innerHTML="";if(top3[0]){const c=card(top3[0],1);c.classList.add("winnerCard");$("#winner").appendChild(c)}}
function judgeReason(x){const p=x.parts||{},penalties=p.penalties||{},notes=[];if((p.identity||0)>=90)notes.push("сильный зонтичный бренд");if((p.phon||0)>=90)notes.push("легко произносится");if((p.prem||0)>=90)notes.push("premium-звучание");if((p.distn||0)>=90)notes.push("хорошая отличительность");if(penalties.namePenalty>0)notes.push("похоже на личное имя");if(penalties.pharmaPenalty>0)notes.push("есть фарма-звучание");if(penalties.awkwardPenalty>0)notes.push("жёсткая фонетика");return notes.slice(0,3).join(" • ")||"сбалансированный кандидат"}
function card(x,rank){const el=document.createElement("div");el.className="card";el.innerHTML=`<div class="nameRow"><div><div class="rank">#${rank}</div><div class="name">${x.name}</div></div><div class="score">${x.finalScore??x.score}</div></div><div class="meta"><span class="pill">Brand ${x.score}</span><span class="pill">Sound ${x.parts?.phon??"—"}</span><span class="pill">Memory ${x.parts?.memo??"—"}</span><span class="pill">Premium ${x.parts?.prem??"—"}</span><span class="pill">Brand fit ${x.parts?.identity??"—"}</span><span class="pill">Broad ${x.parts?.semantic??"—"}</span><span class="pill">${x.status||"AI JUDGE"}</span>${x.riskLabel?`<span class="pill risk-${String(x.riskLabel).toLowerCase()}">Risk ${x.riskLabel} • ${x.webRisk}</span>`:""}</div><div class="judgeReason">${judgeReason(x)}</div><div class="actions"><button class="reject">Отбросить</button><button class="keep">В финал</button><button class="check">Проверить</button></div>`;el.querySelector(".reject").onclick=()=>{dead.add(x.name);current=current.filter(y=>y.name!==x.name);save();render()};el.querySelector(".keep").onclick=()=>{if(!finalists.some(y=>y.name===x.name))finalists.push(x);save();alert(`${x.name} добавлен в финалисты`)};el.querySelector(".check").onclick=()=>openChecks(x.name);return el}
function openChecks(name){const q=s=>encodeURIComponent(s),exact=`"${name}"`,urls=[`https://www.google.com/search?q=${q(exact)}`,`https://www.google.com/search?q=${q(exact+" health AI nutrition fitness software app")}`,`https://www.google.com/search?q=${q("site:apps.apple.com "+exact)}`,`https://www.google.com/search?q=${q("site:play.google.com "+exact)}`,"https://www.tmdn.org/tmview/","https://www.euipo.europa.eu/en/search-ip"];window.open(urls[1],"_blank");navigator.clipboard?.writeText(urls.join("\n"))}
async function generate(target){cancel=false;$("#cancelBtn").disabled=false;$("#status").textContent=`Генерирую ${target.toLocaleString()}…`;const pool=new Map();let tries=0,maxTries=Math.max(target*35,50000);while(pool.size<target&&tries<maxTries&&!cancel){tries++;const n=genName();if(n.length>=4&&n.length<=8&&!dead.has(n)&&!seen.has(n)&&!pool.has(n)){const parts=scoreBreakdown(n);if(parts.total>=80)pool.set(n,parts)}if(tries%1500===0){const pct=Math.min(99,(pool.size/target)*100);$("#progress").value=pct;$("#status").textContent=`Уникальных сильных имён: ${pool.size.toLocaleString()} / ${target.toLocaleString()} • попыток ${tries.toLocaleString()}`;await new Promise(r=>setTimeout(r,0))}}[...pool.keys()].forEach(n=>seen.add(n));current=[...pool.entries()].map(([name,parts])=>({name,score:parts.total,parts,status:"AI JUDGE"})).sort((a,b)=>b.score-a.score||b.parts.identity-a.parts.identity||b.parts.distn-a.parts.distn||b.parts.phon-a.parts.phon).slice(0,25);$("#progress").value=100;$("#cancelBtn").disabled=true;$("#status").textContent="Локальный AI Judge готов. Запускаю серверную проверку TOP‑25…";save();render();const online=await backendHealth();if(online)await autoBackendScreen();else{switchTab("winner");$("#status").textContent="Backend пока не развернут. Показан локальный AI WINNER; кнопка «Проверить» работает вручную."}}
document.querySelectorAll("[data-generate]").forEach(b=>b.onclick=()=>generate(Number(b.dataset.generate)));$("#cancelBtn").onclick=()=>{cancel=true;$("#status").textContent="Останавливаю…"};$("#clearBtn").onclick=()=>{if(confirm("Удалить всю локальную историю Brand Hunter на этом телефоне?")){localStorage.clear();dead=new Set();seen=new Set();finalists=[];current=[];save();render()}};$("#exportBtn").onclick=()=>{const payload={seen:[...seen],rejected:[...dead],finalists,current,backendScreening,exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="brand_hunter_mobile_export.json";a.click()};document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>switchTab(t.dataset.tab));window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("#installBtn").hidden=false});$("#installBtn").onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("#installBtn").hidden=true}};if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js");function safeInit(){try{updateStats();render()}catch(err){console.error(err);$("#status").textContent="Ошибка запуска. Обнови страницу или очисти историю."}}safeInit();
