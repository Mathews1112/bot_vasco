const { Client, GatewayIntentBits } = require('discord.js');
const https = require('https');
require('dotenv').config();
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ID_TIME = 1974;
const API_BASE = 'https://api.sofascore.com/api/v1';
const FUSO_HORARIO = 'America/Sao_Paulo';

function formatarData(data, opcoes = {}) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO_HORARIO,
        ...opcoes,
    }).format(data);
}

function obterProximoJogo(idTime) {
    return new Promise((resolve, reject) => {
        const url = `${API_BASE}/team/${idTime}/events/next/0`;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        };

        https.get(url, options, (res) => {
            let data = '';

            console.error(`Status Code: ${res.statusCode}`);

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.error('Resposta da API:', data);
                try {
                    const dados = JSON.parse(data);
                    if (dados.events && dados.events.length > 0) {
                        const proximoEvento = dados.events[0];
                        const nomeTorneio = proximoEvento.tournament.name;
                        const timeCasa = proximoEvento.homeTeam.name;
                        const timeVisitante = proximoEvento.awayTeam.name;
                        const estadio = proximoEvento.venue?.stadium || 'Local não informado';
                        const horarioInicio = proximoEvento.startTimestamp;
                        const dataInicio = new Date(horarioInicio * 1000);
                        const dataAtual = new Date();
                        const diasAteJogo = Math.ceil((dataInicio - dataAtual) / (1000 * 60 * 60 * 24));

                        resolve({
                            nomeTorneio,
                            timeCasa,
                            timeVisitante,
                            estadio,
                            dataInicio,
                            diasAteJogo,
                            ehHoje: formatarData(dataInicio, { year: 'numeric', month: '2-digit', day: '2-digit' }) ===
                                    formatarData(dataAtual, { year: 'numeric', month: '2-digit', day: '2-digit' }),
                        });
                    } else {
                        console.error('Nenhum evento encontrado na resposta.');
                        resolve(null);
                    }
                } catch (erro) {
                    console.error('Erro ao processar resposta da API:', erro.message);
                    resolve(null);
                }
            });
        }).on('error', (erro) => {
            console.error('Erro na requisição HTTPS:', erro.message);
            resolve(null);
        });
    });
}

const cliente = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

cliente.once('ready', () => {
    console.error(`Bot está online como ${cliente.user.tag}!`);

    setInterval(async () => {
        const canal = cliente.channels.cache.find(canal => canal.name === 'geral');
        if (canal) {
            const jogo = await obterProximoJogo(ID_TIME);
            if (jogo) {
                if (jogo.ehHoje) {
                    canal.send(`🔥 **Hoje tem jogo do Gigante!**\n🏆 **Campeonato:** ${jogo.nomeTorneio}\n⚔️ **Contra:** ${jogo.timeVisitante === 'Vasco da Gama' ? jogo.timeCasa : jogo.timeVisitante}\n⏰ **Horário:** ${formatarData(jogo.dataInicio, { hour: '2-digit', minute: '2-digit' })}`);
                } else {
                    canal.send(`⚽ **Próximo jogo do Vasco:**\n🏆 **Campeonato:** ${jogo.nomeTorneio}\n🏠 **Time da Casa:** ${jogo.timeCasa}\n🛫 **Time Visitante:** ${jogo.timeVisitante}\n⏰ **Horário:** ${formatarData(jogo.dataInicio, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}\n📅 **Dias Restantes:** ${jogo.diasAteJogo} dia(s)`);
                }
            } else {
                canal.send('Nenhum jogo encontrado para o Vasco.');
            }
        }
    }, 24 * 60 * 60 * 1000);

    console.error('Tarefas agendadas para mensagens diárias.');
});

cliente.login(DISCORD_TOKEN);
