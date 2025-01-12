const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ID_TIME = 1974;
const API_BASE = 'https://api.sofascore.com/api/v1';
const FUSO_HORARIO = 'America/Sao_Paulo';

// Validação do Token
if (!DISCORD_TOKEN) {
    console.error('Erro: DISCORD_TOKEN não definido no arquivo .env');
    process.exit(1);
}

// Função para formatar a data
function formatarData(data, opcoes = {}) {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO_HORARIO,
        ...opcoes,
    }).format(data);
}

// Função para obter o próximo jogo
async function obterProximoJogo(idTime) {
    try {
        const resposta = await axios.get(`${API_BASE}/team/${idTime}/events/next/0`);
        if (resposta.status === 200 && resposta.data.events && resposta.data.events.length > 0) {
            const proximoEvento = resposta.data.events[0];
            const nomeTorneio = proximoEvento.tournament.name;
            const timeCasa = proximoEvento.homeTeam.name;
            const timeVisitante = proximoEvento.awayTeam.name;
            const estadio = proximoEvento.venue?.stadium || 'Local não informado';
            const horarioInicio = proximoEvento.startTimestamp;

            // Ajuste com fuso horário correto
            const dataAtual = new Date(new Date().toLocaleString('en-US', { timeZone: FUSO_HORARIO }));
            const dataInicio = new Date(horarioInicio * 1000);

            // Cálculo mais preciso dos dias restantes
            const diffTime = dataInicio - dataAtual;
            const diasAteJogo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return {
                nomeTorneio,
                timeCasa,
                timeVisitante,
                estadio,
                dataInicio,
                diasAteJogo,
                ehHoje: formatarData(dataInicio, { year: 'numeric', month: '2-digit', day: '2-digit' }) ===
                        formatarData(dataAtual, { year: 'numeric', month: '2-digit', day: '2-digit' }),
            };
        } else {
            return null;
        }
    } catch (erro) {
        console.error('Erro ao buscar informações do próximo jogo:', erro.message);
        return null;
    }
}

// Criação do cliente Discord
const cliente = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

cliente.once('ready', () => {
    console.log(`Bot está online como ${cliente.user.tag}!`);

    // Agendamento diário
    cron.schedule('0 12 * * *', async () => {
        const canal = cliente.channels.cache.find(canal => canal.name === 'geral');
        if (canal) {
            const jogo = await obterProximoJogo(ID_TIME);
            if (jogo) {
                if (jogo.ehHoje) {
                    canal.send(
                        `🔥 **Hoje tem jogo do Gigante!**\n🏆 **Campeonato:** ${jogo.nomeTorneio}\n⚔️ **Contra:** ${
                            jogo.timeVisitante === 'Vasco da Gama' ? jogo.timeCasa : jogo.timeVisitante
                        }\n⏰ **Horário:** ${formatarData(jogo.dataInicio, { hour: '2-digit', minute: '2-digit' })}`
                    );
                } else {
                    canal.send(
                        `⚽ **Próximo jogo do Vasco:**\n🏆 **Campeonato:** ${jogo.nomeTorneio}\n🏠 **Time da Casa:** ${jogo.timeCasa}\n🛫 **Time Visitante:** ${jogo.timeVisitante}\n⏰ **Horário:** ${formatarData(jogo.dataInicio, {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}\n📅 **Dias Restantes:** ${jogo.diasAteJogo} dia(s)`
                    );
                }
            } else {
                canal.send('Nenhum jogo encontrado para o Vasco.');
            }
        }
    });

    console.log('Tarefas agendadas para mensagens diárias e alertas de jogo.');
});

// Comando manual: !vasco
cliente.on('messageCreate', async mensagem => {
    if (mensagem.content.toLowerCase() === '!vasco') {
        const jogo = await obterProximoJogo(ID_TIME);
        if (jogo) {
            if (jogo.ehHoje) {
                mensagem.channel.send(
                    `🔥 **Hoje tem jogo do Gigante!**\n🏆 **Campeonato:** ${jogo.nomeTorneio}\n⚔️ **Contra:** ${
                        jogo.timeVisitante === 'Vasco da Gama' ? jogo.timeCasa : jogo.timeVisitante
                    }\n⏰ **Horário:** ${formatarData(jogo.dataInicio, { hour: '2-digit', minute: '2-digit' })}`
                );
            } else {
                mensagem.channel.send(
                    `⚽ **Próximo jogo do Vasco:**\n🏆 **Campeonato:** ${jogo.nomeTorneio}\n🏠 **Time da Casa:** ${jogo.timeCasa}\n🛫 **Time Visitante:** ${jogo.timeVisitante}\n⏰ **Horário:** ${formatarData(jogo.dataInicio, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}\n📅 **Dias Restantes:** ${jogo.diasAteJogo} dia(s)`
                );
            }
        } else {
            mensagem.channel.send('Nenhum jogo encontrado para o Vasco.');
        }
    }
});

// Login do bot
cliente.login(DISCORD_TOKEN);
