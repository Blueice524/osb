import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {createResearch,StudyError} from './research.js';
export function createApp({research=createResearch({apiKey:process.env.STUDY_API_KEY,model:process.env.STUDY_MODEL||'gpt-4.1'}),configured=!!process.env.STUDY_API_KEY,allowedOrigins=(process.env.STUDY_ALLOWED_ORIGINS||'https://blueice524.github.io,http://localhost:5173,http://127.0.0.1:5173').split(',').concat([`http://localhost:${process.env.PORT||8080}`,`http://127.0.0.1:${process.env.PORT||8080}`],process.env.RENDER_EXTERNAL_URL||[]),hourlyLimit=Number(process.env.STUDY_HOURLY_LIMIT)||60,staticDir=resolve('dist')}={}){
 const cache=new Map();let hourlyStart=Date.now(),used=0,active=0;
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 return http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const origin=req.headers.origin;
  if(path.startsWith('/api/')||path==='/study-service.json'||path==='/osb/study-service.json'){
   if(origin&&!allowedOrigins.includes(origin))return json(res,403,{error:'此網站未獲准連線查考服務。'});
   if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
   res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
   if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  }
  if(path.endsWith('/study-service.json')&&req.method==='GET')return json(res,200,{apiBase:'/api'});
  if(path==='/api/health'&&req.method==='GET')return json(res,configured?200:503,{ready:configured});
  if(path==='/api/study'&&req.method==='POST'){
   if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(res,415,{error:'請以 JSON 格式送出問題。'});
   if(!configured)return json(res,503,{error:'自動查考服務尚未設定金鑰，請通知網站管理者。'});
   try{
    let size=0,raw='';for await(const chunk of req){size+=chunk.length;if(size>100000)throw new StudyError(413,'問題或討論內容過長。');raw+=chunk;}
    let body;try{body=JSON.parse(raw);}catch{throw new StudyError(400,'問題格式不正確。');}
    if(!body||typeof body!=='object')throw new StudyError(400,'問題格式不正確。');
    const key=body.mode==='background'&&typeof body.readingId==='string'?body.readingId:null;
    if(key&&cache.has(key)&&Date.now()-cache.get(key).time<86400000)return json(res,200,cache.get(key).value);
    if(Date.now()-hourlyStart>3600000){hourlyStart=Date.now();used=0;}
    if(used>=hourlyLimit||active>=2)throw new StudyError(429,'目前查考流量已達限制，請稍後重試。');
    used++;active++;let result;try{result=await research(body);}finally{active--;}
    if(key){if(cache.size>=1189)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),value:result});}
    return json(res,200,result);
   }catch(error){return json(res,error.status||500,{error:error instanceof StudyError?error.message:'查考服務暫時無法使用，請稍後重試。'});}
  }
  if(path.startsWith('/api/'))return json(res,404,{error:'找不到此服務。'});
  if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'不支援此操作。'});
  try{
   const decoded=decodeURIComponent(path).replace(/^\/osb(?:\/|$)/,'/');
   const filename=resolve(staticDir,'.'+(decoded.endsWith('/')?decoded+'index.html':decoded));
   if(!filename.startsWith(staticDir+sep))return json(res,404,{error:'找不到此頁面。'});
   const content=await readFile(filename);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
   res.writeHead(200,{'Content-Type':mime[extname(filename)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(req.method==='HEAD'?undefined:content);
  }catch{return json(res,404,{error:'找不到此頁面。'});}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const server=createApp();server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('Study server started.'));}
