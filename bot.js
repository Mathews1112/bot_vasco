const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const https = require('https');
const cron = require('node-cron');
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ID_TIME = 1974;
const API_BASE = 'https://api.sofascore.com/api/v1';
const FUSO_HORARIO = 'America/Sao_Paulo';

// Variáveis de cache
let cacheJogo = null;
let cacheDataExpiracao = null;

function formatarData(data, opcoes = {}) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO_HORARIO,
        ...opcoes,
    }).format(data);
}

function fazerRequisicao(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let dados = '';

            res.on('data', (chunk) => {
                dados += chunk;
            });

            res.on('end', () => {
                try {
                    const json = JSON.parse(dados);
                    resolve(json);
                } catch (erro) {
                    reject(new Error('Erro ao analisar resposta JSON.'));
                }
            });
        }).on('error', (erro) => {
            reject(erro);
        });
    });
}

async function obterProximoJogo(idTime) {
    const agora = new Date();

    if (cacheJogo && cacheDataExpiracao && agora < cacheDataExpiracao) {
        return cacheJogo;
    }

    try {
        const url = `${API_BASE}/team/${idTime}/events/next/0`;
        const dados = await fazerRequisicao(url);

        if (dados.events && dados.events.length > 0) {
            const proximoEvento = dados.events[0];
            const horarioInicio = proximoEvento.startTimestamp * 1000;
            const dataInicio = new Date(horarioInicio);
            const dataAtual = new Date();

            cacheJogo = {
                nomeTorneio: proximoEvento.tournament.name,
                timeCasa: proximoEvento.homeTeam.name,
                timeVisitante: proximoEvento.awayTeam.name,
                estadio: proximoEvento.venue?.stadium || 'Local não informado',
                dataInicio,
                ehHoje: formatarData(dataInicio) === formatarData(dataAtual),
            };

            cacheDataExpiracao = new Date(agora.getTime() + 6 * 60 * 60 * 1000);

            return cacheJogo;
        }
        return null;
    } catch (erro) {
        console.error('Erro ao buscar informações do próximo jogo:', erro.message);
        return null;
    }
}

const cliente = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

cliente.once('ready', () => {
    console.log(`Bot está online como ${cliente.user.tag}!`);

    cron.schedule('0 9 * * *', async () => {
        const jogo = await obterProximoJogo(ID_TIME);

        if (jogo && jogo.ehHoje) {
            const canal = cliente.channels.cache.find(canal => canal.name === 'planeta-vegetti99');
            if (canal) {
                const mensagem = `🔥 **Hoje tem jogo do Gigante!**\n🏆 **Campeonato:** ${jogo.nomeTorneio}\n⚔️ **Contra:** ${jogo.timeVisitante}\n⏰ **Horário:** ${formatarData(jogo.dataInicio, { hour: '2-digit', minute: '2-digit' })}`;
                canal.send(mensagem);
            } else {
                console.error('Canal não encontrado.');
            }
        }
    });

    console.log('Tarefa agendada para enviar mensagem no dia do jogo às 9h.');
});

cliente.on('messageCreate', async mensagem => {
    if (mensagem.content.toLowerCase() === '!vasco') {
        const jogo = await obterProximoJogo(ID_TIME);
        if (jogo) {
            const mensagemResposta = jogo.ehHoje
                ? `🔥 **Hoje tem jogo do Gigante!**\n🏆 **Campeonato:** ${jogo.nomeTorneio}\n⚔️ **Contra:** ${jogo.timeVisitante}\n⏰ **Horário:** ${formatarData(jogo.dataInicio, { hour: '2-digit', minute: '2-digit' })}`
                : `⚽ **Próximo jogo do Vascão:**\n🏆 **Campeonato:** ${jogo.nomeTorneio}\n🏠 **Time da Casa:** ${jogo.timeCasa}\n🛫 **Time Visitante:** ${jogo.timeVisitante}\n⏰ **Horário:** ${formatarData(jogo.dataInicio, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
            mensagem.channel.send(mensagemResposta);
        } else {
            mensagem.channel.send('Nenhum jogo encontrado para o Vasco.');
        }
    }
});

cliente.login(DISCORD_TOKEN);
