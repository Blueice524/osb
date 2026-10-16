import {validSources} from './sources.js';
export let apiBase='',serviceConfigLoaded=false;
let configPromise;
export function loadStudyConfig(){
 if(!configPromise)configPromise=(async()=>{try{const response=await fetch(new URL('./study-service.json',document.baseURI),{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(typeof data.apiBase!=='string'||!data.apiBase)return;const url=new URL(data.apiBase,location.href);if(url.username||url.password||url.search||url.hash)return;if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))return;apiBase=url.href.replace(/\/$/,'');}catch{}finally{serviceConfigLoaded=true;}})();
 return configPromise;
}
export async function queryStudy(payload,signal){
 await loadStudyConfig();if(!apiBase)throw new Error('自動查考服務尚未連接，請由網站管理者啟用後端服務。');
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();const timer=setTimeout(abort,105000);
 try{
  const response=await fetch(`${apiBase}/study`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});let data;try{data=await response.json();}catch{throw new Error('查考服務回應格式不正確，請稍後重試。');}
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'查考服務暫時無法使用。');
  const max=payload.mode==='background'?2:4;
  if(!Array.isArray(data.paragraphs)||!data.paragraphs.length||data.paragraphs.length>max||!data.paragraphs.every(p=>typeof p==='string'&&p.trim()&&p.length<=600)||!validSources(data.sources)||!data.sources.length||typeof data.fetchedAt!=='string'||!Number.isFinite(Date.parse(data.fetchedAt)))throw new Error('查考回覆缺少有效內容或出處，請稍後重試。');
  return {paragraphs:data.paragraphs,sources:data.sources,fetchedAt:data.fetchedAt};
 }catch(error){if(controller.signal.aborted)throw new Error('查考等候逾時，問題已保留，請稍後重試。');if(error instanceof TypeError)throw new Error('無法連線查考服務，請稍後重試。');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
