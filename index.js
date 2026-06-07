require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const { google } = require("googleapis");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = "Sheet1";

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

async function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

async function getRows() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:I`
  });

  const rows = res.data.values || [];
  return rows.slice(1);
}

async function appendRow(row) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:I`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row]
    }
  });
}

async function updateStatus(id, status) {
  const rows = await getRows();
  const rowIndex = rows.findIndex(row => String(row[0]) === String(id));

  if (rowIndex === -1) return false;

  const sheetRowNumber = rowIndex + 2;

  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!H${sheetRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[status]]
    }
  });

  return true;
}

async function clearRows() {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:I`
  });
}

const commands = [
  new SlashCommandBuilder()
    .setName("addlist")
    .setDescription("Submit a card request")
    .addStringOption(o => o.setName("card").setDescription("Example: Pikachu 151 AR").setRequired(true))
    .addStringOption(o => o.setName("language").setDescription("Japanese / English / Chinese").setRequired(true))
    .addStringOption(o => o.setName("condition").setDescription("PSA10 / Raw Mint / Any").setRequired(true))
    .addStringOption(o => o.setName("budget").setDescription("Example: 300 / under 1000").setRequired(true))
    .addIntegerOption(o => o.setName("quantity").setDescription("How many cards you need").setRequired(true))
    .addStringOption(o => o.setName("note").setDescription("Extra notes").setRequired(false)),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("View current card request list"),

  new SlashCommandBuilder()
    .setName("done")
    .setDescription("Mark a request as completed")
    .addIntegerOption(o => o.setName("id").setDescription("Request ID").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearlist")
    .setDescription("Clear all card requests")
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  console.log("Slash commands registered.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "addlist") {
      const rows = await getRows();
      const id = rows.length + 1;

      const row = [
        id,
        interaction.user.username,
        interaction.options.getString("card"),
        interaction.options.getString("language"),
        interaction.options.getString("condition"),
        interaction.options.getString("budget"),
        interaction.options.getInteger("quantity"),
        interaction.options.getString("note") || "None",
        "Active",
        new Date().toLocaleString("en-GB")
      ];

      await appendRow(row);

      return interaction.reply(`✅ Request #${id} added: ${row[2]}`);
    }

    if (interaction.commandName === "list") {
      const rows = await getRows();

      if (rows.length === 0) {
        return interaction.reply("There are no card requests right now.");
      }

      const text = rows.map(row => {
        return `#${row[0]} | ${row[8] || "Active"}
Customer: ${row[1]}
Card: ${row[2]}
Language: ${row[3]}
Condition: ${row[4]}
Budget: ${row[5]}
Quantity: ${row[6]}
Note: ${row[7] || "None"}`;
      }).join("\n\n");

      const embed = new EmbedBuilder()
        .setTitle("📋 Current Card Request List")
        .setDescription(text.slice(0, 4000))
        .setFooter({ text: "Pokeunion Bot | Google Sheets" });

      return interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === "done") {
      const id = interaction.options.getInteger("id");
      const ok = await updateStatus(id, "Completed");

      if (!ok) return interaction.reply("Request ID not found.");

      return interaction.reply(`✅ Request #${id} marked as completed.`);
    }

    if (interaction.commandName === "clearlist") {
      await clearRows();
      return interaction.reply("🧹 All card requests have been cleared.");
    }
  } catch (error) {
    console.error(error);
    return interaction.reply("❌ Something went wrong. Please check the bot logs.");
  }
});

registerCommands()
  .then(() => client.login(process.env.DISCORD_TOKEN))
  .catch(console.error);