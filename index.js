require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");


const bot = new TelegramBot(
  process.env.BOT_TOKEN,
  {
    polling: true
  }
);


const GROUP_ID = process.env.GROUP_ID;


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});



// =====================
// SETUP DATABASE
// =====================

async function setupDatabase(){

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT PRIMARY KEY,
      name TEXT,
      messages INTEGER DEFAULT 0,
      role TEXT DEFAULT 'Member',
      is_admin BOOLEAN DEFAULT false
    )
  `);


  console.log("Database siap");

}


setupDatabase();




// =====================
// PROMOTE ADMIN
// =====================

async function promoteUser(userId, title){

  try {


    await bot.promoteChatMember(
      GROUP_ID,
      userId,
      {
        can_manage_chat: false,
        can_delete_messages: true,
        can_restrict_members: true,
        can_invite_users: true,
        can_pin_messages: true,
        can_promote_members: false,
        can_change_info: false
      }
    );


    await bot.setChatAdministratorCustomTitle(
      GROUP_ID,
      userId,
      title
    );


    console.log(
      "Admin berhasil:",
      userId,
      title
    );


  } catch(error){

    console.log(
      "Promote gagal:",
      error.message
    );

  }

}




// =====================
// HITUNG PESAN
// =====================

bot.on("message", async(msg)=>{


  if(
    msg.chat.id.toString() !== GROUP_ID
  ) return;


  if(!msg.from) return;



  const userId = msg.from.id;

  const name =
    msg.from.first_name || "User";



  try {


    await pool.query(
`
INSERT INTO users
(user_id,name,messages)
VALUES($1,$2,1)

ON CONFLICT(user_id)
DO UPDATE SET
name=$2,
messages=users.messages+1
`,
[
userId,
name
]
);



    const result = await pool.query(
`
SELECT * FROM users
WHERE user_id=$1
`,
[
userId
]
);



    const user = result.rows[0];



    // HELPER

    if(
      user.messages >= 1000 &&
      user.role === "Member"
    ){


      await pool.query(
`
UPDATE users
SET role='Helper',
is_admin=true
WHERE user_id=$1
`,
[userId]
);


      await promoteUser(
        userId,
        "Helper"
      );


      await bot.sendMessage(
        GROUP_ID,
`
🎉 Selamat!

${name} sekarang menjadi:

🔵 Helper

Karena sudah mencapai 1000 pesan.
`
      );


    }





    // MODERATOR

    if(
      user.messages >= 5000 &&
      user.role === "Helper"
    ){


      await pool.query(
`
UPDATE users
SET role='Moderator'
WHERE user_id=$1
`,
[userId]
);


      await promoteUser(
        userId,
        "Moderator"
      );


      await bot.sendMessage(
        GROUP_ID,
`
🎉 Upgrade Role!

${name}

Sekarang menjadi:

🟣 Moderator
`
      );


    }



  } catch(error){

    console.log(
      "Database error:",
      error.message
    );

  }


});






// =====================
// PROFILE
// =====================

bot.onText(
/\/profile/,
async(msg)=>{


const userId = msg.from.id;


const result = await pool.query(
`
SELECT * FROM users
WHERE user_id=$1
`,
[
userId
]
);



if(result.rows.length === 0){

return bot.sendMessage(
msg.chat.id,
"Data belum ada."
);

}



const user=result.rows[0];


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






// =====================
// ERROR
// =====================

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
