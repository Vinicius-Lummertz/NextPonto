'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Upload, X, PanelRightClose, PanelRightOpen, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

const DB_URL = "mysql://root:@localhost:3306/nextponto";

type Ponto = {
    id: number;
    data: string;
    entrada?: string;
    almoco_saida?: string;
    almoco_retorno?: string;
    saida_final?: string;
};

export default function ResumoMensal() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [historico, setHistorico] = useState<Ponto[]>([]);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('Dev.Local');
    const [jornadaEsperada, setJornadaEsperada] = useState(8); // Dinâmico do Banco
    const [dataContratacao, setDataContratacao] = useState('2000-01-01'); // Limite para Faltas
    const [dataInicioFerias, setDataInicioFerias] = useState<string | null>(null); // Férias
    const [isAdminViewer, setIsAdminViewer] = useState(false); // Flag de visualização pelo painel admin

    // Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Modal State
    const [selectedFalta, setSelectedFalta] = useState<string | null>(null);
    const [justificativa, setJustificativa] = useState('');
    const [anexoPath, setAnexoPath] = useState<string | null>(null);

    // Carregar Dados
    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                let name = 'Dev.Local';
                try {
                    // @ts-ignore
                    name = await invoke<string>('get_windows_user');
                } catch (e) { }

                if (name === 'Vinicius Gomes' || name === 'Dev.Local') {
                    const params = new URLSearchParams(window.location.search);
                    const queryUser = params.get('user');
                    if (queryUser) {
                        name = queryUser;
                        setIsAdminViewer(true);
                    }
                }

                setUsername(name);

                const db = await Database.load(DB_URL);

                // Pega o mês ativo
                const month = currentDate.getMonth() + 1;
                const year = currentDate.getFullYear();

                const data = await db.select<Ponto[]>(
                    `SELECT * FROM Ponto WHERE username = ? AND MONTH(data) = ? AND YEAR(data) = ?`,
                    [name, month, year]
                );

                try {
                    const estagiarioRow = await db.select<{ jornada_diaria: number, data_inicio_ferias: string | null }[]>(
                        `SELECT jornada_diaria, data_inicio_ferias FROM Estagiarios WHERE nome_usuario = ?`,
                        [name]
                    );
                    if (estagiarioRow.length > 0) {
                        setJornadaEsperada(estagiarioRow[0].jornada_diaria);
                        if (estagiarioRow[0].data_inicio_ferias) {
                            setDataInicioFerias(new Date(estagiarioRow[0].data_inicio_ferias).toISOString().split('T')[0]);
                        }
                    }
                } catch (e) {
                    console.warn("Estagiario nao cadastrado na tabela, fallback 8h ativado", e);
                }

                setHistorico(data);
            } catch (e) {
                console.error("Erro banco SQL:", e);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [currentDate]);

    // Helpers Calendário
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 (Dom) a 6 (Sab)

    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

    // Gerar grid do calendário apenas de Seg a Sex
    const year = currentDate.getFullYear();
    const monthIndex = currentDate.getMonth(); // 0-11
    const daysInMonthCalculated = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, monthIndex, 1).getDay(); // 0(Dom) a 6(Sab)

    const calendarCells: (number | null)[] = [];

    if (firstDayOfWeek > 1 && firstDayOfWeek <= 5) {
        for (let i = 1; i < firstDayOfWeek; i++) {
            calendarCells.push(null);
        }
    }

    for (let day = 1; day <= daysInMonthCalculated; day++) {
        const d = new Date(year, monthIndex, day);
        const dayOfWeek = d.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Seg a Sex
            calendarCells.push(day);
        }
    }

    // Preencher o final para completar a última linha do grid de 5 colunas
    while (calendarCells.length % 5 !== 0) {
        calendarCells.push(null);
    }

    // Header actions
    const prevMonth = () => setCurrentDate(new Date(year, monthIndex - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, monthIndex + 1, 1));

    const todayDateStr = new Date().toISOString().split('T')[0];

    // Cálculos de KPIs
    let totalWorkedMs = 0;
    let totalLunchMs = 0;
    let lunchCount = 0;
    let faltasCount = 0;

    const weeks: { weekTitle: string; worked: number; expected: number; }[] = [];
    let currentWeekWorked = 0;
    let currentWeekExpected = 0;
    let weekCounter = 1;

    for (let i = 0; i < calendarCells.length; i++) {
        const day = calendarCells[i];

        let dayWorkedMs = 0;
        let dayExpectedMs = 0;

        if (day !== null) {
            const loopDate = new Date(year, monthIndex, day);
            const loopDateStr = new Date(loopDate.getTime() - (loopDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const isPast = loopDateStr < todayDateStr;
            const isToday = loopDateStr === todayDateStr;
            const record = historico.find(p => p.data.toString().startsWith(loopDateStr));
            const isBeforeHireDate = loopDateStr < dataContratacao;

            let isVacation = false;
            if (dataInicioFerias) {
                const diffTime = loopDate.getTime() - new Date(dataInicioFerias).getTime();
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                if (diffDays >= 0 && diffDays <= 14) isVacation = true;
            }

            if ((isPast || isToday) && !isBeforeHireDate && !isVacation) {
                dayExpectedMs = jornadaEsperada * 3600000; // Horas dinâmicas baseado no DB
            }

            if (record && record.entrada) {
                const tIn = new Date(record.entrada).getTime();
                if (record.almoco_saida) {
                    const lOut = new Date(record.almoco_saida).getTime();
                    dayWorkedMs += (lOut - tIn);

                    if (record.almoco_retorno) {
                        const lIn = new Date(record.almoco_retorno).getTime();
                        totalLunchMs += (lIn - lOut);
                        lunchCount++;

                        const tOut = record.saida_final ? new Date(record.saida_final).getTime() : new Date().getTime();
                        if (isToday || record.saida_final) {
                            dayWorkedMs += (tOut - lIn);
                        }
                    }
                } else {
                    const tOut = record.saida_final ? new Date(record.saida_final).getTime() : (isToday ? new Date().getTime() : tIn);
                    dayWorkedMs += (tOut - tIn);
                }
            } else if (isPast && !record && !isBeforeHireDate && !isVacation) {
                faltasCount++;
            }

            totalWorkedMs += dayWorkedMs;
            currentWeekWorked += dayWorkedMs;
            currentWeekExpected += dayExpectedMs;
        }

        // Se fechou uma semana (5 dias) ou é o último dia
        if ((i + 1) % 5 === 0) {
            if (currentWeekExpected > 0 || currentWeekWorked > 0) {
                weeks.push({
                    weekTitle: `Semana ${weekCounter}`,
                    worked: currentWeekWorked,
                    expected: currentWeekExpected
                });
            }
            weekCounter++;
            currentWeekWorked = 0;
            currentWeekExpected = 0;
        }
    }

    const formatHorasText = (ms: number, forceSign = false) => {
        if (!ms) return '0h';
        const isNegative = ms < 0;
        const absMs = Math.abs(ms);
        const totalMinutes = Math.floor(absMs / 60000);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;

        let timeStr = '';
        if (hrs > 0) timeStr += `${hrs}h`;
        if (mins > 0) timeStr += ` ${mins}m`;
        if (hrs === 0 && mins === 0) return '0h';
        return (isNegative ? '-' : (forceSign ? '+' : '')) + timeStr.trim();
    };

    const totalHoursStr = formatHorasText(totalWorkedMs);
    const avgLunchMins = lunchCount > 0 ? Math.floor((totalLunchMs / lunchCount) / 60000) : 0;

    const handleFileOpen = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Documentos',
                    extensions: ['pdf', 'png', 'jpg', 'jpeg']
                }]
            });
            if (selected) {
                setAnexoPath(selected as string);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSalvarJustificativa = async () => {
        if (!selectedFalta || !justificativa) {
            alert("Escreva o motivo da justificativa!");
            return;
        }

        try {
            const db = await Database.load(DB_URL);

            // Tenta criar was a precaution, but the admin page creates it
            await db.execute(`
                CREATE TABLE IF NOT EXISTS Justificativas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(150),
                    data_falta DATE,
                    motivo TEXT,
                    anexo_path TEXT,
                    status_aprovacao ENUM('PENDENTE', 'APROVADA', 'RECUSADA') DEFAULT 'PENDENTE'
                )
            `);

            await db.execute(
                `INSERT INTO Justificativas (username, data_falta, motivo, anexo_path) VALUES (?, ?, ?, ?)`,
                [username, selectedFalta, justificativa, anexoPath || null]
            );

            alert("Sua justificativa foi enviada para o administrador com sucesso!");
            setSelectedFalta(null);
            setJustificativa('');
            setAnexoPath(null);
        } catch (e) {
            console.error("Erro ao salvar justificativa:", e);
            alert("Falha de conexão.");
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFDFD] font-sans flex text-neutral-800">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center p-8 transition-all duration-500 ease-in-out">
                <div className={`w-full max-w-6xl transition-all duration-500 ${isSidebarOpen ? 'pr-80' : ''}`}>

                    {/* Header Row */}
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition flex-shrink-0">
                                <ArrowLeft size={20} />
                                <span className="font-medium">Ao Ponto</span>
                            </Link>

                            {isAdminViewer && (
                                <Link href="/admin" className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200 font-bold transition flex-shrink-0 shadow-sm">
                                    <ArrowLeft size={16} /> Voltar ao Painel Admin
                                </Link>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <button onClick={prevMonth} className="p-2 hover:bg-neutral-100 rounded-full transition"><ChevronLeft /></button>
                            <h2 className="text-2xl font-semibold w-auto min-w-[12rem] text-center text-neutral-800 flex flex-col items-center">
                                <span className="capitalize">{currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                                {isAdminViewer && <span className="text-sm text-neutral-500 font-normal">Dashboard de {username}</span>}
                            </h2>
                            <button onClick={nextMonth} className="p-2 hover:bg-neutral-100 rounded-full transition"><ChevronRight /></button>
                        </div>

                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-xl transition flex-shrink-0"
                        >
                            {isSidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
                            {isSidebarOpen ? 'Esconder Semanas' : 'Ver Resumo Semanal'}
                        </button>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-6 mb-10">
                        <div className="bg-zinc-900 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-zinc-800 rounded-full blur-2xl opacity-50"></div>
                            <h3 className="text-zinc-400 font-medium text-sm mb-1">Horas Trabalhadas no Mês</h3>
                            <p className="text-4xl font-light">{totalHoursStr}</p>
                        </div>
                        <div className="bg-zinc-900 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-900/40 rounded-full blur-2xl"></div>
                            <h3 className="text-zinc-400 font-medium text-sm mb-1">Tempo Médio de Almoço</h3>
                            <p className="text-4xl font-light">{avgLunchMins}<span className="text-lg text-zinc-500 font-medium ml-1">min</span></p>
                        </div>
                        <div className="bg-zinc-900 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-900/40 rounded-full blur-2xl"></div>
                            <h3 className="text-zinc-400 font-medium text-sm mb-1">Faltas Injustificadas</h3>
                            <p className="text-4xl font-light text-rose-400">{faltasCount}<span className="text-lg text-zinc-500 font-medium ml-1">dias</span></p>
                        </div>
                    </div>

                    {/* Calendar Grid Container */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100">
                        {loading ? (
                            <div className="h-64 flex items-center justify-center text-neutral-400">Carregando dados...</div>
                        ) : (
                            <div>
                                <div className="grid grid-cols-5 text-center mb-6">
                                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map(d => (
                                        <div key={d} className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-5 gap-4">
                                    {calendarCells.map((day, i) => {
                                        if (day === null) {
                                            return <div key={`empty-${i}`} className="h-24 rounded-2xl bg-transparent border-2 border-transparent"></div>;
                                        }

                                        // Formata DD/MM/YYYY localmente para comparar
                                        const loopDate = new Date(year, monthIndex, day);
                                        const loopDateStr = new Date(loopDate.getTime() - (loopDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

                                        const record = historico.find(p => p.data.toString().startsWith(loopDateStr));

                                        let statusColor = 'bg-neutral-50 border-neutral-100 hover:border-neutral-300';
                                        let statusText = '';
                                        let textColor = 'text-neutral-500';

                                        const isPast = loopDateStr < todayDateStr;
                                        const isToday = loopDateStr === todayDateStr;
                                        const isBeforeHireDate = loopDateStr < dataContratacao;

                                        let isVacation = false;
                                        if (dataInicioFerias) {
                                            const diffTime = loopDate.getTime() - new Date(dataInicioFerias).getTime();
                                            const diffDays = diffTime / (1000 * 60 * 60 * 24);
                                            if (diffDays >= 0 && diffDays <= 14) isVacation = true;
                                        }

                                        if (record) {
                                            if (record.saida_final) {
                                                statusColor = 'bg-emerald-50 border-emerald-100 hover:border-emerald-300';
                                                statusText = 'Turno Completo';
                                                textColor = 'text-emerald-700';
                                            } else {
                                                statusColor = 'bg-amber-50 border-amber-100 hover:border-amber-300';
                                                statusText = 'Em Andamento';
                                                textColor = 'text-amber-700';
                                            }
                                        } else {
                                            if (isPast) {
                                                if (isBeforeHireDate) {
                                                    statusColor = 'bg-neutral-50/50 border-dashed border-neutral-200';
                                                    statusText = 'Fora do Contrato';
                                                    textColor = 'text-neutral-300';
                                                } else if (isVacation) {
                                                    statusColor = 'bg-purple-50 border-purple-200';
                                                    statusText = 'Férias (Isento)';
                                                    textColor = 'text-purple-600';
                                                } else {
                                                    statusColor = 'bg-rose-50 border-rose-200 hover:border-rose-400 cursor-pointer shadow-sm';
                                                    statusText = 'Falta (Justificar)';
                                                    textColor = 'text-rose-600';
                                                }
                                            } else if (isToday) {
                                                if (isVacation) {
                                                    statusColor = 'bg-purple-50 border-purple-200';
                                                    statusText = 'Férias (Isento)';
                                                    textColor = 'text-purple-600';
                                                } else {
                                                    statusColor = 'bg-blue-50 border-blue-100 hover:border-blue-300';
                                                    statusText = 'Hoje';
                                                    textColor = 'text-blue-700';
                                                }
                                            } else if (isVacation) {
                                                statusColor = 'bg-purple-50/50 border-dashed border-purple-200';
                                                statusText = 'Férias (Agendado)';
                                                textColor = 'text-purple-400';
                                            }
                                        }

                                        return (
                                            <div key={day}
                                                onClick={() => !record && isPast && !isBeforeHireDate && !isVacation ? setSelectedFalta(loopDateStr) : null}
                                                className={`h-24 rounded-2xl border-2 relative group flex flex-col justify-between p-3 transition ${statusColor}`}
                                            >
                                                <span className={`font-mono text-sm font-semibold ${textColor}`}>{day}</span>
                                                <span className={`text-[11px] font-medium ${textColor} leading-tight`}>{statusText}</span>

                                                {/* Tooltip Hover for Records */}
                                                {record && (
                                                    <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-zinc-900 text-white rounded-xl p-3 shadow-xl pointer-events-none z-10 text-xs flex flex-col gap-1">
                                                        <div className="font-semibold mb-1 pb-1 border-b border-zinc-700">Detalhes do Dia</div>
                                                        <div className="flex justify-between"><span>Chegada:</span> <span className="font-mono text-zinc-300">{record.entrada ? new Date(record.entrada).toLocaleTimeString().slice(0, 5) : '--:--'}</span></div>
                                                        <div className="flex justify-between"><span>Ida Alm:</span> <span className="font-mono text-zinc-300">{record.almoco_saida ? new Date(record.almoco_saida).toLocaleTimeString().slice(0, 5) : '--:--'}</span></div>
                                                        <div className="flex justify-between"><span>Retorno Alm:</span> <span className="font-mono text-zinc-300">{record.almoco_retorno ? new Date(record.almoco_retorno).toLocaleTimeString().slice(0, 5) : '--:--'}</span></div>
                                                        <div className="flex justify-between"><span>Saída:</span> <span className="font-mono text-zinc-300">{record.saida_final ? new Date(record.saida_final).toLocaleTimeString().slice(0, 5) : '--:--'}</span></div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Framer Motion Sidebar (Weekly Summary) */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-96 bg-neutral-50 border-l border-neutral-200 shadow-2xl p-8 overflow-y-auto z-20"
                    >
                        <div className="flex justify-between items-center mb-10">
                            <h3 className="text-xl font-semibold text-neutral-800">Resumo Semanal</h3>
                            <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-neutral-200 hover:bg-neutral-300 rounded-full text-neutral-600 transition"><X size={18} /></button>
                        </div>

                        <div className="space-y-6">
                            {weeks.map(w => {
                                const saldo = w.worked - w.expected;
                                const isPositive = saldo >= 0;
                                return (
                                    <div key={w.weekTitle} className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition">
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                        <h4 className="text-sm font-semibold text-neutral-500 mb-4">{w.weekTitle}</h4>

                                        <div className="space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-neutral-500">Horas Realizadas</span>
                                                <span className="font-mono font-medium text-neutral-800">{formatHorasText(w.worked)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-neutral-500">Horas Esperadas</span>
                                                <span className="font-mono font-medium text-neutral-800">{formatHorasText(w.expected)}</span>
                                            </div>
                                            <div className="pt-3 border-t border-neutral-100 flex justify-between mt-2">
                                                <span className="text-sm font-semibold text-neutral-600">Saldo</span>
                                                <span className={`font-mono text-sm font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {formatHorasText(saldo, true)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Justification Modal (Shadcn style manual) */}
            <AnimatePresence>
                {selectedFalta && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4"
                            onClick={() => setSelectedFalta(null)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                onClick={e => e.stopPropagation()}
                                className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-neutral-200"
                            >
                                <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-neutral-800">Justificar Registro do dia {'09/03'}</h3>
                                    <button onClick={() => setSelectedFalta(null)} className="text-neutral-400 hover:text-neutral-700 transition"><X size={20} /></button>
                                </div>
                                <div className="p-6 space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-700 mb-2">Motivo/Anotação</label>
                                        <textarea
                                            value={justificativa}
                                            onChange={e => setJustificativa(e.target.value)}
                                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                                            rows={3}
                                            placeholder="Ex: Consulta médica na parte da manhã..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-neutral-700 mb-2">Anexo (Opcional)</label>
                                        <div
                                            onClick={handleFileOpen}
                                            className={`w-full border-2 ${anexoPath ? 'border-solid border-emerald-200 bg-emerald-50' : 'border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100'} rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group`}
                                        >
                                            {anexoPath ? (
                                                <>
                                                    <FileText className="text-emerald-500" size={28} />
                                                    <span className="text-sm font-medium text-emerald-700 text-center truncate w-full px-4">{anexoPath.split('\\').pop()}</span>
                                                    <span className="text-xs text-emerald-600 opacity-70">Clique para alterar o arquivo</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="text-neutral-400 group-hover:text-blue-500 transition-colors" size={28} />
                                                    <span className="text-sm font-medium text-neutral-600">Procurar atestado no computador</span>
                                                    <span className="text-xs text-neutral-400">PDF, PNG ou JPG</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-3">
                                    <button onClick={() => setSelectedFalta(null)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-200 transition-colors">Cancelar</button>
                                    <button onClick={handleSalvarJustificativa} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2">
                                        Salvar Justificativa <ArrowRight size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
