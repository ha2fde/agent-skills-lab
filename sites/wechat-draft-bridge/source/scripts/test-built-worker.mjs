import assert from 'node:assert/strict';
import {readFile,realpath,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(await realpath('node_modules/wrangler/package.json'));
const {Miniflare}=require('miniflare');
const upstream=new Map(),calls=[];
const files=await readdir('dist/server',{recursive:true});
const paths=['index.js',...files.filter(x=>x!=='index.js'&&/\.(?:js|wasm)$/.test(x))];
const mf=new Miniflare({modules:paths.map(p=>({type:p.endsWith('.wasm')?'CompiledWasm':'ESModule',path:resolve('dist/server',p)})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{WECHAT_CONFIG_ENCRYPTION_KEY:btoa('0'.repeat(32))},outboundService:async request=>{
 const url=new URL(request.url);calls.push(url.pathname);
 if(url.hostname==='cloudflare-dns.com') return Response.json({Status:0,Answer:[{type:1,data:'104.18.1.2'}]});
 if(url.hostname==='images.public-site.com') return new Response(Buffer.from(await readFile('scripts/fixtures/png.base64','utf8'),'base64'),{headers:{'content-type':'image/png'}});
 const body=request.method==='POST'&&(request.headers.get('content-type')??'').includes('json')?await request.json():{};
 if(url.pathname==='/cgi-bin/stable_token') return Response.json({access_token:'fake-test-token',expires_in:7200});
 if(url.pathname==='/cgi-bin/material/add_material') return Response.json({media_id:'test-cover-id'});
 if(url.pathname==='/cgi-bin/media/uploadimg') return Response.json({url:'https://mmbiz.qpic.cn/test/body.jpg'});
 if(url.pathname==='/cgi-bin/draft/add') {const media_id='draft-'+upstream.size;upstream.set(media_id,body.articles);return Response.json({media_id});}
 if(url.pathname==='/cgi-bin/draft/get') return upstream.has(body.media_id)?Response.json({news_item:upstream.get(body.media_id)}):Response.json({errcode:40007,errmsg:'invalid media id'});
 if(url.pathname==='/cgi-bin/draft/delete') {upstream.delete(body.media_id);return Response.json({errcode:0});}
 throw new Error('Unexpected outbound '+url.pathname);
}});
try {
 const db=await mf.getD1Database('DB');
 // Only temporary in-memory D1, never production.
 for(const sql of (await readFile('drizzle/0000_wooden_bloodstrike.sql','utf8')).split('--> statement-breakpoint')) await db.prepare(sql).run();
 const iv=new Uint8Array(12),key=await crypto.subtle.importKey('raw',new TextEncoder().encode('0'.repeat(32)),'AES-GCM',false,['encrypt']);
 const enc=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('test-user')},key,new TextEncoder().encode('mock-app-secret-not-real'));
 const cipher=btoa(String.fromCharCode(...iv))+'.'+Buffer.from(enc).toString('base64');
 await db.prepare('INSERT INTO wechat_connections (user_id,app_id,label,secret_cipher,updated_at) VALUES (?,?,?,?,?)').bind('test-user','wx1234567890abcdef','test',cipher,new Date().toISOString()).run();
 const rpc=async(name,args)=>{const response=await mf.dispatchFetch('http://localhost/mcp',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'test-user'},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}})});const result=(await response.json()).result;assert.equal(result.isError,false,JSON.stringify(result));return result.structuredContent;};
 for(const kind of ['png','jpeg','gif','webp']) {
  const result=await rpc('wechat_upload_image',{filename:'test.'+kind,purpose:'cover',image_base64:await readFile('scripts/fixtures/'+kind+'.base64','utf8')});
  assert.equal(result.media_id,'test-cover-id');assert.equal(result.processing.format,'jpeg');console.log('PASS built Worker '+kind+' decode/convert/upload');
 }
 const args={request_id:'built-worker-save-001',title:'Worker smoke test',content:'<h2>标题</h2><p>正文<strong>重点</strong></p>{{image:b}}',cover:{image_url:'https://images.public-site.com/cover.png'},body_images:[{id:'b',image_base64:await readFile('scripts/fixtures/png.base64','utf8')}]};
 const result=await rpc('wechat_prepare_and_save_draft',args);assert.equal(result.readback_verified,true,JSON.stringify(result));
 const before=calls.length;assert.deepEqual(await rpc('wechat_prepare_and_save_draft',args),result);assert.equal(calls.length,before);
 console.log('PASS built Worker end-to-end with real D1, durable idempotency, public URL fetch, inline Base64, formatting, upload and full readback');
 const testArgs={...args,request_id:'built-worker-test-create-001',title:'【测试草稿·勿发布】Worker isolated deletion',test_draft:true};
 const testDraft=await rpc('wechat_prepare_and_save_draft',testArgs);assert.equal(testDraft.readback_verified,true);
 const delArgs={media_id:testDraft.media_id,request_id:'built-worker-test-delete-001'};
 const deleted=await rpc('wechat_delete_test_draft',delArgs);assert.equal(deleted.outcome,'confirmed_deleted');assert.equal(upstream.has(testDraft.media_id),false);
 const after=calls.filter(x=>x==='/cgi-bin/draft/delete').length;
 assert.equal((await rpc('wechat_delete_test_draft',delArgs)).idempotent_replay,true);
 assert.equal(calls.filter(x=>x==='/cgi-bin/draft/delete').length,after);
 assert.equal(upstream.has(result.media_id),true,'ordinary draft remains untouched');
 console.log('PASS built Worker guarded exact-ID delete, durable provenance, absent readback, idempotent retry and unrelated draft preservation');
} finally {await mf.dispose();}
