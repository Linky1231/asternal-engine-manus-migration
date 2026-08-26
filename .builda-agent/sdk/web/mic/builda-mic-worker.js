// BuildaMic 默认分析器（L2 模板，docs/decisions/0012 §4.2/§4.3）——随 addons/builda 分发，
// 装进项目后归项目所有：sdk install 升级不覆盖 addons/builda/mic/，魔改本文件不牵动 SDK
// 版本与分发链（想恢复默认：删除 addons/builda/mic 目录后重跑 builda sdk install）。
//
// 契约（换算法/加特征只改本文件，builda_mic.gd 不用动）：
//   入：{ samples: Float32Array, sampleRate: number }   ← 页面泵 transfer 过来的 PCM 切片
//   出：postMessage({ volume, pitch, ... })              ← 平面对象，字段原样出现在
//                                                          GDScript 侧 BuildaMic.features 里
//
// 默认特征：
//   volume —— 最新分析窗口的 RMS（0..1 量级；BGM 串音必然存在于 PCM，阈值要开着 BGM 调）
//   pitch  —— YIN 基频（Hz，70–1000；无声/无音高时 0）
// 重 DSP 就该在这里跑：本 Worker 与单线程 Godot 引擎真并行，晚 10ms 无感（0012 §4.3）。

var WINDOW = 2048; // 分析窗口（48kHz 下约 43ms，音高检测的自然窗口）
var PITCH_MIN_HZ = 70;
var PITCH_MAX_HZ = 1000;
var YIN_THRESHOLD = 0.15;

var pending = new Float32Array(0);

onmessage = function (e) {
  var data = e.data || {};
  var samples = data.samples;
  var rate = data.sampleRate || 48000;
  if (!samples || !samples.length) return;
  var merged = new Float32Array(pending.length + samples.length);
  merged.set(pending);
  merged.set(samples, pending.length);
  // 只留最新数据，防拉取积压（实时控制要最新窗口，不是连续流）
  if (merged.length > WINDOW * 4) merged = merged.slice(merged.length - WINDOW * 4);
  pending = merged;
  if (pending.length < WINDOW) return;
  var win = pending.slice(pending.length - WINDOW);
  pending = new Float32Array(0);
  postMessage({ volume: rms(win), pitch: yinPitch(win, rate) });
};

function rms(s) {
  var sum = 0;
  for (var i = 0; i < s.length; i++) sum += s[i] * s[i];
  return Math.sqrt(sum / s.length);
}

// 简化 YIN：差函数 → 累积均值归一化 → 绝对阈值取首谷 → 抛物线插值细化
function yinPitch(s, rate) {
  var minTau = Math.max(2, Math.floor(rate / PITCH_MAX_HZ));
  var maxTau = Math.min(s.length - 1, Math.floor(rate / PITCH_MIN_HZ));
  if (maxTau <= minTau) return 0;
  var d = new Float32Array(maxTau + 1);
  for (var tau = 1; tau <= maxTau; tau++) {
    var sum = 0;
    for (var i = 0; i + tau < s.length; i++) {
      var diff = s[i] - s[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  var cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  var running = 0;
  for (tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    cmnd[tau] = running > 0 ? d[tau] * tau / running : 1;
  }
  var best = -1;
  for (tau = minTau; tau <= maxTau; tau++) {
    if (cmnd[tau] < YIN_THRESHOLD) {
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      best = tau;
      break;
    }
  }
  if (best < 0) return 0;
  var x0 = best > 1 ? cmnd[best - 1] : cmnd[best];
  var x1 = cmnd[best];
  var x2 = best < maxTau ? cmnd[best + 1] : cmnd[best];
  var denom = x0 + x2 - 2 * x1;
  var shift = denom !== 0 ? 0.5 * (x0 - x2) / denom : 0;
  return rate / (best + shift);
}
