require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");


const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  {
    polling:true
  }
);


const GROUP_ID = process.env.GROUP_ID;


// load database
let users = JSON.parse(
  fs.readFileSync("database.json")
);


// simpan database
function save(){

  fs.writeFileSync(
    "database.json",
    JSON.stringify(users,null,2)
  );

}


// hitung pesan

bot.on("message", async(msg)=>{


  if(msg.chat.id.toString() !== GROUP_ID)
    return;


  if(!msg.from)
    return;



  const id = msg.from.id;



  if(!users[id]){

    users[id]={
      name: msg.from.first_name,
      messages:0,
      role:"Member"
    };

  }



  users[id].messages++;



  // cek role

  if(users[id].messages >= 10 
    && users[id].role === "Member"){


      users[id].role="Helper";


      bot.sendMessage(
        GROUP_ID,
`🎉 Selamat @${msg.from.username || msg.from.first_name}

Naik role menjadi:

🔵 Helper

Karena sudah mencapai 1000 pesan!`,
{
parse_mode:"HTML"
}
);

  }



  save();


});



// PROFILE

bot.onText(/\/profile/, async(msg)=>{


const id=msg.from.id;


const user=users[id];


if(!user){

return bot.sendMessage(
msg.chat.id,
"Data belum tersedia."
);

}



bot.sendMessage(
msg.chat.id,
`
👤 Profile

Nama:
${user.name}

Role:
${user.role}

Pesan:
${user.messages}
`
);


});



console.log(
"Role Bot aktif"
);
