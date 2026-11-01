const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/../src/backend.js', 'utf8');
const userDb = new Map();
const sent = [];
const events = new Map();
let frontendHandler;
let rawCalls = 0;
let quietCalls = 0;
let uploadCalls = 0;
let chatReadCalls = 0;
const sceneJson = {
  title: 'The Moonlit Library', location: 'Old Library', characters: ['Mira', 'Rowan'],
  summary: 'Mira and Rowan uncover a sealed letter.', events: ['They find a letter.'],
  importantDialogue: ['We should read it together.'], emotions: ['curiosity'],
  relationshipChanges: ['Trust grows.'], continuity: ['The letter remains unopened at first.'], unresolved: ['Who sealed it?']
};
const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
const spindle = {
  userStorage: {
    async getJson(path, opts = {}) {
      assert.ok(opts.userId, 'userStorage.getJson must receive userId');
      const key = `${opts.userId}:${path}`;
      return clone(userDb.has(key) ? userDb.get(key) : opts.fallback);
    },
    async setJson(path, value, opts = {}) {
      assert.ok(opts.userId, 'userStorage.setJson must receive userId');
      userDb.set(`${opts.userId}:${path}`, clone(value));
    }
  },
  storage: {
    async getJson() { throw new Error('shared storage should not be called by 0.3.3'); },
    async setJson() { throw new Error('shared storage should not be called by 0.3.3'); }
  },
  on(name, cb) { events.set(name, cb); },
  onFrontendMessage(cb) { frontendHandler = cb; },
  sendToFrontend(payload, userId) { sent.push({payload:clone(payload),userId}); },
  chats: { async getActive(userId) { assert.ok(userId, 'getActive must receive userId'); return {id:'chat-77',name:'Test Roleplay'}; } },
  chat: { async getMessages(chatId, options) { chatReadCalls++; assert.equal(chatId,'chat-77'); assert.equal(options.tail,80); return [
    {id:'m1',role:'user',content:'Mira enters the library.'},
    {id:'m2',role:'assistant',content:'Rowan lights a candle.'},
    {id:'m3',role:'user',content:'They discover a sealed letter.'}
  ]; } },
  connections: { async get(id,userId) { assert.ok(userId,'connections.get must receive userId'); assert.equal(id,'sidecar-1'); return {id}; } },
  generate: {
    async raw(input) { rawCalls++; assert.equal(input.connection_id,'sidecar-1'); assert.equal(input.userId,'alice','raw generation must receive userId'); return {content:JSON.stringify(sceneJson)}; },
    async quiet(input) { quietCalls++; assert.ok(input.messages?.length); return {content:JSON.stringify(sceneJson)}; }
  },
  images: { async uploadFromDataUrl(dataUrl,options) { uploadCalls++; assert.equal(options.userId,'alice'); assert.equal(options.owner_chat_id,'chat-77'); return {id:'img-1',url:'/api/v1/images/img-1',original_filename:'photo.jpg'}; } },
  log: { info(){}, warn(){}, error(){} }
};
vm.runInNewContext(source, {spindle}, {filename:'evermore-backend.js'});
assert.equal(typeof frontendHandler,'function');
const call = async (type,userId,extra={}) => {
  const start=sent.length;
  await frontendHandler({type,requestId:`req-${sent.length+1}`,chatId:'chat-77',chatName:'Test Roleplay',...extra},userId);
  const response=sent.slice(start).find(x=>x.userId===userId)?.payload;
  return response;
};
(async()=>{
  // Active chat routing and user-isolated settings.
  let r=await call('evermore:get-active','alice');
  assert.equal(r.type,'evermore:active-chat'); assert.equal(r.chatId,'chat-77');
  r=await call('evermore:get-settings','alice'); assert.equal(r.settings.connectionMode,'current');
  await call('evermore:save-settings','alice',{settings:{connectionMode:'separate',connectionId:'sidecar-1'}});
  r=await call('evermore:get-settings','bob'); assert.equal(r.settings.connectionMode,'current'); assert.equal(r.settings.connectionId,'');

  // Separate-connection scene recording passes the same user through every gated API.
  r=await call('evermore:analyse','alice',{mode:'separate',connectionId:'sidecar-1'});
  assert.equal(r.type,'evermore:archive'); assert.equal(r.action,'analyse');
  assert.equal(r.archive.scenes.length,1); assert.equal(r.archive.scenes[0].title,'The Moonlit Library');
  assert.equal(rawCalls,1); assert.equal(chatReadCalls,1);

  // Another account cannot see Alice's saved scenes or notes.
  r=await call('evermore:get','bob'); assert.equal(r.archive.scenes.length,0); assert.equal(r.archive.notes.length,0);
  await call('evermore:save-note','alice',{note:{id:'note-a',title:'Alice note',body:'Private'}});
  r=await call('evermore:get','bob'); assert.equal(r.archive.notes.length,0);
  r=await call('evermore:get','alice'); assert.equal(r.archive.notes.length,1); assert.equal(r.archive.notes[0].body,'Private');

  // Image upload carries userId plus chat ownership.
  r=await call('evermore:upload-image','alice',{dataUrl:'data:image/png;base64,AAAA',filename:'photo.png'});
  assert.equal(r.type,'evermore:image-uploaded'); assert.equal(uploadCalls,1);

  // The event handlers preserve account boundaries for automatic message capture.
  await events.get('MESSAGE_SENT')({chatId:'chat-77',message:{id:'auto-a',role:'assistant',content:'Alice-only event'}},'alice');
  await events.get('MESSAGE_SENT')({chatId:'chat-77',message:{id:'auto-b',role:'assistant',content:'Bob-only event'}},'bob');
  const a=await call('evermore:get','alice'); const b=await call('evermore:get','bob');
  assert.ok(a.archive.messages.some(m=>m.id==='auto-a'));
  assert.ok(!a.archive.messages.some(m=>m.id==='auto-b'));
  assert.ok(b.archive.messages.some(m=>m.id==='auto-b'));
  assert.ok(!b.archive.messages.some(m=>m.id==='auto-a'));

  // Current-connection route still works.
  r=await call('evermore:analyse','bob',{mode:'current'});
  assert.equal(r.type,'evermore:archive'); assert.equal(quietCalls,1);

  // A missing user context never causes a private broadcast.
  const before=sent.length;
  await frontendHandler({type:'evermore:get-active',requestId:'missing-user'},undefined);
  assert.equal(sent.length,before);

  console.log('PASS: active chat user routing');
  console.log('PASS: account-isolated settings, notes, scenes and message event capture');
  console.log('PASS: transcript read and separate/current AI routes');
  console.log('PASS: image upload user context');
  console.log('PASS: missing user context fails closed without broadcasting');
  console.log(`PASS: ${userDb.size} per-user storage records; shared storage was never touched`);
})().catch(err=>{console.error(err);process.exit(1);});
