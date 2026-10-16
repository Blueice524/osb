export const studySources=[
 {title:'CrossExamined',url:'https://www.youtube.com/@CrossExamined'},
 {title:'BibleProject',url:'https://www.youtube.com/@bibleproject'},
 {title:'Best Commentaries',url:'https://bestcommentaries.com/'},
 {title:'StudyLight',url:'https://www.studylight.org/'},
 {title:'福音聯盟中文',url:'https://www.tgcchinese.org/'},
 {title:'查經資料大全',url:'https://www.ccbiblestudy.org/index-T.htm'},
 {title:'馬爾波羅教會查經資料',url:'https://www.churchinmarlboro.org/Biblestudy//Index.htm'}
];
export const searchDomains=['youtube.com','bestcommentaries.com','studylight.org','tgcchinese.org','ccbiblestudy.org','churchinmarlboro.org'];
export function allowedStudyURL(value){
 try{const u=new URL(value),host=u.hostname.replace(/^www\./,'');
  if(u.protocol!=='https:'||u.username||u.password||u.port||!searchDomains.includes(host))return false;
  if(host==='youtube.com')return /^\/@(?:CrossExamined|bibleproject)(?:\/|$)/i.test(u.pathname)||(u.pathname==='/watch'&&/^[\w-]{11}$/.test(u.searchParams.get('v')||''));
  if(host==='churchinmarlboro.org')return /^\/Biblestudy(?:\/|$)/i.test(u.pathname);
  return true;
 }catch{return false;}
}
export function validSources(value){return Array.isArray(value)&&value.length<=8&&value.every(s=>s&&typeof s.title==='string'&&s.title.length>0&&s.title.length<=500&&typeof s.url==='string'&&s.url.length<=2000&&allowedStudyURL(s.url));}
export function validBackground(value){return value&&Array.isArray(value.paragraphs)&&value.paragraphs.length>=1&&value.paragraphs.length<=2&&value.paragraphs.every(p=>typeof p==='string'&&p.trim()&&p.length<=600)&&validSources(value.sources)&&value.sources.length>0&&typeof value.fetchedAt==='string'&&Number.isFinite(Date.parse(value.fetchedAt));}
export function validDiscussion(value){return value===undefined||(Array.isArray(value)&&value.length<=100&&value.every(t=>t&&typeof t.id==='string'&&t.id.length<=100&&typeof t.question==='string'&&t.question.length<=6000&&typeof t.answer==='string'&&t.answer.length<=100000&&['opened','pending','answered','error'].includes(t.status)&&typeof t.createdAt==='string'&&Number.isFinite(Date.parse(t.createdAt))&&(t.origin===undefined||['web','manual'].includes(t.origin))&&(t.sources===undefined||validSources(t.sources))&&(t.origin!=='web'||t.status!=='answered'||t.sources?.length>0)));}
