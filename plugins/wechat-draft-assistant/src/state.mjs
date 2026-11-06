import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, openSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { hash, UserFacingError, WeChatError } from './validation.mjs';

export class State {
  constructor(directory, account) {
    directory = resolve(directory);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const filename = join(directory, 'wechat.sqlite');
    closeSync(openSync(filename, 'a', 0o600));
    chmodSync(filename, 0o600);
    this.db = new DatabaseSync(filename);
    this.account = hash(account);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS receipts (
        account TEXT NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
        state TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL,
        PRIMARY KEY(account, request_id));
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT NOT NULL, result TEXT NOT NULL);`);
  }
  async once(kind, requestId, payload, work) {
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new UserFacingError('请求编号应为 8–100 位字母、数字、下划线或连字符。');
    const digest = hash([kind, payload]);
    const inserted = this.db.prepare(`INSERT OR IGNORE INTO receipts
      (account,request_id,payload_hash,state,created_at) VALUES(?,?,?,'processing',?)`)
      .run(this.account, requestId, digest, new Date().toISOString()).changes;
    if (!inserted) {
      const previous = this.db.prepare('SELECT * FROM receipts WHERE account=? AND request_id=?').get(this.account, requestId);
      if (previous.payload_hash !== digest) throw new UserFacingError('这个请求编号已用于不同内容，请为新操作使用新的编号。');
      if (previous.state === 'complete') return JSON.parse(previous.result);
      throw new UserFacingError(previous.state === 'failed'
        ? '上次请求被拒绝，请修正问题，再使用新的编号。'
        : '该请求仍在处理或结果未知。此编号不会再次写入；请先查询草稿箱核实，勿换编号盲目重试。');
    }
    try {
      const result = await work();
      this.db.prepare("UPDATE receipts SET state='complete',result=? WHERE account=? AND request_id=?")
        .run(JSON.stringify(result), this.account, requestId);
      return result;
    } catch (error) {
      this.db.prepare('UPDATE receipts SET state=?,result=NULL WHERE account=? AND request_id=?')
        .run(error instanceof WeChatError ? 'failed' : 'unknown', this.account, requestId);
      throw error;
    }
  }
  addImage(result) {
    this.db.prepare('INSERT INTO images(account,result) VALUES(?,?)').run(this.account, JSON.stringify(result));
  }
  listImages() {
    return this.db.prepare('SELECT result FROM images WHERE account=? ORDER BY id DESC LIMIT 30')
      .all(this.account).map(row => JSON.parse(row.result));
  }
  close() { this.db.close(); }
}
