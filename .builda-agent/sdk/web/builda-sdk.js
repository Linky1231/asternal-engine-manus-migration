(function () {
  const params = new URLSearchParams(window.location.search || "");
  // 开发版身份/环境只来自 URL 参数（builda dev 注入）。本文件不打任何真实服务端：
  // whoami/privateKV 全部本地伪造；真实宿主桥协议（__cysjHost/makeNativeRequest）
  // 只存在于 runtime 正式版（agent/sdk/runtime/builda-sdk.js）；mock 不使用真实 token。
  const gameId = String(params.get("gameId") || params.get("game_id") || "local-game");
  const bundleVersion = String(params.get("bundleVersion") || params.get("bundle_version") || "local");
  const assetsBaseUrl = String(params.get("assetsBaseUrl") || params.get("assets_base_url") || "");
  const mockPlayerId = params.get("builda_mock_player") || "local-player";
  const mockPlayerName = params.get("builda_mock_name") || mockPlayerId;
  // mock 用户默认头像（平台默认头像资源），让 CP 本地就能调试头像加载/裁剪显示
  const mockAvatar = "https://cysj2-res.hortorinteractive.com/GameCreatorTest/test/image/icon_touxiang_moren.png!mfit_400";
  const mockSafeArea = String(params.get("builda_mock_safearea") || "");
  const mockLanguage = String(params.get("builda_mock_lang") || "").trim();
  // dev 外壳"拒绝麦克风"开关注入：模拟用户拒绝授权，测无麦降级路径
  const mockMicDenied = params.get("builda_mock_mic") === "deny";
  // builda dev 测试外壳（builda-dev-shell.html）装载游戏时注入 builda_mock_shell=1：
  // 支付/广告模态框改经 postMessage 委托外壳渲染，模拟宿主 App 面板盖在 WebView 之上。
  const shellHosted = params.get("builda_mock_shell") === "1" && typeof window.parent !== "undefined" && window.parent !== window;
  let shellDialogSeq = 0;
  let readyCalled = false;
  const audioSessions = {};
  let bgm = null;

  function ok(data) { return { ok: true, data }; }
  function fail(code, message) { return { ok: false, error: { code, message } }; }
  function persistentIdOk(key) { return typeof key === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(key); }
  function privateKVKeyOk(key) { return typeof key === "string" && /^[A-Za-z0-9_:-]{1,64}$/.test(key); }
  function keyOk(key) { return privateKVKeyOk(key); }
  // privateKV 硬限制（与真机宿主契约一致，全按解码后字节数计）
  const KV_SINGLE_MAX = 32 * 1024;
  const KV_KEYS_MAX = 100;
  const KV_BATCH_MAX = 32;
  const KV_PREFIX = "builda:privatekv:" + gameId + ":" + mockPlayerId + ":";
  function storageKey(key) { return KV_PREFIX + key; }
  function b64FromBytes(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function bytesFromB64(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  // instanceof 兜底构造器名判断：value 可能来自其它 realm（iframe/worker/Node vm）
  function isBytes(value) {
    return value instanceof Uint8Array || (ArrayBuffer.isView(value) && value.constructor && value.constructor.name === "Uint8Array");
  }
  // privateKV value 归一化：JS 默认只收 Uint8Array；opts.encoding==="base64" 时收 base64
  // 字符串（GDScript 等字符串桥入口，base64 原样直通不做解码往返）。返回 {b64,len}，非法 null。
  function normalizeKvValue(value, encoding) {
    if (isBytes(value)) return { b64: b64FromBytes(value), len: value.length };
    if (encoding === "base64" && typeof value === "string") {
      try { return { b64: value, len: bytesFromB64(value).length }; } catch (_) { return null; }
    }
    return null;
  }
  function kvOut(b64, encoding) { return encoding === "base64" ? b64 : bytesFromB64(b64); }
  function checkKvKeys(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return fail("BAD_KEY", "privateKV keys must be a non-empty array.");
    if (keys.length > KV_BATCH_MAX) return fail("BATCH_TOO_LARGE", "privateKV batch is limited to " + KV_BATCH_MAX + " keys.");
    for (let i = 0; i < keys.length; i++) {
      if (!keyOk(keys[i])) return fail("BAD_KEY", "privateKV key must match ^[A-Za-z0-9_:-]{1,64}$");
    }
    return null;
  }
  // 现存私域数据的 {key -> 解码字节数}；localStorage 无枚举能力（如 Node 冒烟精简 stub）时
  // 返回 null，跳过配额核算（单值/批量/key 校验不受影响）。
  function kvUsage() {
    const ls = window.localStorage;
    if (typeof ls.length !== "number" || typeof ls.key !== "function") return null;
    const usage = {};
    for (let i = 0; i < ls.length; i++) {
      const name = ls.key(i);
      if (typeof name !== "string" || name.indexOf(KV_PREFIX) !== 0) continue;
      const raw = ls.getItem(name) || "";
      let len = 0;
      try { len = bytesFromB64(raw).length; } catch (_) { len = raw.length; }
      usage[name.slice(KV_PREFIX.length)] = len;
    }
    return usage;
  }
  // setMany 语义与真机一致：整批校验（key/单值/配额），任一违规整批拒绝，不做部分写入。
  function mockKvSetMany(entries, encoding) {
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) return fail("BAD_VALUE", "privateKV entries must be a plain object.");
    const keys = Object.keys(entries);
    const bad = checkKvKeys(keys);
    if (bad) return bad;
    const normalized = {};
    for (let i = 0; i < keys.length; i++) {
      const item = normalizeKvValue(entries[keys[i]], encoding);
      if (!item) return fail("BAD_VALUE", "privateKV value must be a Uint8Array (or base64 string with encoding:\"base64\"): " + keys[i]);
      if (item.len > KV_SINGLE_MAX) return fail("VALUE_TOO_LARGE", "privateKV single value is limited to " + KV_SINGLE_MAX + " bytes: " + keys[i]);
      normalized[keys[i]] = item;
    }
    const usage = kvUsage();
    if (usage) {
      let count = 0;
      Object.keys(usage).forEach(function (k) {
        if (!(k in normalized)) count += 1;
      });
      keys.forEach(function () { count += 1; });
      if (count > KV_KEYS_MAX) return fail("QUOTA_EXCEEDED", "privateKV is limited to " + KV_KEYS_MAX + " keys per player per game.");
    }
    keys.forEach(function (k) { window.localStorage.setItem(storageKey(k), normalized[k].b64); });
    return ok({ keys: keys });
  }
  function mockKvGetMany(keys, encoding) {
    const bad = checkKvKeys(keys);
    if (bad) return bad;
    const entries = {};
    keys.forEach(function (k) {
      const raw = window.localStorage.getItem(storageKey(k));
      entries[k] = raw === null ? null : kvOut(raw, encoding);
    });
    return ok({ entries: entries });
  }
  function mockKvRemoveMany(keys) {
    const bad = checkKvKeys(keys);
    if (bad) return bad;
    keys.forEach(function (k) { window.localStorage.removeItem(storageKey(k)); });
    return ok({ keys: keys });
  }
  // 本文件是【开发版/mock 版】（sdk install 装进项目、builda dev serve），只跑在浏览器里，
  // 给 CP 开发测试用：音频/震动走浏览器原生能力，支付/广告弹 mock 模态框人工选结果，
  // 身份/KV 本地伪造。不含真实宿主桥(flutter_inappwebview)代码。游戏发布后真机加载的是
  // runtime 正式版 agent/sdk/runtime/builda-sdk.js（发 CDN，只走宿主桥、无浏览器兜底）。
  // 两者 API 表面必须一致（Go 测试 TestSDKAPISurfaceConsistency 锁定）。
  // 游戏项目不要直接改本文件——sdk install / builda check 升级时会整文件覆盖。
  // 本地 dev 没有 assetsBaseUrl 时，以页面所在目录为基址解析成绝对 URL：
  // 浏览器管线（three/pixi 相对路径）本来就能跑，但 Godot HTTPRequest / Unity
  // UnityWebRequest 要求完整 URL，裸相对路径会直接报参数错误。CP 把 assets/ 下的
  // audio/、res/ 拷进构建目录即可命中同一路径。真机 runtime 版不做此解析（宿主注入）。
  const effectiveAssetsBase = assetsBaseUrl ||
    (typeof document !== "undefined" && document.baseURI ? new URL(".", document.baseURI).toString() : "./");
  function assetUrl(assetPath) {
    const p = String(assetPath || "").replace(/^\/+/, "");
    if (/^https?:\/\//i.test(p)) return p;
    return effectiveAssetsBase.replace(/\/?$/, "/") + p;
  }
  function audioOk(data) {
    return ok(Object.assign({ available: true }, data || {}));
  }
  // L1 麦克风 PCM 流原语（docs/decisions/0012）：getUserMedia → 内联 AudioWorklet（Blob URL，
  // worklet 内零分析只搬运）→ postMessage(transfer) → 主线程环形缓冲，mic.read() 同步拉取。
  // 不依赖 SharedArrayBuffer；无 AudioWorklet 的老 WebKit 退 ScriptProcessorNode（延迟增大不挂）。
  // 中断恢复（0012 §3.3）：track ended/mute + visibilitychange 内部监听，回前台 best-effort
  // 自动重建；恢复失败时 read().state 持续 "interrupted"，游戏在用户手势里重调幂等的 start()。
  // 本段与 runtime 正式版几乎同源（都用浏览器麦克风），仅 start 前置差异：runtime 先走 L0
  // 宿主握手，mock 直接浏览器授权。
  const MIC_BUFFER_MS_DEFAULT = 1000;
  const MIC_BUFFER_MS_MIN = 100;
  const MIC_BUFFER_MS_MAX = 5000;
  const MIC_WORKLET_JS =
    "class BuildaMicTap extends AudioWorkletProcessor{constructor(){super();this._chunks=[];this._len=0;}" +
    "process(inputs){var ch=inputs[0]&&inputs[0][0];if(!ch||!ch.length)return true;" +
    "this._chunks.push(new Float32Array(ch));this._len+=ch.length;" +
    "if(this._len>=512){var out=new Float32Array(this._len),o=0;" +
    "for(var i=0;i<this._chunks.length;i++){out.set(this._chunks[i],o);o+=this._chunks[i].length;}" +
    "this._chunks=[];this._len=0;this.port.postMessage(out,[out.buffer]);}return true;}}" +
    "registerProcessor('builda-mic-tap',BuildaMicTap);";
  const mic = {
    state: "idle", // idle | starting | running | interrupted
    ctx: null, stream: null, source: null, node: null,
    ring: null, cap: 0, writePos: 0, unread: 0, dropped: 0,
    sampleRate: 0, opts: null, pending: null, gen: 0, started: false, watching: false
  };
  function micWrite(block) {
    if (!mic.ring || !block || !block.length) return;
    for (let i = 0; i < block.length; i++) {
      mic.ring[mic.writePos] = block[i];
      mic.writePos = (mic.writePos + 1) % mic.cap;
      if (mic.unread < mic.cap) mic.unread += 1;
      else mic.dropped += 1; // drop-oldest：覆盖最旧未读样本
    }
  }
  function micTeardown() {
    if (mic.stream) { mic.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (_) {} }); mic.stream = null; }
    if (mic.node) {
      if (mic.node.port) mic.node.port.onmessage = null;
      if ("onaudioprocess" in mic.node) mic.node.onaudioprocess = null;
      try { mic.node.disconnect(); } catch (_) {}
      mic.node = null;
    }
    if (mic.source) { try { mic.source.disconnect(); } catch (_) {} mic.source = null; }
    if (mic.ctx) { try { mic.ctx.close(); } catch (_) {} mic.ctx = null; }
  }
  function micInterrupted() {
    if (mic.state === "running") mic.state = "interrupted";
  }
  function micRebuild() {
    if (mic.pending || mic.state !== "interrupted") return;
    const live = (mic.stream ? mic.stream.getTracks() : []).filter(function (t) { return t.readyState === "live"; });
    if (live.length) {
      // mute 型中断：track 未死，unmute 会自己回 running，不重建
      if (live.some(function (t) { return !t.muted; })) mic.state = "running";
      return;
    }
    // 重建也占用 pending：此间 CP 手势重调 start 会合并到本次重建结果，不会双开采集流
    const gen = mic.gen;
    mic.pending = micBuild(mic.opts || {}).then(function (r) {
      mic.pending = null;
      if (mic.gen !== gen) { micTeardown(); return r; } // 重建期间被 stop：拆掉新建流
      if (r.ok) { mic.state = "running"; }
      return r;
    }, function (e) {
      mic.pending = null;
      return fail("MIC_UNAVAILABLE", String(e && e.message || e || "mic rebuild failed."));
    });
  }
  function micWatchLifecycle() {
    if (mic.watching || typeof document === "undefined" || typeof document.addEventListener !== "function") return;
    mic.watching = true;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      if (mic.ctx && mic.ctx.state !== "running") { try { mic.ctx.resume(); } catch (_) {} }
      micRebuild();
    });
  }
  async function micBuild(opts) {
    const md = (typeof navigator !== "undefined" && navigator.mediaDevices) || null;
    if (!md || typeof md.getUserMedia !== "function") return fail("MIC_UNAVAILABLE", "getUserMedia is unavailable (no secure context or unsupported).");
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return fail("MIC_UNAVAILABLE", "AudioContext is unavailable in this environment.");
    let stream;
    try {
      // 必须显式关闭 WebRTC 三项处理（Chromium 默认全开）：游戏放 BGM 时 AEC 把人声连同
      // "回声"一起对消、降噪抹平残余，产出接近静音（真机 A/B：peak 0.0005 → 0.709）。
      // 声控玩法要原始响度，BGM 串音由 CP 在分析侧处理（0012 §4.5），不开放给 CP 配置。
      stream = await md.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false
      });
    } catch (e) {
      const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
      return fail(denied ? "PERMISSION_DENIED" : "MIC_UNAVAILABLE", String(e && e.message || e || "getUserMedia failed."));
    }
    micTeardown(); // 重入/重建：先清旧图
    let ctx;
    try { ctx = opts.sampleRate ? new AC({ sampleRate: opts.sampleRate }) : new AC(); } catch (_) { ctx = new AC(); }
    try { await ctx.resume(); } catch (_) {}
    mic.ctx = ctx;
    mic.stream = stream;
    mic.sampleRate = ctx.sampleRate; // 实际采样率以 AudioContext 为准（期望值不保证生效）
    const ms = parseInt(opts.bufferMs, 10);
    const bufferMs = Math.min(Math.max(isFinite(ms) && ms > 0 ? ms : MIC_BUFFER_MS_DEFAULT, MIC_BUFFER_MS_MIN), MIC_BUFFER_MS_MAX);
    mic.cap = Math.max(1, Math.round(ctx.sampleRate * bufferMs / 1000));
    mic.ring = new Float32Array(mic.cap);
    mic.writePos = 0;
    mic.unread = 0;
    stream.getTracks().forEach(function (t) {
      t.addEventListener("ended", micInterrupted);
      t.addEventListener("mute", micInterrupted);
      t.addEventListener("unmute", function () { if (mic.state === "interrupted" && mic.stream === stream) mic.state = "running"; });
    });
    mic.source = ctx.createMediaStreamSource(stream);
    let workletReady = false;
    if (ctx.audioWorklet && typeof AudioWorkletNode === "function" && typeof Blob === "function" && typeof URL !== "undefined" && URL.createObjectURL) {
      const blobUrl = URL.createObjectURL(new Blob([MIC_WORKLET_JS], { type: "application/javascript" }));
      try {
        await ctx.audioWorklet.addModule(blobUrl);
        const node = new AudioWorkletNode(ctx, "builda-mic-tap", { numberOfInputs: 1, numberOfOutputs: 0 });
        node.port.onmessage = function (ev) { micWrite(ev.data); };
        mic.source.connect(node);
        mic.node = node;
        workletReady = true;
      } catch (_) {
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    }
    if (!workletReady) {
      // 老 WebKit 兜底：ScriptProcessorNode（输出保持静音，仅驱动采集回调）
      const sp = ctx.createScriptProcessor(2048, 1, 1);
      sp.onaudioprocess = function (ev) { micWrite(ev.inputBuffer.getChannelData(0)); };
      mic.source.connect(sp);
      sp.connect(ctx.destination);
      mic.node = sp;
    }
    micWatchLifecycle();
    return ok({ sampleRate: mic.sampleRate, channels: 1 });
  }
  function micRead(opts) {
    opts = opts || {};
    if (!mic.started || !mic.ring) return fail("MIC_NOT_STARTED", "call mic.start() first.");
    let n = mic.unread;
    const max = parseInt(opts.maxSamples, 10);
    if (isFinite(max) && max >= 0 && max < n) n = max;
    const out = new Float32Array(n); // 独立拷贝（非环形缓冲视图），调用方可 postMessage(transfer)
    const startPos = (mic.writePos - mic.unread + mic.cap) % mic.cap;
    for (let i = 0; i < n; i++) out[i] = mic.ring[(startPos + i) % mic.cap];
    mic.unread -= n;
    const dropped = mic.dropped;
    mic.dropped = 0;
    return ok({
      samples: opts.encoding === "base64" ? b64FromBytes(new Uint8Array(out.buffer)) : out,
      sampleRate: mic.sampleRate,
      dropped: dropped,
      state: mic.state === "running" ? "running" : "interrupted"
    });
  }
  async function micStop() {
    mic.gen += 1; // 使在途 start/重建作废（其新建流由 gen 守卫拆除）
    micTeardown();
    mic.state = "idle";
    mic.started = false;
    mic.ring = null;
    mic.cap = 0;
    mic.writePos = 0;
    mic.unread = 0;
    mic.dropped = 0;
    mic.opts = null;
    return ok({});
  }
  function micStart(opts) {
    opts = opts || {};
    if (mic.state === "running") return Promise.resolve(ok({ sampleRate: mic.sampleRate, channels: 1 }));
    // 在途去重：并发/重复 start（含自动重建进行中）合并到同一次启动的结果，绝不返回瞬时
    // BUSY——首个 CP 联调实证：瞬时 BUSY 会被当成永久拒绝，错误码只表达真实失败。
    if (mic.pending) return mic.pending;
    mic.pending = (async function () {
      const prev = mic.state;
      const gen = mic.gen;
      try {
        if (mockMicDenied) return fail("MIC_UNAVAILABLE", "microphone unavailable (denied or missing); show a blocking prompt with retry.");
        mic.state = "starting";
        mic.opts = { sampleRate: opts.sampleRate, bufferMs: opts.bufferMs };
        const result = await micBuild(mic.opts);
        if (mic.gen !== gen) { micTeardown(); mic.state = "idle"; return fail("MIC_NOT_STARTED", "mic.stop() was called during start."); }
        if (result.ok) { mic.state = "running"; mic.started = true; mic.dropped = 0; }
        else { mic.state = prev; }
        return result;
      } finally {
        mic.pending = null;
      }
    })();
    return mic.pending;
  }
  // L0 权限探测 mock：getUserMedia 探测后立即释放，透传浏览器权限结论
  async function mockRequestMicrophone() {
    if (mockMicDenied) return ok({ available: false });
    const md = (typeof navigator !== "undefined" && navigator.mediaDevices) || null;
    if (!md || typeof md.getUserMedia !== "function") return ok({ available: false });
    try {
      const probe = await md.getUserMedia({ audio: true, video: false });
      probe.getTracks().forEach(function (t) { try { t.stop(); } catch (_) {} });
      return ok({ available: true });
    } catch (_) {
      return ok({ available: false });
    }
  }
  // dev 外壳"麦克风中断"开关（协议 builda:mock-mic）：interrupt 停掉 track 模拟来电/会话
  // 抢占，recover 模拟回前台自动重建（同 0012 §3.3 visibilitychange 路径）。
  if (shellHosted && typeof window.addEventListener === "function") {
    window.addEventListener("message", function (ev) {
      if (ev.origin !== window.location.origin) return;
      const msg = ev.data;
      if (!msg || msg.type !== "builda:mock-mic") return;
      if (msg.action === "interrupt" && mic.state === "running") {
        micTeardown();
        mic.state = "interrupted";
      }
      if (msg.action === "recover") micRebuild();
    });
  }
  // 排行榜前置校验：rankId 约束与 manifest rankBoards 一致；分数为整数且在平台总范围内
  // （每个榜自己的 min/max 由宿主按已发布配置权威校验）；limit 默认 50、上限 100。
  const RANK_SCORE_MIN = -9999999999;
  const RANK_SCORE_MAX = 9999999999;
  function rankIdOk(rankId) { return persistentIdOk(rankId); }
  function rankScoreOk(score) { return typeof score === "number" && Number.isInteger(score) && score >= RANK_SCORE_MIN && score <= RANK_SCORE_MAX; }
  function clampRankLimit(v) {
    v = parseInt(v, 10);
    if (!isFinite(v) || v < 1) v = 50;
    return Math.min(v, 100);
  }
  function rankStorageKey(rankId) { return "builda:rank:" + gameId + ":" + mockPlayerId + ":" + rankId; }
  // 输入面板 maxLength：默认 64，SDK 钳制上限 256（宿主/mock 再按此权威截断）
  function clampInputMaxLen(v) {
    v = parseInt(v, 10);
    if (!isFinite(v) || v < 1) v = 64;
    return Math.min(v, 256);
  }
  let inputPanelOpen = false;

  // getRoleInfo mock 与 runtime 保持相同的 50ms 固定聚合窗口、32 项批次和
  // 30 分钟 / 512 项 LRU；差异只在数据源，本地不会访问真实 Builda 服务。
  const ROLE_INFO_BATCH_MAX = 32;
  const ROLE_INFO_WINDOW_MS = 50;
  const ROLE_INFO_CACHE_TTL_MS = 30 * 60 * 1000;
  const ROLE_INFO_CACHE_MAX = 512;
  const roleInfoCache = new Map();
  const roleInfoQueue = new Set();
  let roleInfoWaiters = [];
  let roleInfoTimer = null;
  function roleIdOk(roleId) {
    return typeof roleId === "string" && /^[1-9][0-9]*$/.test(roleId) &&
      (roleId.length < 19 || (roleId.length === 19 && roleId <= "9223372036854775807"));
  }
  function roleInfoCacheGet(roleId) {
    const entry = roleInfoCache.get(roleId);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) { roleInfoCache.delete(roleId); return null; }
    roleInfoCache.delete(roleId);
    roleInfoCache.set(roleId, entry);
    return entry.value;
  }
  function roleInfoCacheSet(roleId, value) {
    roleInfoCache.delete(roleId);
    roleInfoCache.set(roleId, { value: value, expiresAt: Date.now() + ROLE_INFO_CACHE_TTL_MS });
    while (roleInfoCache.size > ROLE_INFO_CACHE_MAX) roleInfoCache.delete(roleInfoCache.keys().next().value);
  }
  function mockRoleInfoSchedule() {
    if (roleInfoTimer !== null || roleInfoQueue.size === 0) return;
    roleInfoTimer = window.setTimeout(mockRoleInfoFlush, ROLE_INFO_WINDOW_MS);
  }
  function mockRoleInfoSettle(waiter, result) {
    if (waiter.done) return;
    waiter.done = true;
    if (waiter.timer !== null) window.clearTimeout(waiter.timer);
    waiter.resolve(result);
  }
  function mockRoleInfoFlush() {
    roleInfoTimer = null;
    const batch = Array.from(roleInfoQueue).slice(0, ROLE_INFO_BATCH_MAX);
    if (batch.length === 0) return;
    const profiles = {};
    batch.forEach(function (roleId) {
      roleInfoQueue.delete(roleId);
      const profile = {
        userName: roleId === mockPlayerId ? mockPlayerName : "Mock Player " + roleId,
        userImg: mockAvatar
      };
      profiles[roleId] = profile;
      roleInfoCacheSet(roleId, profile);
    });
    roleInfoWaiters.forEach(function (waiter) {
      batch.forEach(function (roleId) {
        if (!waiter.remaining.has(roleId)) return;
        waiter.remaining.delete(roleId);
        waiter.data[roleId] = profiles[roleId];
      });
      if (waiter.remaining.size === 0) {
        mockRoleInfoSettle(waiter, ok(waiter.data));
      }
    });
    roleInfoWaiters = roleInfoWaiters.filter(function (waiter) { return !waiter.done; });
    if (roleInfoQueue.size > 0) mockRoleInfoSchedule();
  }
  function getRoleInfo(roleIds, opts) {
    opts = opts || {};
    if (!Array.isArray(roleIds) || roleIds.length === 0) return Promise.resolve(fail("INVALID_REQUEST", "roleIds must be a non-empty array"));
    if (roleIds.length > ROLE_INFO_BATCH_MAX) return Promise.resolve(fail("BATCH_TOO_LARGE", "role info batch is limited to " + ROLE_INFO_BATCH_MAX + " roleIds"));
    const unique = [];
    const seen = new Set();
    for (let i = 0; i < roleIds.length; i++) {
      if (!roleIdOk(roleIds[i])) return Promise.resolve(fail("INVALID_REQUEST", "roleIds must be positive decimal strings"));
      if (!seen.has(roleIds[i])) { seen.add(roleIds[i]); unique.push(roleIds[i]); }
    }
    const data = {};
    const missing = [];
    unique.forEach(function (roleId) {
      const cached = roleInfoCacheGet(roleId);
      if (cached) data[roleId] = cached;
      else missing.push(roleId);
    });
    if (missing.length === 0) return Promise.resolve(ok(data));
    return new Promise(function (resolve) {
      const waiter = { remaining: new Set(missing), data: data, resolve: resolve, done: false, timer: null };
      if (typeof opts.timeoutMs === "number" && opts.timeoutMs > 0) {
        waiter.timer = window.setTimeout(function () {
          mockRoleInfoSettle(waiter, fail("TIMEOUT", "getRoleInfo timed out"));
          roleInfoWaiters = roleInfoWaiters.filter(function (item) { return !item.done; });
          roleInfoQueue.forEach(function (roleId) {
            let needed = false;
            for (let i = 0; i < roleInfoWaiters.length; i++) {
              if (roleInfoWaiters[i].remaining.has(roleId)) { needed = true; break; }
            }
            if (!needed) roleInfoQueue.delete(roleId);
          });
        }, opts.timeoutMs);
      }
      roleInfoWaiters.push(waiter);
      missing.forEach(function (roleId) { roleInfoQueue.add(roleId); });
      mockRoleInfoSchedule();
    });
  }
  // mock 输入面板：贴底渲染"输入框 + 确认/取消"（无标题栏，与真机宿主形态一致），聚焦真实
  // <input> 唤起系统键盘——这正是真机行为的本地等价物，所以不经 dev-shell 委托（shell 委托是
  // 给无输入焦点需求的 pay/ad 面板用的）。无 DOM 环境（Node 冒烟）按确认 + defaultValue 返回。
  function mockInputPanel(opts) {
    const maxLen = clampInputMaxLen(opts.maxLength);
    const fallback = String(opts.defaultValue || "").slice(0, maxLen);
    if (typeof document === "undefined" || !document.body) return Promise.resolve({ confirmed: true, text: fallback });
    return new Promise(function (resolve) {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2147483647;display:flex;align-items:flex-end;font-family:system-ui,sans-serif;";
      const bar = document.createElement("div");
      bar.style.cssText = "background:#fff;width:100%;padding:10px 12px;display:flex;gap:8px;align-items:center;box-shadow:0 -4px 16px rgba(0,0,0,.2);";
      const field = document.createElement("input");
      field.type = "text";
      field.value = fallback;
      field.placeholder = String(opts.placeholder || "");
      field.maxLength = maxLen;
      field.style.cssText = "flex:1;font-size:15px;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;outline:none;";
      function finish(confirmed) {
        overlay.remove();
        resolve({ confirmed: confirmed, text: confirmed ? field.value.slice(0, maxLen) : "" });
      }
      function button(label, confirmed, style) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText = "padding:8px 16px;border-radius:8px;border:0;cursor:pointer;font-size:14px;white-space:nowrap;" + style;
        b.addEventListener("click", function () { finish(confirmed); });
        return b;
      }
      field.addEventListener("keydown", function (ev) { if (ev.key === "Enter") finish(true); });
      bar.appendChild(field);
      bar.appendChild(button("确认", true, "background:#16a34a;color:#fff;"));
      bar.appendChild(button("取消", false, "background:#e5e7eb;color:#374151;"));
      overlay.appendChild(bar);
      document.body.appendChild(overlay);
      field.focus();
    });
  }
  // 模态框：人工点“成功/失败”决定 pay/ad 的 mock 返回；resolve(true|false)。
  // 在测试外壳里运行时委托外壳渲染（协议 builda:mock-dialog / builda:mock-dialog-result，
  // 同源校验，外壳与本文件同一 sdk zip 分发、协议同版本）；直接打开游戏 URL 时退回
  // 页面内蒙黑模态框；无 DOM 环境（如 CLI 冒烟脚本用 Node 加载本文件）自动按成功返回。
  function mockDialog(kind, title, detail) {
    if (shellHosted) {
      return new Promise(function (resolve) {
        const id = "builda_dialog_" + (++shellDialogSeq);
        function onMessage(ev) {
          const msg = ev.data;
          if (ev.origin !== window.location.origin || !msg || msg.type !== "builda:mock-dialog-result" || msg.id !== id) return;
          window.removeEventListener("message", onMessage);
          resolve(!!msg.success);
        }
        window.addEventListener("message", onMessage);
        window.parent.postMessage({ type: "builda:mock-dialog", id: id, kind: kind, title: title, detail: detail }, window.location.origin);
      });
    }
    if (typeof document === "undefined" || !document.body) return Promise.resolve(true);
    return new Promise(function (resolve) {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;";
      const box = document.createElement("div");
      box.style.cssText = "background:#fff;color:#222;border-radius:12px;padding:20px 24px;min-width:260px;max-width:80vw;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.35);";
      const heading = document.createElement("div");
      heading.style.cssText = "font-size:16px;font-weight:600;margin-bottom:8px;";
      heading.textContent = title;
      const desc = document.createElement("div");
      desc.style.cssText = "font-size:13px;color:#666;margin-bottom:16px;word-break:break-all;";
      desc.textContent = detail;
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:12px;justify-content:center;";
      function button(label, result, style) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText = "padding:8px 20px;border-radius:8px;border:0;cursor:pointer;font-size:14px;" + style;
        b.addEventListener("click", function () {
          overlay.remove();
          resolve(result);
        });
        return b;
      }
      row.appendChild(button("成功", true, "background:#16a34a;color:#fff;"));
      row.appendChild(button("失败", false, "background:#e5e7eb;color:#374151;"));
      box.appendChild(heading);
      box.appendChild(desc);
      box.appendChild(row);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  }

  window.Builda = {
    version: "0.4.34",
    runtime: {
      gameId: gameId,
      bundleVersion: bundleVersion,
      ready: async function () {
        if (!readyCalled) {
          readyCalled = true;
          console.info("[Builda SDK mock] 收到 Builda.runtime.ready()。");
        }
        return ok({ available: false });
      },
      quit: async function () {
        return fail("HOST_UNAVAILABLE", "Builda App host bridge is unavailable.");
      },
      safeArea: function () {
        // 安全区四边 inset（CSS px），同步裸返回（同 assets.url，纯本地数据不包 Result）。
        // mock 值来自 builda dev --safearea 注入的 URL 参数
        // builda_mock_safearea=top,right,bottom,left；缺省全 0（无刘海）。
        const parts = mockSafeArea.split(",").map(function (s) { return parseFloat(s); });
        const n = function (i) { return isFinite(parts[i]) && parts[i] > 0 ? parts[i] : 0; };
        return { top: n(0), right: n(1), bottom: n(2), left: n(3) };
      },
      capsuleMenuRect: function () {
        // 平台悬浮入口（通用设置/暂停退出按钮）矩形，同步裸返回：top/right 是距视口
        // 上/右边缘的 inset（CSS px，与 safeArea 同语义），加 width/height。
        // mock 版：top = safeArea.top + 6，其余固定 right 10、80x32。
        const saTop = parseFloat(mockSafeArea.split(",")[0]);
        return { top: (isFinite(saTop) && saTop > 0 ? saTop : 0) + 6, right: 10, width: 80, height: 32 };
      },
      language: function () {
        // 当前语言（BCP 47 连字符形态），同步裸返回，绝不返回空串。真机宿主只给裸语言码
        // （zh / en，不带区域变体），唯一例外西语为 es-419——mock 把 navigator.language
        // 收敛到同一粒度（取主语言子标签，es* → es-419），与真机值域一致；URL 参数
        // builda_mock_lang 可覆盖为任意值（本地测语言回退逻辑用），优先级最高。
        if (mockLanguage) return mockLanguage;
        const nav = String((typeof navigator !== "undefined" && navigator.language) || "").trim().toLowerCase();
        const primary = nav.split("-")[0];
        if (primary === "es") return "es-419";
        return primary || "en";
      }
    },
    assets: {
      baseUrl: effectiveAssetsBase,
      url: function (path) { return assetUrl(path); }
    },
    audio: {
      playBGM: async function (path, opts) {
        opts = opts || {};
        const url = assetUrl(path);
        const loop = opts.loop !== false;
        const volume = typeof opts.volume === "number" ? opts.volume : 1;
        if (typeof Audio === "undefined") return ok({ available: false, url });
        if (bgm) { bgm.pause(); bgm = null; }
        bgm = new Audio(url);
        bgm.loop = loop;
        bgm.volume = Math.max(0, Math.min(1, volume));
        await bgm.play();
        return audioOk({ url });
      },
      stopBGM: async function () {
        if (bgm) { bgm.pause(); bgm = null; }
        return audioOk({});
      },
      playSFX: async function (path, opts) {
        opts = opts || {};
        const url = assetUrl(path);
        const sessionId = String(opts.sessionId || ("sfx_" + Date.now() + "_" + Math.random().toString(16).slice(2)));
        const volume = typeof opts.volume === "number" ? opts.volume : 1;
        const loop = opts.loop === true;
        if (typeof Audio === "undefined") return ok({ available: false, url, sessionId });
        const audio = new Audio(url);
        audio.loop = loop;
        audio.volume = Math.max(0, Math.min(1, volume));
        audioSessions[sessionId] = audio;
        audio.addEventListener("ended", function () { delete audioSessions[sessionId]; });
        await audio.play();
        return audioOk({ url, sessionId });
      },
      setMuted: async function (muted, group) {
        group = group || "bgm";
        if (bgm && (!group || group === "bgm")) bgm.muted = !!muted;
        Object.keys(audioSessions).forEach(function (id) { audioSessions[id].muted = !!muted; });
        return audioOk({});
      },
      vibrate: async function (level) {
        // 震动强度三档：1 轻 / 2 中 / 3 重，非法值归 2；浏览器 Vibration API 没有强度概念，
        // 按档位映射时长近似（仅 Android 等部分环境可用，且需要用户手势后才生效）。
        // Chrome 会拦截未被用户激活过的跨源 iframe 调用并打印 Intervention，mock 里直接降级。
        level = level === 1 || level === 3 ? level : 2;
        if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return ok({ available: false });
        if (navigator.userActivation && navigator.userActivation.hasBeenActive === false) return ok({ available: false });
        navigator.vibrate({ 1: 20, 2: 50, 3: 100 }[level]);
        return audioOk({});
      },
      requestMicrophone: async function (opts) {
        // L0 权限协商（0012 §3.1）mock：透传浏览器权限（探测后立即释放）；幂等可重复调用。
        // available:false = 用户拒绝或设备无麦（dev 外壳"拒绝麦克风"开关可模拟），游戏应
        // 给出明确的阻断提示并允许重试（替代玩法可选）。
        if (mic.state === "running") return ok({ available: true });
        return mockRequestMicrophone();
      }
    },
    mic: {
      // L1 PCM 流原语（0012 §3.2/§3.3）：单声道 float32（[-1,1]），环形缓冲 drop-oldest。
      // start 必须在用户手势之后调用（自动播放策略），幂等可重入（中断后重调即手动重建）；
      // 注意"权限结果回调不是手势上下文"（Godot 轮询取结果必然脱离手势）——标准流程是
      // 两次手势：第 1 次点击 requestMicrophone，第 2 次点击 start；并发 start 在途去重
      // 合并结果，不返回瞬时 BUSY；
      // read 是同步裸调用，返回自上次 read 以来的新样本（独立拷贝，可 transfer 给 Worker），
      // dropped 报告被覆盖的样本数，state:"interrupted" 表示采集中断（SDK 回前台自动重建）；
      // stop 幂等。重 DSP（音高/音色）放 CP 自己的 Web Worker，别抢主线程（0012 §4.3）。
      // PCM 只许本地实时分析，禁止录音留存/上传（审核红线）。
      start: async function (opts) {
        return micStart(opts);
      },
      read: function (opts) {
        return micRead(opts);
      },
      stop: async function () {
        return micStop();
      }
    },
    pay: {
      showPayPanel: async function (saleId, opts) {
        if (!persistentIdOk(saleId)) return fail("BAD_PAY_ID", "pay id must match ^[A-Za-z0-9_-]{1,64}$");
        // mock 支付面板：外壳/页面内模态框，人工点“成功/失败”决定返回，
        // 便于 CP 本地跑通按 orderId 幂等发放的两条分支。真机支付面板在 runtime 正式版。
        const success = await mockDialog("pay", "Mock 支付面板", "saleId: " + String(saleId || ""));
        return ok({ success: !!success, orderId: success ? "mock_order_" + Date.now().toString(36) : "" });
      }
    },
    ad: {
      showRewardAd: async function (posId, opts) {
        // posId 是游戏自定义的广告位统计标识（任意命名，无需申请、无需在 manifest 声明）。
        // mock 激励视频：外壳/页面内模态框，人工点“成功/失败”决定返回。
        // 真机激励视频与 onRewardAdsResultV2 回推在 runtime 正式版。
        const success = await mockDialog("ad", "Mock 激励视频", "posId: " + String(posId || ""));
        return ok({ success: !!success, transId: success ? "mock_trans_" + Date.now().toString(36) : "", adCoin: null });
      }
    },
    input: {
      // 拉起 mock 输入面板（输入框 + 键盘，无标题栏）。同刻单例：面板未关时再调返回 BUSY。
      showInputPanel: async function (opts) {
        opts = opts || {};
        if (inputPanelOpen) return fail("BUSY", "input panel is already open.");
        inputPanelOpen = true;
        try {
          const result = await mockInputPanel(opts);
          return ok({ confirmed: !!result.confirmed, text: String(result.text || "") });
        } finally {
          inputPanelOpen = false;
        }
      }
    },
    rank: {
      // mock 排行榜：本地拿不到 builda.publish.json 的榜单配置，所以不校验 rankId 是否已发布、
      // 不校验每榜 min/max、不区分 sortType/周期——只保留最近一次提交的分数，榜单按降序展示
      // 固定假对手，供 CP 跑通接口形态与 UI；真实校验与 best-per-cycle 语义只在真机宿主。
      submitScore: async function (rankId, score) {
        if (!rankIdOk(rankId)) return fail("BAD_RANK_ID", "rank id must match ^[A-Za-z0-9_-]{1,64}$");
        if (!rankScoreOk(score)) return fail("BAD_SCORE", "rank score must be an integer within [" + RANK_SCORE_MIN + ", " + RANK_SCORE_MAX + "].");
        window.localStorage.setItem(rankStorageKey(rankId), String(score));
        return ok({ rankId: rankId });
      },
      getRankList: async function (rankId, opts) {
        opts = opts || {};
        if (!rankIdOk(rankId)) return fail("BAD_RANK_ID", "rank id must match ^[A-Za-z0-9_-]{1,64}$");
        const limit = clampRankLimit(opts.limit);
        const rival = function (rank, score, n) { return { rank: rank, score: score, player: { id: "mock_rival_" + n, name: "Rival " + n, avatar: mockAvatar } }; };
        const raw = window.localStorage.getItem(rankStorageKey(rankId));
        if (raw === null) {
          return ok({ rankId: rankId, list: [rival(1, 300, 1), rival(2, 200, 2), rival(3, 100, 3)].slice(0, limit), self: null });
        }
        const score = parseInt(raw, 10) || 0;
        const list = [
          rival(1, score + 20, 1),
          rival(2, score + 10, 2),
          { rank: 3, score: score, player: { id: mockPlayerId, name: mockPlayerName, avatar: mockAvatar } },
          rival(4, score - 10, 4)
        ].slice(0, limit);
        return ok({ rankId: rankId, list: list, self: { rank: 3, score: score } });
      }
    },
    whoami: async function () {
      return ok({ id: mockPlayerId, name: mockPlayerName, avatar: mockAvatar });
    },
    requestToken: async function () {
      // mock token：纯本地伪造形态，真实服务不会接受；10 分钟"有效期"仅供游戏跑通
      // "过期前重新请求"的刷新逻辑。真机 token 由宿主经 requestToken cmd 向服务端换发。
      return ok({ token: "mock_token_" + Date.now().toString(36) + Math.random().toString(16).slice(2), expiresAt: Math.floor(Date.now() / 1000) + 600 });
    },
    getRoleInfo: getRoleInfo,
    privateKV: {
      // 私域存档（当前游戏×当前玩家），value 为不透明字节流（Godot 侧推荐 var_to_bytes），
      // localStorage 存 base64。限额与真机宿主一致，CP 在 builda dev 阶段就能撞到配额错误；
      // 写频率限额（60/min）由真机宿主执行，mock 不模拟。last write wins，无版本/CAS；
      // get 返回 null 表示 key 不存在（空字节是合法值），删除必须显式 remove/removeMany。
      get: async function (key, opts) {
        opts = opts || {};
        const result = mockKvGetMany([key], opts.encoding);
        return result.ok ? ok(result.data.entries[key]) : result;
      },
      set: async function (key, value, opts) {
        opts = opts || {};
        if (!keyOk(key)) return fail("BAD_KEY", "privateKV key must match ^[A-Za-z0-9_:-]{1,64}$");
        const entries = {};
        entries[key] = value;
        const result = mockKvSetMany(entries, opts.encoding);
        return result.ok ? ok({ key: key }) : result;
      },
      remove: async function (key) {
        const result = mockKvRemoveMany([key]);
        return result.ok ? ok({ key: key }) : result;
      },
      getMany: async function (keys, opts) {
        opts = opts || {};
        return mockKvGetMany(keys, opts.encoding);
      },
      setMany: async function (entries, opts) {
        opts = opts || {};
        return mockKvSetMany(entries, opts.encoding);
      },
      removeMany: async function (keys) {
        return mockKvRemoveMany(keys);
      }
    }
  };

  // 开发期 ready 检查：runtime.ready() 是开始游戏逻辑前必须调用的接口（真机宿主靠它
  // 结束加载态）。mock 版在加载 15 秒后仍未收到 ready 时 console.warn 提醒一次——只提示
  // 不阻断，慢机器上 Godot wasm 还没加载完属正常，游戏已在运行才说明确实漏调。
  // Node 冒烟加载本文件时 unref 定时器，避免挂住进程。
  const readyWatchdog = setTimeout(function () {
    if (readyCalled) return;
    console.warn("[Builda SDK mock] 加载 15 秒后仍未收到 Builda.runtime.ready()。如果游戏已经开始运行，说明漏调了 ready()：必须在游戏加载完成、开始游戏逻辑前调用（Godot 侧 BuildaClient.runtime_ready()），真机宿主依赖它结束加载态。");
  }, 15000);
  if (readyWatchdog && typeof readyWatchdog.unref === "function") readyWatchdog.unref();
})();
