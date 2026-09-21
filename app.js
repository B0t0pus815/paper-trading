/* TTMSqz+SMC 紙上交易儀表板。
   圖表全部手刻 SVG，沒有外部相依 —— PWA 離線時也要能畫。 */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };
const NBSP = ' ';

const fmt = {
  qty: (v) => v == null ? '—'
    : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString()
    : Math.abs(v) >= 1 ? v.toFixed(2)
    : v.toPrecision(3),
  n: (v, d = 2) => v == null || !isFinite(v) ? '—' :
      (v < 0 ? '\u2212' : '') + Math.abs(v).toLocaleString('en-US',
      { minimumFractionDigits: d, maximumFractionDigits: d }),
  sign: (v, d = 2) => v == null || !isFinite(v) ? '—' :
      (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d),
  pct: (v, d = 1) => v == null || !isFinite(v) ? '—' : (v * 100).toFixed(d) + '%',
  px: (v) => v == null ? '—' : (Math.abs(v) >= 1000 ? v.toFixed(1)
      : Math.abs(v) >= 1 ? v.toFixed(3) : v.toPrecision(5)),
  time: (iso) => { const d = new Date(iso); return isNaN(d) ? '—' :
      d.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false }); },
  ago: (iso) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!isFinite(s)) return '—';
    if (s < 90) return '剛剛';
    if (s < 5400) return Math.round(s / 60) + ' 分鐘前';
    if (s < 172800) return Math.round(s / 3600) + ' 小時前';
    return Math.round(s / 86400) + ' 天前';
  },
};
// 顏色永遠搭配正負號與 ▲▼，不單獨承載訊息
const cls = (v) => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
const arrow = (v) => v > 0 ? '▲' : v < 0 ? '▼' : '–';
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ------------------------------------------------------------------ */
/* 線圖：權益曲線 / 累積 R                                              */
/* ------------------------------------------------------------------ */
function lineChart(host, points, valueIdx, label, formatter) {
  host.innerHTML = '';
  if (!points || points.length < 2) {
    host.innerHTML = '<div class="empty">資料還不夠畫圖</div>';
    return;
  }
  const W = 640, H = 200, P = { t: 12, r: 10, b: 22, l: 46 };
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[valueIdx]);
  const x0 = xs[0], x1 = xs[xs.length - 1];
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const X = t => P.l + (t - x0) / Math.max(1, x1 - x0) * (W - P.l - P.r);
  const Y = v => P.t + (hi - v) / (hi - lo) * (H - P.t - P.b);

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label + '走勢圖');
  const mk = (t, a) => { const n = document.createElementNS(ns, t);
    for (const k in a) n.setAttribute(k, a[k]); return n; };

  // 格線 + y 軸刻度（4 條，recessive）
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = lo + (hi - lo) * i / ticks, y = Y(v);
    svg.appendChild(mk('line', { x1: P.l, x2: W - P.r, y1: y, y2: y,
      stroke: css('--grid'), 'stroke-width': 1 }));
    const tx = mk('text', { x: P.l - 7, y: y + 3.5, 'text-anchor': 'end',
      fill: css('--muted'), 'font-size': 10.5, 'font-variant-numeric': 'tabular-nums' });
    tx.textContent = formatter(v);
    svg.appendChild(tx);
  }
  // 起始水平線（淨值 = 初始資金 / 累積 R = 0）
  const base = valueIdx === 1 ? ys[0] : 0;
  if (base >= lo && base <= hi) {
    svg.appendChild(mk('line', { x1: P.l, x2: W - P.r, y1: Y(base), y2: Y(base),
      stroke: css('--axis'), 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
  }

  const d = points.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(2) + ' ' + Y(p[valueIdx]).toFixed(2)).join(' ');
  svg.appendChild(mk('path', {
    d: `${d} L ${X(x1).toFixed(2)} ${Y(lo).toFixed(2)} L ${X(x0).toFixed(2)} ${Y(lo).toFixed(2)} Z`,
    fill: css('--series-soft'), stroke: 'none' }));
  svg.appendChild(mk('path', { d, fill: 'none', stroke: css('--series'),
    'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

  // x 軸兩端日期
  [[x0, 'start', P.l], [x1, 'end', W - P.r]].forEach(([t, anchor, x]) => {
    const n = mk('text', { x, y: H - 6, 'text-anchor': anchor, fill: css('--muted'), 'font-size': 10.5 });
    n.textContent = new Date(t).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    svg.appendChild(n);
  });

  // 最後一點直接標註（單一序列不需要圖例）
  const lx = X(x1), ly = Y(ys[ys.length - 1]);
  svg.appendChild(mk('circle', { cx: lx, cy: ly, r: 4.5, fill: css('--series'),
    stroke: css('--surface'), 'stroke-width': 2 }));

  // 十字線 + tooltip
  const cross = mk('line', { y1: P.t, y2: H - P.b, stroke: css('--axis'),
    'stroke-width': 1, opacity: 0 });
  const focus = mk('circle', { r: 4, fill: css('--series'), stroke: css('--surface'),
    'stroke-width': 2, opacity: 0 });
  svg.appendChild(cross); svg.appendChild(focus);
  host.appendChild(svg);
  const tip = el('div', 'tip'); host.appendChild(tip);

  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const t = x0 + (cx / r.width * W - P.l) / (W - P.l - P.r) * (x1 - x0);
    let best = 0, bd = Infinity;
    for (let i = 0; i < xs.length; i++) { const dd = Math.abs(xs[i] - t); if (dd < bd) { bd = dd; best = i; } }
    const px = X(xs[best]), py = Y(ys[best]);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('opacity', 1);
    focus.setAttribute('cx', px); focus.setAttribute('cy', py); focus.setAttribute('opacity', 1);
    tip.innerHTML = `<b>${formatter(ys[best])}</b><br>${fmt.time(new Date(xs[best]).toISOString())}`;
    tip.classList.add('on');
    const left = Math.min(Math.max(px / W * r.width - tip.offsetWidth / 2, 2), r.width - tip.offsetWidth - 2);
    tip.style.left = left + 'px';
    tip.style.top = Math.max(0, py / H * r.height - tip.offsetHeight - 10) + 'px';
  };
  const leave = () => { cross.setAttribute('opacity', 0); focus.setAttribute('opacity', 0); tip.classList.remove('on'); };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', leave);
  svg.addEventListener('touchmove', move, { passive: true });
  svg.addEventListener('touchend', leave);
}

/* ------------------------------------------------------------------ */
/* 分向長條圖：每幣總 R。0 線可見，方向本身表達正負                      */
/* ------------------------------------------------------------------ */
function divergingBars(host, rows) {
  host.innerHTML = '';
  if (!rows || !rows.length) { host.innerHTML = '<div class="empty">還沒有交易</div>'; return; }
  const ns = 'http://www.w3.org/2000/svg';
  const rowH = 28, W = 640, P = { t: 6, r: 6, b: 6, l: 96 };
  const H = P.t + rows.length * rowH + P.b;
  const max = Math.max(1e-9, ...rows.map(r => Math.abs(r.total_r)));
  // 0 線放在繪圖區正中間，兩側各留 LABEL 給直接標註用
  const LABEL = 52;
  const mid = (P.l + (W - P.r)) / 2;
  const half = (W - P.r - P.l) / 2 - LABEL;
  const scale = v => v / max * half;

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '每個幣種的累積 R');
  const mk = (t, a) => { const n = document.createElementNS(ns, t);
    for (const k in a) n.setAttribute(k, a[k]); return n; };

  svg.appendChild(mk('line', { x1: mid, x2: mid, y1: P.t, y2: H - P.b,
    stroke: css('--axis'), 'stroke-width': 1 }));

  rows.forEach((r, i) => {
    const y = P.t + i * rowH, w = scale(r.total_r), pos = r.total_r >= 0;
    const bw = Math.max(2, Math.abs(w));
    svg.appendChild(mk('rect', {
      x: pos ? mid + 1 : mid - bw - 1, y: y + 7, width: bw, height: rowH - 15,
      rx: 4, fill: pos ? css('--good') : css('--bad') }));

    const name = mk('text', { x: 0, y: y + rowH / 2 + 4, fill: css('--ink-2'),
      'font-size': 12.5 });
    name.textContent = r.symbol.replace('USDT', '');
    svg.appendChild(name);

    const cnt = mk('text', { x: P.l - 10, y: y + rowH / 2 + 4, 'text-anchor': 'end',
      fill: css('--muted'), 'font-size': 11 });
    cnt.textContent = r.n + ' 筆';
    svg.appendChild(cnt);

    // 直接標值：色盲情境下正負由這個數字與 0 線的方向承載，不靠顏色
    const lab = mk('text', { x: pos ? mid + bw + 7 : mid - bw - 7,
      y: y + rowH / 2 + 4, 'text-anchor': pos ? 'start' : 'end',
      fill: css('--ink'), 'font-size': 11.5, 'font-variant-numeric': 'tabular-nums' });
    lab.textContent = fmt.sign(r.total_r, 1) + 'R';
    svg.appendChild(lab);
  });
  host.appendChild(svg);
}

/* ------------------------------------------------------------------ */
/* R 分布直方圖                                                         */
/* ------------------------------------------------------------------ */
function histogram(host, hist) {
  host.innerHTML = '';
  if (!hist || !hist.counts || !hist.counts.length || !hist.counts.some(c => c)) {
    host.innerHTML = '<div class="empty">還沒有交易</div>'; return;
  }
  const ns = 'http://www.w3.org/2000/svg';
  const W = 640, H = 150, P = { t: 10, r: 8, b: 24, l: 28 };
  const n = hist.counts.length, max = Math.max(...hist.counts);
  const bw = (W - P.l - P.r) / n;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '每筆交易 R 倍數的分布');
  const mk = (t, a) => { const q = document.createElementNS(ns, t);
    for (const k in a) q.setAttribute(k, a[k]); return q; };
  const baseY = H - P.b;

  hist.counts.forEach((c, i) => {
    const lo = hist.edges[i], hi = hist.edges[i + 1];
    const h = max ? c / max * (baseY - P.t) : 0;
    if (c > 0) {
      svg.appendChild(mk('rect', {
        x: P.l + i * bw + 1, y: baseY - h, width: Math.max(1, bw - 2), height: h,
        rx: 3, fill: hi <= 0 ? css('--bad') : css('--good'), opacity: .9 }));
    }
    if (Math.abs(lo % 1) < 1e-9 && lo % 2 === 0) {
      const t = mk('text', { x: P.l + i * bw, y: H - 8, 'text-anchor': 'middle',
        fill: css('--muted'), 'font-size': 10 });
      t.textContent = lo;
      svg.appendChild(t);
    }
  });
  // 0 線：正負由位置承載
  const zi = hist.edges.findIndex(e => Math.abs(e) < 1e-9);
  if (zi >= 0) {
    const zx = P.l + zi * bw;
    svg.appendChild(mk('line', { x1: zx, x2: zx, y1: P.t - 4, y2: baseY + 4,
      stroke: css('--axis'), 'stroke-width': 1.5 }));
  }
  svg.appendChild(mk('line', { x1: P.l, x2: W - P.r, y1: baseY, y2: baseY,
    stroke: css('--axis'), 'stroke-width': 1 }));
  const yl = mk('text', { x: P.l - 6, y: P.t + 8, 'text-anchor': 'end',
    fill: css('--muted'), 'font-size': 10 });
  yl.textContent = max;
  svg.appendChild(yl);
  host.appendChild(svg);
}

/* ------------------------------------------------------------------ */
/* 渲染                                                                 */
/* ------------------------------------------------------------------ */
let DATA = null, curveMode = 1;   // 1 = 淨值, 2 = 累積 R

// 多軌。data.json 一定有（軌道 A），它的 tracks 欄位說還有哪幾條。
// 名字寫在這裡而不是後端，是為了讓手機端不必等新快照就能顯示新軌道。
const TRACK_NAMES = {
  baseline:    '基線',
  csmom:       '跨截面',
  trail_close: '鬆停損',
};
let TRACKS = [{ key: 'baseline', file: 'data.json', name: 'A 基線' }];

function buildTracks(listed) {
  const keys = ['baseline', ...(listed || []).filter(k => k !== 'baseline')];
  TRACKS = keys.map((k, i) => ({
    key: k,
    file: k === 'baseline' ? 'data.json' : `data-${k}.json`,
    name: `${String.fromCharCode(65 + i)} ${TRACK_NAMES[k] || k}`,
  }));
  return TRACKS;
}
const SNAP = {};                  // key -> snapshot
let track = 'baseline';
try { track = localStorage.getItem('track') || 'baseline'; } catch (e) {}
let FETCH_ERR = null;             // 最近一次抓取失敗的說明（null = 正常）

function tile(k, v, d, klass, hero) {
  const n = el('div', 'tile' + (hero ? ' hero' : ''));
  n.innerHTML = `<div class="k">${k}</div><div class="v num ${klass || ''}">${v}</div>` +
    (d ? `<div class="d">${d}</div>` : '');
  return n;
}

function render(data) {
  DATA = data;
  const p = data.portfolio, s = data.status;

  // --- header ---
  const age = (Date.now() - new Date(data.generated_at).getTime()) / 1000;
  const barSec = { '1h': 3600, '3h': 10800, '4h': 14400 }[data.timeframe] || 3600;
  const dot = $('#dot');
  dot.className = 'dot' + (s.errors && s.errors.length ? ' err' : age > barSec * 2 ? ' stale' : '');
  $('#updated').textContent = fmt.ago(data.generated_at);
  $('#tf').textContent = `${data.config.symbols.length} 幣 · ${data.timeframe}`;

  // --- 提示條 ---
  const banner = $('#banner');
  banner.innerHTML = '';
  if (FETCH_ERR) {
    // 抓不到就明說，並且講清楚畫面上這份資料是什麼時候的。
    const b = el('div', 'banner err');
    b.textContent = `抓不到最新資料（${FETCH_ERR}）。`
      + `畫面上是 ${fmt.ago(data.generated_at)}的快取，不是現在的狀況。`;
    banner.appendChild(b);
  }
  if (s.errors && s.errors.length) {
    const b = el('div', 'banner');
    b.textContent = '上次更新有錯誤：' + s.errors[s.errors.length - 1].split('\n')[0];
    banner.appendChild(b);
  } else if (age > barSec * 2) {
    const b = el('div', 'banner');
    b.textContent = `資料已經 ${fmt.ago(data.generated_at)}，常駐程式可能沒在跑。`;
    banner.appendChild(b);
  }

  // --- 主要指標 ---
  // 第一排：錢。帳戶現在多少、今天賺賠多少。
  const t1 = $('#tiles1'); t1.innerHTML = '';
  const pnl = p.pnl == null ? p.equity - p.initial_equity : p.pnl;
  t1.appendChild(tile('帳戶淨值',
    fmt.n(p.equity, 2) + ' U',
    `${arrow(pnl)} ${fmt.sign(pnl, 2)} U（${fmt.sign(p.return_pct, 2)}%）　起始 ${fmt.n(p.initial_equity, 0)}`,
    cls(pnl), true));
  const today = p.today_pnl == null ? null : p.today_pnl;
  t1.appendChild(tile('今日損益',
    today == null ? '—' : fmt.sign(today, 2) + ' U',
    today == null ? '' :
      `${fmt.sign(p.today_pnl_pct, 2)}%　${p.open_count} 筆持倉中`,
    cls(today), true));

  // 第二排：錢的組成與活動量
  const t2b = $('#tiles2'); t2b.innerHTML = '';
  t2b.appendChild(tile('已實現',
    fmt.sign(p.realized_pnl == null ? p.realized_equity - p.initial_equity
             : p.realized_pnl, 2) + ' U',
    '已平倉的損益', cls(p.realized_pnl)));
  t2b.appendChild(tile('未實現',
    fmt.sign(p.unrealized_pnl, 2) + ' U',
    p.exposure == null ? `${p.open_count} 筆未平倉`
      : `${p.open_count} 筆 · 持倉 ${fmt.n(p.exposure, 0)} U`
        + `（本金的 ${fmt.n(p.exposure_pct, 1)}%）`,
    cls(p.unrealized_pnl)));
  t2b.appendChild(tile('交易筆數', fmt.n(p.n_trades, 0),
    `${fmt.n(p.trades_per_day, 1)} 筆/天`));
  t2b.appendChild(tile('累積 R', fmt.sign(p.total_r, 1),
    `跑了 ${fmt.n(p.days_running, 0)} 天`, cls(p.total_r)));

  // 第三排：統計。樣本小的時候這些只是雜訊，所以放在下面。
  const t2 = $('#tiles3'); t2.innerHTML = '';
  t2.appendChild(tile('期望值 R/筆', p.mean_r == null ? '—' : fmt.sign(p.mean_r, 4),
    p.sd_r == null ? '' : `SD ${fmt.n(p.sd_r, 2)}`, cls(p.mean_r)));
  t2.appendChild(tile('t 值', p.t_stat == null ? '—' : fmt.n(p.t_stat, 2),
    p.t_stat == null ? '樣本不足'
      : Math.abs(p.t_stat) < 1 ? '與隨機無異' : p.t_stat >= 2 ? '站得住腳' : '還不夠',
    p.t_stat != null && p.t_stat >= 2 ? 'pos' : ''));
  t2.appendChild(tile('勝率', p.win_rate == null ? '—' : fmt.pct(p.win_rate),
    p.profit_factor == null ? '' : `PF ${fmt.n(p.profit_factor, 2)}`));
  t2.appendChild(tile('最大回撤', p.max_dd_pct == null ? '—' : fmt.n(p.max_dd_pct, 1) + '%',
    `${fmt.n(p.max_dd_r, 1)}R`, p.max_dd_pct > 0 ? 'neg' : ''));

  // --- 雙軌 A/B ---
  renderAB(data.ab);

  // --- 曲線 ---
  drawCurve();

  // --- 持倉 ---
  const pl = $('#positions'); pl.innerHTML = '';
  $('#poscount').textContent = data.open_positions.length ? `${data.open_positions.length} 筆` : '';
  if (!data.open_positions.length) {
    pl.innerHTML = '<div class="empty">目前空手</div>';
  } else {
    data.open_positions.forEach(o => {
      const c = el('div', 'poscard');
      const pct = Math.min(100, Math.abs(o.unrealized_r) / 3 * 100);
      c.innerHTML = `
        <div class="posrow">
          <span class="sym">${o.symbol.replace('USDT', '')}</span>
          <span class="tag">${o.direction === 'long' ? '多' : '空'}</span>
          <span class="tag">${o.signal_source}</span>
          <span class="r num ${cls(o.unrealized_r)}">${arrow(o.unrealized_r)} ${fmt.sign(o.unrealized_r, 2)}R</span>
        </div>
        <div class="bar"><i style="width:${pct}%;background:${o.unrealized_r >= 0 ? 'var(--good)' : 'var(--bad)'}"></i></div>
        <div class="posamt">
          <span class="amt">${fmt.n(o.notional, 0)} U</span>
          <span class="sub">持倉額 · 現值 ${fmt.n(o.market_value, 0)} U
            · ${fmt.sign(o.unrealized_pnl, 2)} U</span>
        </div>
        <div class="meta">
          <span>數量 ${fmt.qty(o.qty)}</span>
          <span>風險 ${fmt.n(o.R_dollar, 2)} U/R</span>
          <span>進場 ${fmt.px(o.entry_price)}</span>
          <span>現價 ${fmt.px(o.last_price)}</span>
          <span>停損 ${fmt.px(o.cur_stop)}${o.trail_active ? ' (移動)' : ''}</span>
          <span>距停損 ${fmt.n(o.stop_distance_pct, 2)}%</span>
          <span>持倉 ${o.bars_held} 根</span>
          <span>最差 ${fmt.n(o.mae_r, 2)}R · 最好 ${fmt.n(o.mfe_r, 2)}R</span>
        </div>`;
      pl.appendChild(c);
    });
  }

  divergingBars($('#symbolchart'), data.by_symbol.filter(d => d.n > 0));
  histogram($('#hist'), data.r_histogram);

  // --- 訊號來源 ---
  const sb = $('#srcbody'); sb.innerHTML = '';
  $('#srctable').hidden = false; $('#srcempty').hidden = true;
  if (!data.by_source.length) {
    // 以前這行直接把整張表（連同 #srcbody）換成一句話，下一次 render
    // 就再也找不到 #srcbody，整個 render 從這裡拋例外中斷 ——
    // 後面的最近交易、事件、設定全部停止更新。這就是「網頁不會更新」。
    $('#srctable').hidden = true; $('#srcempty').hidden = false;
  } else {
    data.by_source.forEach(r => {
      const tr = el('tr');
      tr.innerHTML = `<td class="sym">${r.source}</td><td>${r.n}</td>
        <td class="${cls(r.mean_r)}">${fmt.sign(r.mean_r, 3)}</td>
        <td class="${cls(r.total_r)}">${fmt.sign(r.total_r, 1)}</td>
        <td>${fmt.pct(r.win_rate, 0)}</td>
        <td>${r.t_stat == null ? '—' : fmt.n(r.t_stat, 2)}</td>`;
      sb.appendChild(tr);
    });
  }

  // --- 成本 ---
  const c = data.cost || {};
  const cw = $('#cost');
  if (c.n) {
    cw.innerHTML = `
      <div class="meta" style="margin-top:0">
        <span>每筆成本 <b class="num">${fmt.n(c.mean_cost_r, 4)} R</b></span>
        <span>毛期望值 <b class="num ${cls(c.mean_gross_r)}">${fmt.sign(c.mean_gross_r, 4)}</b></span>
        <span>淨期望值 <b class="num ${cls(c.mean_net_r)}">${fmt.sign(c.mean_net_r, 4)}</b></span>
        <span>中位停損 ${fmt.n(c.median_stop_pct, 2)}%</span>
      </div>
      <div class="meta">若停損放寬一倍，成本降到 ${fmt.n(c.cost_r_if_stop_2x, 4)} R，
        淨期望值約 ${fmt.sign(c.net_r_if_stop_2x, 4)}（只算成本效果，不含勝率變化）</div>`;
  } else { cw.innerHTML = '<div class="empty">還沒有交易</div>'; }

  // --- 最近交易 ---
  const tb = $('#tradebody'); tb.innerHTML = '';
  $('#tradetable').hidden = false; $('#tradeempty').hidden = true;
  if (!data.recent_trades.length) {
    $('#tradetable').hidden = true; $('#tradeempty').hidden = false;
  } else {
    data.recent_trades.slice(0, 25).forEach(t => {
      const tr = el('tr');
      tr.innerHTML = `<td><span class="sym">${t.symbol.replace('USDT', '')}</span>
          <span class="tag">${t.direction === 'long' ? '多' : '空'}</span></td>
        <td style="text-align:left;color:var(--muted);font-size:11.5px">${t.signal_source}</td>
        <td>${t.notional == null ? '—' : fmt.n(t.notional, 0)}</td>
        <td class="${cls(t.pnl_net)}">${fmt.sign(t.pnl_net, 2)}</td>
        <td style="color:var(--muted);font-size:11.5px">${fmt.time(t.exit_time)}</td>
        <td style="color:var(--muted);font-size:11.5px">${t.exit_reason}</td>
        <td class="${cls(t.r_multiple)}">${fmt.sign(t.r_multiple, 2)}</td>`;
      tb.appendChild(tr);
    });
  }

  // --- 事件 ---
  const fd = $('#feed'); fd.innerHTML = '';
  if (!data.events.length) {
    fd.innerHTML = '<div class="empty">還沒有事件。開倉與平倉會出現在這裡。</div>';
  } else {
    data.events.slice(0, 20).forEach(e => {
      const d = el('div', 'fitem');
      const pl2 = e.payload || {};
      const when = new Date(e.ts).toLocaleString('zh-TW',
        { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
      if (e.kind === 'close') {
        d.innerHTML = `<span class="t">${when}</span>
          <span><b>${e.symbol.replace('USDT', '')}</b> 平倉
            <span class="tag">${pl2.direction === 'long' ? '多' : '空'}</span>
            <span style="color:var(--muted)">${pl2.reason}</span></span>
          <span class="r ${cls(pl2.r)}">${fmt.sign(pl2.r, 2)}R</span>`;
      } else {
        d.innerHTML = `<span class="t">${when}</span>
          <span><b>${e.symbol.replace('USDT', '')}</b> 開倉
            <span class="tag">${pl2.direction === 'long' ? '多' : '空'}</span>
            <span style="color:var(--muted)">${pl2.source} @ ${fmt.px(pl2.entry)}</span></span>`;
      }
      fd.appendChild(d);
    });
  }

  // --- footer ---
  const cf = data.config;
  $('#cfg').innerHTML =
    `起點 ${fmt.time(data.started_at)}（已跑 ${fmt.n(p.days_running, 1)} 天）· ` +
    `訊號 ${cf.signals.join(' / ')} · 停損 ${cf.stop_mode} ${cf.atr_mult}×ATR · ` +
    `每筆風險 ${cf.risk_pct}% · 手續費 ${(cf.fee_rate * 100).toFixed(3)}% + 滑價 ${cf.slippage_bps} bps<br>` +
    `下次更新 ${fmt.time(s.next_update)} · 追蹤 ${s.symbols_tracked}/${s.symbols_configured} 幣` +
    (p.req_n ? ` · 達 t=2 還需約 ${p.req_n.toLocaleString()} 筆` : '');
}

function drawCurve() {
  if (!DATA) return;
  const isEq = curveMode === 1;
  lineChart($('#curve'), DATA.equity_curve, curveMode,
    isEq ? '組合淨值' : '累積 R',
    isEq ? (v => fmt.n(v, 0)) : (v => fmt.sign(v, 0)));
}

/* ------------------------------------------------------------------ */
/* 載入                                                                 */
/* ------------------------------------------------------------------ */
async function grab(t) {
  // 回傳 {ok, data} 或 {ok:false, why}。404 對 csmom 來說是正常的（單軌模式）。
  try {
    const r = await fetch(t.file + '?t=' + Date.now(), { cache: 'no-store' });
    if (r.status === 404 && t.key !== 'baseline') return { ok: false, missing: true };
    if (!r.ok) return { ok: false, why: 'HTTP ' + r.status };
    // service worker 在離線時會標這個；資料是好的，但不是現在的。
    const stale = r.headers.get('X-From-Cache') === '1';
    return { ok: true, stale, data: await r.json() };
  } catch (e) {
    return { ok: false, why: '連不上（' + (e && e.message ? e.message : 'network') + '）' };
  }
}

async function load(showSpin) {
  const btn = $('#refresh');
  if (showSpin) btn.textContent = '…';
  try {
    // 先抓主軌，它會告訴我們還有哪些軌道；再去抓其餘的。
    const first = await grab({ key: 'baseline', file: 'data.json' });
    const listed = (first.ok && first.data.tracks) || ['baseline'];
    const want = buildTracks(listed);
    const rest = await Promise.all(want.slice(1).map(grab));
    const got = [first, ...rest];
    let err = null;
    got.forEach((g, i) => {
      const t = want[i];
      if (g.ok) {
        if (g.stale && !err) err = '離線';
        SNAP[t.key] = g.data;
        try { localStorage.setItem('snap:' + t.key, JSON.stringify(g.data)); } catch (e) {}
      } else if (!g.missing) {
        if (!err) err = g.why;
        try {
          const c = localStorage.getItem('snap:' + t.key)
                 || (t.key === 'baseline' ? localStorage.getItem('snap') : null);
          if (c) SNAP[t.key] = JSON.parse(c);
        } catch (e) {}
      } else {
        delete SNAP[t.key];
      }
    });
    // 這裡是整個「網頁不會更新」bug 的核心：以前抓取失敗會靜靜地
    // 拿快取重畫，畫面看起來一切正常，只是數字永遠停在那一刻。
    // 現在失敗就明說，而且說清楚畫面上這份是什麼時候的。
    for (const t of TRACKS) if (!want.includes(t)) delete SNAP[t.key];
    FETCH_ERR = err;
    if (!SNAP.baseline) {
      $('#banner').innerHTML =
        '<div class="banner err">讀不到資料' + (err ? '（' + err + '）' : '') +
        '。第一次開啟需要連線。</div>';
      return;
    }
    if (!SNAP[track]) track = 'baseline';
    renderTrackBar();
    render(SNAP[track]);
  } finally { btn.textContent = '↻'; }
}

function renderTrackBar() {
  const bar = $('#trackbar'), seg = $('#trackseg');
  const avail = TRACKS.filter(t => SNAP[t.key]);
  if (avail.length < 2) { bar.hidden = true; return; }
  bar.hidden = false;
  seg.innerHTML = '';
  for (const t of avail) {
    const b = el('button');
    b.textContent = t.name;
    b.setAttribute('aria-pressed', String(t.key === track));
    b.addEventListener('click', () => {
      track = t.key;
      try { localStorage.setItem('track', track); } catch (e) {}
      renderTrackBar();
      render(SNAP[track]);
    });
    seg.appendChild(b);
  }
  const s = SNAP[track];
  $('#tracknote').textContent = s && s.config && s.config.cross
    ? `Score=(close−close[${s.config.cross.lookback}])/ATR，每根每方向放行前 ${s.config.cross.top_k} 名`
    : '每個幣各自為政，沒有跨截面過濾';
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#curvetoggle button').forEach(b => {
    b.addEventListener('click', () => {
      curveMode = Number(b.dataset.mode);
      document.querySelectorAll('#curvetoggle button').forEach(x =>
        x.setAttribute('aria-pressed', String(Number(x.dataset.mode) === curveMode)));
      drawCurve();
    });
  });
  $('#refresh').addEventListener('click', () => load(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(false); });
  window.addEventListener('resize', () => { if (DATA) { drawCurve();
    divergingBars($('#symbolchart'), DATA.by_symbol.filter(d => d.n > 0));
    histogram($('#hist'), DATA.r_histogram); } });
  load(false);
  setInterval(() => { if (!document.hidden) load(false); }, 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});


// --------------------------------------------------------------------
// 雙軌 A/B。單軌跑的時候 data.ab 不存在，整段隱藏。
// 這裡刻意不畫圖、不加顏色強調誰贏 —— n 還是個位數的時候，
// 把差距畫成長條圖只會讓人把雜訊當結論。
// --------------------------------------------------------------------
function renderAB(ab) {
  const wrap = $('#abwrap');
  const have = TRACKS.filter(t => SNAP[t.key]);
  if (have.length < 2 && (!ab || !ab.tracks || ab.tracks.length < 2)) {
    wrap.hidden = true; return;
  }
  wrap.hidden = false;

  const rows = have.length >= 2
    ? have.map(t => ({ label: t.key, name: t.name,
                       p: SNAP[t.key].portfolio,
                       desc: (ab && (ab.tracks || []).find(r => r.label === t.key) || {}).desc }))
    : ab.tracks.map(r => ({ label: r.label, name: r.label, p: r, desc: r.desc }));

  const base = rows.find(r => r.label === 'baseline');
  let h = '<table class="tbl"><thead><tr><th>軌道</th><th>淨值</th><th>損益</th>'
        + '<th>交易</th><th>持倉</th><th>期望值 R</th><th>vs 基線</th></tr></thead><tbody>';
  for (const r of rows) {
    const p = r.p;
    const d = (base && p.mean_r != null && base.p.mean_r != null)
      ? p.mean_r - base.p.mean_r : null;
    h += `<tr><td>${r.name}${r.label === track ? ' ←' : ''}`
       + (r.desc ? `<div class="note" style="font-size:10.5px">${r.desc}</div>` : '')
       + `</td>`
       + `<td>${fmt.n(p.equity, 2)}</td>`
       + `<td class="${cls(p.pnl)}">${fmt.sign(p.pnl, 2)}</td>`
       + `<td>${p.n_trades}</td><td>${p.open_count}</td>`
       + `<td>${p.mean_r == null ? '—' : fmt.sign(p.mean_r, 4)}</td>`
       + `<td class="${r.label === 'baseline' ? '' : cls(d)}">`
       + `${r.label === 'baseline' ? '—' : (d == null ? '—' : fmt.sign(d, 4))}</td></tr>`;
  }
  h += '</tbody></table>';

  const m = (ab && ab.mask_stats) || {};
  const notes = [];
  if (m.signals_before) {
    notes.push(`跨截面遮罩：${m.signals_before} → ${m.signals_after} 個訊號`
             + `（濾掉 ${fmt.n(m.drop_pct, 1)}%）`);
  }
  const least = Math.min(...rows.map(r => r.p.n_trades));
  notes.push(least === 0
    ? '還沒有平倉交易，差額算不出來。'
    : `樣本最少的一軌 ${least} 筆。`
      + `<b>跨截面要 2,500 筆才判得動；鬆停損看的是次根出場率，不是這個差額。</b>`);
  h += `<div class="note" style="margin-top:8px">${notes.join('<br>')}</div>`;
  $('#ab').innerHTML = h;

  if (have.length >= 2) dualCurve();
}

/* 多軌淨值疊圖。都換算成「相對起始資金的 %」，起始資金不同也比得了。
   顏色不是唯一的訊息載體：線型也不同（實線 / 虛線 / 點線），
   另外有圖例與上面那張表。 */
function dualCurve() {
  const host = $('#abcurve');
  if (!host) return;
  const series = TRACKS.filter(t => SNAP[t.key]).map(t => {
    const s = SNAP[t.key];
    const base = s.portfolio.initial_equity || 1;
    return { name: t.name,
             pts: (s.equity_curve || []).map(p => [p[0], (p[1] / base - 1) * 100]) };
  }).filter(x => x.pts.length >= 2);
  if (series.length < 2) { host.innerHTML = '<div class="empty">資料還不夠畫圖</div>'; return; }

  const W = 640, H = 190, P = { t: 12, r: 10, b: 22, l: 48 };
  const all = series.flatMap(s => s.pts);
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let lo = Math.min(...ys, 0), hi = Math.max(...ys, 0);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const X = t => P.l + (t - x0) / Math.max(1, x1 - x0) * (W - P.l - P.r);
  const Y = v => P.t + (hi - v) / (hi - lo) * (H - P.t - P.b);
  const ns = 'http://www.w3.org/2000/svg';
  const mk = (t, a) => { const n = document.createElementNS(ns, t);
    for (const k in a) n.setAttribute(k, a[k]); return n; };

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '兩軌報酬率走勢比較');
  for (let i = 0; i <= 4; i++) {
    const v = lo + (hi - lo) * i / 4, y = Y(v);
    svg.appendChild(mk('line', { x1: P.l, x2: W - P.r, y1: y, y2: y,
      stroke: css('--grid'), 'stroke-width': 1 }));
    const tx = mk('text', { x: P.l - 7, y: y + 3.5, 'text-anchor': 'end',
      fill: css('--muted'), 'font-size': 10.5, 'font-variant-numeric': 'tabular-nums' });
    tx.textContent = fmt.n(v, 1) + '%';
    svg.appendChild(tx);
  }
  if (0 >= lo && 0 <= hi) {
    svg.appendChild(mk('line', { x1: P.l, x2: W - P.r, y1: Y(0), y2: Y(0),
      stroke: css('--axis'), 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
  }
  const colors = [css('--series'), css('--series-b'), css('--series-c')];
  const dashes = [null, '6 4', '2 3'];
  series.forEach((s, i) => {
    const d = s.pts.map((p, j) => (j ? 'L' : 'M') + X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2)).join(' ');
    const attr = { d, fill: 'none', stroke: colors[i % colors.length],
      'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    if (dashes[i % dashes.length]) attr['stroke-dasharray'] = dashes[i % dashes.length];
    svg.appendChild(mk('path', attr));
  });
  host.innerHTML = '';
  const lg = el('div');
  lg.innerHTML = series.map((s, i) =>
    `<span class="lgd"><i style="background:${colors[i % colors.length]}"></i>${s.name}</span>`).join('');
  host.appendChild(svg);
  host.appendChild(lg);
}

/* ------------------------------------------------------------------ */
/* 倍數壓力鏡                                                          */
/*                                                                     */
/* 這一塊跟頁面上其他東西不一樣：它畫的是**歷史回測**，不是紙上交易。   */
/* 目的只有一個 —— 在真的把每筆風險調大之前，先看著它跌。              */
/*                                                                     */
/* 演算法刻意簡單：不複利，E(t) = E0 + k × 累積R(t)。複利會讓倍數效果   */
/* 跟路徑纏在一起，看不出倍數本身做了什麼。                            */
/*                                                                     */
/* 三條線是「有序的量級」不是三個類別，所以用單一色相由淺到深的序數色階，*/
/* 不是三個不同顏色。而且它們數學上不會交叉（|回撤%| 對 k 單調遞增），  */
/* 所以中間可以填成三條乾淨的帶狀區 —— 那些帶就是「槓桿多挖的深度」。   */
/* ------------------------------------------------------------------ */
let STRESS = null;
let stressView = 'dd';

async function loadStress() {
  try {
    const r = await fetch('stress.json');
    if (!r.ok) return;                       // 沒產生過就整塊不出現
    STRESS = await r.json();
    $('#stresswrap').hidden = false;
    renderStress();
  } catch (e) { /* 這塊是參考資料，抓不到不該影響交易畫面 */ }
}

function stressSeries() {
  const e0 = STRESS.e0;
  return STRESS.mults.map(m => {
    let peak = e0;
    const pts = STRESS.points.map(p => {
      const eq = e0 + p[1] * m.r_dollar;
      if (eq > peak) peak = eq;
      return [p[0], stressView === 'eq' ? eq : (eq - peak) / peak * 100];
    });
    return { m, pts, color: css('--stress-' + m.k), name: m.k + '×' };
  });
}

function renderStress() {
  if (!STRESS) return;
  const S = STRESS, st = S.stats;

  $('#stresswarn').innerHTML =
    `<b>歷史回測，不是預測，而且是樣本內。</b>`
    + `往上那一半被選擇偏差灌過水，<b>往下那一半才是可信的</b> —— `
    + `樣本外的回撤通常只會更深。`;

  drawStress();

  // --- 表：兩種回撤定義都列，它們回答不同的問題 ---
  let h = '<table class="tbl"><thead><tr><th>每筆風險</th><th>1R</th>'
        + '<th>從前高回撤</th><th>最差起點</th><th>期末</th></tr></thead><tbody>';
  for (const m of S.mults) {
    h += `<tr><td class="k"><span class="swatch" style="background:${css('--stress-' + m.k)}"></span>`
       + `${m.k}×${m.k === 1 ? '（目前）' : ''}<div class="note" style="font-size:10.5px">`
       + `帳戶的 ${m.risk_pct}%</div></td>`
       + `<td>${m.r_dollar} U</td>`
       + `<td class="neg">${fmt.n(m.dd_from_peak_pct, 1)}%<div class="note" style="font-size:10.5px">`
       + `${fmt.n(m.dd_from_peak_usd, 0)} U</div></td>`
       + `<td class="neg">${fmt.n(m.dd_worst_start_pct, 1)}%</td>`
       + `<td class="${m.final_pct >= 0 ? 'pos' : 'neg'}">${fmt.sign(m.final_pct, 0)}%</td></tr>`;
  }
  h += '</tbody></table>';
  $('#stressstats').innerHTML = h;

  $('#stressnote').innerHTML =
    `<b>兩個回撤定義回答不同的問題。</b>`
    + `「從前高回撤」是歷史那條路徑上你從高水位掉了多少；`
    + `「最差起點」是如果你剛好從那段的起點開始跑，本金會虧掉多少`
    + `（數學上 = 倍數 × ${fmt.n(st.max_dd_r, 1)}R，跟哪天開始無關）。`
    + `前者比較小，只是因為那時帳戶已經先漲了好幾年 —— `
    + `<b>如果你今天才開始跑，你面對的是後面那個數字。</b><br><br>`
    + `圖上有兩個不同的低點，值得分開看：<br>`
    + `· <b>百分比最深</b>在 ${S.mults[0].dd_from_peak_at}`
    + `（那時帳戶還小，同樣的 R 換算成 % 就更大）。<br>`
    + `· <b>金額最大、也最久</b>的那一次是 ${st.dd_start} 見頂，`
    + `跌到 ${st.dd_trough}，跨越 ${st.dd_trades.toLocaleString()} 筆交易，`
    + (st.recovered ? '後來回到前高。' : '<b>到資料結束都還沒回到前高。</b>')
    + `<br><br>處於 20R 以上回撤的時間占 ${st.pct_time_under_20r}%，`
    + `50R 以上 ${st.pct_time_under_50r}%，100R 以上 ${st.pct_time_under_100r}%。`
    + `挑倍數的時候，挑一個你在<b>第六個月還在虧、還沒回到前高</b>的時候`
    + `不會把程式關掉的數字。`
    + `<br><br>來源：${S.source.what}，${S.source.start} ~ ${S.source.end}，`
    + `${S.source.n_trades.toLocaleString()} 筆，不複利。`;
}

function drawStress() {
  const host = $('#stresschart');
  if (!host || !STRESS) return;
  host.innerHTML = '';
  const series = stressSeries();
  const isDD = stressView === 'dd';

  const W = 640, H = 250, P = { t: 14, r: 12, b: 24, l: 52 };
  const xs = series[0].pts.map(p => p[0]);
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const all = series.flatMap(s => s.pts.map(p => p[1]));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (isDD) hi = 0; else lo = Math.min(lo, STRESS.e0);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; if (!isDD) hi += pad;
  const X = t => P.l + (t - x0) / Math.max(1, x1 - x0) * (W - P.l - P.r);
  const Y = v => P.t + (hi - v) / (hi - lo) * (H - P.t - P.b);
  const fv = v => isDD ? v.toFixed(0) + '%' : Math.round(v).toLocaleString();

  const ns = 'http://www.w3.org/2000/svg';
  const mk = (t, a) => { const n = document.createElementNS(ns, t);
    for (const k in a) n.setAttribute(k, a[k]); return n; };
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    isDD ? '三種每筆風險下的水下回撤比較' : '三種每筆風險下的帳戶淨值比較');

  for (let i = 0; i <= 4; i++) {
    const v = lo + (hi - lo) * i / 4, y = Y(v);
    svg.appendChild(mk('line', { x1: P.l, x2: W - P.r, y1: y, y2: y,
      stroke: css('--grid'), 'stroke-width': 1 }));
    const tx = mk('text', { x: P.l - 7, y: y + 3.5, 'text-anchor': 'end',
      fill: css('--muted'), 'font-size': 10.5, 'font-variant-numeric': 'tabular-nums' });
    tx.textContent = fv(v);
    svg.appendChild(tx);
  }
  // 水平面（回撤 0 / 初始資金）
  const base = isDD ? 0 : STRESS.e0;
  if (base >= lo && base <= hi) {
    svg.appendChild(mk('line', { x1: P.l, x2: W - P.r, y1: Y(base), y2: Y(base),
      stroke: css('--axis'), 'stroke-width': 1 }));
  }

  const path = pts => pts.map((p, i) =>
    (i ? 'L' : 'M') + X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2)).join(' ');

  // 帶狀區：三條線不會交叉，所以中間就是「槓桿多挖的深度」。
  // 畫成互不重疊的帶，而不是三層半透明疊加 —— 疊加會讓最淺的區域最深，剛好相反。
  if (isDD) {
    const edges = [series[0].pts.map(p => [p[0], 0]), ...series.map(s => s.pts)];
    for (let i = 0; i < series.length; i++) {
      const top = edges[i], bot = edges[i + 1];
      const d = path(top) + ' L ' + bot.slice().reverse()
        .map(p => X(p[0]).toFixed(2) + ' ' + Y(p[1]).toFixed(2)).join(' L ') + ' Z';
      svg.appendChild(mk('path', { d, fill: series[i].color,
        'fill-opacity': 0.16, stroke: 'none' }));
    }
  }
  series.forEach(s => svg.appendChild(mk('path', {
    d: path(s.pts), fill: 'none', stroke: s.color, 'stroke-width': 2,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round' })));

  // 自己組日期字串。zh-TW 的 toLocaleDateString 會走民國紀年，
  // 兩端都印出同一個奇怪的年份，看不出跨了幾年。
  const ym = t => { const d = new Date(t);
    return d.getUTCFullYear() + '/' + (d.getUTCMonth() + 1); };
  [[x0, 'start', P.l], [x1, 'end', W - P.r]].forEach(([t, anchor, x]) => {
    const n = mk('text', { x, y: H - 7, 'text-anchor': anchor,
      fill: css('--muted'), 'font-size': 10.5 });
    n.textContent = ym(t);
    svg.appendChild(n);
  });

  // 選擇性直接標註：只標最深那條的谷底（回撤圖）或各線終點（淨值圖）
  if (isDD) {
    const s = series[series.length - 1];
    let j = 0;
    s.pts.forEach((p, i) => { if (p[1] < s.pts[j][1]) j = i; });
    const px = X(s.pts[j][0]), py = Y(s.pts[j][1]);
    svg.appendChild(mk('circle', { cx: px, cy: py, r: 4, fill: s.color,
      stroke: css('--surface'), 'stroke-width': 2 }));
    // 標註要壓在線上面，所以描一圈 surface 色的外框（paint-order 讓框在字下面）
    const right = px > W * 0.6;
    const lab = mk('text', { x: right ? px - 9 : px + 9, y: py + 14,
      'text-anchor': right ? 'end' : 'start', fill: css('--ink'),
      'font-size': 12, 'font-weight': 640,
      stroke: css('--surface'), 'stroke-width': 3.5, 'paint-order': 'stroke' });
    lab.textContent = `${s.m.k}× 谷底 ${s.pts[j][1].toFixed(0)}%`;
    svg.appendChild(lab);
  } else {
    series.forEach(s => {
      const p = s.pts[s.pts.length - 1];
      svg.appendChild(mk('circle', { cx: X(p[0]), cy: Y(p[1]), r: 3.5, fill: s.color,
        stroke: css('--surface'), 'stroke-width': 2 }));
    });
  }

  const cross = mk('line', { y1: P.t, y2: H - P.b, stroke: css('--axis'),
    'stroke-width': 1, opacity: 0 });
  svg.appendChild(cross);
  const dots = series.map(s => {
    const c = mk('circle', { r: 3.5, fill: s.color, stroke: css('--surface'),
      'stroke-width': 2, opacity: 0 });
    svg.appendChild(c); return c;
  });
  host.appendChild(svg);
  const tip = el('div', 'tip'); host.appendChild(tip);

  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const t = x0 + (cx / r.width * W - P.l) / (W - P.l - P.r) * (x1 - x0);
    let best = 0, bd = Infinity;
    for (let i = 0; i < xs.length; i++) {
      const dd = Math.abs(xs[i] - t); if (dd < bd) { bd = dd; best = i; }
    }
    const px = X(xs[best]);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px);
    cross.setAttribute('opacity', 1);
    let rows = '';
    series.forEach((s, i) => {
      const v = s.pts[best][1];
      dots[i].setAttribute('cx', px);
      dots[i].setAttribute('cy', Y(v));
      dots[i].setAttribute('opacity', 1);
      rows += `${s.m.k}× ${isDD ? fmt.n(v, 1) + '%' : Math.round(v).toLocaleString() + ' U'}<br>`;
    });
    tip.innerHTML = rows + `<span style="opacity:.7">`
      + new Date(xs[best]).toLocaleDateString('zh-TW',
        { year: 'numeric', month: '2-digit', day: '2-digit' }) + '</span>';
    tip.classList.add('on');
    const left = Math.min(Math.max(px / W * r.width - tip.offsetWidth / 2, 2),
                          r.width - tip.offsetWidth - 2);
    tip.style.left = left + 'px';
    tip.style.top = '4px';
  };
  const leave = () => {
    cross.setAttribute('opacity', 0);
    dots.forEach(d => d.setAttribute('opacity', 0));
    tip.classList.remove('on');
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', leave);
  svg.addEventListener('touchmove', move, { passive: true });
  svg.addEventListener('touchend', leave);

  // 圖例：兩條以上一定有，識別不能只靠顏色
  $('#stresslegend').innerHTML = series.map(s =>
    `<span><i style="border-top-color:${s.color}"></i>${s.m.k}× · 1R = ${s.m.r_dollar} U`
    + ` · 谷底 ${fmt.n(s.m.dd_from_peak_pct, 1)}%</span>`).join('');
}

document.querySelectorAll('#stresstoggle button').forEach(b => {
  b.addEventListener('click', () => {
    stressView = b.dataset.v;
    document.querySelectorAll('#stresstoggle button').forEach(x =>
      x.setAttribute('aria-pressed', String(x.dataset.v === stressView)));
    drawStress();
  });
});
window.addEventListener('resize', () => { if (STRESS) drawStress(); });
loadStress();
