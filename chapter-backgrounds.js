import { personalReading } from './bible.js';
let indexPromise;
export function validFHLSourceURL(value) {
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='bible.fhl.net'&&!url.username&&!url.password&&!url.port;}catch{return false;}
}
function validateIndex(data) {
 if(data?.version!==1 || !data.chapters || typeof data.chapters!=='object' || Array.isArray(data.chapters))throw new Error('Invalid background index');
 const entries=Object.entries(data.chapters);
 if(entries.length>1189)throw new Error('Too many chapters');
 const result=new Map();
 for(const [key,entry] of entries){
  const match=/^([A-Z0-9]{3})\.([1-9]\d*)$/.exec(key);
  if(!match || !personalReading(`personal-${match[1]}-${match[2]}`) || !entry || !Array.isArray(entry.paragraphs) || entry.paragraphs.length<1 || entry.paragraphs.length>2 || !entry.paragraphs.every(p=>typeof p==='string'&&p.trim().length>0&&p.length<=600) || typeof entry.source!=='string' || !entry.source.trim() || entry.source.length>1200 || (entry.sourceURL!==undefined&&!validFHLSourceURL(entry.sourceURL)))throw new Error('Invalid chapter background');
  result.set(key,{paragraphs:entry.paragraphs.map(p=>p.trim()),source:entry.source.trim(),sourceURL:entry.sourceURL||''});
 }
 return result;
}
export async function chapterBackground(bookId,chapter) {
 if(!personalReading(`personal-${bookId}-${chapter}`))throw new Error('Invalid chapter');
 if(!indexPromise)indexPromise=(async()=>{
  const response=await fetch(new URL('./chapter-backgrounds.json',document.baseURI),{cache:'no-cache'});
  if(!response.ok)throw new Error('Background index unavailable');
  const text=await response.text();if(text.length>4000000)throw new Error('Background index too large');
  return validateIndex(JSON.parse(text));
 })().catch(error=>{indexPromise=undefined;throw error;});
 return (await indexPromise).get(`${bookId}.${chapter}`)||null;
}
