// This opens a ChatGPT conversation; it is not a custom GPT inference API.
export let gptURL = '';
export let configLoaded = false;
export function validDiscussion(value) {
 return value === undefined || (Array.isArray(value) && value.length <= 100 && value.every(turn=>turn && typeof turn.id==='string' && turn.id.length<=100 && typeof turn.question==='string' && turn.question.length<=6000 && typeof turn.answer==='string' && turn.answer.length<=100000 && ['opened','answered'].includes(turn.status) && typeof turn.createdAt==='string' && Number.isFinite(Date.parse(turn.createdAt))));
}
export function validateGPTURL(value) {
 try {const url=new URL(value);return url.protocol==='https:' && ['chatgpt.com','chat.openai.com'].includes(url.hostname) && !url.username && !url.password && !url.port && /^\/g\/[a-zA-Z0-9-]+\/?$/.test(url.pathname) ? url.href : '';}
 catch {return '';}
}
export async function loadGPTConfig() {
 try {const response=await fetch(new URL('./gpt-config.json',document.baseURI),{cache:'no-store'});if(response.ok)gptURL=validateGPTURL((await response.json()).gpt_url);}
 catch {/* Without a public GPT link, the UI explicitly opens ChatGPT for manual plugin selection. */}
 finally {configLoaded=true;}
}
export function discussionPrompt(passage,question,history=[]) {
 const previous=history.slice(-10).map(t=>`先前的問題：${t.question}\n先前貼回的 GPT 回覆：${t.answer}`).join('\n\n');
 return `我正在使用「靜讀」記錄個人讀經。\n目前經文：${passage}\n\n${previous?`同一段經文的先前討論（由使用者貼回）：\n${previous}\n\n`:''}這次想探討的問題：\n${question}\n\n請用繁體中文協助查考，先回答問題，分清經文明說的內容、上下文與解釋，以及可行的生活應用。若有不同解讀，請清楚區分；不確定的資料請直接說明，不要假稱已查閱來源，也不要替我編寫個人心得。`;
}
