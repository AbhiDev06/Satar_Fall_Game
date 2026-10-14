const cv = document.getElementById("game");
const ctx = cv.getContext("2d");
const W = cv.width, H = cv.height;
const $ = id => document.getElementById(id);

let best = 0;
try { best = Number(localStorage.getItem("starfall-best")) || 0; } catch (e) { }

const keys = {};
let G = null, running = false, paused = false, last = 0;
let pointer = null;
const stars = [...Array(80)].map(() => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + .5 }));
const POWER = { rapid: "#fbbf24", shield: "#22d3ee", life: "#fb7185" };

/* ---------- Setup ---------- */
function reset() {
    G = {
        score: 0, lives: 3, wave: 0, banner: 0, boss: false,
        p: { x: W / 2, y: H - 70, w: 30, h: 30, cool: 0, inv: 0, shield: 0, rapid: 0 },
        b: [], eb: [], en: [], pw: [], pt: [], toSpawn: 0, spawnT: 0
    };
    nextWave();
    hud();
}

function nextWave() {
    G.wave++;
    G.banner = 2;
    G.boss = G.wave % 5 === 0;
    G.toSpawn = G.boss ? 1 : 5 + G.wave * 2;
    G.spawnT = 1;
    hud();
}

function hud() {
    $("score").textContent = G.score;
    $("lives").textContent = G.lives;
    $("wave").textContent = G.wave;
    $("best").textContent = best;
}

/* ---------- Spawning ---------- */
function spawn() {
    if (G.boss) {
        const hp = 40 + G.wave * 4;
        G.en.push({ t: 3, x: W / 2, y: -60, w: 90, h: 56, hp, max: hp, vx: 80, fire: 1, score: 1000 });
        return;
    }
    const r = Math.random();
    let t = 0;
    if (G.wave > 1 && r > .6) t = 1;
    if (G.wave > 2 && r > .85) t = 2;
    const x = 30 + Math.random() * (W - 60);
    const e = { t, x, x0: x, y: -30, w: 28, h: 28, hp: 1, vy: 90 + G.wave * 6, ph: Math.random() * 6, fire: 1 + Math.random() * 2, score: 100 };
    if (t === 1) e.score = 150;
    if (t === 2) { e.hp = 4; e.w = 40; e.h = 40; e.vy = 50; e.score = 300; }
    G.en.push(e);
}

/* ---------- Helpers ---------- */
function boom(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 160;
        G.pt.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .5 + Math.random() * .4, color });
    }
}
const hit = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

function hurt() {
    const p = G.p;
    if (p.inv > 0) return;
    if (p.shield > 0) { p.shield = 0; p.inv = 1; boom(p.x, p.y, "#22d3ee", 14); return; }
    G.lives--;
    p.inv = 1.8;
    boom(p.x, p.y, "#fb7185", 26);
    hud();
    if (G.lives <= 0) gameOver();
}

function kill(e) {
    G.score += e.score;
    boom(e.x, e.y, e.t === 3 ? "#fbbf24" : "#fb7185", e.t === 3 ? 60 : 16);
    if (e.t !== 3 && Math.random() < .13) {
        const kinds = ["rapid", "shield", "life"];
        G.pw.push({ x: e.x, y: e.y, w: 20, h: 20, kind: kinds[Math.floor(Math.random() * 3)] });
    }
    hud();
}

/* ---------- Update ---------- */
function update(dt) {
    const p = G.p;

    // movement
    const speed = 320;
    if (keys.ArrowLeft || keys.a) p.x -= speed * dt;
    if (keys.ArrowRight || keys.d) p.x += speed * dt;
    if (keys.ArrowUp || keys.w) p.y -= speed * dt;
    if (keys.ArrowDown || keys.s) p.y += speed * dt;
    if (pointer) {
        p.x += (pointer.x - p.x) * Math.min(1, dt * 14);
        p.y += (pointer.y - 30 - p.y) * Math.min(1, dt * 14);
    }
    p.x = Math.max(20, Math.min(W - 20, p.x));
    p.y = Math.max(H * .45, Math.min(H - 30, p.y));
    p.inv -= dt; p.shield = p.shield > 0 ? p.shield - dt : 0; p.rapid = Math.max(0, p.rapid - dt);

    // auto fire
    p.cool -= dt;
    if (p.cool <= 0) {
        p.cool = p.rapid > 0 ? .14 : .27;
        const spread = p.rapid > 0 ? [-.2, 0, .2] : [0];
        spread.forEach(a => G.b.push({ x: p.x, y: p.y - 18, vx: Math.sin(a) * 500, vy: -560, w: 4, h: 14 }));
    }

    // waves
    if (G.banner > 0) G.banner -= dt;
    else if (G.toSpawn > 0) {
        G.spawnT -= dt;
        if (G.spawnT <= 0) { spawn(); G.toSpawn--; G.spawnT = Math.max(.35, .95 - G.wave * .04); }
    } else if (G.en.length === 0) nextWave();

    // enemies
    G.en.forEach(e => {
        if (e.t === 3) {
            e.y = Math.min(e.y + 60 * dt, 90);
            e.x += e.vx * dt;
            if (e.x < 60 || e.x > W - 60) e.vx *= -1;
            e.fire -= dt;
            if (e.fire <= 0) {
                e.fire = .9;
                for (let a = -2; a <= 2; a++) G.eb.push({ x: e.x, y: e.y + 30, vx: a * 60, vy: 200, w: 8, h: 8 });
            }
            return;
        }
        e.ph += dt * 3;
        e.y += e.vy * dt;
        if (e.t === 1) e.x = e.x0 + Math.sin(e.ph) * 70;
        if (e.t === 2) {
            e.fire -= dt;
            if (e.fire <= 0) { e.fire = 1.6; G.eb.push({ x: e.x, y: e.y + 20, vx: 0, vy: 230, w: 8, h: 8 }); }
        }
    });

    // move projectiles and effects
    G.b.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
    G.eb.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
    G.pw.forEach(o => { o.y += 90 * dt; });
    G.pt.forEach(o => { o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt; });
    stars.forEach(s => { s.y += s.s * 40 * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });

    // collisions
    G.b.forEach(b => {
        G.en.forEach(e => {
            if (!b.dead && e.hp > 0 && hit(b, e)) {
                b.dead = true; e.hp--;
                boom(b.x, b.y, "#fff", 3);
                if (e.hp <= 0) kill(e);
            }
        });
    });
    G.eb.forEach(b => { if (hit(b, p)) { b.dead = true; hurt(); } });
    G.en.forEach(e => { if (e.hp > 0 && hit(e, { x: p.x, y: p.y, w: 22, h: 22 })) { if (e.t !== 3) { e.hp = 0; kill(e); } hurt(); } });
    G.pw.forEach(o => {
        if (hit(o, p)) {
            o.dead = true;
            if (o.kind === "life") { G.lives = Math.min(5, G.lives + 1); hud(); }
            if (o.kind === "shield") p.shield = 8;
            if (o.kind === "rapid") p.rapid = 8;
        }
    });

    // cleanup
    G.b = G.b.filter(b => !b.dead && b.y > -20 && b.x > -20 && b.x < W + 20);
    G.eb = G.eb.filter(b => !b.dead && b.y < H + 20 && b.x > -20 && b.x < W + 20);
    G.en = G.en.filter(e => e.hp > 0 && e.y < H + 50);
    G.pw = G.pw.filter(o => !o.dead && o.y < H + 20);
    G.pt = G.pt.filter(o => o.life > 0);
}

/* ---------- Drawing ---------- */
function draw() {
    ctx.fillStyle = "#02030d";
    ctx.fillRect(0, 0, W, H);
    stars.forEach(s => { ctx.fillStyle = "rgba(255,255,255," + (0.3 + s.s / 3) + ")"; ctx.fillRect(s.x, s.y, s.s, s.s); });

    const p = G.p;
    // player ship
    if (G.lives > 0 && (p.inv <= 0 || Math.floor(p.inv * 12) % 2 === 0)) {
        ctx.fillStyle = "#22d3ee";
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 20); ctx.lineTo(p.x + 17, p.y + 16); ctx.lineTo(p.x, p.y + 8); ctx.lineTo(p.x - 17, p.y + 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath(); ctx.moveTo(p.x - 5, p.y + 11); ctx.lineTo(p.x, p.y + 20 + Math.random() * 8); ctx.lineTo(p.x + 5, p.y + 11); ctx.fill();
        if (p.shield > 0) { ctx.strokeStyle = "rgba(34,211,238,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, 7); ctx.stroke(); }
    }

    // bullets
    ctx.fillStyle = "#fde68a";
    G.b.forEach(b => ctx.fillRect(b.x - 2, b.y - 7, 4, 14));
    ctx.fillStyle = "#fb7185";
    G.eb.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill(); });

    // enemies
    G.en.forEach(e => {
        ctx.fillStyle = ["#fb7185", "#c084fc", "#f97316", "#a3e635"][e.t];
        ctx.beginPath();
        if (e.t === 3) {
            ctx.rect(e.x - 45, e.y - 20, 90, 40);
            ctx.fill();
            ctx.fillStyle = "#1e1b4b"; ctx.fillRect(e.x - 30, e.y - 8, 60, 10);
            ctx.fillStyle = "#334155"; ctx.fillRect(e.x - 45, e.y - 34, 90, 6);
            ctx.fillStyle = "#a3e635"; ctx.fillRect(e.x - 45, e.y - 34, 90 * (e.hp / e.max), 6);
        } else {
            ctx.moveTo(e.x, e.y + e.h / 2); ctx.lineTo(e.x + e.w / 2, e.y - e.h / 2); ctx.lineTo(e.x - e.w / 2, e.y - e.h / 2); ctx.closePath(); ctx.fill();
        }
    });

    // power-ups and particles
    G.pw.forEach(o => {
        ctx.fillStyle = POWER[o.kind];
        ctx.beginPath(); ctx.arc(o.x, o.y, 10, 0, 7); ctx.fill();
        ctx.fillStyle = "#050816"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(o.kind[0].toUpperCase(), o.x, o.y + 4);
    });
    G.pt.forEach(o => { ctx.globalAlpha = Math.max(0, o.life * 2); ctx.fillStyle = o.color; ctx.fillRect(o.x, o.y, 3, 3); });
    ctx.globalAlpha = 1;

    // banner and status
    if (G.banner > 0) {
        ctx.fillStyle = "#e6ecff"; ctx.font = "bold 34px Segoe UI, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(G.boss ? "BOSS INCOMING" : "WAVE " + G.wave, W / 2, H / 3);
    }
    ctx.font = "13px Segoe UI, sans-serif"; ctx.textAlign = "left";
    if (p.rapid > 0) { ctx.fillStyle = POWER.rapid; ctx.fillText("Rapid " + p.rapid.toFixed(1) + "s", 10, H - 12); }
    if (p.shield > 0) { ctx.fillStyle = POWER.shield; ctx.fillText("Shield " + p.shield.toFixed(1) + "s", 100, H - 12); }
}

/* ---------- Loop and state ---------- */
function loop(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, .05);
    last = t;
    if (!paused) update(dt);
    draw();
    requestAnimationFrame(loop);
}

function showOverlay(title, text, btn) {
    $("ovTitle").textContent = title;
    $("ovText").textContent = text;
    $("startBtn").textContent = btn;
    $("overlay").classList.remove("hidden");
}

function start() {
    reset();
    paused = false;
    running = true;
    $("overlay").classList.add("hidden");
    last = performance.now();
    requestAnimationFrame(loop);
}

function gameOver() {
    running = false;
    const isBest = G.score > best;
    if (isBest) {
        best = G.score;
        try { localStorage.setItem("starfall-best", best); } catch (e) { }
    }
    hud();
    showOverlay("Game over", "Score " + G.score + " on wave " + G.wave + (isBest ? ". New best score!" : "."), "Play again");
}

function togglePause() {
    if (!running) return;
    paused = !paused;
    $("pauseBtn").textContent = paused ? "Resume" : "Pause";
    if (paused) showOverlay("Paused", "Take a breath, pilot.", "Resume");
    else $("overlay").classList.add("hidden");
}

$("startBtn").addEventListener("click", () => { if (paused) togglePause(); else start(); });
$("pauseBtn").addEventListener("click", togglePause);
$("resetBestBtn").addEventListener("click", () => {
    best = 0;

    try {
        localStorage.removeItem("starfall-best");
    } catch (e) {
        // Storage may be unavailable.
    }

    $("best").textContent = best;
});

document.addEventListener("keydown", e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = true;
    if (k === "p" || k === "Escape") togglePause();
    if (k.startsWith("Arrow") || k === " ") e.preventDefault();
});
document.addEventListener("keyup", e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });

function setPointer(e) {
    const r = cv.getBoundingClientRect();
    pointer = { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); setPointer(e); });
cv.addEventListener("pointermove", e => { if (e.pointerType === "mouse" || e.buttons) setPointer(e); });
cv.addEventListener("pointerup", () => { pointer = null; });
cv.addEventListener("pointerleave", () => { pointer = null; });

// initial screen
G = { score: 0, lives: 3, wave: 1, banner: 0, p: { x: W / 2, y: H - 70, shield: 0, rapid: 0, inv: 0 }, b: [], eb: [], en: [], pw: [], pt: [] };
hud();
draw();