export type BuildaResult<T> = { ok: true; data: T; requestId?: string } | { ok: false; error: { code: string; message: string }; requestId?: string };
export type BuildaPlayer = { id: string; name: string; avatar?: string };
export type BuildaAudioResult = { available: boolean; url?: string; sessionId?: string };
export type BuildaSafeArea = { top: number; right: number; bottom: number; left: number };
export type BuildaCapsuleMenuRect = { top: number; right: number; width: number; height: number };
export type BuildaPayPanelResult = { success: boolean; orderId: string };
export type BuildaRewardAdResult = { success: boolean; transId: string; adCoin: unknown | null };
// 输入面板：宿主只展示输入框 + 键盘（无标题栏），确认返回最终文本（宿主侧完成审核/截断），
// 取消返回 { confirmed: false, text: "" }。同刻单例，面板未关时再调返回 BUSY。
export type BuildaInputPanelResult = { confirmed: boolean; text: string };
export type BuildaInputPanelOpts = { placeholder?: string; defaultValue?: string; maxLength?: number; timeoutMs?: number };
// mic（docs/decisions/0012）：麦克风 PCM 流原语。SDK 只把麦克风变成"可拉取的单声道
// float32 样本流"（[-1,1]），不做任何特征分析——音高/音量/音色等由 CP 对 PCM 自行计算
// （重 DSP 放 CP 自己的 Web Worker，别抢主线程）。requestMicrophone 触发/查询权限，幂等；
// available:false = 用户拒绝或设备无麦，游戏应给出明确的阻断提示并允许重试（无麦替代
// 玩法可选、不是必须）。start 需在用户手势后
// 调用（自动播放策略），幂等可重入（中断后重调即手动重建），实际 sampleRate 以返回值为准；
// 注意"权限结果回调不是手势上下文"——标准流程是两次手势（第 1 次点击 requestMicrophone，
// 权限结果回来停在"等一次点击"引导，第 2 次点击 start）；并发/重复 start 在途去重合并到
// 同一次启动结果，不返回瞬时 BUSY。
// read 是同步调用：返回自上次 read 以来的新样本，samples 是独立拷贝（可 transfer 给
// Worker）；encoding:"base64" 时改返 float32 LE 字节的 base64 字符串（GDScript 等字符串桥
// 用）；dropped 是环形缓冲 drop-oldest 覆盖的样本数（拉取过慢的信号，实时控制通常无害，
// 别当连续流做录音）；state:"interrupted" 表示采集中断（来电/切后台，SDK 回前台
// best-effort 自动重建；持续 interrupted 时在用户手势里重调 start）。stop 幂等。
// PCM 只许本地实时分析，禁止录音留存/上传（审核红线）。
export type BuildaMicPermission = { available: boolean };
export type BuildaMicStart = { sampleRate: number; channels: 1 };
export type BuildaMicRead = { samples: Float32Array | string; sampleRate: number; dropped: number; state: "running" | "interrupted" };
// rank：排行榜（榜单在 builda.publish.json 的 rankBoards 声明并随发布审核生效）。
// rankId 必须匹配 ^[A-Za-z0-9_-]{1,64}$。
// submitScore 提交本局分数，宿主按榜单配置校验（rankId 已发布、min/max 范围）并按
// sortType 保留每玩家每周期最优成绩；getRankList 返回榜单前 N 名 + 自己的名次
// （self 为 null 表示本周期未上榜）。分数是整数，平台总范围 [-9999999999, 9999999999]。
export type BuildaRankEntry = { rank: number; score: number; player: BuildaPlayer };
export type BuildaRankList = { rankId: string; list: BuildaRankEntry[]; self: { rank: number; score: number } | null };
// requestToken：向宿主换取 game-scoped 短期 token（绑定当前游戏 × 当前玩家 × 有限时效，
// 绝不是完整登录态），供游戏逻辑层直连需要鉴权的 Builda 服务（具体服务另行定义）。
// 游戏只在内存持有：禁止写入 privateKV/本地文件/URL/存档；过期前自行重新请求。
// expiresAt 为 Unix 秒。SDK 不持久化 token、不管理其刷新；getRoleInfo 每批通过既有宿主
// requestToken 契约取得当前 token。
export type BuildaTokenResult = { token: string; expiresAt: number };
export type BuildaRoleInfo = { userName: string; userImg: string };
export type BuildaRoleInfoMap = Record<string, BuildaRoleInfo>;
// privateKV：当前游戏 × 当前玩家的私域存档，value 是不透明字节流（推荐 Godot 侧
// var_to_bytes()/bytes_to_var()）。opts.encoding:"base64" 时 value 进出改用 base64 字符串
// （给 GDScript 等字符串桥用；JS 侧默认只收发 Uint8Array）。
// 语义：last write wins、无版本/CAS；get 返回 null 表示 key 不存在（空字节是合法值）；
// setMany 整批校验任一违规整批拒绝，写入尽力不承诺事务；removeMany 对不存在 key 幂等。
// key 必须匹配 ^[A-Za-z0-9_:-]{1,64}$；新代码仍推荐只使用字母、数字、_、-。
// 限额（按解码后字节数）：单 value ≤ 32KB，
// 单次批量 ≤ 32 key，每玩家每游戏总活 key ≤ 100；无聚合字节配额。
// SDK 不自动拆批，超过 32 key 返回 BATCH_TOO_LARGE。
export type BuildaKVValue = Uint8Array | string;
export type BuildaKVEntries = Record<string, Uint8Array | string | null>;
export type BuildaKVOpts = { timeoutMs?: number; encoding?: "base64" };

export interface BuildaPrivateKV {
  get(key: string, opts?: BuildaKVOpts): Promise<BuildaResult<Uint8Array | string | null>>;
  set(key: string, value: BuildaKVValue, opts?: BuildaKVOpts): Promise<BuildaResult<{ key: string }>>;
  remove(key: string, opts?: { timeoutMs?: number }): Promise<BuildaResult<{ key: string }>>;
  getMany(keys: string[], opts?: BuildaKVOpts): Promise<BuildaResult<{ entries: BuildaKVEntries }>>;
  setMany(entries: Record<string, BuildaKVValue>, opts?: BuildaKVOpts): Promise<BuildaResult<{ keys: string[] }>>;
  removeMany(keys: string[], opts?: { timeoutMs?: number }): Promise<BuildaResult<{ keys: string[] }>>;
}

export interface BuildaSDK {
  version: string;
  runtime: {
    gameId: string;
    bundleVersion: string;
    ready(): Promise<BuildaResult<{ available: boolean }>>;
    quit(): Promise<BuildaResult<Record<string, never>>>;
    safeArea(): BuildaSafeArea;
    capsuleMenuRect(): BuildaCapsuleMenuRect;
    // 当前语言（BCP 47 连字符形态）。宿主只给裸语言码（"zh"、"en"，不带区域变体，
    // 不会出现 "zh-CN"），唯一例外西语为 "es-419"。同步裸返回、每次调用现读（宿主运行中
    // 切语言会更新），缺失/无宿主兜底 "en"，绝不返回空串。
    // 游戏侧匹配建议：精确匹配 → 语言前缀降级（es-419 → es）→ 游戏默认语言。
    language(): string;
  };
  assets: {
    // assets.zip 双子树：audio/**（宿主音频通道）与 res/**（游戏自取大资源，如 3D 模型）。
    // res/** 用 url("res/models/car.glb") 现取 URL 后自行 fetch；不要写死 CDN 地址，
    // assetsBaseUrl 每次重传都会变。规则与分引擎接法见 SKILL「res/** 大资源动态加载」。
    // 返回值总是绝对 URL：真机由宿主注入 CDN 基址；本地 mock 无基址时按页面所在目录解析
    // （把 audio/、res/ 拷进构建目录即可本地闭环），Godot HTTPRequest 可直接使用。
    baseUrl: string;
    url(path: string): string;
  };
  audio: {
    playBGM(path: string, opts?: { loop?: boolean; volume?: number }): Promise<BuildaResult<BuildaAudioResult>>;
    stopBGM(): Promise<BuildaResult<BuildaAudioResult>>;
    playSFX(path: string, opts?: { sessionId?: string; volume?: number; loop?: boolean; fadeIn?: number; pitch?: number }): Promise<BuildaResult<BuildaAudioResult>>;
    setMuted(muted: boolean, group?: "bgm" | "effect"): Promise<BuildaResult<BuildaAudioResult>>;
    vibrate(level?: 1 | 2 | 3): Promise<BuildaResult<BuildaAudioResult>>;
    requestMicrophone(opts?: { timeoutMs?: number }): Promise<BuildaResult<BuildaMicPermission>>;
  };
  mic: {
    start(opts?: { sampleRate?: number; bufferMs?: number }): Promise<BuildaResult<BuildaMicStart>>;
    read(opts?: { maxSamples?: number; encoding?: "base64" }): BuildaResult<BuildaMicRead>;
    stop(): Promise<BuildaResult<Record<string, never>>>;
  };
  pay: {
    showPayPanel(saleId: string, opts?: { timeoutMs?: number }): Promise<BuildaResult<BuildaPayPanelResult>>;
  };
  ad: {
    // posId 是游戏自定义的广告位统计标识：任意字符串（如 "revive"），只用于区分游戏内
    // 不同的广告触发点做统计；不是平台分配的广告位 ID，无需申请、无需在 manifest 声明。
    showRewardAd(posId: string, opts?: { timeoutMs?: number }): Promise<BuildaResult<BuildaRewardAdResult>>;
  };
  input: {
    showInputPanel(opts?: BuildaInputPanelOpts): Promise<BuildaResult<BuildaInputPanelResult>>;
  };
  rank: {
    submitScore(rankId: string, score: number, opts?: { timeoutMs?: number }): Promise<BuildaResult<{ rankId: string }>>;
    getRankList(rankId: string, opts?: { limit?: number; timeoutMs?: number }): Promise<BuildaResult<BuildaRankList>>;
  };
  whoami(opts?: { timeoutMs?: number }): Promise<BuildaResult<BuildaPlayer>>;
  requestToken(opts?: { timeoutMs?: number }): Promise<BuildaResult<BuildaTokenResult>>;
  // 查询 Cy 游玩角色的公开资料。roleId 使用正整数十进制字符串；返回 map 中有 key
  // 表示本次查到，没有 key 表示本次没查到。SDK 固定 50ms 聚合，成功项内存缓存 30 分钟。
  // timeoutMs 是本次调用自身的端到端等待上限；同一 50ms 窗口内其他调用不会被一起取消。
  getRoleInfo(roleIds: string[], opts?: { timeoutMs?: number }): Promise<BuildaResult<BuildaRoleInfoMap>>;
  privateKV: BuildaPrivateKV;
}

declare global {
  interface Window {
    Builda: BuildaSDK;
  }
}
