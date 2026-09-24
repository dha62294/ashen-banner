const terrain = [
  'p p f p r r p p', 'p f f p r p p p', 'p p p p r p f p', 'w w p f p p f p',
  'p r p f p p p p', 'p r p p f p f p', 'p p p p p p f p', 'p p p p p p p p'
].map(row => row.split(' '));
const terrainName = { p:'Plain', f:'Forest', r:'Road', w:'Water' };
const baseUnits = [
  {id:'a',team:'player',name:'Arlen',role:'Banner Guard',symbol:'A',x:1,y:6,hp:22,max:22,atk:8,def:4,move:3},
  {id:'b',team:'player',name:'Bryn',role:'River Scout',symbol:'B',x:2,y:5,hp:17,max:17,atk:6,def:2,move:4},
  {id:'c',team:'player',name:'Cira',role:'Wind Adept',symbol:'C',x:0,y:7,hp:14,max:14,atk:9,def:1,move:3},
  {id:'d',team:'enemy',name:'Hark',role:'Raider Captain',symbol:'H',x:6,y:1,hp:24,max:24,atk:8,def:3,move:3},
  {id:'e',team:'enemy',name:'Moro',role:'Axe Raider',symbol:'M',x:6,y:4,hp:18,max:18,atk:7,def:2,move:3},
  {id:'f',team:'enemy',name:'Siv',role:'Axe Raider',symbol:'S',x:7,y:6,hp:18,max:18,atk:7,def:2,move:3}
];

let units, selected, phase, round, logs, locked;
const board = document.querySelector('#board');
const unitCard = document.querySelector('#unit-card');
const logEl = document.querySelector('#log');
const turnEl = document.querySelector('#turn');
const roundEl = document.querySelector('#round');
const modal = document.querySelector('#modal');
const alive = () => units.filter(unit => unit.hp > 0);
const at = (x, y) => alive().find(unit => unit.x === x && unit.y === y);
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function reset() {
  units = baseUnits.map(unit => ({...unit, moved:false})); selected = null; phase = 'player'; round = 1;
  logs = ['The vanguard reaches the River Road.']; locked = false; modal.classList.remove('show'); render();
}
function tileCost(x, y) { return terrain[y][x] === 'w' || at(x, y) ? 99 : terrain[y][x] === 'f' ? 2 : 1; }
function defense(unit) { return unit.def + (terrain[unit.y][unit.x] === 'f' ? 1 : 0); }
function log(message) { logs.unshift(message); logs = logs.slice(0, 5); }
function reachable(unit) {
  const seen = new Map([[`${unit.x},${unit.y}`, 0]]); const queue = [[unit.x, unit.y, 0]];
  while (queue.length) {
    const [x, y, cost] = queue.shift();
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
      const nextX = x + dx, nextY = y + dy;
      if (nextX < 0 || nextY < 0 || nextX > 7 || nextY > 7) return;
      const nextCost = cost + tileCost(nextX, nextY), key = `${nextX},${nextY}`;
      if (nextCost <= unit.move && (!seen.has(key) || nextCost < seen.get(key))) { seen.set(key, nextCost); queue.push([nextX, nextY, nextCost]); }
    });
  }
  return seen;
}
function render() {
  board.innerHTML = ''; const moves = selected && phase === 'player' && !selected.moved ? reachable(selected) : new Map();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const unit = at(x, y), button = document.createElement('button'), key = `${x},${y}`;
    button.className = `cell ${terrainName[terrain[y][x]].toLowerCase()} ${unit ? unit.team === 'player' ? 'friendly' : 'enemy' : ''}`;
    button.dataset.symbol = unit ? unit.symbol : '';
    button.setAttribute('aria-label', unit ? `${unit.name}, ${unit.team}, ${unit.hp} health, on ${terrainName[terrain[y][x]]}` : `${terrainName[terrain[y][x]]}, row ${y + 1} column ${x + 1}`);
    if (selected?.x === x && selected?.y === y) button.classList.add('selected');
    if (!unit && moves.has(key) && key !== `${selected.x},${selected.y}`) button.classList.add('reachable');
    if (unit && selected && unit.team !== selected.team && distance(selected, unit) === 1) button.classList.add('target');
    button.onclick = () => clickTile(x, y); board.appendChild(button);
  }
  turnEl.textContent = phase === 'player' ? 'PLAYER PHASE' : 'RAIDER PHASE'; roundEl.textContent = `ROUND ${round}`;
  renderCard(); logEl.innerHTML = logs.map(message => `<p>${message}</p>`).join('');
  document.querySelector('#end-turn').disabled = phase !== 'player' || locked;
}
function renderCard() {
  const unit = selected || alive().find(candidate => candidate.team === 'player');
  if (!unit) { unitCard.innerHTML = ''; return; }
  const bonus = terrain[unit.y][unit.x] === 'f' ? ' +1 forest' : '';
  unitCard.innerHTML = `<div class="unit-name">${unit.symbol} ${unit.name}</div><div class="unit-meta">${unit.role} · ${unit.team === 'player' ? 'Vanguard' : 'Raider'}</div><div class="bar"><span style="width:${unit.hp / unit.max * 100}%"></span></div><div class="unit-meta">HP ${unit.hp}/${unit.max}</div><div class="stats"><div class="stat">ATK <b>${unit.atk}</b></div><div class="stat">DEF <b>${defense(unit)}</b></div><div class="stat">MOV <b>${unit.move}</b></div><div class="stat">TILE <b>${terrainName[terrain[unit.y][unit.x]]}${bonus}</b></div></div>`;
}
function clickTile(x, y) {
  if (locked || phase !== 'player') return;
  const unit = at(x, y);
  if (unit?.team === 'player' && !unit.moved) { selected = unit; render(); return; }
  if (!selected) return;
  if (unit?.team === 'enemy' && distance(selected, unit) === 1) { attack(selected, unit); return; }
  const valid = reachable(selected);
  if (!unit && valid.has(`${x},${y}`) && `${x},${y}` !== `${selected.x},${selected.y}`) { selected.x = x; selected.y = y; log(`${selected.name} advances across the ${terrainName[terrain[y][x]].toLowerCase()}.`); render(); }
}
function attack(attacker, defender) {
  const damage = Math.max(1, attacker.atk - defense(defender)); defender.hp -= damage; log(`${attacker.name} strikes ${defender.name} for ${damage}.`);
  if (defender.hp <= 0) log(`${defender.name} falls.`);
  else { const counter = Math.max(1, defender.atk - defense(attacker)); attacker.hp -= counter; log(`${defender.name} counters for ${counter}.`); if (attacker.hp <= 0) log(`${attacker.name} falls.`); }
  attacker.moved = true; selected = null; checkEnd(); render();
}
function checkEnd() { const players = alive().filter(unit => unit.team === 'player'), enemies = alive().filter(unit => unit.team === 'enemy'); if (!enemies.length) finish(true); if (!players.length) finish(false); }
function finish(win) { locked = true; document.querySelector('#result-title').textContent = win ? 'VICTORY' : 'DEFEAT'; document.querySelector('#result-text').textContent = win ? 'The raiders scatter. The River Road remains open—for tonight.' : 'The banner falls. Rally the vanguard and try again.'; modal.classList.add('show'); }
async function enemyTurn() {
  phase = 'enemy'; selected = null; render(); await pause(450);
  for (const enemy of alive().filter(unit => unit.team === 'enemy')) {
    const friends = alive().filter(unit => unit.team === 'player'); if (!friends.length) break;
    const target = friends.sort((a,b) => distance(enemy,a) - distance(enemy,b))[0];
    if (distance(enemy, target) > 1) {
      const choices = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({x:enemy.x+dx,y:enemy.y+dy})).filter(choice => choice.x >= 0 && choice.y >= 0 && choice.x < 8 && choice.y < 8 && !at(choice.x,choice.y) && terrain[choice.y][choice.x] !== 'w');
      choices.sort((a,b) => (Math.abs(a.x-target.x)+Math.abs(a.y-target.y)) - (Math.abs(b.x-target.x)+Math.abs(b.y-target.y)));
      const move = choices.shift(); if (move) { enemy.x = move.x; enemy.y = move.y; }
    }
    if (distance(enemy,target) === 1 && target.hp > 0) { const damage = Math.max(1, enemy.atk - defense(target)); target.hp -= damage; log(`${enemy.name} attacks ${target.name} for ${damage}.`); if (target.hp <= 0) log(`${target.name} falls.`); }
    render(); checkEnd(); if (locked) return; await pause(300);
  }
  phase = 'player'; round++; alive().filter(unit => unit.team === 'player').forEach(unit => unit.moved = false); log('The vanguard takes the initiative.'); render();
}
document.querySelector('#end-turn').onclick = () => { if (phase === 'player' && !locked) enemyTurn(); };
document.querySelector('#restart').onclick = reset; document.querySelector('#again').onclick = reset; reset();
