require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require('discord.js');

const {
  appendData,
  getNextId,
  getData
} = require('./services/sheets');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

const RANK_ORDER = [
  "PROSPECT",
  "OLD LADY",
  "MEMBER",
  "ENFORCER",
  "TREASURER",
  "SECRETARY",
  "ROAD CAPTAIN",
  "SERGEANT",
  "VICE PRESIDENT",
  "PRESIDENT"
];

const RANK_ROLE_MAP = {
  "PRESIDENT": process.env.ROLE_PRESIDENT,
  "VICE PRESIDENT": process.env.ROLE_VICE_PRESIDENT,
  "SERGEANT": process.env.ROLE_SERGEANT,
  "ROAD CAPTAIN": process.env.ROLE_ROAD_CAPTAIN,
  "SECRETARY": process.env.ROLE_SECRETARY,
  "TREASURER": process.env.ROLE_TREASURER,
  "ENFORCER": process.env.ROLE_ENFORCER,
  "MEMBER": process.env.ROLE_MEMBER,
  "OLD LADY": process.env.ROLE_OLD_LADY,
  "PROSPECT": process.env.ROLE_PROSPECT
};

function isLeaderOrAdmin(member) {
  return (
    member.roles.cache.has(process.env.ROLE_ADMIN) ||
    member.roles.cache.has(process.env.ROLE_PRESIDENT) ||
    member.roles.cache.has(process.env.ROLE_VICE_PRESIDENT) ||
    member.roles.cache.has(process.env.ROLE_SERGEANT) ||
    member.roles.cache.has(process.env.ROLE_ROAD_CAPTAIN) ||
    member.roles.cache.has(process.env.ROLE_SECRETARY) ||
    member.roles.cache.has(process.env.ROLE_TREASURER) ||
    member.roles.cache.has(process.env.ROLE_ENFORCER)
  );
}

async function syncDiscordRole(guild, username, newRank) {
  const member = guild.members.cache.find(m => m.user.username === username);
  if (!member) return;

  // hapus semua role rank
  for (const rank in RANK_ROLE_MAP) {
    const roleId = RANK_ROLE_MAP[rank];
    if (roleId && member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId).catch(()=>{});
    }
  }

  // tambah role baru
  const newRoleId = RANK_ROLE_MAP[newRank];
  if (newRoleId) {
    await member.roles.add(newRoleId).catch(()=>{});
  }
}

client.once('clientReady', () => {
  console.log(`🏍️ MC SYSTEM ONLINE - ${client.user.tag}`);
});

async function generateMemberEmbed(guild) {

  const data = await getData("Members!A:G") || [];

  const grouped = {};

  // 🔥 pastikan semua rank tersedia
  RANK_ORDER.forEach(r => grouped[r] = []);

  data.forEach(m => {

    if (!m || !m[2] || !m[3]) return; // skip row kosong

    const rank = m[2].toString().trim().toUpperCase();
    const status = m[3].toString().trim().toUpperCase();

    if (status !== "ACTIVE") return;

    // 🔥 jika rank tidak ada di RANK_ORDER → skip
    if (!grouped.hasOwnProperty(rank)) return;

    grouped[rank].push(m);
  });

  const embed = new EmbedBuilder()
    .setTitle("👥 MEMBER LIST")
    .setColor("DarkGreen")
    .setTimestamp();

  let totalCount = 0;

  for (const rank of RANK_ORDER.slice().reverse()) {

    if (!grouped[rank] || grouped[rank].length === 0) continue;

    let roleMention = "";

    if (process.env["ROLE_" + rank.replace(/ /g,"_")]) {
      roleMention = `<@&${process.env["ROLE_" + rank.replace(/ /g,"_")]}>`;
    }

    // 🔴 PRESIDENT highlight merah
    if (rank === "PRESIDENT") {
      embed.setColor("Red");
    }

    const names = grouped[rank].map(m => {

      totalCount++;

      let badge = "";

      if (rank === "PRESIDENT") {
        badge = "👑 ";
      }

      if (m[5] && m[5] === process.env.BOT_ADMIN_ID) {
        badge += "🛡 ";
      }

      return `${badge}${m[1]}`;
    }).join("\n");

    embed.addFields({
      name: `🏷 ${rank} ${roleMention}`,
      value: names || "-",
      inline: false
    });
  }

  embed.setFooter({
    text: `Total Member Active: ${totalCount}`
  });

  return embed;
}

client.on('interactionCreate', async (interaction) => {
  try {

    // ==================================================
    // SLASH COMMAND
    // ==================================================
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === "panel") {

        const embed = new EmbedBuilder()
          .setTitle("🏍️ MC CONTROL SYSTEM")
          .setColor("DarkBlue");

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("inventory_btn").setLabel("📦 Inventory").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("conflict_btn").setLabel("⚔️ Conflict").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("member_btn").setLabel("👤 Member").setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("inventory_master_btn").setLabel("📦 Inventory Master").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("conflict_master_btn").setLabel("⚔️ Conflict Master").setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({ embeds: [embed], components: [row1, row2] });
      }

      // ================= INVENTORY TOTAL =================
      if (interaction.commandName === "inventory_total") {

        if (!isLeaderOrAdmin(interaction.member))
          return interaction.reply({ content: "❌ Leader/Admin only.", flags: 64});

        return sendInventoryEmbed(interaction, true);
      }

      // ================= MEMBER LIST =================
      if (interaction.commandName === "member_list") {

      const status = interaction.options.getString("status") || "ACTIVE";

      const data = await getData("Members!A:G") || [];
      const filtered = data.filter(m => m[3] === status);

      if (!filtered.length)
        return interaction.reply({
          content: `Tidak ada member ${status}`,
          flags: 64
        });

      const embed = await generateMemberEmbed(interaction.guild);

      return interaction.reply({
        embeds: [embed],
        flags: 64
      });
    }
  }

    // ==================================================
    // BUTTON
    // ==================================================
    if (interaction.isButton()) {

      // INVENTORY
      if (interaction.customId === "inventory_btn") {

        const master = await getData("Inventory_Master!A:B") || [];
        if (!master.length)
          return interaction.reply({ content: "Master kosong.", flags: 64 });

        const options = master.map(m => ({
          label: m[1],
          value: `${m[1]}`
        }));

        return interaction.reply({
          content: "Pilih Item:",
          flags: 64,
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("inventory_select")
                .addOptions(options)
            )
          ]
        });
      }

      // CONFLICT
      if (interaction.customId === "conflict_btn") {

        const master = await getData("Conflict_Master!A:B") || [];
        if (!master.length)
          return interaction.reply({ content: "Tidak ada master conflict.", flags: 64 });

        const options = master.map(m => ({
          label: m[1],
          value: `${m[1]}`
        }));

        return interaction.reply({
          content: "Pilih Musuh:",
          flags: 64,
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("conflict_select")
                .addOptions(options)
            )
          ]
        });
      }

      // INVENTORY REFRESH
      if (interaction.customId === "inventory_refresh") {
        if (!isLeaderOrAdmin(interaction.member))
          return interaction.reply({ content: "❌ Leader only.", flags: 64 });

        await interaction.deferUpdate();
        return sendInventoryEmbed(interaction, false);
      }

      // ================= MEMBER PANEL =================
      if (interaction.customId === "member_btn") {

      const embed = new EmbedBuilder()
        .setTitle("👤 MEMBER MANAGEMENT")
        .setDescription("Pilih aksi di bawah ini")
        .setColor("DarkGreen");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("member_add_btn")
          .setLabel("➕ Add")
          .setStyle(ButtonStyle.Success),
        /*new ButtonBuilder()
          .setCustomId("member_manage_btn")
          .setLabel("⚙️ Manage")
          .setStyle(ButtonStyle.Primary),*/
        new ButtonBuilder()
          .setCustomId("member_refresh")
          .setLabel("🔄 Refresh")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        embeds: [embed],
        components: [row],
        flags: 64
      });
    }

    if (interaction.customId === "member_add_btn") {

    const modal = new ModalBuilder()
        .setCustomId("member_add_modal_new")
        .setTitle("Tambah Member")
        .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("nama")
          .setLabel("Nama")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("rank")
          .setLabel("Rank")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

/*  ERROR (BELUM DIFIX)

    if (interaction.customId === "member_manage_btn") {

    const data = await getData("Members!A:G") || [];

    if (!data.length)
      return interaction.reply({ content: "Tidak ada member.", flags: 64 });

    // 🔥 Filter baris kosong dulu
    const validMembers = data.filter(m =>
      m &&
      m[0] && m[0].toString().trim() !== "" &&
      m[1] && m[1].toString().trim() !== "" &&
      m[2] && m[2].toString().trim() !== ""
    );

    if (!validMembers.length)
      return interaction.reply({ content: "Tidak ada member valid.", flags: 64 });

    // 🔥 Limit max 25 (Discord limit select menu)
    const limitedMembers = validMembers.slice(0, 25);

    const options = limitedMembers.map(m => ({
      label: `${m[1].toString().trim().substring(0, 80)} (${m[2]})`,
      value: m[0].toString().trim()
    }));

    return interaction.reply({
      content: "Pilih Member:",
      flags: 64,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("member_select_manage_new")
            .addOptions(options)
        )
      ]
    }); 
    }

    if (interaction.customId === "member_refresh") {

    await interaction.deferUpdate();

    const embed = await generateMemberEmbed(interaction.guild);

    return interaction.editReply({
      embeds: [embed]
    });
  }

// ================= MEMBER BUTTON ACTION =================
if (interaction.customId.startsWith("member_action_")) {

  await interaction.deferUpdate();

  const parts = interaction.customId.split("_");

  // format: member_action_promote_MBR-001
  const action = parts[2];
  const memberId = parts.slice(3).join("_");

  const data = await getData("Members!A:G") || [];

  const cleanId = String(memberId).trim();

  const rowIndex = data.findIndex(m =>
    m[0] && String(m[0]).trim() === cleanId
  );

  if (rowIndex === -1) {
    console.log("ID Dicari:", cleanId);
    console.log("Semua ID:", data.map(m => m[0]));
    return interaction.followUp({
      content: `❌ Member tidak ditemukan.`,
      ephemeral: true
    });
  }

  const sheetRow = rowIndex + 2;
  const currentRank = String(data[rowIndex][2]).trim();

  // ===== ACTION =====

  if (action === "promote") {
    const rankIndex = RANK_ORDER.indexOf(currentRank);
    if (rankIndex !== -1 && rankIndex < RANK_ORDER.length - 1) {
      await updateRow(`Members!C${sheetRow}`, [[RANK_ORDER[rankIndex + 1]]]);
    }
  }

  else if (action === "demote") {
    const rankIndex = RANK_ORDER.indexOf(currentRank);
    if (rankIndex > 0) {
      await updateRow(`Members!C${sheetRow}`, [[RANK_ORDER[rankIndex - 1]]]);
    }
  }

  else if (action === "nonaktif") {
    await updateRow(`Members!D${sheetRow}`, [["NONACTIVE"]]);
  }

  else if (action === "restore") {
    await updateRow(`Members!D${sheetRow}`, [["ACTIVE"]]);
  }

  else if (action === "remove") {
    await updateRow(`Members!D${sheetRow}`, [["REMOVED"]]);
  }

//  await updateRow(`Members!C${sheetRow}`, [[newRank]]);

  const embed = new EmbedBuilder()
    .setTitle("Member Updated");

  return interaction.editReply({
    embeds: [embed]
  });
}

if (interaction.customId.startsWith("member_filter_")) {

  const status = interaction.customId.split("_")[2];

  const data = await getData("Members!A:G") || [];
  const filtered = data.filter(m => m[3] === status);

  if (!filtered.length) {
    return interaction.editReply({
      content: `Tidak ada member ${status}`,
      embeds: [],
      components: interaction.message.components
    });
  }

  const embed = buildMemberListEmbed(filtered, status);

  return interaction.editReply({
    embeds: [embed],
    components: interaction.message.components
  });
}*/

      // MASTER BUTTON
      if (
        interaction.customId === "inventory_master_btn" ||
        interaction.customId === "conflict_master_btn"
      ) {

        if (!isLeaderOrAdmin(interaction.member))
          return interaction.reply({ content: "❌ Leader/Admin only.", flags: 64 });

        const isInventory = interaction.customId === "inventory_master_btn";

        const modal = new ModalBuilder()
          .setCustomId(isInventory ? "master_inventory_add" : "master_conflict_add")
          .setTitle("Tambah Master")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("nama")
                .setLabel("Nama")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );

        return interaction.showModal(modal);
      }
    }

    // ==================================================
    // SELECT
    // ==================================================
    if (interaction.isStringSelectMenu()) {

      // INVENTORY SELECT
      if (interaction.customId === "inventory_select") {

        const item = interaction.values[0];

        const modal = new ModalBuilder()
          .setCustomId(`inventory_modal_${item}`)
          .setTitle(`Inventory ${item}`)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("jumlah")
                .setLabel("Jumlah (+/-)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );

        return interaction.showModal(modal);
      }

      // CONFLICT SELECT
      if (interaction.customId === "conflict_select") {

        const enemy = interaction.values[0];

        return interaction.reply({
          content: `Hasil conflict ${enemy}?`,
          flags: 64,
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`conflict_result_${enemy}`)
                .addOptions([
                  { label: "WIN", value: "WIN" },
                  { label: "LOSE", value: "LOSE" },
                  { label: "DRAW", value: "DRAW" }
                ])
            )
          ]
        });
      }

      // CONFLICT RESULT
      if (interaction.customId.startsWith("conflict_result_")) {

        const enemy = interaction.customId.replace("conflict_result_", "");
        const result = interaction.values[0];

        const modal = new ModalBuilder()
          .setCustomId(`conflict_modal_${enemy}_${result}`)
          .setTitle(`Conflict ${enemy}`)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("kerugian")
                .setLabel("Kerugian")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );

        return interaction.showModal(modal);
      }

      // MEMBER FILTER
      if (interaction.customId === "member_manage_btn") {

      const embed = new EmbedBuilder()
        .setTitle("📂 Filter Member")
        .setDescription("Pilih filter status")
        .setColor("DarkGreen");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("member_filter_ACTIVE")
          .setLabel("ACTIVE")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("member_filter_NONACTIVE")
          .setLabel("NONACTIVE")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("member_filter_REMOVED")
          .setLabel("REMOVED")
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        embeds: [embed],
        components: [row],
        flags: 64
      });
    }

    // Member Promote/Demote/Nonaktif/Remove
    /* ERROR (BELUM DIFIX)

    if (interaction.customId === "member_select_manage_new") {

    await interaction.deferUpdate();

    const memberId = interaction.values[0];
    const data = await getData("Members!A:G");
    const member = data.find(m => String(m[0]).trim() === String(memberId).trim());

    if (!member) {
    return interaction.followUp({
      content: "❌ Member tidak ditemukan.",
      ephemeral: true
    });
  }

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${member[1]}`)
      .addFields(
        { name: "Rank", value: member[2], inline: true },
        { name: "Status", value: member[3], inline: true }
      )
      .setColor("DarkGreen");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`member_action_promote_${memberId}`)
        .setLabel("⬆️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`member_action_demote_${memberId}`)
        .setLabel("⬇️")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`member_action_nonaktif_${memberId}`)
        .setLabel("❌")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`member_action_restore_${memberId}`)
        .setLabel("♻️")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`member_action_remove_${memberId}`)
        .setLabel("🗑")
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row],
      content: ""
    });
  }*/
  }

    // ==================================================
    // MODAL
    // ==================================================
    if (interaction.isModalSubmit()) {

      await interaction.deferReply({ flags: 64 });

      // INVENTORY SAVE
      if (interaction.customId.startsWith("inventory_modal_")) {

        const item = interaction.customId.replace("inventory_modal_", "");
        const jumlah = parseInt(interaction.fields.getTextInputValue("jumlah"));

        if (isNaN(jumlah))
          return interaction.editReply("Jumlah harus angka.");

        const id = await getNextId("Inventory!A:A", "INV-");

        await appendData("Inventory!A:F", [
          id,
          new Date().toLocaleString(),
          item,
          jumlah,
          interaction.user.username
        ]);

        return interaction.editReply("Inventory berhasil diperbarui.");
      }

      // CONFLICT SAVE
      if (interaction.customId.startsWith("conflict_modal_")) {

        const parts = interaction.customId.split("_");
        const enemy = parts[2];
        const result = parts[3];
        const kerugian = interaction.fields.getTextInputValue("kerugian");

        const id = await getNextId("Conflict!A:A", "CF-");

        await appendData("Conflict!A:G", [
          id,
          new Date().toLocaleString(),
          enemy,
          result,
          kerugian,
          interaction.user.username
        ]);

        return interaction.editReply("Conflict berhasil dicatat.");
      }

      if (interaction.customId === "member_add_modal_new") {

      const nama = interaction.fields.getTextInputValue("nama");
      const rank = interaction.fields.getTextInputValue("rank").toUpperCase();

      const id = await getNextId("Members!A:A", "MBR-");

      await appendData("Members!A:G", [
        id,
        nama,
        rank,
        "ACTIVE",
        new Date().toLocaleString(),
        interaction.user.id,
        interaction.user.username
      ]);

      return interaction.editReply("✅ Member berhasil ditambahkan.");
    }

      // MASTER SAVE
      if (
        interaction.customId === "master_inventory_add" ||
        interaction.customId === "master_conflict_add"
      ) {

        const nama = interaction.fields.getTextInputValue("nama");

        const sheet =
          interaction.customId === "master_inventory_add"
            ? "Inventory_Master!A:B"
            : "Conflict_Master!A:B";

        const prefix =
          interaction.customId === "master_inventory_add"
            ? "ITEM-"
            : "ENM-";

        const id = await getNextId(sheet.replace("A:B", "A:A"), prefix);

        await appendData(sheet, [id, nama]);

        return interaction.editReply("Master berhasil ditambahkan.");
      }
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied)({
      content: "❌ Error terjadi.",
      ephemeral: true
    });
  }
});

async function sendInventoryEmbed(interaction, isReply) {

  const master = await getData("Inventory_Master!A:B") || [];
  const transactions = await getData("Inventory!A:F") || [];

  const totals = {};

  master.forEach(m => totals[m[1]] = 0);

  transactions.forEach(t => {
    if (totals[t[2]] !== undefined)
      totals[t[2]] += parseInt(t[3]) || 0;
  });

  const embed = new EmbedBuilder()
    .setTitle("📦 TOTAL INVENTORY")
    .setColor("DarkBlue")
    .setTimestamp();

  for (const item in totals) {
    const stock = totals[item];
    embed.addFields({
      name: item,
      value: stock < 5
        ? `**${stock}** 🚨`
        : `**${stock}**`,
      inline: true
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("inventory_refresh")
      .setLabel("🔄 Refresh")
      .setStyle(ButtonStyle.Primary)
  );

  if (isReply)
    return interaction.reply({ embeds: [embed], components: [row] });

  return interaction.editReply({ embeds: [embed], components: [row] });
}

client.login(process.env.TOKEN);