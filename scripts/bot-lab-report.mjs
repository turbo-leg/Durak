import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const duel = process.argv[2] === 'duel';
const directory = duel ? 'output/bot-duel' : 'output/bot-lab';
const dataPath = resolve(directory, 'results.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const history = JSON.parse(readFileSync(resolve(directory, 'history.json'), 'utf8'));
const embedded = JSON.stringify(data).replaceAll('<', '\\u003c');
const embeddedHistory = JSON.stringify(history).replaceAll('<', '\\u003c');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${duel ? 'Durak Duel Lab' : 'Durak Bot Lab'}</title>
<style>
:root{--ink:#2b2327;--wine:#502e3b;--wine2:#694256;--paper:#f6f1e8;--card:#fffcf6;--line:#d8cbbd;--blue:#2d7795;--orange:#b65d43;--muted:#72656b}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 'Segoe UI',Arial,sans-serif}h1,h2,p{margin-top:0}
header{background:var(--wine);color:#fff8ed;padding:40px max(24px,calc((100vw - 1180px)/2));position:relative;overflow:hidden}
header:after{content:'♠';font:270px Georgia,serif;position:absolute;right:7%;top:-110px;color:#ffffff0b;pointer-events:none}
h1{font:normal clamp(42px,7vw,82px)/.95 Georgia,serif;letter-spacing:-.055em;margin:12px 0 18px}header p{max-width:680px;color:#e4d8d2;font-size:17px}
.tag{font-size:13px;color:#e5bca7;letter-spacing:.08em}.wrap{max-width:1228px;margin:auto;padding:34px 24px 80px}
.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:34px}.stat{background:var(--card);padding:19px 22px;border-top:4px solid var(--wine);box-shadow:0 2px 11px #3a25300e}.stat strong{display:block;font:normal 32px Georgia,serif}.stat span{font-size:13px;color:var(--muted)}
section{background:var(--card);border:1px solid var(--line);padding:24px;margin:18px 0}h2{font:normal 29px Georgia,serif;letter-spacing:-.03em;margin-bottom:5px}.sub{color:var(--muted);margin-bottom:22px}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}button{border:1px solid var(--line);background:transparent;color:var(--ink);padding:7px 13px;font:inherit;cursor:pointer}button.active{background:var(--wine);color:white;border-color:var(--wine)}button:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.chart{display:grid;gap:10px}.row{display:grid;grid-template-columns:minmax(130px,210px) 1fr 70px;gap:12px;align-items:center}.name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.track{height:20px;background:#efe8dd;position:relative}.track:before{content:'';position:absolute;left:var(--expected);height:100%;border-left:1px dashed #7e7476;z-index:2}.bar{height:100%;background:var(--blue)}.row.champ .bar{background:var(--wine2)}.row.finalist .bar{background:var(--orange)}.ci{height:14px;position:absolute;top:3px;border-left:2px solid #1e2428;border-right:2px solid #1e2428}.value{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}.axis{display:flex;justify-content:space-between;margin:5px 70px 0 222px;font-size:12px;color:var(--muted)}
.grid{display:grid;grid-template-columns:1.4fr 1fr;gap:18px}.callout{font-size:17px;padding:18px 20px;background:#f4ebe4;border-left:4px solid var(--orange)}.callout.pass{background:#e9f2eb;border-color:#438161}.metric{font-size:31px;font-family:Georgia,serif;margin:0}.small{font-size:13px;color:var(--muted)}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:9px 11px;border-bottom:1px solid var(--line);text-align:left}th{font-size:12px;color:var(--muted);font-weight:600}td:last-child,th:last-child{text-align:right}.heat{display:grid;grid-template-columns:100px repeat(6,minmax(28px,1fr));gap:3px;align-items:center}.heat>div{padding:8px 3px;text-align:center;font-size:13px}.heat .label{text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.heat .cell{color:#152a34}
footer{color:var(--muted);font-size:12px;margin-top:25px}a{color:var(--blue)}
@media(max-width:800px){.summary{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.row{grid-template-columns:110px 1fr 55px;gap:6px}.axis{margin-left:116px;margin-right:55px}section{padding:17px}.wrap{padding:24px 12px}}
@media(max-width:480px){.summary{grid-template-columns:1fr 1fr}.stat{padding:14px}.stat strong{font-size:24px}.row{grid-template-columns:90px 1fr 48px}.name{font-size:12px}.axis{margin-left:96px;margin-right:48px}}
</style>
</head><body>
<header><div class="tag">${duel ? 'TWO SEATS · ONE WINNER' : 'SIX SEATS · ONE WINNER'}</div><h1>${duel ? 'Durak Duel Lab' : 'Durak Bot Lab'}</h1><p>${duel ? 'Head-to-head specialists play both seats against the incumbent on reproducible decks. Fresh decks decide promotion.' : 'A tournament ledger for the Hot Potato rules. Every candidate plays all six seats against incumbent and mixed-policy tables on reproducible decks.'}</p></header>
<main class="wrap">
<div class="summary" id="summary"></div>
<section><h2>Which bot won more?</h2><p class="sub">Training uses successive halving on shared decks. Surviving candidates play more games; compare rates and intervals, not raw wins. Bars start at zero; the dashed line marks the ${duel ? '50%' : '16.7%'} equal-skill expectation. Black ticks show approximate 95% Wilson intervals.</p><p class="small" id="training-stages"></p><div class="tools" id="filters"></div><div class="chart" id="chart"></div><div class="axis">${(duel ? [0, 20, 40, 60, 70] : [0, 10, 20, 30]).map((n) => `<span>${n}%</span>`).join('')}</div></section>
<div class="grid"><section><h2>Promotion check</h2><p class="sub">A finalist faces fresh decks after selection. ${duel ? 'The incumbent plays the other seat.' : 'The incumbent plays those same decks and seats.'}</p><div id="promotion"></div></section><section><h2>Seat effects</h2><p class="sub">Wins by candidate seat in training. Darker cells mean more wins.</p><div class="heat" id="heat" style="grid-template-columns:100px repeat(${duel ? 2 : 6},minmax(28px,1fr))"></div></section></div>
${duel ? '<section><h2>Challenge readiness</h2><p class="sub">The current duel champion faces several older and contrasting bots on separate decks. Intervals show uncertainty; bot matches cannot establish human skill.</p><div id="readiness-status"></div><div style="overflow-x:auto"><table><thead><tr><th>Opponent</th><th>Wins</th><th>Games</th><th>Win rate</th><th>95% interval</th></tr></thead><tbody id="readiness"></tbody></table></div></section>' : ''}
<section><h2>All candidates</h2><p class="sub">Win rate is only one measure. Invalid moves and stalled games disqualify a candidate.${duel ? ' Training reward starts at +1 for a win or −1 for a loss, with small adjustments for final hand gap and forced pickups. Promotion still uses wins only.' : ''}</p><div style="overflow-x:auto"><table><thead><tr><th>Policy</th><th>Generation</th><th>Wins</th><th>Games</th><th>Win rate</th>${duel ? '<th>Reward / game</th><th>Pickups / game</th>' : ''}<th>Invalid</th><th>Stalls</th><th>Actions / game</th></tr></thead><tbody id="table"></tbody></table></div></section>
<section><h2>Run history</h2><p class="sub">Each run carries its champion into the next tournament. Open a saved JSON file in <code>${directory}/runs</code> for full details.</p><div style="overflow-x:auto"><table><thead><tr><th>Run</th><th>Games</th><th>Finalist</th><th>Holdout lift</th><th>Result</th></tr></thead><tbody id="history"></tbody></table></div></section>
<footer>Generated <span id="date"></span>. Seed base: <span id="seed-base"></span>; training seeds: <span id="seeds"></span>; holdout seeds: <span id="holdout-seeds"></span>. The confidence intervals are descriptive; the promotion decision uses paired differences across holdout seeds.</footer>
</main><script>const data=${embedded};const history=${embeddedHistory};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=x=>(100*x).toFixed(1)+'%';
const rate=r=>r.wins/r.games;
function wilson(r){const n=r.games,p=rate(r),z=1.96,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-h),Math.min(1,c+h)]}
const seatCount=data.players??6,axisMax=seatCount===2?.7:.3;
const total=data.rows.reduce((a,r)=>a+r.games,0)+data.holdoutSeeds*seatCount*(seatCount===2?1:2)+(data.readiness??[]).reduce((a,r)=>a+r.games,0)+(data.promoted?0:(data.finalistReadiness??[]).reduce((a,r)=>a+r.games,0));
document.getElementById('summary').innerHTML=[['Games played',total.toLocaleString()],['Candidates',data.rows.length],['Best training rate',pct(Math.max(...data.rows.map(rate)))],['Promotion',data.promoted?'New champion':'Incumbent held']].map(([a,b])=>'<div class="stat"><strong>'+esc(b)+'</strong><span>'+esc(a)+'</span></div>').join('');
if(data.trainingStages)document.getElementById('training-stages').textContent=Object.entries(data.trainingStages).map(([name,stages])=>name+': '+stages.map(s=>s.candidates+' candidates × '+s.seeds+' seeds').join(' → ')).join(' · ');
let filter='all';const filters=document.getElementById('filters');
function render(){filters.innerHTML=['all','0','1'].map(f=>'<button class="'+(filter===f?'active':'')+'" data-filter="'+f+'">'+({'all':'All candidates','0':'Generation 0','1':'Generation 1'}[f])+'</button>').join('');
const rows=[...data.rows].filter(r=>filter==='all'||String(r.generation)===filter).sort((a,b)=>rate(b)-rate(a)||a.id.localeCompare(b.id));
document.getElementById('chart').innerHTML=rows.map(r=>{const [lo,hi]=wilson(r);return '<div class="row '+(r.id===data.finalist?'finalist':r.id==='champion'||r.id==='champion-g1'||r.id==='duel-champion'||r.id==='duel-champion-g1'?'champ':'')+'"><span class="name" title="'+esc(r.id)+'">'+esc(r.id)+'</span><div class="track" style="--expected:'+100/(seatCount*axisMax)+'%"><div class="bar" style="width:'+Math.min(100,rate(r)/axisMax*100)+'%"></div><div class="ci" style="left:'+Math.min(100,lo/axisMax*100)+'%;width:'+Math.max(0,Math.min(100,hi/axisMax*100)-Math.min(100,lo/axisMax*100))+'%"></div></div><span class="value">'+pct(rate(r))+'</span></div>'}).join('');
document.getElementById('heat').innerHTML='<div></div>'+Array.from({length:seatCount},(_,i)=>'<div>'+(i+1)+'</div>').join('')+rows.slice(0,8).map(r=>'<div class="label" title="'+esc(r.id)+'">'+esc(r.id)+'</div>'+r.seatWins.map(v=>'<div class="cell" style="background:rgba(45,119,149,'+(.08+.65*v/(r.games/seatCount))+')">'+v+'</div>').join('')).join('');
document.getElementById('table').innerHTML=rows.map(r=>'<tr><td>'+esc(r.id)+'</td><td>'+r.generation+'</td><td>'+r.wins+'</td><td>'+r.games+'</td><td>'+pct(rate(r))+'</td>'+(seatCount===2?'<td>'+(r.reward===undefined?'–':(r.reward/r.games).toFixed(3))+'</td><td>'+(r.pickups===undefined?'–':(r.pickups/r.games).toFixed(2))+'</td>':'')+'<td>'+(r.invalid??0)+'</td><td>'+r.stalled+'</td><td>'+(r.actions/r.games).toFixed(1)+'</td></tr>').join('');}
filters.addEventListener('click',e=>{if(e.target.dataset.filter){filter=e.target.dataset.filter;render()}});render();
const candidate=data.holdout.reduce((a,r)=>a+r.candidateWins,0),champion=data.holdout.reduce((a,r)=>a+r.championWins,0),games=data.holdoutSeeds*seatCount;
document.getElementById('promotion').innerHTML='<div class="callout '+(data.promoted?'pass':'')+'">'+(data.promoted?'Promoted ':'Incumbent retained. ')+esc(data.finalist)+' won '+candidate+' of '+games+' holdout games; incumbent won '+champion+'.</div><p class="metric">'+(data.lift>=0?'+':'')+pct(data.lift)+' <span class="small">win-rate difference</span></p><p>95% lower bound: '+(data.lowerBound>=0?'+':'')+pct(data.lowerBound)+'. Promotion requires a positive bound, legal games'+(seatCount===2?', and at least 50% against every stress opponent':'')+'.</p>';
if(document.getElementById('readiness')){const rows=data.readiness??[];const strong=rows.length>=4&&rows.every(r=>r.stalled===0&&wilson(r)[0]>.55);document.getElementById('readiness-status').innerHTML='<div class="callout '+(strong?'pass':'')+'">'+(strong?'Bot stress target met.':'Bot stress target not met.')+' Target: a 95% lower bound above 55% against every stress opponent. A human match remains the real test.</div>';document.getElementById('readiness').innerHTML=rows.map(r=>{const [lo,hi]=wilson(r);return '<tr><td>'+esc(r.opponent)+'</td><td>'+r.wins+'</td><td>'+r.games+'</td><td>'+pct(r.wins/r.games)+'</td><td>'+pct(lo)+'–'+pct(hi)+'</td></tr>'}).join('');}
document.getElementById('history').innerHTML=history.map(r=>'<tr><td>'+esc(new Date(r.generatedAt).toLocaleString())+'</td><td>'+r.games.toLocaleString()+'</td><td>'+esc(r.finalist)+'</td><td>'+(r.lift>=0?'+':'')+pct(r.lift)+'</td><td>'+(r.promoted?'Promoted':'Held')+'</td></tr>').join('');
document.getElementById('date').textContent=new Date(data.generatedAt).toLocaleString();document.getElementById('seeds').textContent=data.seeds;document.getElementById('holdout-seeds').textContent=data.holdoutSeeds;
document.getElementById('seed-base').textContent=data.seedBase ?? 'legacy fixed seeds';
</script></body></html>`;
const target = resolve(directory, 'report.html');
writeFileSync(target, html);
console.log(`Report: ${target}`);
