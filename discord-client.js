/* eslint-disable import/extensions */
import * as dotenv from 'dotenv';
import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    EmbedBuilder,
} from 'discord.js';
// import dateCheckingHandler from './helper-functions/observer/eamuse-observer.js';
import ExtendedMaintenanceObserver from './helper-functions/observer/eamuse-observer-class.js';

dotenv.config();
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const rest = new REST({ version: '10' }).setToken(TOKEN);

// log in and make the bot online
client.login(TOKEN);

const myObserver = new ExtendedMaintenanceObserver();
myObserver.extendedMaintenanceObserver();
// const interval = setInterval(() => myObserver.extendedMaintenanceObserver(), 1000);

function globalPostAllServers(messagePayload) {
    // find a channel called maintenance-reminders and send a test message
    client.guilds.cache.forEach((guild) => {
        const targetChannel = guild.channels.cache.find((channel) => channel.name === 'maintenance-reminders');
        targetChannel.send(messagePayload);
    });
}

// function to fire after the bot has logged in
client.on('ready', () => {
    console.log(`${client.user.tag} has logged in`);
    // console.log('number of servers this bot is in: ', client.guilds.cache.size);
    globalPostAllServers(`number of servers this bot is in: ${client.guilds.cache.size}`);
});

// function to fire any time a message is created
client.on('messageCreate', (message) => {
    console.log(message.content);
});

client.on('interactionCreate', (interaction) => {
    if (interaction.isChatInputCommand()) {
        const inputCommand = interaction.commandName;

        const embedReply = new EmbedBuilder();

        switch (inputCommand) {
        case 'getnextmaintenance':
            // get the next maintenance period
            // interaction.reply({ content: `Here's the next maintenance period: ${1}` });
            embedReply.setTitle('📅 Next Extended Maintenance Date: ');
            // embedReply.setDescription('The next maintenance date');
            embedReply.addFields(
                { name: 'Date', value: myObserver.nextMaintenanceDate.date },
                { name: 'Begin time', value: myObserver.nextMaintenanceDate.start },
                { name: 'End time', value: myObserver.nextMaintenanceDate.end },
                // { name: 'Inline field title', value: 'Some value here', inline: true },
                // { name: 'Inline field title', value: 'Some value here', inline: true },
            );
            interaction.reply({ embeds: [embedReply] });
            break;
        case 'doessomethingelse':
            // get the next maintenance period
            interaction.reply({ content: 'Something else!' });
            break;
        default:
            interaction.reply({ content: 'Sorry, I didn\'t recognize that command' });
            break;
        }
    }
});

const arrayOfGuilds = client.guilds.cache;
console.log(arrayOfGuilds);

async function main() {
    const commands = [
        {
            name: 'getnextmaintenance',
            description: 'Returns the date and time of the NEXT e-amusement extended maintenance period',
        },
        {
            name: 'doessomethingelse',
            description: 'Returns the date and time of the NEXT e-amusement extended maintenance period',
        },
    ];

    try {
        console.log('Started refreshing application (/) commands.');
        // use guild specific version when testing, and global version when ready for production
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
            body: commands,
        });
        // await rest.put(Routes.applicationCommands(CLIENT_ID), {
        //     body: commands,
        // });
    } catch (e) {
        console.error(e);
    }
}

main();
