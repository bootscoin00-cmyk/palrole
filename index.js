require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");


const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  {
    polling: true
  }
);


const GROUP_ID = process.env.GROUP_ID;


// DATABASE

let users = {};

if (fs.existsSync("database.json")) {
  users = JSON.parse(
    fs.readFileSync("database.json")
  );
}



function saveDatabase(){

  fs.writeFileSync(
    "database.json",
    JSON.stringify(users, null, 2)
  );

}



// PROMOTE ADMIN

async function promoteUser(userId, title){

  try {


    await bot.promoteChatMember(
      GROUP_ID,
      userId,
      {
        can_manage_chat: false,
        can_delete_messages: true,
        can_manage_video_chats: false,
        can_restrict_members: true,
        can_promote_members: false,
        can_change_info: false,
        can_invite_users: true,
        can_pin_messages: true
      }
    );


    await bot.setChatAdministratorCustomTitle(
      GROUP_ID,
      userId,
      title
    );


    console.log(
      "Promoted:",
      userId,
      title
    );


  } catch(error){

    console.log(
      "Promote error:",
      error.message
    );

  }

}



// HITUNG PESAN MEMBER

bot.on("message", async(msg)=>{


  if(
    msg.chat.id.toString() !== GROUP_ID
  ) return;


  if(!msg.from) return;



  const id = msg.from.id;



  if(!users[id]){

    users[id] = {

      name:
      msg.from.first_name,

      messages:0,

      role:"Member"

    };

  }



  users[id].messages++;



  // HELPER

  if(
    users[id].messages >= 1000 &&
    users[id].role === "Member"
  ){


    users[id].role="Helper";


    await promoteUser(
      id,
      "Helper"
    );



    await bot.sendMessage(
      GROUP_ID,
`
🎉 Selamat!

@${msg.from.username || msg.from.first_name}

Sekarang menjadi:

🔵 Helper

Karena telah mencapai 1000 pesan.
`,
{
parse_mode:"HTML"
}
);


  }



  // MODERATOR

  if(
    users[id].messages >= 5000 &&
    users[id].role === "Helper"
  ){


    users[id].role="Moderator";


    await promoteUser(
      id,
      "Moderator"
    );



    await bot.sendMessage(
      GROUP_ID,
`
🎉 Upgrade Role!

@${msg.from.username || msg.from.first_name}

Sekarang menjadi:

🟣 Moderator
`,
{
parse_mode:"HTML"
}
);


  }



  saveDatabase();


});





// PROFILE

bot.onText(
/\/profile/,
async(msg)=>{


const id = msg.from.id;


const user = users[id];


if(!user){

return bot.sendMessage(
msg.chat.id,
"Data belum ada."
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





// ERROR

bot.on(
"polling_error",
(error)=>{

console.log(
"Polling Error:",
error.message
);

});



console.log(
"👑 Role Admin Bot aktif"
);
