import Phaser from "phaser";
import worldMapUrl from "../assets/world-map.png";
import { AREAS, LOCATIONS, WORLD_SCENE } from "./world-data.js";
import { loadSave, savePosition } from "./save-system.js";

const WIDTH = 960;
const HEIGHT = 720;
const ui = {
  title: document.querySelector("#sceneTitle"),
  hint: document.querySelector("#sceneHint"),
  save: document.querySelector("#saveStatus"),
  sound: document.querySelector("#soundButton"),
  dialogue: document.querySelector("#dialogue"),
  dialogueName: document.querySelector("#dialogueName"),
  dialogueAvatar: document.querySelector("#dialogueAvatar"),
  dialogueText: document.querySelector("#dialogueText"),
};
let soundOn = true;
let activeScene;
let audioContext;

function tone(frequency = 420) {
  if (!soundOn) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .12);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(); oscillator.stop(audioContext.currentTime + .12);
}

function showDialogue(npc) {
  ui.dialogueName.textContent = npc.name;
  ui.dialogueAvatar.textContent = npc.avatar;
  ui.dialogueText.textContent = Phaser.Utils.Array.GetRandom(npc.lines);
  ui.dialogue.showModal();
  tone(560);
}

function setUi(title, hint) {
  ui.title.textContent = title;
  ui.hint.textContent = hint;
}

class BootScene extends Phaser.Scene {
  constructor() { super("boot"); }
  preload() { this.load.image("world-map", worldMapUrl); }
  create() {
    const save = loadSave();
    const target = save.sceneId === WORLD_SCENE || AREAS[save.sceneId] ? save.sceneId : "home-living";
    this.scene.start(target === WORLD_SCENE ? WORLD_SCENE : "area", { areaId: target, saved: save });
  }
}

class WorldMapScene extends Phaser.Scene {
  constructor() { super(WORLD_SCENE); }
  create() {
    activeScene = this;
    setUi("世界地图", "点击一个地点开始探索");
    this.add.image(WIDTH / 2, HEIGHT / 2, "world-map").setDisplaySize(WIDTH, HEIGHT);
    this.add.rectangle(WIDTH/2,45,520,58,0x493080,.76).setStrokeStyle(3,0xffffff,.8);
    this.add.text(WIDTH/2,45,"今天想去哪里？",{fontFamily:'Microsoft YaHei',fontSize:'27px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
    Object.values(LOCATIONS).forEach((location) => {
      const h = location.hotspots;
      const zone = this.add.zone(h.x,h.y,h.width,h.height).setInteractive({ useHandCursor:true });
      const chip = this.add.container(h.x,h.y + h.height*.42);
      const bg = this.add.rectangle(0,0,150,48,0xffffff,.92).setStrokeStyle(4,location.color);
      const label = this.add.text(0,0,`${location.icon} ${location.name}`,{fontFamily:'Microsoft YaHei',fontSize:'20px',fontStyle:'bold',color:'#493080'}).setOrigin(.5);
      chip.add([bg,label]);
      zone.on("pointerover",()=>this.tweens.add({targets:chip,scale:1.08,duration:120}));
      zone.on("pointerout",()=>this.tweens.add({targets:chip,scale:1,duration:120}));
      zone.on("pointerup",()=>{ tone(500); this.scene.start("area",{areaId:location.hub}); });
    });
    savePosition(WORLD_SCENE, WIDTH/2, HEIGHT/2);
  }
}

function makePerson(scene, x, y, avatar, tint = 0x7655d6, scale = 1) {
  const shadow = scene.add.ellipse(0,32,66,20,0x3f315c,.18);
  const body = scene.add.circle(0,0,32,tint).setStrokeStyle(5,0xffffff,.9);
  const face = scene.add.text(0,-4,avatar,{fontSize:'44px'}).setOrigin(.5);
  const person = scene.add.container(x,y,[shadow,body,face]).setScale(scale);
  person.setSize(96,108);
  return person;
}

class AreaScene extends Phaser.Scene {
  constructor() { super("area"); }
  init(data) { this.areaId = data.areaId || "home-living"; this.saved = data.saved; }
  create() {
    activeScene = this;
    const area = AREAS[this.areaId];
    const location = LOCATIONS[area.location];
    setUi(`${location.name} · ${area.name}`, "点击地面移动，点击人物聊天");
    this.drawRoom(area, location);
    this.obstacles = [];
    this.player = makePerson(this, this.saved?.sceneId === this.areaId ? this.saved.x : 640, this.saved?.sceneId === this.areaId ? this.saved.y : 560, "🧒", 0x7655d6, 1.08).setDepth(20);
    this.player.setData("isPlayer", true);
    this.createDoors(area);
    this.createNpcs(area);
    this.input.on("pointerup", (pointer, objects) => {
      if (ui.dialogue.open || objects.some((object)=>object.getData?.("interactiveRole"))) return;
      this.movePlayer(pointer.worldX, pointer.worldY);
    });
    this.time.addEvent({ delay: 1600, loop: true, callback: ()=>this.moveNpcs() });
    savePosition(this.areaId, this.player.x, this.player.y);
  }

  drawRoom(area, location) {
    this.add.rectangle(WIDTH/2,HEIGHT/2,WIDTH,HEIGHT,area.palette[0]);
    this.add.polygon(WIDTH/2,420,[0,-190,480,-285,480,210,0,305,-480,210,-480,-285],area.palette[1]).setStrokeStyle(8,0xffffff,.55);
    this.add.polygon(WIDTH/2,520,[-430,-120,0,-210,430,-120,0,-28],0xffffff,.28);
    this.add.text(45,38,`${location.icon} ${location.name} · ${area.name}`,{fontFamily:'Microsoft YaHei',fontSize:'28px',fontStyle:'bold',color:'#493080',backgroundColor:'#ffffffdd',padding:{x:16,y:10}}).setDepth(5);
    const spots = [[145,210],[815,220],[215,500],[755,505],[480,175]];
    area.furniture.forEach((item,index)=>{
      const [x,y]=spots[index%spots.length];
      this.add.ellipse(x,y+24,95,28,0x493080,.12);
      this.add.text(x,y,item,{fontSize:'58px'}).setOrigin(.5);
    });
  }

  createDoors(area) {
    const doors = [];
    if (area.type === "hub") {
      doors.push({x:850,y:410,label:area.nextLabel,target:area.next,icon:"🚪"});
      doors.push({x:110,y:410,label:"返回世界地图",target:WORLD_SCENE,icon:"🗺️"});
    } else {
      doors.push({x:110,y:410,label:area.backLabel,target:area.back,icon:"🚪"});
    }
    doors.forEach((door)=>{
      const container=this.add.container(door.x,door.y).setDepth(10).setSize(150,150).setInteractive({useHandCursor:true});
      const bg=this.add.rectangle(0,0,128,132,0x7655d6,.92).setStrokeStyle(5,0xffffff);
      const icon=this.add.text(0,-18,door.icon,{fontSize:'50px'}).setOrigin(.5);
      const label=this.add.text(0,42,door.label,{fontFamily:'Microsoft YaHei',fontSize:'15px',fontStyle:'bold',color:'#fff',align:'center',wordWrap:{width:120}}).setOrigin(.5);
      container.add([bg,icon,label]).setData("interactiveRole","door");
      container.on("pointerup",(pointer,localX,localY,event)=>{ event.stopPropagation(); tone(470); savePosition(this.areaId,this.player.x,this.player.y); this.scene.start(door.target === WORLD_SCENE ? WORLD_SCENE : "area",door.target === WORLD_SCENE ? undefined : {areaId:door.target}); });
    });
  }

  createNpcs(area) {
    this.npcs = area.npcs.map((npc,index)=>{
      const columns = Math.min(6, Math.ceil(Math.sqrt(area.npcs.length)));
      const x = 270 + (index % columns) * (420 / Math.max(1,columns-1));
      const y = 285 + Math.floor(index / columns) * 130;
      const hue=[0xe7789d,0x65a9db,0x6fc38a,0xe4a14a][index%4];
      const person=makePerson(this,x,y,npc.avatar,hue,.9).setDepth(15).setInteractive({useHandCursor:true});
      person.setData("interactiveRole","npc").setData("npc",npc).setData("home",{x,y});
      person.on("pointerup",(pointer,localX,localY,event)=>{ event.stopPropagation(); showDialogue(npc); });
      return person;
    });
  }

  moveNpcs() {
    if (ui.dialogue.open) return;
    this.npcs.forEach((npc,index)=>{
      if (Math.random() > .68) return;
      const home=npc.getData("home");
      const radius=["student","customer"].includes(npc.getData("npc").role)?65:35;
      this.tweens.add({targets:npc,x:Phaser.Math.Clamp(home.x+Phaser.Math.Between(-radius,radius),220,740),y:Phaser.Math.Clamp(home.y+Phaser.Math.Between(-35,35),240,590),duration:900+index*35,ease:'Sine.easeInOut'});
    });
  }

  movePlayer(x,y) {
    const targetX=Phaser.Math.Clamp(x,180,790); const targetY=Phaser.Math.Clamp(y,230,620);
    this.tweens.killTweensOf(this.player);
    const distance=Phaser.Math.Distance.Between(this.player.x,this.player.y,targetX,targetY);
    this.tweens.add({targets:this.player,x:targetX,y:targetY,duration:Math.max(180,distance*2.1),ease:'Linear',onComplete:()=>{
      savePosition(this.areaId,this.player.x,this.player.y);
      ui.save.textContent="已自动保存";
    }});
    ui.save.textContent="正在保存…";
    tone(290);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: "#b5e6ff",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  render: { antialias: true, pixelArt: false },
  scene: [BootScene, WorldMapScene, AreaScene],
});

ui.sound.addEventListener("click",()=>{ soundOn=!soundOn; ui.sound.textContent=soundOn?"🔊":"🔇"; ui.sound.setAttribute("aria-label",soundOn?"关闭声音":"打开声音"); });
window.addEventListener("pagehide",()=>{ if (activeScene?.player) savePosition(activeScene.areaId,activeScene.player.x,activeScene.player.y); });
window.addEventListener("beforeunload",()=>{ if (activeScene?.player) savePosition(activeScene.areaId,activeScene.player.x,activeScene.player.y); });
export { game };
