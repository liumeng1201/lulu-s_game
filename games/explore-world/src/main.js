import Phaser from "phaser";
import worldMapUrl from "../assets/village-map-v2.png";
import characterAtlasUrl from "../assets/player-sprites-v2.png";
import { AREAS, LOCATIONS, WORLD_SCENE } from "./world-data.js";
import { SAVE_KEY, DEFAULT_SAVE, validateExploreSave } from "./save-system.js";
import { startPlayLimit } from "../../../assets/js/play-limit.js";
import { createVersionedGameStore, showSaveConflict } from "../../../assets/js/safe-storage.js";

const WIDTH = 1280;
const HEIGHT = 720;
const TILE = 32;
const WALK_SPEED = 230;
const ui = Object.fromEntries(["sceneTitle", "sceneHint", "saveStatus", "soundButton", "dialogue", "dialogueName", "dialogueAvatar", "dialogueText"].map((id) => [id, document.querySelector(`#${id}`)]));
const gameStore = createVersionedGameStore({ key: SAVE_KEY, validate: validateExploreSave, storage: localStorage, sessionStorage, onConflict: showSaveConflict });
const roleTints = { family: 0xffd6b0, teacher: 0xffd37a, student: 0xaed8ff, doctor: 0xb8e7dc, nurse: 0xffc9d5, patient: 0xd9c8ff, cashier: 0xffd08d, staff: 0xbbe09b, customer: 0xe7c3a2 };
let soundOn = true;
let activeScene;
let audioContext;
let dialogueTimer;

function loadExploreSave() { return gameStore.load() ?? { ...DEFAULT_SAVE }; }
function saveExplorePosition(sceneId, x, y) { return gameStore.save({ version: 4, sceneId, x: Math.round(x), y: Math.round(y), updatedAt: Date.now() }); }

function tone(frequency = 420, duration = .1) {
  if (!soundOn) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain();
  oscillator.type = "square"; oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.035, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}

function setUi(title, hint) { ui.sceneTitle.textContent = title; ui.sceneHint.textContent = hint; }

function showDialogue(npc) {
  clearInterval(dialogueTimer);
  ui.dialogueName.textContent = npc.name;
  ui.dialogueAvatar.style.backgroundImage = `url(${characterAtlasUrl})`;
  ui.dialogueAvatar.style.backgroundPosition = `${(npc.frame % 4) * 33.333}% ${Math.floor(npc.frame / 4) * 33.333}%`;
  ui.dialogueAvatar.style.filter = `sepia(.15) hue-rotate(${npc.hue}deg)`;
  const line = Phaser.Utils.Array.GetRandom(npc.lines);
  ui.dialogueText.textContent = "";
  ui.dialogue.showModal();
  let index = 0;
  dialogueTimer = setInterval(() => {
    ui.dialogueText.textContent = line.slice(0, ++index);
    if (index >= line.length) clearInterval(dialogueTimer);
  }, 28);
  tone(610, .08);
}

function cropCharacter(sprite, direction = 0, frame = 0) {
  const source = sprite.texture.getSourceImage();
  const cellWidth = source.width / 4; const cellHeight = source.height / 4;
  sprite.setCrop(frame * cellWidth, direction * cellHeight, cellWidth, cellHeight);
}

function makePerson(scene, x, y, { scale = 1, tint, frame = 0 } = {}) {
  const shadow = scene.add.rectangle(0, 40 * scale, 48 * scale, 12 * scale, 0x34283c, .2);
  const sprite = scene.add.image(0, 0, "characters").setDisplaySize(92 * scale, 118 * scale);
  cropCharacter(sprite, 0, frame);
  if (tint) sprite.setTint(tint);
  const person = scene.add.container(x, y, [shadow, sprite]).setSize(92 * scale, 118 * scale);
  return person.setData("sprite", sprite).setData("direction", 0).setData("walkFrame", 0);
}

function facePerson(person, dx, dy, moving, time = 0) {
  let direction = person.getData("direction") ?? 0;
  if (Math.abs(dx) > Math.abs(dy)) direction = dx < 0 ? 1 : 2;
  else if (Math.abs(dy) > 0) direction = dy < 0 ? 3 : 0;
  const frame = moving ? 1 + Math.floor(time / 150) % 3 : 0;
  person.setData("direction", direction).setData("walkFrame", frame);
  cropCharacter(person.getData("sprite"), direction, frame);
}

function addPixelRect(scene, x, y, width, height, color, stroke = 0x4d3b38) {
  return scene.add.rectangle(x, y, width, height, color).setStrokeStyle(4, stroke);
}

function drawFurniture(scene, kind, x, y) {
  const group = scene.add.container(x, y).setDepth(y);
  const rect = (ox, oy, w, h, color, stroke) => group.add(addPixelRect(scene, ox, oy, w, h, color, stroke));
  if (["plant"].includes(kind)) { rect(0, 12, 42, 36, 0x9a633d); rect(-12, -18, 22, 44, 0x4c9a55, 0x32683c); rect(13, -26, 24, 48, 0x69b85d, 0x32683c); }
  else if (["sofa", "bench"].includes(kind)) { rect(0, 0, kind === "sofa" ? 150 : 130, 64, kind === "sofa" ? 0x6f9f8e : 0xb88458); rect(0, 26, 168, 18, 0x4e6f65); }
  else if (["bookshelf", "shelf", "cooler"].includes(kind)) { rect(0, 0, 118, 106, kind === "cooler" ? 0x9ecbd0 : 0x96613f); [-30,0,30].forEach((ox,i)=>rect(ox,-8,18,62,[0xe67451,0x69a4a7,0xe8c267][i])); }
  else if (["desk", "counter", "reception"].includes(kind)) { rect(0, 12, 126, 62, 0xb97843); rect(0, -22, 140, 18, 0xe0a65b); }
  else if (kind === "bed") { rect(0, 8, 150, 76, 0xf2eee0); rect(-52, -8, 38, 42, 0xbadbd5); }
  else if (["notice-board", "map-board", "window"].includes(kind)) { rect(0, -20, 130, 78, kind === "window" ? 0x8fd0d2 : 0x5f805f); rect(0, -20, 6, 78, 0xf5e4b8); }
  else if (["toy-box", "shoe-rack", "basket", "cart"].includes(kind)) { rect(0, 12, 94, 54, 0xd18b45); rect(0, -18, 74, 16, 0xefbd61); }
  else if (kind === "coat-rack") { rect(0, 0, 16, 112, 0x76513b); rect(0, -45, 76, 14, 0x76513b); }
  else if (kind === "cabinet") { rect(0, 0, 96, 112, 0xd9e5d5); rect(0, 0, 4, 100, 0x668b82); }
  else if (kind === "produce") { rect(0, 14, 118, 52, 0xb9753f); [-34,0,34].forEach((ox,i)=>rect(ox,-18,25,25,[0xe8564a,0x73a84e,0xe8bd4a][i],0x5f4934)); }
  else { rect(0, 0, 100, 70, 0xb97b4c); }
  return group;
}

class BootScene extends Phaser.Scene {
  constructor() { super("boot"); }
  preload() { this.load.image("world-map", worldMapUrl); this.load.image("characters", characterAtlasUrl); }
  create() {
    this.textures.get("characters").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("world-map").setFilter(Phaser.Textures.FilterMode.NEAREST);
    const save = loadExploreSave(); const target = save.sceneId === WORLD_SCENE || AREAS[save.sceneId] ? save.sceneId : "home-living";
    this.scene.start(target === WORLD_SCENE ? WORLD_SCENE : "area", { areaId: target, saved: save });
  }
}

class WorldMapScene extends Phaser.Scene {
  constructor() { super(WORLD_SCENE); }
  create() {
    activeScene = this; setUi("青芽镇地图", "选择一个地点开始今天的探索");
    this.add.image(WIDTH / 2, HEIGHT / 2, "world-map").setDisplaySize(WIDTH, HEIGHT);
    addPixelRect(this, WIDTH / 2, 47, 430, 62, 0x493a58, 0xf3d47d);
    this.add.text(WIDTH / 2, 47, "青 芽 镇 · 今日去哪里？", { fontFamily: '"Microsoft YaHei", monospace', fontSize: "24px", fontStyle: "bold", color: "#fff5ce" }).setOrigin(.5);
    Object.values(LOCATIONS).forEach((location) => {
      const { x, y } = location.mapPosition;
      const marker = this.add.container(x, y).setSize(210, 120).setInteractive({ useHandCursor: true });
      const bg = addPixelRect(this, 0, 0, 174, 54, 0xfff3cf, location.color); const label = this.add.text(0, 0, location.name, { fontFamily: '"Microsoft YaHei", monospace', fontSize: "22px", fontStyle: "bold", color: "#44354e" }).setOrigin(.5);
      marker.add([bg, label]);
      marker.on("pointerover", () => this.tweens.add({ targets: marker, y: y - 8, duration: 100 }));
      marker.on("pointerout", () => this.tweens.add({ targets: marker, y, duration: 100 }));
      marker.on("pointerup", () => { tone(520); this.scene.start("area", { areaId: location.hub }); });
    });
    saveExplorePosition(WORLD_SCENE, WIDTH / 2, HEIGHT / 2);
  }
}

class AreaScene extends Phaser.Scene {
  constructor() { super("area"); }
  init(data) { this.areaId = data.areaId || "home-living"; this.saved = data.saved; this.lastSavedAt = 0; this.wasKeyboardMoving = false; }
  create() {
    activeScene = this; this.area = AREAS[this.areaId]; const location = LOCATIONS[this.area.location];
    setUi(`${location.name} · ${this.area.name}`, "方向键 / WASD / 点击移动，点击人物交谈");
    this.drawRoom(); this.createDoors(); this.createNpcs();
    const savedHere = this.saved?.sceneId === this.areaId;
    const x = savedHere ? Phaser.Math.Clamp(this.saved.x, 105, WIDTH - 105) : WIDTH / 2;
    const y = savedHere ? Phaser.Math.Clamp(this.saved.y, 275, HEIGHT - 78) : 520;
    this.player = makePerson(this, x, y, { scale: 1.02 }).setDepth(y + 20).setData("isPlayer", true);
    this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT");
    this.input.on("pointerup", (pointer, objects) => {
      if (ui.dialogue.open || objects.some((object) => object.getData?.("interactiveRole"))) return;
      this.movePlayer(pointer.worldX, pointer.worldY);
    });
    this.time.addEvent({ delay: 1900, loop: true, callback: () => this.moveNpcs() });
    this.showAreaTitle(`${location.name} · ${this.area.name}`); saveExplorePosition(this.areaId, x, y);
  }

  drawRoom() {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, this.area.palette[0]);
    this.add.rectangle(WIDTH / 2, 105, WIDTH, 210, this.area.palette[0]);
    for (let y = 210; y < HEIGHT; y += TILE) for (let x = 0; x < WIDTH; x += TILE) this.add.rectangle(x + TILE / 2, y + TILE / 2, TILE, TILE, (x / TILE + y / TILE) % 2 ? this.area.palette[1] : Phaser.Display.Color.IntegerToColor(this.area.palette[1]).brighten(8).color);
    this.add.rectangle(WIDTH / 2, 210, WIDTH, 20, 0x68473c).setStrokeStyle(4, 0x463038);
    [205, 640, 1075].forEach((x) => { addPixelRect(this, x, 100, 160, 94, 0x8fc9cb, 0xf8df9d); this.add.rectangle(x, 100, 8, 90, 0xf8df9d); });
    addPixelRect(this, WIDTH / 2, 430, 350, 190, 0xd6a05e, 0x9d6742).setAlpha(.68);
    const spots = [[150,310],[1080,315],[220,585],[1030,580],[640,300]];
    this.area.furniture.forEach((kind, index) => drawFurniture(this, kind, ...spots[index % spots.length]));
  }

  showAreaTitle(text) {
    const card = addPixelRect(this, WIDTH / 2, 115, 360, 58, 0x493a58, 0xf2d47d).setDepth(1000);
    const label = this.add.text(WIDTH / 2, 115, text, { fontFamily: '"Microsoft YaHei", monospace', fontSize: "24px", fontStyle: "bold", color: "#fff6d6" }).setOrigin(.5).setDepth(1001);
    this.tweens.add({ targets: [card, label], alpha: 0, delay: 1250, duration: 450, onComplete: () => { card.destroy(); label.destroy(); } });
  }

  createDoors() {
    const doors = this.area.type === "hub"
      ? [{ x: WIDTH - 82, label: this.area.nextLabel, target: this.area.next }, { x: 82, label: "世界地图", target: WORLD_SCENE }]
      : [{ x: 82, label: this.area.backLabel, target: this.area.back }];
    doors.forEach((door) => {
      const container = this.add.container(door.x, 390).setDepth(410).setSize(118, 180).setInteractive({ useHandCursor: true }).setData("interactiveRole", "door");
      const frame = addPixelRect(this, 0, 0, 106, 166, 0x6f4938, 0x3d3032); const panel = addPixelRect(this, 0, 7, 72, 128, 0xc9834c, 0x4d3534);
      const sign = this.add.text(0, 112, door.label, { fontFamily: '"Microsoft YaHei", monospace', fontSize: "15px", fontStyle: "bold", color: "#fff2c1", backgroundColor: "#493a58", padding: { x: 7, y: 4 } }).setOrigin(.5);
      container.add([frame, panel, sign]);
      container.on("pointerup", (_p, _x, _y, event) => { event.stopPropagation(); tone(470); saveExplorePosition(this.areaId, this.player.x, this.player.y); this.scene.start(door.target === WORLD_SCENE ? WORLD_SCENE : "area", door.target === WORLD_SCENE ? undefined : { areaId: door.target }); });
    });
  }

  createNpcs() {
    const count = this.area.npcs.length; const columns = Math.min(6, Math.ceil(Math.sqrt(count)));
    this.npcs = this.area.npcs.map((npc, index) => {
      const x = 300 + (index % columns) * (680 / Math.max(1, columns - 1)); const y = 350 + Math.floor(index / columns) * 150;
      const frame = index % 4; const hue = (index * 37 + 20) % 150;
      const person = makePerson(this, x, Math.min(y, 620), { scale: .88, tint: roleTints[npc.role] ?? 0xffffff, frame }).setDepth(y).setInteractive({ useHandCursor: true });
      const dialogueNpc = { ...npc, frame, hue };
      const prompt = addPixelRect(this, 0, -72, 28, 28, 0xfff0a3, 0x493a58); const mark = this.add.text(0, -73, "!", { fontFamily: "monospace", fontSize: "20px", fontStyle: "bold", color: "#493a58" }).setOrigin(.5);
      person.add([prompt, mark]).setData("interactiveRole", "npc").setData("npc", dialogueNpc).setData("home", { x, y: Math.min(y, 620) });
      person.on("pointerup", (_p, _x, _y, event) => { event.stopPropagation(); showDialogue(dialogueNpc); });
      return person;
    });
  }

  moveNpcs() {
    if (ui.dialogue.open) return;
    this.npcs.forEach((npc, index) => {
      if (Math.random() > .55) return;
      const home = npc.getData("home"); const radius = ["student", "customer"].includes(npc.getData("npc").role) ? 68 : 38;
      const targetX = Phaser.Math.Clamp(home.x + Phaser.Math.Between(-radius, radius), 190, WIDTH - 190); const targetY = Phaser.Math.Clamp(home.y + Phaser.Math.Between(-35, 35), 290, HEIGHT - 74);
      facePerson(npc, targetX - npc.x, targetY - npc.y, true, index * 170);
      this.tweens.add({ targets: npc, x: targetX, y: targetY, duration: 850 + index * 25, ease: "Sine.easeInOut", onUpdate: () => npc.setDepth(npc.y), onComplete: () => facePerson(npc, 0, 0, false) });
    });
  }

  movePlayer(x, y) {
    const targetX = Phaser.Math.Clamp(x, 105, WIDTH - 105); const targetY = Phaser.Math.Clamp(y, 270, HEIGHT - 72);
    this.tweens.killTweensOf(this.player); const dx = targetX - this.player.x; const dy = targetY - this.player.y;
    const duration = Math.max(180, Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY) * 2.4);
    facePerson(this.player, dx, dy, true);
    this.tweens.add({ targets: this.player, x: targetX, y: targetY, duration, ease: "Linear", onUpdate: (_t, target) => { facePerson(this.player, dx, dy, true, performance.now()); target.setDepth(target.y + 20); }, onComplete: () => { facePerson(this.player, 0, 0, false); this.persistPosition(); } });
    ui.saveStatus.textContent = "行走中…"; tone(290, .06);
  }

  persistPosition() {
    saveExplorePosition(this.areaId, this.player.x, this.player.y); ui.saveStatus.textContent = "已自动保存"; this.lastSavedAt = this.time.now;
  }

  update(time, delta) {
    if (!this.player || ui.dialogue.open) return;
    const left = this.keys.A.isDown || this.keys.LEFT.isDown; const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
    const up = this.keys.W.isDown || this.keys.UP.isDown; const down = this.keys.S.isDown || this.keys.DOWN.isDown;
    let dx = Number(right) - Number(left); let dy = Number(down) - Number(up);
    if (!dx && !dy) {
      if (this.wasKeyboardMoving) {
        this.wasKeyboardMoving = false; facePerson(this.player, 0, 0, false); this.persistPosition();
      }
      return;
    }
    this.wasKeyboardMoving = true;
    this.tweens.killTweensOf(this.player); const length = Math.hypot(dx, dy); dx /= length; dy /= length;
    this.player.x = Phaser.Math.Clamp(this.player.x + dx * WALK_SPEED * delta / 1000, 105, WIDTH - 105);
    this.player.y = Phaser.Math.Clamp(this.player.y + dy * WALK_SPEED * delta / 1000, 270, HEIGHT - 72);
    this.player.setDepth(this.player.y + 20); facePerson(this.player, dx, dy, true, time); ui.saveStatus.textContent = "正在探索…";
    if (time - this.lastSavedAt > 900) this.persistPosition();
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO, parent: "game", width: WIDTH, height: HEIGHT, backgroundColor: "#354f48",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 2 },
  render: { antialias: false, pixelArt: true, roundPixels: true }, scene: [BootScene, WorldMapScene, AreaScene],
});

function saveCurrentPosition() { if (activeScene?.player) saveExplorePosition(activeScene.areaId, activeScene.player.x, activeScene.player.y); }
function lockGame() { saveCurrentPosition(); game.loop.sleep(); }
function resumeGameAfterLimit() { game.loop.wake(); }

ui.dialogue.addEventListener("close", () => clearInterval(dialogueTimer));
ui.soundButton.addEventListener("click", () => { soundOn = !soundOn; ui.soundButton.textContent = soundOn ? "🔊" : "🔇"; ui.soundButton.setAttribute("aria-label", soundOn ? "关闭声音" : "打开声音"); });
window.addEventListener("pagehide", saveCurrentPosition); window.addEventListener("beforeunload", saveCurrentPosition);
startPlayLimit({ onLock: lockGame, onResume: resumeGameAfterLimit });
export { game };
