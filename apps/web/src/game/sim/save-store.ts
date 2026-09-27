import type {SaveEnvelope} from '../../../../../packages/protocol/src/index';
const DB='meridian-saves',STORE='matches';
function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function putSave(save:SaveEnvelope,slot='autosave'){const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(save,slot);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();}
export async function getSave(slot='autosave'){const db=await database();const save=await new Promise<SaveEnvelope|undefined>((resolve,reject)=>{const req=db.transaction(STORE).objectStore(STORE).get(slot);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();return save;}
