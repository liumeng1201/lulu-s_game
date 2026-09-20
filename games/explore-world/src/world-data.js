export const WORLD_SCENE = "world-map";

export const LOCATIONS = {
  home: {
    name: "家",
    mapPosition: { x: 300, y: 235 },
    color: 0xb591ef,
    hub: "home-entry",
    hotspots: { x: 205, y: 185, width: 260, height: 230 },
  },
  school: {
    name: "学校",
    mapPosition: { x: 965, y: 235 },
    color: 0xffb75e,
    hub: "school-corridor",
    hotspots: { x: 725, y: 185, width: 260, height: 230 },
  },
  hospital: {
    name: "医院",
    mapPosition: { x: 300, y: 510 },
    color: 0x71c5e8,
    hub: "hospital-lobby",
    hotspots: { x: 185, y: 515, width: 285, height: 240 },
  },
  market: {
    name: "超市",
    mapPosition: { x: 965, y: 510 },
    color: 0xffd45b,
    hub: "market-aisle",
    hotspots: { x: 770, y: 520, width: 285, height: 240 },
  },
};

export const AREAS = {
  "home-entry": { location: "home", name: "门厅", type: "hub", next: "home-living", nextLabel: "进入客厅", palette: [0xffe8b5,0xc98b58], furniture: ["plant","coat-rack","shoe-rack"], npcs: [{ name:"妈妈", role:"family", lines:["回来啦？客厅里准备了水果。","慢慢走，别撞到门边的小花盆哦。"] }] },
  "home-living": { location: "home", name: "客厅", type: "room", back: "home-entry", backLabel: "回到门厅", palette: [0xffe6b0,0xb9784c], furniture: ["sofa","bookshelf","plant","toy-box"], npcs: [
    { name:"爸爸",avatar:"👨",role:"family",lines:["我正在整理书架，你今天想看哪本书？","探索完小世界，记得回来休息。"] },
    { name:"爷爷",avatar:"👴",role:"family",lines:["窗外的天气真好，适合出去走一走。"] },
    { name:"奶奶",avatar:"👵",role:"family",lines:["桌上有水果，玩累了就来吃一点。"] },
    { name:"弟弟",avatar:"👦",role:"family",lines:["我搭了一座积木城堡！你看像不像真的？"] },
  ]},
  "school-corridor": { location:"school", name:"走廊", type:"hub", next:"school-classroom", nextLabel:"进入教室", palette:[0xffdda0,0xc88745], furniture:["window","notice-board","plant"], npcs:[{name:"值班老师",role:"teacher",lines:["教室就在前面，走路要轻一点哦。"]}] },
  "school-classroom": { location:"school", name:"教室", type:"room", back:"school-corridor", backLabel:"回到走廊", palette:[0xffe7a8,0xb97b43], furniture:["bookshelf","desk","map-board","desk"], npcs:[
    {name:"林老师",avatar:"👩‍🏫",role:"teacher",lines:["今天我们要认识地图上的不同地方。"]},
    ...Array.from({length:10},(_,i)=>({name:`同学${i+1}`,avatar:i%2?"👧":"👦",role:"student",lines:["下课后一起去操场玩吧！","我正在画我的家，你想看看吗？","今天的故事特别有趣。"]})),
  ]},
  "hospital-lobby": { location:"hospital", name:"大厅", type:"hub", next:"hospital-infusion", nextLabel:"前往输液室", palette:[0xd9f3ed,0x79afa7], furniture:["plant","bench","reception"], npcs:[{name:"导诊护士",role:"nurse",lines:["需要帮助时可以来问我。","输液室在前面的走廊右侧。"]}] },
  "hospital-infusion": { location:"hospital", name:"输液室", type:"room", back:"hospital-lobby", backLabel:"回到大厅", palette:[0xe0f4ea,0x75a9a3], furniture:["bed","bench","cabinet","plant"], npcs:[
    {name:"陈护士",avatar:"👩‍⚕️",role:"nurse",lines:["别担心，我会认真照顾每一位病人。"]},
    {name:"王医生",avatar:"👨‍⚕️",role:"doctor",lines:["多喝水、好好休息，身体会慢慢恢复。"]},
    ...Array.from({length:4},(_,i)=>({name:`病人${i+1}`,avatar:i%2?"🤒":"🧑",role:"patient",lines:["我在安静地休息，很快就会好起来。"]})),
  ]},
  "market-aisle": { location:"market", name:"入口通道", type:"hub", next:"market-floor", nextLabel:"进入商品区", palette:[0xffe29c,0xcf8c43], furniture:["cart","basket","shelf"], npcs:[{name:"理货员",role:"staff",lines:["欢迎光临！需要找商品可以问我。"]}] },
  "market-floor": { location:"market", name:"商品区", type:"room", back:"market-aisle", backLabel:"回到入口", palette:[0xffdc91,0xc47b3e], furniture:["produce","shelf","cooler","counter","produce"], npcs:[
    {name:"收银员",avatar:"👩‍💼",role:"cashier",lines:["选好商品后，请到收银台排队结账。"]},
    {name:"理货员",avatar:"🧑‍💼",role:"staff",lines:["我正在把新鲜水果摆整齐。"]},
    ...Array.from({length:4},(_,i)=>({name:`顾客${i+1}`,avatar:i%2?"👩":"👨",role:"customer",lines:["今天的蔬菜看起来很新鲜。","我在找家里需要的东西。"]})),
  ]},
};
