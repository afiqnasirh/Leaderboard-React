import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

// ── CONFIG ─────────────────────────────────────────────────────
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZnV6sv6OrFBlUHZfqtCFjTPabnDBg9XFaxVnOf0rnWuFS1oC0zZDc_W4Gi61r_JMA/exec' // ← paste your Apps Script URL
const CACHE_KEY  = 'agentathon-pub-cache'

// ── PALETTE ────────────────────────────────────────────────────
const C = {
  o200:'#fec8a8', o300:'#fd9a5f', o400:'#f65403', o500:'#c44000',
  oGlow:'#f6540388', oBg:'#f6540310',
  b200:'#9d8fff',  b300:'#5b48fb',  b400:'#1901e7',
  bGlow:'#1901e788', bBg:'#1901e710',
  bg:'#06040F', bg2:'#0D0820', bg3:'#111525',
  text:'#D8D0F8', muted:'#6658A0', dim:'#2A1F4A',
  gold:'#FFD700', silver:'#C0C0C0', bronze:'#CD7F32',
}

const CRITERIA = [
  { key:'pitchClarity',   label:'Pitch Clarity',           short:'Pitch',    max:15, color:C.o300 },
  { key:'innovation',     label:'Innovation & Creativity', short:'Innovate', max:15, color:C.b200 },
  { key:'workflow',       label:'AI Agent Workflow',       short:'Workflow', max:20, color:C.o400 },
  { key:'demo',           label:'AI Agent Demo',           short:'Demo',     max:25, color:C.b300 },
  { key:'businessImpact', label:'Business Impact',         short:'Business', max:25, color:C.o200 },
]
const MAX_TOTAL = 100
const emptyScores = () => ({ pitchClarity:0, innovation:0, workflow:0, demo:0, businessImpact:0 })
const calcTotal   = s  => CRITERIA.reduce((sum, c) => sum + (Number(s[c.key]) || 0), 0)
const API_OK      = SCRIPT_URL !== 'YOUR_APPS_SCRIPT_URL_HERE' && SCRIPT_URL.startsWith('https://')

// Read ?teamid=005 from URL for personalised highlight
const URL_TEAM_ID = (() => {
  try {
    const p = new URLSearchParams(window.location.search)
    const v = p.get('teamid') || p.get('team')
    return v ? Number(v) : null
  } catch (_) { return null }
})()

function getRankColor(rank) {
  if (rank === 1) return { color: C.gold,   glow: C.gold   }
  if (rank === 2) return { color: C.silver, glow: C.silver }
  if (rank === 3) return { color: C.bronze, glow: C.bronze }
  if (rank <= 10) return { color: C.o300,   glow: C.o400   }
  return { color: C.b200, glow: C.b400 }
}

// ── GLOBAL CSS (injected once) ─────────────────────────────────
const GLOBAL_CSS = `
  .grid-bg {
    position:fixed;inset:0;pointer-events:none;z-index:0;
    background-image:linear-gradient(${C.o400}06 1px,transparent 1px),
                     linear-gradient(90deg,${C.b400}06 1px,transparent 1px);
    background-size:46px 46px;
    will-change:transform;transform:translateZ(0);
  }
  .sl { position:fixed;left:0;right:0;height:2px;pointer-events:none;z-index:1;will-change:top }
  .sl-o { background:linear-gradient(transparent,${C.o400}1A,transparent) }
  .sl-b { background:linear-gradient(transparent,${C.b400}1A,transparent) }
  .nav-btn {
    background:transparent;border:1px solid #FFFFFF14;color:${C.muted};
    padding:8px 18px;cursor:pointer;font-family:'Orbitron',monospace;
    font-size:10px;letter-spacing:.2em;transition:all .2s;border-radius:6px;
    -webkit-tap-highlight-color:transparent;
  }
  .nav-btn:hover,.nav-btn:active { border-color:${C.o400}66;color:${C.o300} }
  .nav-btn.on  { border-color:${C.o400};color:${C.o300};background:${C.oBg};box-shadow:0 0 14px ${C.o400}33 }
  .tr { transition:background .12s;cursor:pointer;-webkit-tap-highlight-color:transparent;will-change:transform;transform:translateZ(0) }
  .tr:active { background:${C.o400}18 !important }
  .gbadge {
    display:inline-block;font-size:11px;
    background:${C.b400}1A;color:${C.b200};
    border:1px solid ${C.b400}33;
    padding:2px 7px;border-radius:3px;letter-spacing:.06em;
  }
  .expand-enter { animation:expandIn .2s ease }
  @keyframes expandIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
  .podium-desktop { display:flex;align-items:flex-end;justify-content:center;gap:10px;margin-bottom:36px;padding:0 16px }
  .podium-mobile  { display:none;flex-direction:column;gap:12px;margin-bottom:28px;padding:0 8px }
  .search-fab {
    position:fixed;bottom:160px;right:16px;z-index:50;
    width:52px;height:52px;border-radius:50%;
    background:linear-gradient(135deg,${C.o400},${C.b400});
    border:none;cursor:pointer;display:none;
    align-items:center;justify-content:center;font-size:20px;
    box-shadow:0 4px 20px ${C.o400}55,0 0 0 1px ${C.o400}44;
    transition:transform .15s;-webkit-tap-highlight-color:transparent;
  }
  .search-fab:active { transform:scale(.93) }
  .my-team-btn {
    background:${C.o400}18;border:1px solid ${C.o400}55;color:${C.o300};
    padding:7px 14px;border-radius:20px;
    font-family:'Orbitron',monospace;font-size:9px;letter-spacing:.15em;
    cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;
  }
  .pulse-o { animation:po 2.4s ease-in-out infinite }
  .pulse-g { animation:pg 2s   ease-in-out infinite }
  @keyframes po { 0%,100%{opacity:1;text-shadow:0 0 14px ${C.oGlow}} 50%{opacity:.65;text-shadow:none} }
  @keyframes pg { 0%,100%{opacity:1;text-shadow:0 0 18px #FFD70099} 50%{opacity:.7;text-shadow:none} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:none} }
  @keyframes fadeIn    { from{opacity:0;transform:translateY(6px)}   to{opacity:1;transform:none} }
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes marquee   { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  .fi { animation:fadeIn .3s ease }
  @media(max-width:768px){
    .podium-desktop { display:none!important }
    .podium-mobile  { display:flex!important }
    .search-fab     { display:flex!important }
    .hdr-sub  { display:none!important }
    .lb-prog  { display:none!important }
    .fn-prog  { display:none!important }
    .lb-hdr   { grid-template-columns:44px 1fr 90px!important }
    .lb-row-g { grid-template-columns:44px 1fr 90px!important }
    .fn-hdr   { grid-template-columns:42px 1fr 86px!important }
    .fn-row-g { grid-template-columns:42px 1fr 86px!important }
    .detail-grid { grid-template-columns:1fr!important }
    .hdr-title { font-size:15px!important;letter-spacing:.06em!important }
    .nav-btn   { padding:7px 11px!important;font-size:9px!important }
  }
  @media(max-width:420px){
    .hdr-title { font-size:13px!important }
    .nav-btn   { padding:6px 9px!important;font-size:8px!important }
  }
`

function useGlobalCSS() {
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = GLOBAL_CSS
    document.head.appendChild(el)
    return () => document.head.removeChild(el)
  }, [])
}

// ── LOGO ───────────────────────────────────────────────────────
function Logo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={C.o400} /><stop offset="100%" stopColor={C.b400} />
        </linearGradient>
        <linearGradient id="lg2" x1="56" y1="0" x2="0" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={C.b400} /><stop offset="100%" stopColor={C.o400} />
        </linearGradient>
      </defs>
      <path d="M28 5 A23 23 0 1 1 5.1 33" fill="none" stroke="url(#lg1)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="28" cy="28" r="13" fill="url(#lg1)" opacity="0.15" />
      <circle cx="28" cy="28" r="13" fill="none" stroke="url(#lg2)" strokeWidth="1.5" />
      <rect x="16" y="19" width="24" height="4" rx="2" fill="url(#lg1)" />
      <rect x="26" y="19" width="4" height="16" rx="2" fill="url(#lg1)" />
      <circle cx="5.5" cy="33" r="2.5" fill={C.o400} />
    </svg>
  )
}

// ── RADAR CHART ────────────────────────────────────────────────
function RadarChart({ scores, size = 240 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.34
  const n  = CRITERIA.length
  const angle   = i => (Math.PI * 2 / n) * i - Math.PI / 2
  const pt      = (i, ratio) => ({ x: cx + r * ratio * Math.cos(angle(i)), y: cy + r * ratio * Math.sin(angle(i)) })
  const rings   = [0.25, 0.5, 0.75, 1.0]
  const ringPath = ratio => {
    const pts = CRITERIA.map((_, i) => pt(i, ratio))
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z'
  }
  const dataPath = () => {
    const pts = CRITERIA.map((c, i) => {
      const ratio = Math.min(1, (scores[c.key] || 0) / c.max)
      return pt(i, ratio)
    })
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z'
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow:'visible' }}>
      <defs>
        <linearGradient id="rf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={C.o400} stopOpacity="0.3" />
          <stop offset="100%" stopColor={C.b400} stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="rs" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={C.o400} />
          <stop offset="100%" stopColor={C.b300} />
        </linearGradient>
      </defs>
      {rings.map((ratio, ri) => (
        <path key={ri} d={ringPath(ratio)} fill="none"
          stroke={ri === 3 ? '#FFFFFF18' : '#FFFFFF0A'}
          strokeWidth={ri === 3 ? '1' : '0.5'} />
      ))}
      {CRITERIA.map((_, i) => {
        const end = pt(i, 1)
        return <line key={i} x1={cx} y1={cy} x2={end.x.toFixed(1)} y2={end.y.toFixed(1)} stroke="#FFFFFF0C" strokeWidth="0.5" />
      })}
      <path d={dataPath()} fill="url(#rf)" stroke="url(#rs)" strokeWidth="2" strokeLinejoin="round" />
      {CRITERIA.map((c, i) => {
        const ratio = Math.min(1, (scores[c.key] || 0) / c.max)
        const p = pt(i, ratio)
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={C.bg} stroke={C.o400} strokeWidth="1.5" />
            <circle cx={p.x} cy={p.y} r="2" fill={C.o300} />
          </g>
        )
      })}
      {CRITERIA.map((c, i) => {
        const lp   = pt(i, 1.22)
        const cosA = Math.cos(angle(i))
        const anchor = Math.abs(cosA) < 0.1 ? 'middle' : cosA < 0 ? 'end' : 'start'
        return (
          <g key={i}>
            <text x={lp.x} y={lp.y - 6} textAnchor={anchor} fontSize="9" fontFamily="'Orbitron',monospace" fill={C.o300}>{c.short}</text>
            <text x={lp.x} y={lp.y + 7} textAnchor={anchor} fontSize="9" fontFamily="'Share Tech Mono',monospace" fill={C.muted}>{scores[c.key] || 0}/{c.max}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── TEAM DETAIL PANEL ──────────────────────────────────────────
function TeamDetail({ team, rank, onClose }) {
  const total = calcTotal(team.scores)
  const pct   = Math.round((total / MAX_TOTAL) * 100)
  const rc    = getRankColor(rank)
  return (
    <div style={{ background:C.bg2, border:`1px solid ${C.o400}44`, borderTop:`3px solid ${C.o400}`, borderRadius:'10px', padding:'20px', marginBottom:'20px', position:'relative', overflow:'hidden', animation:'slideDown .25s ease' }}>
      <div style={{ position:'absolute', top:-40, right:-40, width:'140px', height:'140px', borderRadius:'50%', background:`radial-gradient(circle,${C.o400}12,transparent 70%)`, pointerEvents:'none' }} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          {team.logo && (
            <div style={{ width:'46px', height:'46px', borderRadius:'50%', border:`2px solid ${C.o400}44`, background:C.bg, overflow:'hidden', flexShrink:0 }}>
              <img src={team.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', padding:'3px' }} onError={e => e.target.style.display = 'none'} />
            </div>
          )}
          <div>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'15px', fontWeight:'700', color:'#fff', marginBottom:'4px' }}>{team.name}</div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:'12px', color:C.muted }}>{team.group}</span>
              <span style={{ fontSize:'9px', background:`${rc.color}22`, color:rc.color, border:`1px solid ${rc.color}55`, padding:'2px 8px', borderRadius:'3px', fontFamily:"'Orbitron',monospace" }}>RANK #{rank}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:`1px solid ${C.dim}`, color:C.muted, padding:'7px 12px', cursor:'pointer', borderRadius:'6px', fontFamily:"'Orbitron',monospace", fontSize:'10px' }}>✕</button>
      </div>
      <div className="detail-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'18px' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
          <RadarChart scores={team.scores} size={220} />
          <div style={{ textAlign:'center', marginTop:'8px' }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'26px', fontWeight:'900', background:`linear-gradient(90deg,${C.o400},${C.b300})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              {total}<span style={{ fontSize:'12px', color:C.muted, WebkitTextFillColor:C.muted }}>/{MAX_TOTAL}</span>
            </div>
            <div style={{ height:'4px', background:C.dim, borderRadius:'2px', margin:'6px 4px' }}>
              <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${C.o400},${C.b300})`, borderRadius:'2px' }} />
            </div>
            <div style={{ fontSize:'12px', color:C.muted }}>{pct}% of maximum</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize:'9px', color:C.o400, letterSpacing:'.3em', fontFamily:"'Orbitron',monospace", marginBottom:'12px' }}>BREAKDOWN</div>
          {CRITERIA.map(c => {
            const val = team.scores[c.key] || 0
            const bp  = Math.round((val / c.max) * 100)
            return (
              <div key={c.key} style={{ marginBottom:'11px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                  <span style={{ fontSize:'12px', color:C.text }}>{c.label}</span>
                  <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'12px', color:c.color }}>{val}<span style={{ color:C.muted }}>/{c.max}</span></span>
                </div>
                <div style={{ height:'5px', background:C.dim, borderRadius:'3px' }}>
                  <div style={{ height:'100%', width:`${bp}%`, background:`linear-gradient(90deg,${C.o400},${C.b300})`, borderRadius:'3px' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── EXPANDABLE ROW BREAKDOWN ───────────────────────────────────
function RowBreakdown({ team, rank, topScore, onClose }) {
  const total = calcTotal(team.scores)
  const rc    = getRankColor(rank)
  return (
    <div className="expand-enter" style={{ background:C.bg3, borderLeft:`3px solid ${rc.color}`, padding:'14px 16px', borderBottom:`1px solid ${C.dim}55` }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px', marginBottom:'12px' }}>
        {CRITERIA.map(c => {
          const val = team.scores[c.key] || 0
          const pct = Math.round((val / c.max) * 100)
          return (
            <div key={c.key} style={{ textAlign:'center' }}>
              <div style={{ height:'40px', background:C.dim, borderRadius:'3px', position:'relative', overflow:'hidden', marginBottom:'4px' }}>
                <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${pct}%`, background:`linear-gradient(to top,${C.o400}88,${C.b400}44)` }} />
              </div>
              <div style={{ fontSize:'10px', color:c.color, fontFamily:"'Orbitron',monospace", fontWeight:'700' }}>{val}</div>
              <div style={{ fontSize:'9px', color:C.muted, marginTop:'1px' }}>{c.short}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'18px', fontWeight:'700', color:rc.color }}>{total}<span style={{ fontSize:'10px', color:C.muted, fontWeight:'400' }}>/{MAX_TOTAL}</span></div>
          <div style={{ height:'5px', width:'80px', background:C.dim, borderRadius:'3px' }}>
            <div style={{ height:'100%', width:`${topScore > 0 ? Math.round((total / topScore) * 100) : 0}%`, background:`linear-gradient(90deg,${rc.color},${rc.color}88)`, borderRadius:'3px' }} />
          </div>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:`1px solid ${C.dim}`, color:C.muted, padding:'5px 10px', cursor:'pointer', borderRadius:'4px', fontFamily:"'Orbitron',monospace", fontSize:'9px' }}>COLLAPSE ▲</button>
      </div>
    </div>
  )
}

// ── DESKTOP PODIUM ─────────────────────────────────────────────
function DesktopPodium({ teams }) {
  const top3   = teams.slice(0, 3)
  const order  = [1, 0, 2]
  const heights = ['120px', '168px', '96px']
  const labels  = ['2ND', '1ST', '3RD']
  const colors  = [C.silver, C.gold, C.bronze]
  return (
    <div className="podium-desktop">
      {order.map((idx, pos) => {
        const team = top3[idx]
        if (!team) return null
        const col   = colors[pos]
        const total = calcTotal(team.scores)
        return (
          <div key={team.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1, maxWidth:'220px' }}>
            <div style={{ fontSize:'9px', color:C.muted, letterSpacing:'.2em', marginBottom:'5px', fontFamily:"'Orbitron',monospace" }}>RANK</div>
            {team.logo
              ? <div style={{ width:'54px', height:'54px', borderRadius:'50%', border:`2px solid ${col}`, background:C.bg2, overflow:'hidden', boxShadow:`0 0 22px ${col}55`, marginBottom:'8px' }}>
                  <img src={team.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', padding:'4px' }} onError={e => e.target.style.display = 'none'} />
                </div>
              : <div style={{ width:'54px', height:'54px', borderRadius:'50%', border:`2px solid ${col}`, background:`radial-gradient(circle at 40% 35%,${col}33,transparent)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Orbitron',monospace", fontSize:'20px', fontWeight:'900', color:col, boxShadow:`0 0 22px ${col}55`, marginBottom:'8px' }}>{idx + 1}</div>
            }
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'10px', color:'#fff', textAlign:'center', marginBottom:'3px', maxWidth:'150px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{team.name}</div>
            <div style={{ fontSize:'11px', color:col, marginBottom:'8px', fontFamily:"'Share Tech Mono',monospace" }}>{total}/{MAX_TOTAL}</div>
            <div style={{ width:'100%', height:heights[pos], background:`linear-gradient(to top,${col}18,transparent)`, border:`1px solid ${col}44`, borderBottom:'none', borderRadius:'4px 4px 0 0', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'8px' }}>
              <span style={{ fontFamily:"'Orbitron',monospace", fontSize:'9px', letterSpacing:'.3em', color:`${col}77` }}>{labels[pos]}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── MOBILE PODIUM ──────────────────────────────────────────────
function MobilePodium({ teams }) {
  const top3 = teams.slice(0, 3)
  const configs = [
    { idx:0, rank:1, color:C.gold,   label:'🥇 CHAMPION',     logoSize:'72px', nameSz:'15px', scoreSz:'22px', bg:`linear-gradient(135deg,${C.gold}18,${C.gold}06)` },
    { idx:1, rank:2, color:C.silver, label:'🥈 1ST RUNNER-UP', logoSize:'56px', nameSz:'13px', scoreSz:'18px', bg:`linear-gradient(135deg,${C.silver}12,${C.silver}04)` },
    { idx:2, rank:3, color:C.bronze, label:'🥉 2ND RUNNER-UP', logoSize:'56px', nameSz:'13px', scoreSz:'18px', bg:`linear-gradient(135deg,${C.bronze}12,${C.bronze}04)` },
  ]
  return (
    <div className="podium-mobile">
      {configs.map(({ idx, rank, color, label, logoSize, nameSz, scoreSz, bg }) => {
        const team = top3[idx]
        if (!team) return null
        const total = calcTotal(team.scores)
        return (
          <div key={team.id} style={{ background:bg, border:`1px solid ${color}44`, borderLeft:`4px solid ${color}`, borderRadius:'10px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'14px', boxShadow: rank === 1 ? `0 4px 24px ${color}22` : 'none' }}>
            <div style={{ flexShrink:0 }}>
              {team.logo
                ? <div style={{ width:logoSize, height:logoSize, borderRadius:'50%', border:`2px solid ${color}`, background:C.bg2, overflow:'hidden', boxShadow:`0 0 16px ${color}44` }}>
                    <img src={team.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', padding:'5px' }} onError={e => e.target.style.display = 'none'} />
                  </div>
                : <div style={{ width:logoSize, height:logoSize, borderRadius:'50%', border:`2px solid ${color}`, background:`radial-gradient(circle at 40% 35%,${color}33,transparent)`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Orbitron',monospace", fontSize: rank === 1 ? '26px' : '22px', fontWeight:'900', color, boxShadow:`0 0 16px ${color}44` }}>{rank}</div>
              }
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'9px', color, fontFamily:"'Orbitron',monospace", letterSpacing:'.15em', marginBottom:'4px' }}>{label}</div>
              <div style={{ fontSize:nameSz, fontWeight:'700', color:'#fff', fontFamily:"'Orbitron',monospace", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'2px' }}>{team.name}</div>
              <div style={{ fontSize:'11px', color:C.muted }}>{team.group}</div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontFamily:"'Orbitron',monospace", fontSize:scoreSz, fontWeight:'900', color, textShadow:`0 0 12px ${color}88` }}>{total}</div>
              <div style={{ fontSize:'10px', color:C.muted, marginTop:'2px' }}>/ {MAX_TOTAL}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── SPONSOR MARQUEE ────────────────────────────────────────────
function SponsorMarquee() {
  const sponsors = ['TELEKOM MALAYSIA', 'AIFF 2025', 'AGENT-A-THON', 'POWERED BY AI', 'YOUR SPONSOR', 'YOUR SPONSOR']
  const items    = [...sponsors, ...sponsors]
  return (
    <div style={{ overflow:'hidden', padding:'14px 0 10px', borderBottom:`1px solid ${C.dim}66` }}>
      <div style={{ fontSize:'8px', color:C.muted, letterSpacing:'.4em', fontFamily:"'Orbitron',monospace", textAlign:'center', marginBottom:'10px' }}>PROUDLY SUPPORTED BY</div>
      <div style={{ display:'flex', gap:'0', animation:'marquee 18s linear infinite', width:'max-content' }}>
        {items.map((s, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'0 24px' }}>
            <div style={{ width:'5px', height:'5px', borderRadius:'50%', background: i % 2 === 0 ? C.o400 : C.b400, boxShadow:`0 0 5px ${i % 2 === 0 ? C.o400 : C.b400}` }} />
            <span style={{ fontSize:'9px', color:C.muted, letterSpacing:'.25em', fontFamily:"'Orbitron',monospace", whiteSpace:'nowrap' }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MAIN LEADERBOARD COMPONENT ─────────────────────────────────
export default function Leaderboard() {
  useGlobalCSS()

  const [teams, setTeams] = useState(() => {
    try {
      const r = localStorage.getItem(CACHE_KEY)
      if (r) {
        const p = JSON.parse(r)
        if (Array.isArray(p) && p.length > 0)
          return p.map(t => ({ ...t, scores: t.scores || emptyScores(), finaleScores: t.finaleScores || emptyScores() }))
      }
    } catch (_) {}
    return []
  })
  const [view,       setView]       = useState('leaderboard')
  const [loading,    setLoading]    = useState(true)
  const [syncing,    setSyncing]    = useState(false)
  const [lastSync,   setLastSync]   = useState(null)
  const [netErr,     setNetErr]     = useState('')
  const [lbSearch,   setLbSearch]   = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [ticker,     setTicker]     = useState(0)
  const searchRef = useRef(null)

  const fetchTeams = useCallback(async (silent = false) => {
    if (!API_OK) { setLoading(false); return }
    if (!silent) setLoading(true); else setSyncing(true)
    try {
      const res  = await fetch(SCRIPT_URL + '?t=' + Date.now())
      const data = await res.json()
      if (data.status !== 'ok') throw new Error(data.message)
      const fresh = data.teams.map(t => ({ ...t, scores: t.scores || emptyScores(), finaleScores: t.finaleScores || emptyScores() }))
      setTeams(fresh)
      setLastSync(new Date())
      setNetErr('')
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)) } catch (_) {}
    } catch (err) {
      setNetErr('Offline')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [])

  useEffect(() => { fetchTeams() }, [])
  useEffect(() => {
    if (!API_OK) return
    const t = setInterval(() => fetchTeams(true), 30000)
    return () => clearInterval(t)
  }, [fetchTeams])
  useEffect(() => {
    const t = setInterval(() => setTicker(x => x + 1), 55)
    return () => clearInterval(t)
  }, [])

  // Auto-highlight + scroll to URL team
  useEffect(() => {
    if (URL_TEAM_ID && teams.length > 0) {
      setExpandedId(URL_TEAM_ID)
      setTimeout(() => {
        const el = document.getElementById(`team-row-${URL_TEAM_ID}`)
        if (el) el.scrollIntoView({ behavior:'smooth', block:'center' })
      }, 600)
    }
  }, [teams.length])

  useEffect(() => {
    if (showSearch && searchRef.current) searchRef.current.focus()
  }, [showSearch])

  const sorted     = useMemo(() => [...teams].sort((a, b) => calcTotal(b.scores) - calcTotal(a.scores)), [teams])
  const filteredLb = useMemo(() => sorted.filter(t =>
    t.name.toLowerCase().includes(lbSearch.toLowerCase()) ||
    t.group.toLowerCase().includes(lbSearch.toLowerCase())
  ), [sorted, lbSearch])
  const topScore   = calcTotal((sorted[0] || { scores: emptyScores() }).scores)
  const scanPos    = (ticker * 2.5) % 100

  const scrollToMyTeam = () => {
    if (!URL_TEAM_ID) return
    const el = document.getElementById(`team-row-${URL_TEAM_ID}`)
    if (el) el.scrollIntoView({ behavior:'smooth', block:'center' })
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px' }}>
      <div style={{ width:'52px', height:'52px', borderRadius:'50%', border:`2px solid ${C.o400}`, borderTopColor:C.b400, animation:'spin 0.9s linear infinite' }} />
      <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'11px', background:`linear-gradient(90deg,${C.o400},${C.b300})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'.3em' }}>
        {API_OK ? 'LOADING SCORES...' : 'AIFF AGENT-A-THON'}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text, fontFamily:"'Share Tech Mono',monospace", overflowX:'hidden' }}>
      <div className="grid-bg" />
      <div className="sl sl-o" style={{ top:`${scanPos}%` }} />
      <div className="sl sl-b" style={{ top:`${(scanPos + 47) % 100}%` }} />

      {/* ── HEADER ── */}
      <header style={{ position:'fixed', top:'12px', left:'50%', transform:'translateX(-50%)', zIndex:100, width:'calc(100% - 48px)', maxWidth:'1200px', background:`linear-gradient(180deg,${C.bg}F2,${C.bg2}EE)`, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', boxShadow:`0 0 0 1px ${C.o400}33,0 8px 32px #00000077`, borderRadius:'12px', border:`1px solid ${C.o400}33`, padding:'0 22px', display:'flex', alignItems:'center', justifyContent:'space-between', minHeight:'70px', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <Logo size={42} />
          <div>
            <div className="hdr-title" style={{ fontFamily:"'Orbitron',monospace", fontSize:'20px', fontWeight:'900', letterSpacing:'.13em', background:`linear-gradient(90deg,${C.o400},${C.o300} 30%,${C.b300} 70%,${C.b400})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              AIFF AGENT-A-THON
            </div>
            <div className="hdr-sub" style={{ fontSize:'9px', color:C.muted, letterSpacing:'.3em', display:'flex', alignItems:'center', gap:'6px', marginTop:'2px' }}>
              <span style={{ width:'12px', height:'1px', display:'inline-block', background:`linear-gradient(90deg,${C.o400},transparent)` }} />
              POWERED BY TELEKOM MALAYSIA
              <span style={{ width:'12px', height:'1px', display:'inline-block', background:`linear-gradient(90deg,transparent,${C.b400})` }} />
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          <div onClick={() => fetchTeams(true)} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'10px', color: netErr ? '#FF7070' : C.muted, cursor:'pointer', padding:'4px 8px', borderRadius:'20px', border:`1px solid ${C.dim}` }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background: netErr ? '#FF7070' : syncing ? C.b300 : C.o400, animation: syncing ? 'spin 0.8s linear infinite' : 'po 2s infinite', boxShadow: syncing ? `0 0 8px ${C.b400}` : `0 0 5px ${C.o400}` }} />
            {netErr ? 'OFFLINE' : syncing ? 'SYNC' : lastSync ? lastSync.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : 'LIVE'}
          </div>
          {URL_TEAM_ID && <button className="my-team-btn" onClick={scrollToMyTeam}>MY TEAM ↓</button>}
          <button className={`nav-btn ${view === 'leaderboard' ? 'on' : ''}`} onClick={() => setView('leaderboard')}>BOARD</button>
          <button className={`nav-btn ${view === 'finale' ? 'fin' : ''}`} onClick={() => setView('finale')}
            style={{ borderColor: view === 'finale' ? C.gold + '88' : '#FFFFFF14', color: view === 'finale' ? C.gold : C.muted, background: view === 'finale' ? C.gold + '10' : 'transparent', boxShadow: view === 'finale' ? `0 0 18px ${C.gold}44` : 'none' }}>
            ⚡ FINALE
          </button>
        </div>
      </header>

      {/* ── SEARCH FAB (mobile) ── */}
      <button className="search-fab" onClick={() => setShowSearch(s => !s)}>{showSearch ? '✕' : '🔍'}</button>

      {/* ── SEARCH DRAWER ── */}
      {showSearch && (
        <div style={{ position:'fixed', bottom:'140px', left:'16px', right:'16px', zIndex:60, background:C.bg2, border:`1px solid ${C.o400}44`, borderRadius:'12px', padding:'14px', boxShadow:'0 -4px 24px #00000099', animation:'slideDown .2s ease' }}>
          <input ref={searchRef} value={lbSearch} onChange={e => setLbSearch(e.target.value)} placeholder="Search team or group..."
            style={{ background:C.bg, border:`1px solid ${C.o400}44`, color:C.text, padding:'11px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'15px', outline:'none', borderRadius:'8px', width:'100%' }} />
          {lbSearch && <div style={{ fontSize:'11px', color:C.muted, marginTop:'8px' }}>{filteredLb.length} of {teams.length} teams</div>}
        </div>
      )}

      <main style={{ position:'relative', zIndex:5, padding:'100px 20px 200px', maxWidth:'1060px', margin:'0 auto' }}>

        {/* ── LEADERBOARD ── */}
        {view === 'leaderboard' && (
          <div className="fi">
            {topScore > 0 && <DesktopPodium teams={sorted} />}
            {topScore > 0 && <MobilePodium  teams={sorted} />}

            {/* Desktop search */}
            <div style={{ display:'flex', gap:'10px', marginBottom:'14px', alignItems:'center', flexWrap:'wrap' }}>
              <input value={lbSearch} onChange={e => setLbSearch(e.target.value)} placeholder="[ SEARCH TEAM OR GROUP ]"
                style={{ background:C.bg2, border:`1px solid ${C.b400}33`, color:C.text, padding:'10px 14px', fontFamily:"'Share Tech Mono',monospace", fontSize:'14px', outline:'none', borderRadius:'6px', maxWidth:'320px', width:'100%', transition:'border-color .2s' }}
                onFocus={e  => e.target.style.borderColor = `${C.o400}88`}
                onBlur={e   => e.target.style.borderColor = `${C.b400}33`} />
              <span style={{ fontSize:'12px', color:C.dim, whiteSpace:'nowrap' }}>{filteredLb.length}/{teams.length}</span>
              <span style={{ fontSize:'11px', color:C.muted }}>· tap a row to expand</span>
            </div>

            <div className="lb-hdr" style={{ display:'grid', gridTemplateColumns:'56px 1fr 160px 120px', padding:'9px 16px', fontSize:'9px', letterSpacing:'.3em', color:C.muted, borderBottom:'1px solid', borderImage:`linear-gradient(90deg,${C.o400}55,${C.b400}55) 1`, marginBottom:'2px' }}>
              <span>RANK</span><span>TEAM</span><span className="lb-prog">PROGRESS</span><span style={{ textAlign:'right' }}>SCORE</span>
            </div>

            {filteredLb.some(t => sorted.indexOf(t) < 10) && (
              <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'5px 16px 3px' }}>
                <div style={{ height:'1px', flex:1, background:`linear-gradient(90deg,${C.o400}66,transparent)` }} />
                <span style={{ fontSize:'8px', fontFamily:"'Orbitron',monospace", color:C.o400, letterSpacing:'.3em' }}>TOP 10</span>
                <div style={{ height:'1px', flex:1, background:`linear-gradient(90deg,transparent,${C.b400}66)` }} />
              </div>
            )}

            {filteredLb.map((team, ri) => {
              const rank     = sorted.indexOf(team) + 1
              const rc       = getRankColor(rank)
              const isTop3   = rank <= 3
              const isTop10  = rank <= 10
              const total    = calcTotal(team.scores)
              const pct      = topScore > 0 ? Math.round((total / topScore) * 100) : 0
              const ac       = rank % 2 === 0 ? C.b400 : C.o400
              const al       = rank % 2 === 0 ? C.b300 : C.o300
              const isExpanded = expandedId === team.id
              const isMyTeam   = URL_TEAM_ID && team.id === URL_TEAM_ID
              const prev     = filteredLb[ri - 1]
              const pr       = prev ? sorted.indexOf(prev) + 1 : null

              return (
                <div key={team.id} id={`team-row-${team.id}`}>
                  {pr === 10 && rank === 11 && (
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'5px 16px' }}>
                      <div style={{ height:'1px', flex:1, background:`linear-gradient(90deg,${C.dim}88,transparent)` }} />
                      <span style={{ fontSize:'8px', fontFamily:"'Orbitron',monospace", color:C.muted, letterSpacing:'.3em' }}>REST OF FIELD</span>
                      <div style={{ height:'1px', flex:1, background:`linear-gradient(90deg,transparent,${C.dim}88)` }} />
                    </div>
                  )}
                  <div className="tr lb-row-g"
                    onClick={() => setExpandedId(isExpanded ? null : team.id)}
                    style={{
                      display:'grid', gridTemplateColumns:'56px 1fr 160px 120px',
                      padding: isTop10 ? '13px 16px 13px 12px' : '10px 16px',
                      borderBottom:`1px solid ${isExpanded ? 'transparent' : isTop10 ? ac + '1A' : C.dim + '33'}`,
                      alignItems:'center',
                      background: isMyTeam   ? `linear-gradient(90deg,${C.o400}22,${C.b400}12)`
                                : isExpanded ? C.bg3
                                : isTop3     ? `linear-gradient(90deg,${ac}10,${C.bg3})`
                                : isTop10    ? `linear-gradient(90deg,${ac}08,${C.bg3})`
                                : C.bg,
                      borderLeft: isMyTeam ? `3px solid ${C.o400}` : isTop10 ? `3px solid ${ac}` : '3px solid transparent',
                      outline: isMyTeam ? `1px solid ${C.o400}33` : 'none',
                    }}>
                    <div style={{ fontFamily:"'Orbitron',monospace", fontSize: isTop3 ? '15px' : '13px', fontWeight:'700', color:rc.color, textShadow: isTop3 ? `0 0 14px ${rc.glow}CC` : 'none' }}
                      className={isTop3 ? 'pulse-o' : ''}>
                      #{rank}
                    </div>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'7px', flexWrap:'wrap' }}>
                        {team.logo && (
                          <div style={{ width:'26px', height:'26px', borderRadius:'50%', border:`1px solid ${isTop10 ? ac + '55' : C.dim}`, background:C.bg2, overflow:'hidden', flexShrink:0 }}>
                            <img src={team.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }} onError={e => e.target.style.display = 'none'} />
                          </div>
                        )}
                        <span style={{ fontSize: isTop10 ? '14px' : '13px', color: isMyTeam ? C.o300 : isTop3 ? '#fff' : isTop10 ? C.text : '#9999BB', fontWeight: isTop10 ? '500' : '400', fontFamily: isTop3 ? "'Orbitron',monospace" : 'inherit' }}>
                          {team.name}
                        </span>
                        {isMyTeam  && <span style={{ fontSize:'8px', background:`${C.o400}33`, color:C.o300, border:`1px solid ${C.o400}66`, padding:'1px 5px', borderRadius:'3px', fontFamily:"'Orbitron',monospace" }}>YOU</span>}
                        {isTop10 && !isTop3 && <span style={{ fontSize:'8px', background:`${ac}1A`, color:al, border:`1px solid ${ac}44`, padding:'1px 5px', borderRadius:'3px', fontFamily:"'Orbitron',monospace" }}>TOP10</span>}
                        {isTop3 && <span style={{ fontSize:'8px', background:`${ac}22`, color:C.o300, border:`1px solid ${ac}77`, padding:'1px 6px', borderRadius:'3px', fontFamily:"'Orbitron',monospace" }}>{rank === 1 ? '🥇 LEADER' : rank === 2 ? '🥈 2ND' : '🥉 3RD'}</span>}
                      </div>
                      <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px', display:'flex', gap:'8px', alignItems:'center' }}>
                        <span className="gbadge">{team.group}</span>
                        <span style={{ color:C.dim }}>ID·{String(team.id).padStart(3, '0')}</span>
                      </div>
                    </div>
                    <div className="lb-prog">
                      {isTop10 && topScore > 0 && (
                        <div style={{ height:'4px', background:C.dim, borderRadius:'2px', overflow:'hidden', marginBottom:'5px' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${ac},${al})`, borderRadius:'2px' }} />
                        </div>
                      )}
                      <div style={{ display:'flex', gap:'3px' }}>
                        {CRITERIA.map(c => {
                          const s = team.scores[c.key] || 0
                          const p = Math.round((s / c.max) * 100)
                          const h = Math.round(p * 2.55).toString(16).padStart(2, '0')
                          return <div key={c.key} title={`${c.label}: ${s}/${c.max}`} style={{ width:'8px', height:'8px', borderRadius:'1px', background:`linear-gradient(to top,${C.o400}${h},${C.b400}${h})`, border:`1px solid ${C.dim}` }} />
                        })}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:"'Orbitron',monospace", fontSize: isTop3 ? '16px' : '14px', fontWeight:'700', color:rc.color, textShadow: isTop3 ? `0 0 12px ${rc.glow}88` : 'none' }}>
                        {total}<span style={{ fontSize:'10px', color:C.muted, fontWeight:'400' }}>/{MAX_TOTAL}</span>
                      </div>
                      <div style={{ fontSize:'11px', color:C.dim, marginTop:'1px' }}>{isExpanded ? '▲' : '▼'}</div>
                    </div>
                  </div>
                  {isExpanded && <RowBreakdown team={team} rank={rank} topScore={topScore} onClose={() => setExpandedId(null)} />}
                </div>
              )
            })}
          </div>
        )}

        {/* ── FINALE VIEW ── */}
        {view === 'finale' && (() => {
          const top10q = sorted.slice(0, 10)
          const top10  = [...top10q].sort((a, b) => calcTotal(b.finaleScores || emptyScores()) - calcTotal(a.finaleScores || emptyScores()))
          const fnSel  = selectedId ? top10.find(t => t.id === selectedId) : null
          const fnRank = fnSel ? top10.indexOf(fnSel) + 1 : null
          const topFn  = calcTotal((top10[0] || { finaleScores: emptyScores() }).finaleScores || emptyScores())
          return (
            <div className="fi">
              <div style={{ textAlign:'center', marginBottom:'28px', position:'relative' }}>
                <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'320px', height:'80px', background:`radial-gradient(ellipse,${C.gold}14,transparent 70%)`, pointerEvents:'none' }} />
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'10px', letterSpacing:'.5em', color:C.muted, marginBottom:'5px' }}>TOP 10 FINALISTS</div>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:'28px', fontWeight:'900', letterSpacing:'.2em', background:`linear-gradient(90deg,${C.o400},${C.gold},${C.o300},${C.gold},${C.b300})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', filter:`drop-shadow(0 0 18px ${C.gold}44)` }}>FINALE</div>
              </div>
              {topFn > 0 && <DesktopPodium teams={top10.map(t => ({ ...t, scores: t.finaleScores || emptyScores() }))} />}
              {topFn > 0 && <MobilePodium  teams={top10.map(t => ({ ...t, scores: t.finaleScores || emptyScores() }))} />}
              {fnSel && <TeamDetail team={{ ...fnSel, scores: fnSel.finaleScores || emptyScores() }} rank={fnRank} onClose={() => setSelectedId(null)} />}

              <div className="fn-hdr" style={{ display:'grid', gridTemplateColumns:'56px 1fr 160px 130px', padding:'9px 16px', fontSize:'9px', letterSpacing:'.3em', color: C.gold + '88', borderBottom:'1px solid', borderImage:`linear-gradient(90deg,${C.gold}66,${C.o400}44) 1`, marginBottom:'4px' }}>
                <span>RANK</span><span>TEAM</span><span className="fn-prog">PROGRESS</span><span style={{ textAlign:'right' }}>SCORE</span>
              </div>

              {top10.map((team, i) => {
                const rank    = i + 1
                const fnSc    = team.finaleScores || emptyScores()
                const total   = calcTotal(fnSc)
                const lbScore = calcTotal(team.scores)
                const pct     = topFn > 0 ? Math.round((total / topFn) * 100) : 0
                const isSel   = selectedId === team.id
                const mc      = [C.gold, C.silver, C.bronze]
                const ra      = rank <= 3 ? mc[rank - 1] : (rank % 2 === 0 ? C.b300 : C.o300)
                return (
                  <div key={team.id}>
                    <div className="tr fn-row-g"
                      onClick={() => setSelectedId(isSel ? null : team.id)}
                      style={{ display:'grid', gridTemplateColumns:'56px 1fr 160px 130px', padding:'14px 16px 14px 12px', marginBottom:'3px', borderRadius:'8px', border:`1px solid ${ra}2A`, borderLeft:`4px solid ${ra}`, alignItems:'center', background: isSel ? `linear-gradient(90deg,${C.gold}18,${C.o400}0A)` : rank <= 3 ? `linear-gradient(90deg,${ra}0E,${C.bg3})` : `linear-gradient(90deg,${ra}07,${C.bg})`, boxShadow: rank <= 3 ? `0 2px 14px ${ra}14` : 'none' }}>
                      <div style={{ fontFamily:"'Orbitron',monospace", fontWeight:'900', fontSize: rank <= 3 ? '17px' : '14px', color:ra, textShadow: rank <= 3 ? `0 0 14px ${ra}AA` : 'none' }} className={rank <= 3 ? 'pulse-g' : ''}>
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                      </div>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                          {team.logo && <div style={{ width: rank <= 3 ? '36px' : '26px', height: rank <= 3 ? '36px' : '26px', borderRadius:'50%', border:`2px solid ${ra}55`, background:C.bg, overflow:'hidden', flexShrink:0 }}><img src={team.logo} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', padding:'3px' }} onError={e => e.target.style.display = 'none'} /></div>}
                          <span style={{ fontSize: rank <= 3 ? '14px' : '13px', fontWeight: rank <= 3 ? '700' : '400', color: isSel ? C.gold : rank <= 3 ? '#fff' : C.text, fontFamily: rank <= 3 ? "'Orbitron',monospace" : 'inherit' }}>{team.name}</span>
                          {rank <= 3 && <span style={{ fontSize:'8px', background:`${ra}22`, color:ra, border:`1px solid ${ra}66`, padding:'2px 7px', borderRadius:'3px', fontFamily:"'Orbitron',monospace" }}>{rank === 1 ? 'CHAMPION' : rank === 2 ? '1ST RUNNER-UP' : '2ND RUNNER-UP'}</span>}
                          {rank > 3  && <span style={{ fontSize:'8px', background:`${ra}14`, color:ra, border:`1px solid ${ra}44`, padding:'1px 6px', borderRadius:'3px', fontFamily:"'Orbitron',monospace" }}>FINALIST</span>}
                        </div>
                        <div style={{ fontSize:'12px', color:C.muted, marginTop:'3px' }}><span className="gbadge">{team.group}</span></div>
                      </div>
                      <div className="fn-prog">
                        <div style={{ height:'4px', background:C.dim, borderRadius:'2px', overflow:'hidden', marginBottom:'5px' }}><div style={{ height:'100%', width:`${pct}%`, background:`linear-gradient(90deg,${ra},${ra}88)`, borderRadius:'2px' }} /></div>
                        <div style={{ display:'flex', gap:'3px' }}>
                          {CRITERIA.map(c => {
                            const s = fnSc[c.key] || 0
                            const p = Math.round((s / c.max) * 100)
                            const h = Math.round(p * 2.55).toString(16).padStart(2, '0')
                            return <div key={c.key} title={`${c.label}: ${s}/${c.max}`} style={{ width:'8px', height:'8px', borderRadius:'1px', background:`linear-gradient(to top,${C.gold}${h},${C.o400}${h})`, border:`1px solid ${C.dim}` }} />
                          })}
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontFamily:"'Orbitron',monospace", fontSize: rank <= 3 ? '17px' : '14px', fontWeight:'700', color:ra, textShadow: rank <= 3 ? `0 0 12px ${ra}77` : 'none' }}>{total}<span style={{ fontSize:'10px', color:C.muted, fontWeight:'400' }}>/{MAX_TOTAL}</span></div>
                        <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>LB <span style={{ color:C.o300, fontFamily:"'Orbitron',monospace" }}>{lbScore}</span></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </main>

      {/* ── FOOTER ── */}
      <footer style={{ position:'fixed', bottom:'12px', left:'50%', transform:'translateX(-50%)', zIndex:100, width:'calc(100% - 48px)', maxWidth:'1200px', background:`linear-gradient(180deg,${C.bg2}F2,${C.bg}F5)`, backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', boxShadow:`0 0 0 1px ${C.b400}33,0 -6px 28px #00000066`, borderRadius:'12px', border:`1px solid ${C.b400}33` }}>
        <SponsorMarquee />
        <div style={{ padding:'8px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'6px', fontSize:'10px', color:C.dim, letterSpacing:'.18em' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.o400, boxShadow:`0 0 5px ${C.o400}`, animation:'po 2s infinite' }} />
            {netErr ? <span style={{ color:'#FF7070' }}>OFFLINE</span> : <span>LIVE · {teams.length} TEAMS</span>}
          </div>
          <span style={{ background:`linear-gradient(90deg,${C.o400}77,${C.b400}77)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontFamily:"'Orbitron',monospace", fontSize:'8px' }}>AIFF © 2025</span>
          <span>MAX {MAX_TOTAL} PTS</span>
        </div>
      </footer>
    </div>
  )
}
