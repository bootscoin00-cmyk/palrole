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


console.log(
  "DATABASE TERBACA:",
  process.env.DATABASE_URL ? "ADA" : "TIDAK ADA"
);



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

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS warned BOOLEAN DEFAULT false
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
  "PROMOTE ERROR:",
  error
);

}

}

// =====================
// REMOVE ADMIN
// =====================

async function removeAdmin(userId){

  try{

    await bot.promoteChatMember(
      GROUP_ID,
      userId,
      {
        can_manage_chat:false,
        can_delete_messages:false,
        can_restrict_members:false,
        can_invite_users:false,
        can_pin_messages:false,
        can_promote_members:false,
        can_change_info:false
      }
    );

    console.log(
      "Admin dicabut:",
      userId
    );

  }catch(error){

    console.log(
      "REMOVE ADMIN ERROR:",
      error.message
    );

  }

}

// =====================
// CEK ADMIN TIDAK AKTIF
// =====================

async function checkInactiveMembers() {

  try {

    const result = await pool.query(`
      SELECT *
      FROM users
      WHERE is_admin = true
    `);

    const now = new Date();

    for (const user of result.rows) {

      const lastActive = new Date(user.last_active);

      const diffDays =
        (now - lastActive) / (1000 * 60 * 60 * 24);

      // =====================
      // WARNING 5 HARI
      // =====================

      if (diffDays >= 5 && diffDays < 7 && !user.warned) {

        try {

          await bot.sendMessage(
            user.user_id,
`⚠️ Peringatan!

Kamu sudah tidak aktif di grup selama 5 hari.

Jika dalam 2 hari ke depan kamu masih belum aktif,
status admin akan dicabut otomatis.

Cukup kirim 1 pesan di grup untuk mempertahankan jabatanmu.`
          );

        } catch {

          console.log(`Tidak bisa mengirim DM ke ${user.name}`);
        }

        await pool.query(
          `
          UPDATE users
          SET warned = true
          WHERE user_id = $1
          `,
          [user.user_id]
        );

      }

      // =====================
      // CABUT ADMIN 7 HARI
      // =====================

      if (diffDays >= 7) {

        await removeAdmin(user.user_id);

        await pool.query(
          `
          UPDATE users
          SET
            role = 'Member',
            is_admin = false,
            warned = false
          WHERE user_id = $1
          `,
          [user.user_id]
        );

        await bot.sendMessage(
          GROUP_ID,
`📢 Status Admin Dicabut

${user.name} kehilangan status admin karena tidak aktif selama 7 hari.

Silakan kembali aktif untuk mendapatkan role kembali.`
        );

      }

    }

  } catch (error) {

    console.log("CHECK INACTIVE ERROR:", error.message);

  }

}

// =====================
// HITUNG PESAN
// =====================

bot.on("message", async(msg)=>{

console.log(
"Pesan masuk:",
msg.chat.id,
msg.text
);

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
(user_id,name,messages,last_active,warned)
VALUES($1,$2,1,NOW(),false)

ON CONFLICT(user_id)
DO UPDATE SET
name=$2,
messages=users.messages+1,
last_active=NOW(),
warned=false
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

console.log(
  "DATA USER:",
  user
);


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

// Cek admin tidak aktif setiap 1 jam
setInterval(checkInactiveMembers, 60 * 60 * 1000);

// Jalankan sekali saat bot hidup
checkInactiveMembers();

console.log(
"👑 Role Admin Bot aktif"
);
