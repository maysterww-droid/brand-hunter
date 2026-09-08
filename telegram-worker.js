import base from './worker.js';

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"};
const BOT_USERNAME='BrandHunterMaysterBot';
const BOT_URL=`https://t.me/${BOT_USERNAME}`;

function timeoutSignal(ms){return AbortSignal.timeout?AbortSignal.timeout(ms):undefined}

async function telegramApi(env,method,payload){
  if(!env.TELEGRAM_BOT_TOKEN)return{ok:false,error:'TELEGRAM_BOT_TOKEN missing'};
  try{
    const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload||{}),
      signal:timeoutSignal(8000)
    });
    const data=await r.json().catch(()=>({}));
    return{ok:r.ok&&data.ok===true,status:r.status,data,error:data?.description||(!r.ok?`HTTP ${r.status}`:undefined)};
  }catch(e){return{ok:false,error:String(e?.message||e)}}
}

async function getTelegramChat(env){
  if(!env.AUTOPILOT_KV)return null;
  const raw=await env.AUTOPILOT_KV.get('telegram_chat');
  if(!raw)return null;
  try{return JSON.parse(raw)}catch{return null}
}

async function discoverTelegramChat(env){
  if(!env.AUTOPILOT_KV)return{ok:false,error:'AUTOPILOT_KV missing'};
  const r=await telegramApi(env,'getUpdates',{limit:100,timeout:0,allowed_updates:['message']});
  if(!r.ok)return r;
  const updates=Array.isArray(r.data?.result)?r.data.result:[];
  const messages=updates.map(x=>x?.message).filter(Boolean).filter(m=>m?.chat?.id);
  if(!messages.length)return{ok:false,error:'no_messages',hint:`Open @${BOT_USERNAME} and press START or send /start`};
  const preferred=[...messages].reverse().find(m=>String(m.text||'').trim().toLowerCase().startsWith('/start'))||messages[messages.length-1];
  const chat={
    id:String(preferred.chat.id),
    type:preferred.chat.type||'private',
    firstName:preferred.chat.first_name||'',
    username:preferred.chat.username||'',
    connectedAt:new Date().toISOString()
  };
  await env.AUTOPILOT_KV.put('telegram_chat',JSON.stringify(chat));
  return{ok:true,chat};
}

async function sendTelegram(env,text){
  const chat=await getTelegramChat(env);
  if(!chat?.id)return{ok:false,error:'chat_not_connected'};
  return telegramApi(env,'sendMessage',{
    chat_id:chat.id,
    text,
    disable_web_page_preview:true,
    reply_markup:{inline_keyboard:[[{text:'Открыть Brand Hunter',url:'https://brand-hunter.maysterww.workers.dev/autopilot.html'}]]}
  });
}

async function notifyFinalists(env,finalists){
  if(!env.AUTOPILOT_KV||!Array.isArray(finalists)||!finalists.length)return;
  for(const f of finalists){
    const name=String(f?.name||'').trim();
    if(!name)continue;
    const key=`telegram_finalist:${name}`;
    if(await env.AUTOPILOT_KV.get(key))continue;
    const score=f?.score??'—',risk=f?.deepRisk??f?.knockout?.deepRisk??'—';
    const sent=await sendTelegram(env,`🏆 BRAND HUNTER — НОВЫЙ ФИНАЛИСТ\n\n${name}\nScore: ${score}\nDeep risk: ${risk}\nDeep Knockout: PASS\n\nКандидат прошёл автоматический фильтр. Перед окончательным выбором нужна ручная юридическая проверка товарного знака.`);
    if(sent.ok)await env.AUTOPILOT_KV.put(key,new Date().toISOString());
  }
}

async function handleTelegram(request,env){
  if(!env.AUTOPILOT_KV)return Response.json({ok:false,error:'AUTOPILOT_KV not configured'},{status:503,headers:JSON_HEADERS});
  const connected=await getTelegramChat(env);
  if(request.method==='GET')return Response.json({ok:true,tokenConfigured:!!env.TELEGRAM_BOT_TOKEN,connected:!!connected?.id,chat:connected?{firstName:connected.firstName,username:connected.username}:null,botUrl:BOT_URL,botUsername:BOT_USERNAME},{headers:JSON_HEADERS});
  if(request.method!=='POST')return Response.json({ok:false,error:'GET or POST required'},{status:405,headers:JSON_HEADERS});
  let body={};try{body=await request.json()}catch{}
  const action=body?.action||'connect';
  if(action==='connect'){
    const d=await discoverTelegramChat(env);
    if(!d.ok)return Response.json({...d,botUrl:BOT_URL},{status:400,headers:JSON_HEADERS});
    const welcome=await sendTelegram(env,'✅ Brand Hunter AUTOPILOT подключён. Я пришлю сообщение только когда появится новый финалист, прошедший Deep Knockout = PASS.');
    return Response.json({ok:true,connected:true,botUrl:BOT_URL,delivery:welcome},{headers:JSON_HEADERS});
  }
  if(action==='test'){
    const sent=await sendTelegram(env,'✅ TEST: уведомления Brand Hunter работают. AUTOPILOT будет писать сюда только при новом финалисте.');
    return Response.json({ok:sent.ok,connected:sent.ok,botUrl:BOT_URL,delivery:sent},{status:sent.ok?200:400,headers:JSON_HEADERS});
  }
  return Response.json({ok:false,error:'unknown action'},{status:400,headers:JSON_HEADERS});
}

async function interceptAutopilot(request,env,ctx){
  const response=await base.fetch(request,env,ctx);
  if(request.method==='POST'&&response.ok){
    try{
      const data=await response.clone().json();
      if(data?.ok&&Array.isArray(data.finalists)&&data.finalists.length)ctx?.waitUntil?.(notifyFinalists(env,data.finalists));
    }catch{}
  }
  return response;
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/telegram'))return handleTelegram(request,env);
    if(url.pathname.startsWith('/api/notifications'))return handleTelegram(request,env);
    if(url.pathname.startsWith('/api/autopilot'))return interceptAutopilot(request,env,ctx);
    return base.fetch(request,env,ctx);
  },
  async scheduled(controller,env,ctx){
    if(typeof base.scheduled==='function')await base.scheduled(controller,env,ctx);
    if(!env.AUTOPILOT_KV)return;
    try{
      const history=JSON.parse(await env.AUTOPILOT_KV.get('history')||'[]');
      const latest=history?.[0];
      if(latest?.finalists?.length)await notifyFinalists(env,latest.finalists);
    }catch{}
  }
};
