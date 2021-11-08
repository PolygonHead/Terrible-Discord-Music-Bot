const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const { MessageAttachment, MessageEmbed } = require('discord.js');

//Global queue for your bot. Every server will have a key and value pair in this map. { guild.id, queue_constructor{} }
const queue = new Map();
const timeout = [];
const timeout_time = 120;
module.exports = {
    name: 'play',
    description: 'Music bot, deal with it.',
    async execute(message,args, cmd, client, Discord){
        //Checking for the voicechannel and permissions (you can add more permissions if you like).
        const voice_channel = message.member.voice.channel;
        if (!voice_channel) return message.reply('You need to be in a channel to execute this command!');
        const permissions = voice_channel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) return message.reply('You dont have the correct permissions');
        if (!permissions.has('SPEAK')) return message.reply('You dont have the correct permissions');

        //This is our server queue. We are getting this server queue from the global queue.
        const server_queue = queue.get(message.guild.id);

        //If the user has used the play command
        if (cmd === 'play' || cmd === 'p'){
            if (!args.length) return message.channel.send('You need to send the second argument!');
            let song = {};
            message.channel.send(`🔎**Searching for** \`${args.join(' ')}\``);
            //If the first argument is a link. Set the song object to have two keys. Title and URl.
            if (ytdl.validateURL(args[0])) {
                const song_info = await ytdl.getInfo(args[0]);
                song = { title: song_info.videoDetails.title, url: song_info.videoDetails.video_url }
            } else {
                //If there was no link, we use keywords to search for a video. Set the song object to have two keys. Title and URl.
                const video_finder = async (query) =>{
                    const video_result = await ytSearch(query);
                    return (video_result.videos.length > 1) ? video_result.videos[0] : null;
                }

                const video = await video_finder(args.join(' '));
                if (video){
                    song = { title: video.title, url: video.url }
                } else {
                    return message.channel.send('Error finding video.');
                }
            }

            //If the server queue does not exist (which doesn't for the first video queued) then create a constructor to be added to our global queue.
            if (!server_queue){

                const queue_constructor = {
                    voice_channel: voice_channel,
                    text_channel: message.channel,
                    connection: null,
                    songs: [],
                    volume: 1,
                    loop: false,
                    bitrate: 12000
                }
                
                //Add our key and value pair into the global queue. We then use this to get our server queue.
                queue.set(message.guild.id, queue_constructor);
                queue_constructor.songs.push(song);
    
                //Establish a connection and play the song with the vide_player function.
                try {
                    const connection = await voice_channel.join();
                    queue_constructor.connection = connection;
                    video_player(message.guild, queue_constructor.songs[0]);
                    
                } catch (err) {
                    queue.delete(message.guild.id);
                    message.channel.send('There was an error connecting!');
                    throw err;
                }
            } else{
                
                if (server_queue.songs.length == 0) {
                    server_queue.songs.push(song);
                    return video_player(message.guild, server_queue.songs[0]);
                    
                } else {
                    server_queue.songs.push(song);
                    return message.channel.send(`👍 ${song.title} **added to queue!**`);
                }
            }
        }

        else if(cmd === 'skip' || cmd === 's') skip_song(message, server_queue, message.guild);
        else if(cmd === 'pause') pause_song(message, server_queue);
        else if(cmd === 'loop') loop_song(server_queue);
        else if(cmd === 'volume' || cmd === 'v'){
            if (!server_queue) {
                message.reply("I'm not playing anything😠");
            } else{
                if (!args.length) return message.channel.send(`🔊 **Volume is currently** ${server_queue.volume}`) ;
                volume_float = parseFloat(args)
                if (isNaN(volume_float) || volume_float < 0 || message.member.id == 300861204627193856 && volume_float > 2) {
                    message.reply("Why?")
                } else {
                    server_queue.volume = volume_float;
                    server_queue.connection.dispatcher.setVolume(volume_float);
                    message.channel.send(`🔊**Volume is now** ${server_queue.volume}`)
                }
            }
        }
        else if(cmd === 'leave' || cmd === 'l') leave_command(message, server_queue, message.guild);
        else if(cmd === 'queue' || cmd === 'q') check_queue(message, server_queue);
        else if(cmd === 'nowplaying' || cmd === 'np') now_playing(message, server_queue);
        else if(cmd === 'help' || cmd === 'h') help(message, server_queue);
        else if(cmd === 'resume' || cmd === 'r') resume_song(message, server_queue);
        else if(cmd === 'bitrate' || cmd === 'b') change_bitrate(message, server_queue, args);
        else {
            message.reply("Lol, no :)")
        }
    }
    
}

const video_player = async (guild, song) => {
    const song_queue = queue.get(guild.id);

    //If no song is left in the server queue. Leave the voice channel and delete the key and value pair from the global queue.
    if (!song_queue) return;
    if (song) {

        if (timeout[guild.id]) {
            clearTimeout(timeout[guild.id]);
            //song_queue.text_channel.send("***--TIMEOUT INTERRUPTED--***");
            

            timeout[guild.id] = null;
        }

        const stream = ytdl(song.url, { filter: 'audioonly' });

        let songPlayer = song_queue.connection.play(stream, { seek: 0, volume: song_queue.volume, bitrate: song_queue.bitrate, speed: 3})
        songPlayer.on('finish', () => {
            //song_queue.text_channel.send("***--SONG ENDED--***");
            if (!song_queue.loop) song_queue.songs.shift();
            //song_queue.text_channel.send("***--LOOP IS OFF, GOING TO NEXT SONG--***");
            video_player(guild, song_queue.songs[0]);
            //song_queue.text_channel.send("***--PLAYING SONG--***");
        });
    
        await song_queue.text_channel.send(`🎶 **Now playing** ${song.title}`)
    } else {
        //song_queue.text_channel.send("***--SONG TIMED OUT--***");
        song_queue.songs = []
        timeout[guild.id] = setTimeout(() => leave(song_queue, guild), timeout_time * 1000);
    }
}

const skip_song = (message, server_queue) => {
    if(!server_queue || !server_queue.songs){
        return message.channel.send(`**There are no songs in queue** 😔`);
    }
    message.channel.send("**Okay, song is no more.**")
    server_queue.connection.dispatcher.end();
    if (server_queue.loop) server_queue.songs.shift();
}

const pause_song = (message, server_queue) => {
    message.channel.send(`⏸**Song paused!**`);
    server_queue.connection.dispatcher.pause();
}

const resume_song = (message, server_queue) => {
    message.channel.send(`▶️**Song played!**`);
    server_queue.connection.dispatcher.resume();
    
}

const leave = (server_queue, guild) => {
    //server_queue.text_channel.send("***--MESSAGE RECIEVED FOR BOT TO LEAVE--***");
    if (!queue.get(guild.id)) return;
    server_queue.text_channel.send("***Later gamers***");
    
    server_queue.voice_channel.leave();
    //server_queue.text_channel.send("***--BOT HAS SUCCESSFULLY LEFT--***");
    queue.delete(guild.id);
    //server_queue.text_channel.send("***--BOT HAS SUCCESSFULLY LEFT AND QUEUE DELETED--***");
}

const leave_command = (message, server_queue, guild) => {
    /*
    if (false) {
        message.channel.send("I need to be in a channel to leave it.");
        message.channel.send(message.guild.voiceConnection);
        return;
    } 
    */
    if (!queue.get(guild.id)) return message.reply("Leave what?");
    message.channel.send("***Later gamers***");
    server_queue.songs = [];
    
    queue.delete(message.guild.id);
    server_queue.voice_channel.leave();
}

const loop_song = (server_queue) => {
    let loop = server_queue.loop
    if (!loop) server_queue.loop = true;
    else server_queue.loop = false;
    server_queue.text_channel.send(`🔁**Loop is now set to** ${server_queue.loop}`)
}

const shuffle = (message, server_queue) => {
    return
}
const now_playing = (message, server_queue) => {
    if (typeof server_queue.songs[0].title !== 'undefined') message.channel.send(`**Currently playing** ${server_queue.songs[0].title}`)
    else message.channel.send(`**Currently playing** ${server_queue.songs[1].title}`)
}

const change_bitrate = (message, server_queue, args) => {
    if (!args.length) return message.channel.send(`👾 **Bitrate is currently** ${server_queue.bitrate}`) ;
    bitrate_int = parseInt(args)

    if (bitrate_int !== NaN || bitrate_int <= 0) {
        server_queue.bitrate = bitrate_int;
        server_queue.connection.dispatcher.setBitrate(server_queue.bitrate);
        message.channel.send(`👾**Volume is now** ${server_queue.bitrate}`)
    } else {
        message.reply("Why?")
    }

}  

const help = (message) => {
    let help_embed = new MessageEmbed() 
        .setColor('#0099ff')
        .setTitle('HELP ME!')
        .addFields(
            { name: '~help | ~h', value: 'Shows this thing you are looking at.' },
            { name: '~play | ~p', value: 'Play a song!' },
            { name: '~skip | ~s', value: 'Skips the current song.' },
            { name: '~leave | ~l', value: 'Makes me leave the call.' },
            { name: '~queue | ~q', value: 'Shows the queue.' },
            { name: '~nowplaying | ~np', value: 'Shows the current song.' },
            { name: '~volume | ~v', value: 'Set the volume to your liking. [Default = 1]' },
            { name: '~loop', value: 'Loop the current song.' },
            { name: '~shuffle', value: 'Shuffles the queue. [NOT WORKING]' },
        );
    
        message.reply(help_embed);
}

const check_queue = (message, server_queue) => {
    if (!server_queue){
        return message.channel.send(`**There are no songs in queue** 😔`);
    }

    let embed_queue = new MessageEmbed() 
        .setColor('#0099ff')
        .setTitle('Song Queue');
    for(let song of server_queue.songs) {
        embed_queue.addField(song.title, song.url);
    }
    message.channel.send(embed_queue);
} 
