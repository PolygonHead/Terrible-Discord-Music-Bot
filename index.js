const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const prefix = "~";

const fs = require('fs')
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith(".js"));
for(const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}


client.on('ready', () => {
    console.log('The client is ready!');
    client.user.setPresence({
        status: 'online',
        activity: {
            name: 'minecrazy | ~help',
            type: 'PLAYING'
        }
    });
})

client.on('message', message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return; 
    
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        client.commands.get("play").execute(message, args, command);
    } catch (err){
        message.reply("Oh fiddlesticks! What now?")
        console.log(err)
    }
        
});

client.login(config.token);

