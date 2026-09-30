// claim_workbuddy_checkin.js
// 自动领取 WorkBuddy 桌面端「Buddy加油站」每日签到积分（默认 100 积分/天）
//
// 原理：复现客户端主进程 authService.claimDailyCheckin() 发出的请求
//   POST https://www.codebuddy.cn/v2/billing/meter/daily-checkin
//   Header: Authorization: Bearer <本机 JWT>, X-User-Id, X-Product-Code: workbuddy
//
// 登录态来源：WorkBuddy 客户端写入的本地认证文件（见 defaultInfoPath()），
//   含 accessToken / refreshToken。本脚本只读取，不在代码里写死任何密钥 / 凭据，
//   也不写死用户名或机器目录——路径按平台用 os.homedir() 自动推导。
//   若自动定位失败，可用环境变量 WORKBUDDY_AUTH_INFO 指定该文件绝对路径。
//
// 用法：node claim_workbuddy_checkin.js   （需 Node 18+，因使用全局 fetch）

const fs = require('fs');
const os = require('os');
const path = require('path');

const ENDPOINT = 'https://www.codebuddy.cn';
const TOKEN_URL = ENDPOINT + '/auth/realms/copilot/protocol/openid-connect/token';

// 按平台自动推导 WorkBuddy 本地认证文件路径（不写死用户名 / 机器目录）
function defaultInfoPath() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    return path.join(
      home, 'AppData', 'Local', 'CodeBuddyExtension', 'Data', 'Public', 'auth', 'workbuddy-desktop.info'
    );
  }
  if (process.platform === 'darwin') {
    return path.join(
      home, 'Library', 'Application Support', 'CodeBuddyExtension', 'Data', 'Public', 'auth', 'workbuddy-desktop.info'
    );
  }
  // Linux：Electron 常见 userData 位置之一，失败请用 WORKBUDDY_AUTH_INFO 覆盖
  return path.join(
    home, '.config', 'CodeBuddyExtension', 'Data', 'Public', 'auth', 'workbuddy-desktop.info'
  );
}

const INFO_PATH = process.env.WORKBUDDY_AUTH_INFO || defaultInfoPath();

function loadInfo() {
  return JSON.parse(fs.readFileSync(INFO_PATH, 'utf8'));
}
function saveInfo(info) {
  fs.writeFileSync(INFO_PATH, JSON.stringify(info, null, 2));
}
function jwtExp(token) {
  try {
    const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    return p.exp || 0;
  } catch {
    return 0;
  }
}

// accessToken 即将过期时用 refreshToken 换一个新的，并写回本地文件（客户端本身也会这么做）
async function ensureFreshToken(info) {
  const now = Math.floor(Date.now() / 1000);
  if (jwtExp(info.auth.accessToken) > now + 300) return info.auth.accessToken;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: 'console',
    refresh_token: info.auth.refreshToken,
  });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('刷新 token 失败: ' + JSON.stringify(j).slice(0, 300));
  info.auth.accessToken = j.access_token;
  if (j.refresh_token) info.auth.refreshToken = j.refresh_token;
  if (j.expires_in) info.auth.expiresIn = j.expires_in;
  saveInfo(info);
  return j.access_token;
}

async function buildHeaders(info) {
  const token = await ensureFreshToken(info);
  return {
    Accept: 'application/json',
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    'X-User-Id': info.account.uid,
    'X-Product-Code': 'workbuddy',
    'User-Agent': 'WorkBuddy/Desktop',
  };
}

(async () => {
  const info = loadInfo();
  const h = await buildHeaders(info);

  // 1) 先查状态，避免重复领取
  const st = await fetch(ENDPOINT + '/v2/billing/meter/checkin-activity-status', {
    method: 'POST',
    headers: h,
    body: '{}',
  });
  const sd = await st.json();
  if (sd.code !== 0) {
    console.log('状态查询失败:', JSON.stringify(sd).slice(0, 300));
    return;
  }
  if (sd.data.today_checked_in) {
    console.log(
      `今日已签到，跳过。主题=${sd.data.theme_name} 连续${sd.data.streak_days}天 总积分=${sd.data.total_credits}`
    );
    return;
  }

  // 2) 领取今日积分
  const r = await fetch(ENDPOINT + '/v2/billing/meter/daily-checkin', {
    method: 'POST',
    headers: h,
    body: '{}',
  });
  const rd = await r.json();
  if (rd.code === 0) {
    console.log(`领取成功！本次 +${rd.data.credit} 积分，连续签到 ${rd.data.streak_days} 天`);
  } else {
    console.log('领取返回异常:', JSON.stringify(rd).slice(0, 400));
  }
})().catch((e) => {
  console.error('脚本出错:', e.message);
  process.exit(1);
});
