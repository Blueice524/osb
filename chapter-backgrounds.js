import {queryStudy} from './study-service.js';
const cache=new Map();
// Kept for opening previously shared FHL snapshots.
export function validFHLSourceURL(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='bible.fhl.net'&&!u.username&&!u.password&&!u.port;}catch{return false;}}
export function readingBackground(readingId){
 if(!cache.has(readingId))cache.set(readingId,queryStudy({mode:'background',readingId}).catch(error=>{cache.delete(readingId);throw error;}));
 return cache.get(readingId);
}
