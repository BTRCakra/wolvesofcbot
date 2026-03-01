require('dotenv').config();

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

const commands = [
  {
  name: 'panel',
  description: 'Buka panel MC'
  },
  
  {
  name: 'inventory_total',
  description: 'Menampilkan total seluruh inventory'
  },

  {
  name: 'member_list',
  description: 'Menampilkan daftar seluruh member MC'
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('⏳ Deploying slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('✅ Slash commands berhasil didaftarkan!');
  } catch (error) {
    console.error(error);
  }
})();