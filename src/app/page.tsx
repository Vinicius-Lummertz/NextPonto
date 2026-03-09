'use client';

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import Link from 'next/link';

type Ponto = {
    id: number;
    data: string;
    entrada?: string;
    almoco_saida?: string;
    almoco_retorno?: string;
    saida_final?: string;
};

const DB_URL = "mysql://root:@localhost:3306/nextponto";

export default function PontoEletronico() {
    const [username, setUsername] = useState('Carregando...');
    const [historicoMes, setHistoricoMes] = useState<Ponto[]>([]);
    const [pontoHoje, setPontoHoje] = useState<Ponto | null>(null);
    const [proximoPonto, setProximoPonto] = useState('Entrada');
    const [tipoPerfil, setTipoPerfil] = useState<'ESTAGIARIO' | 'GESTOR' | 'ESTAGIARIO_GESTOR'>('ESTAGIARIO');
    const [loading, setLoading] = useState(true);

    // 1. Inicializa: Tauri -> Nome -> Tauri SQL
    useEffect(() => {
        async function loadData() {
            try {
                let name = 'Dev.Local';
                try {
                    // @ts-ignore - Ignore the missing typings if not fully typed
                    name = await invoke<string>('get_windows_user');
                } catch (e) {
                    console.log('Tauri não detectado, rodando fallback mockado');
                }
                setUsername(name);

                try {
                    // @ts-ignore
                    if (!window.__TAURI_INTERNALS__) {
                        throw new Error("Aplicativo aberto no Navegador! Feche esta guia e abra o programa PontoEletronico (.exe) instalado, ele é necessário para acessar o Banco de Dados.");
                    }
                    const db = await Database.load(DB_URL);

                    const perfilQuery = await db.select<{ tipo_perfil: string }[]>(
                        `SELECT tipo_perfil FROM Estagiarios WHERE nome_usuario = ?`,
                        [name]
                    );

                    if (perfilQuery.length > 0) {
                        setTipoPerfil(perfilQuery[0].tipo_perfil as 'ESTAGIARIO' | 'GESTOR' | 'ESTAGIARIO_GESTOR');
                    }

                    const historico = await db.select<Ponto[]>(
                        `SELECT * FROM Ponto WHERE username = ? AND data >= DATE_SUB(NOW(), INTERVAL 1 MONTH) ORDER BY data DESC`,
                        [name]
                    );

                    const now = new Date();
                    const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
                    const todayStr = localDate.toISOString().split('T')[0];
                    const hoje = historico.find(p => p.data.toString().startsWith(todayStr)) || null;

                    let next = 'Entrada';
                    if (hoje) {
                        if (hoje.saida_final) next = 'Turno Concluído';
                        else if (hoje.almoco_retorno) next = 'Saída Final';
                        else if (hoje.almoco_saida) next = 'Retorno do Almoço';
                        else next = 'Ida ao Almoço';
                    }

                    setHistoricoMes(historico);
                    setPontoHoje(hoje);
                    setProximoPonto(next);
                } catch (e: any) {
                    console.error("Erro banco SQL:", e);
                    setUsername(`Erro Crítico: ${e.message}`);
                }
            } finally { setLoading(false); }
        }
        loadData();
    }, []);

    // 2. Acionar Registro
    const registrar = async () => {
        setLoading(true);
        try {
            const db = await Database.load(DB_URL);
            const now = new Date();
            const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
            const todayStr = localDate.toISOString().split('T')[0];
            const sqlTime = localDate.toISOString().slice(0, 19).replace('T', ' ');

            const result = await db.select<Ponto[]>(
                `SELECT * FROM Ponto WHERE username = ? AND data = ? LIMIT 1`,
                [username, todayStr]
            );

            let ponto = result[0] || null;
            let next = 'Turno Concluído';

            if (!ponto) {
                await db.execute(
                    `INSERT INTO Ponto (username, data, entrada) VALUES (?, ?, ?)`,
                    [username, todayStr, sqlTime]
                );
                const inserted = await db.select<Ponto[]>(
                    `SELECT * FROM Ponto WHERE username = ? AND data = ? LIMIT 1`,
                    [username, todayStr]
                );
                ponto = inserted[0];
                next = 'Ida ao Almoço';
            } else if (!ponto.almoco_saida) {
                await db.execute(`UPDATE Ponto SET almoco_saida = ? WHERE id = ?`, [sqlTime, ponto.id]);
                ponto.almoco_saida = localDate.toISOString().slice(0, 19);
                next = 'Retorno do Almoço';
            } else if (!ponto.almoco_retorno) {
                await db.execute(`UPDATE Ponto SET almoco_retorno = ? WHERE id = ?`, [sqlTime, ponto.id]);
                ponto.almoco_retorno = localDate.toISOString().slice(0, 19);
                next = 'Saída Final';
            } else if (!ponto.saida_final) {
                await db.execute(`UPDATE Ponto SET saida_final = ? WHERE id = ?`, [sqlTime, ponto.id]);
                ponto.saida_final = localDate.toISOString().slice(0, 19);
                next = 'Turno Concluído';
            } else {
                setLoading(false);
                return;
            }

            setPontoHoje(ponto);
            setProximoPonto(next);

            setHistoricoMes(prev => {
                const existsInfo = prev.find(p => p.id === ponto!.id);
                return existsInfo ? prev.map(p => p.id === ponto!.id ? ponto! : p) : [ponto!, ...prev];
            });

        } catch (e) {
            console.error(e);
        } finally { setLoading(false); }
    };

    // 3. Cálculo de horas úteis (Carga 8h diária)
    const calcularSaldo = () => {
        let horasDia = 0;

        historicoMes.forEach(p => {
            if (!p.entrada) return;
            const tIn = new Date(p.entrada).getTime();
            let tempoUtil = 0;

            if (p.almoco_saida) { // Fez primeira perna (Entrada->Almoço)
                tempoUtil += new Date(p.almoco_saida).getTime() - tIn;
                if (p.almoco_retorno) { // Fez segunda perna (Retorno->Saída)
                    const tRetorno = new Date(p.almoco_retorno).getTime();
                    const tOut = p.saida_final ? new Date(p.saida_final).getTime() : new Date().getTime();
                    tempoUtil += tOut - tRetorno;
                }
            } else { // Não saiu pro almoço ainda (Entrada -> Agora)
                const tOut = p.saida_final ? new Date(p.saida_final).getTime() : new Date().getTime();
                tempoUtil += tOut - tIn;
            }
            horasDia += tempoUtil / 3600000;
        });

        // Se a pessoa estiver trabalhando hoje e a contagem for dinâmica:
        const todayStr = new Date().toISOString().split('T')[0];
        // Conta a quantidade de dias do histórico (isso seria na semana? O App todo tava calculando histórico geral. Vamos ignorar hoje na expectativa:
        const isTodayInHistory = historicoMes.some(p => new Date(p.data).toISOString().split('T')[0] === todayStr);
        const pastDaysCnt = isTodayInHistory ? historicoMes.length - 1 : historicoMes.length;
        const esperado = pastDaysCnt * 8;
        return { horasDia, esperado, saldo: horasDia - esperado };
    };

    const formatHorasText = (horas: number) => {
        const ms = horas * 3600000;
        const totalMinutes = Math.floor(ms / 60000);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;

        let timeStr = '';
        if (hrs > 0) timeStr += `${hrs} hora${hrs > 1 ? 's' : ''}`;
        if (mins > 0) {
            if (hrs > 0) timeStr += ' e ';
            timeStr += `${mins} min`;
        }
        if (hrs === 0 && mins === 0) return '0 min';
        return timeStr;
    };

    const { horasDia, esperado, saldo } = calcularSaldo();
    const formatTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

    // Configuração visual do botão Redondo
    let btnCor = 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30';
    if (proximoPonto === 'Entrada') btnCor = 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/40';
    else if (proximoPonto.includes('Almoço')) btnCor = 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/40';
    else if (proximoPonto === 'Saída Final') btnCor = 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/40';

    const isOk = saldo >= 0;
    const saldoCorCmp = isOk ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Calculate specifically today's worked hours to show below the history
    const calcularHorasHoje = () => {
        if (!pontoHoje || !pontoHoje.entrada) return 0;

        const tIn = new Date(pontoHoje.entrada).getTime();
        let tempoUtil = 0;

        if (pontoHoje.almoco_saida) {
            tempoUtil += new Date(pontoHoje.almoco_saida).getTime() - tIn;
            if (pontoHoje.almoco_retorno) {
                const tRetorno = new Date(pontoHoje.almoco_retorno).getTime();
                const tOut = pontoHoje.saida_final ? new Date(pontoHoje.saida_final).getTime() : new Date().getTime();
                tempoUtil += tOut - tRetorno;
            }
        } else {
            const tOut = pontoHoje.saida_final ? new Date(pontoHoje.saida_final).getTime() : new Date().getTime();
            tempoUtil += tOut - tIn;
        }

        return tempoUtil / 3600000;
    };
    const horasHoje = calcularHorasHoje();

    return (
        <div className="np-page np-home-page min-h-screen bg-neutral-100 flex items-center justify-center p-6 font-sans">
            <div className="max-w-5xl w-full flex flex-col md:flex-row gap-6">

                {/* Principal - Botão */}
                {tipoPerfil !== 'GESTOR' ? (
                    <div className="flex-1 bg-white rounded-3xl p-10 shadow-sm border border-neutral-200 flex flex-col items-center justify-center gap-12">
                        <div className="text-center">
                            <h1 className="text-2xl font-semibold text-neutral-800 tracking-tight">
                                Registrando ponto para o dia: {formatDate(new Date())}
                            </h1>
                            <p className="text-sm text-neutral-500 mt-2">Logado como: <strong className="text-neutral-800">{username}</strong></p>
                        </div>

                        <button
                            disabled={proximoPonto === 'Turno Concluído' || loading}
                            onClick={registrar}
                            className={`peer cursor-pointer w-64 h-64 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-105 active:scale-95 shadow-xl ${proximoPonto === 'Turno Concluído' ? 'bg-neutral-300 pointer-events-none' : btnCor}`}
                        >
                            <div className="absolute inset-2 border-4 border-white/20 rounded-full pointer-events-none"></div>
                            <span className="cursor-pointer text-3xl font-bold tracking-tight px-4 leading-tight whitespace-pre-line text-center">
                                {loading ? 'Aguarde...' : (proximoPonto === 'Turno Concluído' ? 'Até amanhã!' : `Registrar\n${proximoPonto}`)}
                            </span>
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 bg-white rounded-3xl p-10 shadow-sm border border-neutral-200 flex flex-col items-center justify-center">
                        <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center mb-6">
                            <span className="text-4xl">👋</span>
                        </div>
                        <h1 className="text-3xl font-bold text-neutral-800 tracking-tight mb-2">
                            Olá, {username.split(' ')[0]}
                        </h1>
                        <p className="text-neutral-500 text-center max-w-sm">
                            Seu perfil está configurado como <strong>Gestor</strong>. Utilize o painel lateral para acessar as ferramentas administrativas da equipe.
                        </p>
                    </div>
                )}

                {/* Dashboard Direito */}
                <div className="w-full md:w-96 flex flex-col gap-6">

                    {/* Card Histórico Diário */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-200">
                        <h3 className="text-lg font-semibold text-neutral-800 mb-6 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            Histórico de Hoje
                        </h3>
                        <div className="space-y-4">
                            <LogItem label="Chegada" time={formatTime(pontoHoje?.entrada)} active={!!pontoHoje?.entrada} />
                            <LogItem label="Ida ao Almoço" time={formatTime(pontoHoje?.almoco_saida)} active={!!pontoHoje?.almoco_saida} />
                            <LogItem label="Retorno do Almoço" time={formatTime(pontoHoje?.almoco_retorno)} active={!!pontoHoje?.almoco_retorno} />
                            <LogItem label="Saída Final" time={formatTime(pontoHoje?.saida_final)} active={!!pontoHoje?.saida_final} />
                        </div>
                        {pontoHoje && (
                            <div className="mt-6 pt-6 border-t border-neutral-100 flex items-center text-neutral-800">
                                <span className="text-sm font-semibold mr-2">Total Trabalhado no Dia</span>
                                <span className="font-mono font-bold text-sm text-emerald-600">{formatHorasText(horasHoje)}</span>
                            </div>
                        )}
                    </div>

                    {/* Ações Gerenciais */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-200 flex flex-col gap-3">
                        <Link href="/resumo" className="w-full text-center py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-xl transition-colors shrink-0">
                            Ver Resumo Mensal
                        </Link>
                        <Link href="/relatorio" className="w-full text-center py-3 px-4 bg-neutral-800 hover:bg-neutral-900 text-white font-medium rounded-xl transition-colors shrink-0">
                            Gerar Relatório Técnico PDF
                        </Link>
                    </div>

                    {/* Módulo Admin */}
                    {(tipoPerfil === 'GESTOR' || tipoPerfil === 'ESTAGIARIO_GESTOR' || username === 'Vinicius Gomes') && (
                        <div className="bg-neutral-900 rounded-3xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.1)] border border-neutral-800 flex flex-col gap-3 group transition-all hover:bg-black peer-hover:border-transparent peer-hover:shadow-none">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-amber-400 text-xl group-hover:scale-110 transition-transform">🛡️</span>
                                <h4 className="text-white font-semibold flex-1 tracking-wide">Gestão da Equipe</h4>
                            </div>
                            <Link href="/admin" className="w-full text-center py-3 px-4 bg-amber-500 hover:bg-amber-400 text-neutral-900 font-bold rounded-xl transition-all shrink-0 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] peer-hover:opacity-0 peer-hover:pointer-events-none duration-300">
                                Painel Administrativo
                            </Link>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

// Subcomponente de lista de ponto
function LogItem({ label, time, active }: { label: string, time: string, active: boolean }) {
    return (
        <div className="flex justify-between items-center bg-neutral-50 p-3 rounded-xl border border-transparent hover:border-neutral-200 transition-colors">
            <span className={`text-sm font-medium ${active ? 'text-neutral-800' : 'text-neutral-400'}`}>
                {label}
            </span>
            <span className={`font-mono text-base ${active ? 'text-neutral-900 font-semibold' : 'text-neutral-300'}`}>
                {time}
            </span>
        </div>
    );
}
