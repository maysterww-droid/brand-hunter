import base from './worker.js';

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"};
const BOT_USERNAME='BrandHunterMaysterBot';
const BOT_URL=`https://t.me/${BOT_USERNAME}`;
const LEGAL_GATE_VERSION='1.0';
const FINAL_LABEL='TECHNICAL PASS';

function timeoutSignal(ms){return AbortSignal.timeout?AbortSignal.timeout(ms):undefined}
function ddgQuery(q){return`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`}
async function fetchText(url,ms=7000){try{const r=await fetch(url,{signal:timeoutSignal(ms),redirect:'follow'});if(!r.ok)return{ok:false,status:r.status,text:''};return{ok:true,status:r.status,text:(await r.text()).slice(0,300000)}}catch(e){return{ok:false,status:0,text:'',error:String(e?.message||e)}}}
async function searchSignal(name,query){const r=await fetchText(ddgQuery(query));if(!r.ok)return{available:false,hits:0,reason:`search unavailable (${r.status||'network'})`};const html=r.text.toLowerCase(),n=name.toLowerCase(),cards=(html.match(/result__a/g)||[]).length,mentions=Math.max(0,html.split(n).length-1);return{available:true,hits:Math.min(15,cards)+Math.min(15,mentions)}}
async function domainRegistered(domain){try{const r=await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`,{headers:{accept:'application/rdap+json,application/json'},signal:timeoutSignal(6000),redirect:'follow'});if(r.status===404)return{available:true,registered:false};if(r.ok)return{available:true,registered:true}}catch{}return{available:false,registered:null}}
async function domainGate(name){const baseName=name.toLowerCase(),tlds=['com','ai','app','health','care','io'];const results=await Promise.all(tlds.map(async tld=>{const domain=`${baseName}.${tld}`;return{domain,...await domainRegistered(domain)}}));return{available:results.some(x=>x.available),registered:results.filter(x=>x.registered===true).length,results}}
async function appleGate(name){try{const r=await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=software&limit=50`,{signal:timeoutSignal(7000)});if(!r.ok)return{available:false,exact:0,near:0};const j=await r.json(),n=name.toLowerCase(),rows=j.results||[],exact=rows.filter(x=>String(x.trackName||'').toLowerCase()===n||String(x.sellerName||'').toLowerCase()===n).length,near=rows.filter(x=>String(x.trackName||'').toLowerCase().includes(n)||n.includes(String(x.trackName||'').toLowerCase())).length;return{available:true,exact,near}}catch{return{available:false,exact:0,near:0}}}
function phoneticForms(name){const n=String(name||'').toUpperCase().replace(/[^A-Z]/g,'');const skeleton=n.replace(/[AEIOUY]/g,'').replace(/(.)\1+/g,'$1');const vowelSwap=n.replace(/[AEIOUY]+/g,'*');return[...new Set([n,skeleton,vowelSwap].filter(x=>x.length>=3))]}
async function legalRiskGate(env,candidate){const name=String(candidate?.name||'').trim().toUpperCase();if(!name)return{status:'BLOCK',reason:'invalid_name',version:LEGAL_GATE_VERSION};const cached=env.AUTOPILOT_KV?await env.AUTOPILOT_KV.get(`legal_gate:${name}`):null;if(cached){try{return JSON.parse(cached)}catch{}}
  const q=`"${name}"`,forms=phoneticForms(name),similarQuery=forms.map(x=>`"${x}"`).join(' OR ');
  const [exact,health,software,play,euipo,wipo,tmview,classes,similar,apple,domains]=await Promise.all([
    searchSignal(name,q),
    searchSignal(name,`${q} health wellness nutrition fitness medical healthcare`),
    searchSignal(name,`${q} software app AI SaaS company startup`),
    searchSignal(name,`site:play.google.com ${q}`),
    searchSignal(name,`site:euipo.europa.eu ${q}`),
    searchSignal(name,`site:wipo.int ${q}`),
    searchSignal(name,`site:tmview.org ${q}`),
    searchSignal(name,`${q} trademark class 9 35 41 42 44 software health`),
    searchSignal(name,`${similarQuery} brand trademark company app health software`),
    appleGate(name),
    domainGate(name)
  ]);
  const checks={exact,health,software,play,euipo,wipo,tmview,classes,similar,apple,domains};
  const unknown=Object.values(checks).filter(x=>x&&x.available===false).length;
  const tmHits=[euipo,wipo,tmview].reduce((s,x)=>s+(x.available?x.hits:0),0);
  let risk=0;
  risk+=Math.min(30,(exact.hits||0)*3);
  risk+=Math.min(18,(health.hits||0)*2);
  risk+=Math.min(16,(software.hits||0)*2);
  risk+=Math.min(15,(play.hits||0)*3);
  risk+=Math.min(35,tmHits*6);
  risk+=Math.min(12,(classes.hits||0)*2);
  risk+=Math.min(18,(similar.hits||0));
  risk+=Math.min(18,(apple.exact||0)*8+(apple.near||0)*2);
  risk+=Math.min(12,(domains.registered||0)*2);
  risk=Math.min(100,risk);
  let status='LEGAL_REVIEW';
  const reasons=[];
  if(tmHits>=2){status='BLOCK';reasons.push('trademark signals')}
  if((apple.exact||0)>0){status='BLOCK';reasons.push('exact App Store match')}
  if((exact.hits||0)>=8){status='BLOCK';reasons.push('strong exact public presence')}
  if(risk>=58){status='BLOCK';reasons.push('aggregate risk too high')}
  if(status!=='BLOCK'&&unknown===0&&risk<=10&&tmHits===0&&(apple.exact||0)===0&&(exact.hits||0)<=2&&(health.hits||0)<=2&&(software.hits||0)<=2&&(play.hits||0)<=1&&(similar.hits||0)<=4)status=FINAL_LABEL;
  if(status==='LEGAL_REVIEW'&&!reasons.length){if(unknown>0)reasons.push('incomplete public data');if(risk>10)reasons.push('non-zero similarity/public signals')}
  const result={name,status,riskScore:risk,unknownChecks:unknown,trademarkHits:tmHits,checkedAt:new Date().toISOString(),version:LEGAL_GATE_VERSION,reasons,checks,disclaimer:'Automated public-signal screening only. TECHNICAL PASS is not legal trademark clearance. Final adoption still requires professional trademark clearance.'};
  if(env.AUTOPILOT_KV)await env.AUTOPILOT_KV.put(`legal_gate:${name}`,JSON.stringify(result),{expirationTtl:604800});
  return result;
}

async function telegramApi(env,method,payload){if(!env.TELEGRAM_BOT_TOKEN)return{ok:false,error:'TELEGRAM_BOT_TOKEN missing'};try{const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload||{}),signal:timeoutSignal(8000)});const data=await r.json().catch(()=>({}));return{ok:r.ok&&data.ok===true,status:r.status,data,error:data?.description||(!r.ok?`HTTP ${r.status}`:undefined)}}catch(e){return{ok:false,error:String(e?.message||e)}}}
async function getTelegramChat(env){if(!env.AUTOPILOT_KV)return null;const raw=await env.AUTOPILOT_KV.get('telegram_chat');if(!raw)return null;try{return JSON.parse(raw)}catch{return null}}
async function discoverTelegramChat(env){if(!env.AUTOPILOT_KV)return{ok:false,error:'AUTOPILOT_KV missing'};const r=await telegramApi(env,'getUpdates',{limit:100,timeout:0,allowed_updates:['message']});if(!r.ok)return r;const updates=Array.isArray(r.data?.result)?r.data.result:[],messages=updates.map(x=>x?.message).filter(Boolean).filter(m=>m?.chat?.id);if(!messages.length)return{ok:false,error:'no_messages',hint:`Open @${BOT_USERNAME} and press START or send /start`};const preferred=[...messages].reverse().find(m=>String(m.text||'').trim().toLowerCase().startsWith('/start'))||messages[messages.length-1],chat={id:String(preferred.chat.id),type:preferred.chat.type||'private',firstName:preferred.chat.first_name||'',username:preferred.chat.username||'',connectedAt:new Date().toISOString()};await env.AUTOPILOT_KV.put('telegram_chat',JSON.stringify(chat));return{ok:true,chat}}
async function sendTelegram(env,text){const chat=await getTelegramChat(env);if(!chat?.id)return{ok:false,error:'chat_not_connected'};return telegramApi(env,'sendMessage',{chat_id:chat.id,text,disable_web_page_preview:true,reply_markup:{inline_keyboard:[[{text:'Открыть Brand Hunter',url:'https://brand-hunter.maysterww.workers.dev/autopilot.html'}]]}})}

async function gateCandidates(env,candidates){const out=[];for(const c of Array.isArray(candidates)?candidates:[]){const gate=await legalRiskGate(env,c);out.push({...c,legalGate:gate})}return out}
async function notifyTechnicalPass(env,candidates){if(!env.AUTOPILOT_KV||!Array.isArray(candidates)||!candidates.length)return;const gated=await gateCandidates(env,candidates);for(const f of gated.filter(x=>x.legalGate?.status===FINAL_LABEL)){const name=String(f?.name||'').trim();if(!name)continue;const key=`telegram_technical_pass:${name}`;if(await env.AUTOPILOT_KV.get(key))continue;const score=f?.score??'—',risk=f?.deepRisk??f?.knockout?.deepRisk??'—',legalRisk=f.legalGate?.riskScore??'—';const sent=await sendTelegram(env,`🛡️ BRAND HUNTER — TECHNICAL PASS\n\n${name}\nLocal score: ${score}\nDeep risk: ${risk}\nLegal-gate risk: ${legalRisk}\n\nПройден усиленный автоматический фильтр: exact/near matches, health/software presence, App Store, Google Play signals, domains, EUIPO/WIPO/TMview public signals и similarity checks.\n\n⚠️ Это НЕ юридическое заключение. Перед регистрацией бренда, редизайном и рекламными расходами нужна профессиональная trademark clearance.`);if(sent.ok)await env.AUTOPILOT_KV.put(key,new Date().toISOString())}}

async function handleTelegram(request,env){if(!env.AUTOPILOT_KV)return Response.json({ok:false,error:'AUTOPILOT_KV not configured'},{status:503,headers:JSON_HEADERS});const connected=await getTelegramChat(env);if(request.method==='GET')return Response.json({ok:true,tokenConfigured:!!env.TELEGRAM_BOT_TOKEN,connected:!!connected?.id,chat:connected?{firstName:connected.firstName,username:connected.username}:null,botUrl:BOT_URL,botUsername:BOT_USERNAME,legalGateVersion:LEGAL_GATE_VERSION},{headers:JSON_HEADERS});if(request.method!=='POST')return Response.json({ok:false,error:'GET or POST required'},{status:405,headers:JSON_HEADERS});let body={};try{body=await request.json()}catch{}const action=body?.action||'connect';if(action==='connect'){const d=await discoverTelegramChat(env);if(!d.ok)return Response.json({...d,botUrl:BOT_URL},{status:400,headers:JSON_HEADERS});const welcome=await sendTelegram(env,'✅ Brand Hunter AUTOPILOT подключён. Уведомления теперь приходят только после усиленного Legal Risk Gate. Статус TECHNICAL PASS означает низкий автоматический риск, но не заменяет юридическую trademark clearance.');return Response.json({ok:true,connected:true,botUrl:BOT_URL,delivery:welcome},{headers:JSON_HEADERS})}if(action==='test'){const sent=await sendTelegram(env,'✅ TEST: Telegram работает. Brand Hunter пришлёт имя только после Deep Knockout + усиленного Legal Risk Gate = TECHNICAL PASS. Перед реальным запуском бренда всё равно нужна профессиональная trademark clearance.');return Response.json({ok:sent.ok,connected:sent.ok,botUrl:BOT_URL,delivery:sent},{status:sent.ok?200:400,headers:JSON_HEADERS})}return Response.json({ok:false,error:'unknown action'},{status:400,headers:JSON_HEADERS})}

function safeHistory(history){return (Array.isArray(history)?history:[]).map(x=>({...x,finalists:[],legalGatePending:Array.isArray(x.finalists)?x.finalists.length:0,finalistPolicy:'TECHNICAL_PASS_ONLY'}))}
async function interceptAutopilot(request,env,ctx){const response=await base.fetch(request,env,ctx);if(!response.ok)return response;try{const data=await response.clone().json();if(request.method==='POST'&&data?.ok){const gated=await gateCandidates(env,data.finalists||[]),technical=gated.filter(x=>x.legalGate?.status===FINAL_LABEL),review=gated.filter(x=>x.legalGate?.status==='LEGAL_REVIEW'),blocked=gated.filter(x=>x.legalGate?.status==='BLOCK');if(technical.length)ctx?.waitUntil?.(notifyTechnicalPass(env,technical));return Response.json({...data,finalists:technical.map(x=>({...x,status:FINAL_LABEL})),legalReview:review.map(x=>({name:x.name,status:'LEGAL_REVIEW',riskScore:x.legalGate?.riskScore,reasons:x.legalGate?.reasons})),blocked:blocked.map(x=>({name:x.name,status:'BLOCK',riskScore:x.legalGate?.riskScore,reasons:x.legalGate?.reasons})),legalGateVersion:LEGAL_GATE_VERSION,finalistPolicy:'TECHNICAL_PASS_ONLY'},{headers:JSON_HEADERS})}if(request.method==='GET'&&Array.isArray(data?.history))return Response.json({...data,history:safeHistory(data.history),legalGateVersion:LEGAL_GATE_VERSION,finalistPolicy:'TECHNICAL_PASS_ONLY'},{headers:JSON_HEADERS})}catch{}return response}

export default{async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname.startsWith('/api/telegram'))return handleTelegram(request,env);if(url.pathname.startsWith('/api/notifications'))return handleTelegram(request,env);if(url.pathname.startsWith('/api/autopilot'))return interceptAutopilot(request,env,ctx);return base.fetch(request,env,ctx)},async scheduled(controller,env,ctx){if(typeof base.scheduled==='function')await base.scheduled(controller,env,ctx);if(!env.AUTOPILOT_KV)return;try{const history=JSON.parse(await env.AUTOPILOT_KV.get('history')||'[]'),latest=history?.[0];if(latest?.finalists?.length)await notifyTechnicalPass(env,latest.finalists)}catch{}}};
