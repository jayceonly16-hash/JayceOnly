require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const DATA_FILE = "./card-list.json";

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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

  const data = loadData();

  if (interaction.commandName === "addlist") {
    const item = {
      id: data.length + 1,
      user: interaction.user.username,
      userId: interaction.user.id,
      card: interaction.options.getString("card"),
      language: interaction.options.getString("language"),
      condition: interaction.options.getString("condition"),
      budget: interaction.options.getString("budget"),
      quantity: interaction.options.getInteger("quantity"),
      note: interaction.options.getString("note") || "None",
      status: "Active",
      createdAt: new Date().toLocaleString("en-GB")
    };

    data.push(item);
    saveData(data);

    return interaction.reply(`✅ Request #${item.id} added: ${item.card}`);
  }

  if (interaction.commandName === "list") {
    if (data.length === 0) {
      return interaction.reply("There are no card requests right now.");
    }

    const text = data
      .map(item => {
        return `#${item.id} | ${item.status}
Customer: <@${item.userId}>
Card: ${item.card}
Language: ${item.language}
Condition: ${item.condition}
Budget: ${item.budget}
Quantity: ${item.quantity}
Note: ${item.note}`;
      })
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle("📋 Current Card Request List")
      .setDescription(text.slice(0, 4000))
      .setFooter({ text: "Pokeunion Bot" });

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "done") {
    const id = interaction.options.getInteger("id");
    const item = data.find(x => x.id === id);

    if (!item) return interaction.reply("Request ID not found.");

    item.status = "Completed";
    saveData(data);

    return interaction.reply(`✅ Request #${id} marked as completed: ${item.card}`);
  }

  if (interaction.commandName === "clearlist") {
    saveData([]);
    return interaction.reply("🧹 All card requests have been cleared.");
  }
});

registerCommands();
client.login(process.env.DISCORD_TOKEN);