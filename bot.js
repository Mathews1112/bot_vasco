const { Client, GatewayIntentBits } = require('discord.js');
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

            // Ajuste para o fuso horário correto
            const dataAtual = new Date(new Date().toLocaleString('en-US', { timeZone: FUSO_HORARIO }));
            const dataInicio = new Date(horarioInicio * 1000);
            dataAtual.setHours(0, 0, 0, 0);
            dataInicio.setHours(0, 0, 0, 0);

            const diasAteJogo = Math.ceil((dataInicio - dataAtual) / (1000 * 60 * 60 * 24));

            return {
                nomeTorneio,
                timeCasa,
                timeVisitante,
                estadio,
                dataInicio,
                diasAteJogo,
                ehHoje:
                    formatarData(dataInicio, { year: 'numeric', month: '2-digit', day: '2-digit' }) ===
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

const cliente = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

cliente.once('ready', () => {
    console.log(`Bot está online como ${cliente.user.tag}!`);

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

cliente.login(DISCORD_TOKEN);
