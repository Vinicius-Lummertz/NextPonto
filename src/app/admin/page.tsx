'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import Link from 'next/link';
import { ArrowLeft, Shield, CheckCircle, Users, BarChart, Search, XCircle, UserCheck, UserPlus, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';

const DB_URL = "mysql://root:@localhost:3306/nextponto";

// Tipagens
type Estagiario = {
    nome_usuario: string;
    jornada_diaria: number;
    data_contratacao: string;
    data_inicio_ferias?: string;
    status: 'ATIVO' | 'REMOVIDO' | 'FERIAS';
    tipo_perfil: 'ESTAGIARIO' | 'GESTOR' | 'ESTAGIARIO_GESTOR';
};

type Ponto = {
    id: number;
    username: string;
    data: string;
    entrada?: string;
    almoco_saida?: string;
    almoco_retorno?: string;
    saida_final?: string;
};

type Justificativa = {
    id: number;
    username: string;
    data_falta: string;
    motivo: string;
    anexo_path: string | null;
    status_aprovacao: 'PENDENTE' | 'APROVADA' | 'RECUSADA';
};

export default function AdminPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'DESEMPENHO' | 'APROVACOES' | 'GESTAO'>('DESEMPENHO');

    // Dados Globais
    const [adminName, setAdminName] = useState('');
    const [estagiarios, setEstagiarios] = useState<Estagiario[]>([]);
    const [pontosMes, setPontosMes] = useState<Ponto[]>([]);
    const [justificativas, setJustificativas] = useState<Justificativa[]>([]);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'NOME' | 'FALTAS' | 'SALDO' | 'ALMOCO'>('NOME');

    // Novo Cadastro State
    const [novoNome, setNovoNome] = useState('');
    const [novaJornada, setNovaJornada] = useState(8);
    const [novaContratacao, setNovaContratacao] = useState(new Date().toISOString().split('T')[0]);
    const [novoPerfil, setNovoPerfil] = useState<'ESTAGIARIO' | 'GESTOR' | 'ESTAGIARIO_GESTOR'>('ESTAGIARIO');
    const [isCadastroOpen, setIsCadastroOpen] = useState(false);

    // Data atual
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const todayDateStr = new Date(currentDate.getTime() - (currentDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    useEffect(() => {
        loadDashboard();
    }, [router]);

    async function loadDashboard() {
        setLoading(true);
        try {
            let name = 'Dev.Local';
            try {
                // @ts-ignore
                name = await invoke<string>('get_windows_user');
            } catch (e) { }

            const db = await Database.load(DB_URL);

            if (name !== 'Vinicius Gomes') {
                const adminCheck = await db.select<{ tipo_perfil: string }[]>(
                    `SELECT tipo_perfil FROM Estagiarios WHERE nome_usuario = ?`,
                    [name]
                );

                if (adminCheck.length === 0 || adminCheck[0].tipo_perfil === 'ESTAGIARIO') {
                    router.push('/');
                    return;
                }
            }

            setAdminName(name);

            // Garantir que a tabela Justificativas existe
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

            // 1. Carregar Estagiarios Ativos/Ferias (nÃ£o removidos)
            const users = await db.select<Estagiario[]>(`SELECT * FROM Estagiarios WHERE status != 'REMOVIDO'`);
            setEstagiarios(users);

            // 2. Carregar Pontos de todo mundo no mÃªs atual
            const pts = await db.select<Ponto[]>(
                `SELECT * FROM Ponto WHERE MONTH(data) = ? AND YEAR(data) = ?`,
                [currentMonth, currentYear]
            );
            setPontosMes(pts);

            // 3. Carregar Justificativas Pendentes
            const justs = await db.select<Justificativa[]>(`SELECT * FROM Justificativas WHERE status_aprovacao = 'PENDENTE'`);
            setJustificativas(justs);

            setLoading(false);
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar dados do banco.');
            setLoading(false);
        }
    }

    // AÃ§Ãµes de GestÃ£o
    const handleRemover = async (nome: string) => {
        if (!window.confirm(`Deseja realmente bloquear o acesso de ${nome}?`)) return;
        const db = await Database.load(DB_URL);
        await db.execute(`UPDATE Estagiarios SET status = 'REMOVIDO' WHERE nome_usuario = ?`, [nome]);
        loadDashboard();
    };

    const handleFerias = async (nome: string) => {
        if (!window.confirm(`Deseja conceder 15 dias de fÃ©rias para ${nome}? Sistema isentarÃ¡ ele de justificar faltas pelos prÃ³ximos 15 dias a partir de hoje.`)) return;
        const db = await Database.load(DB_URL);
        const tdStr = new Date().toISOString().split('T')[0];
        await db.execute(`UPDATE Estagiarios SET data_inicio_ferias = ?, status = 'ATIVO' WHERE nome_usuario = ?`, [tdStr, nome]);
        loadDashboard();
    };

    const handleChangeJornada = async (nome: string, newJornada: number) => {
        const db = await Database.load(DB_URL);
        await db.execute(`UPDATE Estagiarios SET jornada_diaria = ? WHERE nome_usuario = ?`, [newJornada, nome]);
        loadDashboard();
    };

    const handleChangePerfil = async (nome: string, novoPerfil: string) => {
        const db = await Database.load(DB_URL);
        await db.execute(`UPDATE Estagiarios SET tipo_perfil = ? WHERE nome_usuario = ?`, [novoPerfil, nome]);
        loadDashboard();
    };

    const handleCadastrar = async () => {
        if (!novoNome || !novaContratacao) {
            alert("Preencha todos os campos para cadastrar.");
            return;
        }
        try {
            const db = await Database.load(DB_URL);
            await db.execute(
                `INSERT INTO Estagiarios (nome_usuario, jornada_diaria, data_contratacao, tipo_perfil, status) VALUES (?, ?, ?, ?, 'ATIVO')`,
                [novoNome, novaJornada, novaContratacao, novoPerfil]
            );
            setNovoNome('');
            setNovaJornada(8);
            setNovoPerfil('ESTAGIARIO');
            loadDashboard();
            alert("UsuÃ¡rio cadastrado com sucesso!");
        } catch (e: any) {
            console.error(e);
            alert("Erro ao cadastrar: " + e.message);
        }
    };

    // AÃ§Ãµes de AprovaÃ§Ã£o
    const handleAprovarFalta = async (id: number, username: string, dataFalta: string) => {
        const db = await Database.load(DB_URL);
        await db.execute(`UPDATE Justificativas SET status_aprovacao = 'APROVADA' WHERE id = ?`, [id]);

        // Inserir registro no ponto indicando folga abonada
        const dtFalta = new Date(dataFalta).toISOString().split('T')[0];

        // Verifica se jÃ¡ existe um ponto no dia
        const check = await db.select<any[]>(`SELECT id FROM Ponto WHERE username = ? AND DATE(data) = ?`, [username, dtFalta]);
        if (check.length === 0) {
            await db.execute(
                `INSERT INTO Ponto (username, data, entrada, saida_final) VALUES (?, ?, ?, ?)`,
                [username, dtFalta, `${dtFalta} 08:00:00`, `${dtFalta} 16:00:00`] // HorÃ¡rio genÃ©rico preenchido pra abonar
            );
        }

        loadDashboard();
    };

    const handleReprovarFalta = async (id: number) => {
        const db = await Database.load(DB_URL);
        await db.execute(`UPDATE Justificativas SET status_aprovacao = 'RECUSADA' WHERE id = ?`, [id]);
        loadDashboard();
    };

    const handleOpenAnexo = async (path: string) => {
        try {
            await open(path);
        } catch (e) {
            alert("NÃ£o foi possÃ­vel abrir o anexo nativamente. Verifique o caminho absoluto.");
        }
    };

    // Processar KPIs por Estagiario
    const kpisData = useMemo(() => {
        // Quantidade de dias Ãºteis no mes atÃ© agora (ou total dependendo da regra)
        const year = currentDate.getFullYear();
        const monthIndex = currentDate.getMonth();
        const daysInMonthCalculated = new Date(year, monthIndex + 1, 0).getDate();

        const validDays: string[] = []; // Dias Ãºteis atÃ© hoje
        for (let day = 1; day <= daysInMonthCalculated; day++) {
            const d = new Date(year, monthIndex, day);
            const dayOfWeek = d.getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                const lpStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                validDays.push(lpStr);
            }
        }

        return estagiarios.map(est => {
            let totalWorkedMs = 0;
            let expectedWorkedMs = 0;
            let totalLunchMs = 0;
            let numLunches = 0;
            let faltasCont = 0;

            const dataContratacaoIso = new Date(est.data_contratacao).toISOString().split('T')[0];
            const dataInicioFeriasIso = est.data_inicio_ferias ? new Date(est.data_inicio_ferias).toISOString().split('T')[0] : null;

            validDays.forEach(dayStr => {
                const isPast = dayStr < todayDateStr;
                const isToday = dayStr === todayDateStr;
                const isBeforeHire = dayStr < dataContratacaoIso;

                let isVacation = false;
                if (dataInicioFeriasIso) {
                    const diffTime = new Date(dayStr).getTime() - new Date(dataInicioFeriasIso).getTime();
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    if (diffDays >= 0 && diffDays <= 14) {
                        isVacation = true;
                    }
                }

                const records = pontosMes.filter(p => p.username === est.nome_usuario && p.data.toString().startsWith(dayStr));
                const record = records[0];

                if ((isPast || isToday) && !isBeforeHire && !isVacation) {
                    expectedWorkedMs += (est.jornada_diaria * 3600000);
                }

                if (record && record.entrada) {
                    const tIn = new Date(record.entrada).getTime();
                    if (record.almoco_saida) {
                        const lOut = new Date(record.almoco_saida).getTime();
                        totalWorkedMs += (lOut - tIn);

                        if (record.almoco_retorno) {
                            const lIn = new Date(record.almoco_retorno).getTime();
                            totalLunchMs += (lIn - lOut);
                            numLunches++;

                            const tOut = record.saida_final ? new Date(record.saida_final).getTime() : new Date().getTime();
                            if (isToday || record.saida_final) {
                                totalWorkedMs += (tOut - lIn);
                            }
                        }
                    } else {
                        const tOut = record.saida_final ? new Date(record.saida_final).getTime() : (isToday ? new Date().getTime() : tIn);
                        totalWorkedMs += (tOut - tIn);
                    }
                } else if (isPast && !record && est.status !== 'FERIAS' && !isBeforeHire && !isVacation) {
                    faltasCont++;
                }
            });

            const saldoLogicoMs = totalWorkedMs - expectedWorkedMs;
            const avgLunchMins = numLunches > 0 ? ((totalLunchMs / numLunches) / 60000) : 0;

            return {
                ...est,
                saldoH: saldoLogicoMs / 3600000,
                faltas: faltasCont,
                avgLunch: avgLunchMins
            };
        });

    }, [estagiarios, pontosMes, todayDateStr]);

    // Apply Sorting and Filtering
    const sortedKpis = useMemo(() => {
        let filtered = kpisData.filter(k => k.nome_usuario.toLowerCase().includes(searchTerm.toLowerCase()));

        filtered.sort((a, b) => {
            if (sortBy === 'NOME') return a.nome_usuario.localeCompare(b.nome_usuario);
            if (sortBy === 'FALTAS') return b.faltas - a.faltas;
            if (sortBy === 'SALDO') return a.saldoH - b.saldoH; // Crescente (devedores primeiro)
            if (sortBy === 'ALMOCO') return b.avgLunch - a.avgLunch;
            return 0;
        });

        return filtered;
    }, [kpisData, searchTerm, sortBy]);


    if (loading) return <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center font-sans"><div className="animate-pulse flex items-center gap-3"><Shield className="text-amber-500 animate-bounce" size={32} /> <span className="font-bold text-neutral-600">Verificando credenciais de diretoria...</span></div></div>;
    if (error) return <div>{error}</div>;

    const pendentesCount = justificativas.length;

    return (
        <div className="np-page np-admin-page min-h-screen bg-[#F5F5F7] font-sans flex flex-col text-neutral-800">
            {/* Header / Navbar */}
            <div className="bg-neutral-900 text-white p-6 flex items-center justify-between shadow-md z-10 sticky top-0">
                <div className="flex items-center gap-6">
                    <Link href="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition font-medium">
                        <ArrowLeft size={18} /> Voltar ao Ponto
                    </Link>
                    <div className="h-6 w-px bg-neutral-700"></div>
                    <div className="flex items-center gap-3">
                        <Shield className="text-amber-400" size={24} />
                        <h1 className="text-xl font-bold tracking-wide">Painel de GestÃ£o AvanÃ§ada</h1>
                    </div>
                </div>
                <div className="text-sm text-neutral-400">
                    Administrador Atual: <span className="text-amber-400 font-bold ml-1">{adminName}</span>
                </div>
            </div>

            {/* Layout Main */}
            <div className="flex-1 flex w-full max-w-7xl mx-auto mt-8 gap-8 px-6 pb-12">

                {/* Sidemenu */}
                <div className="w-72 flex flex-col gap-3 shrink-0">
                    <button
                        onClick={() => setActiveTab('DESEMPENHO')}
                        className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-semibold transition-all shadow-sm border ${activeTab === 'DESEMPENHO' ? 'bg-white border-white text-neutral-900 shadow-neutral-200 transform scale-105' : 'bg-transparent border-transparent text-neutral-500 hover:bg-white/50'}`}
                    >
                        <BarChart size={20} className={activeTab === 'DESEMPENHO' ? 'text-blue-500' : ''} />
                        Desempenho da Equipe
                    </button>

                    <button
                        onClick={() => setActiveTab('APROVACOES')}
                        className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-semibold transition-all shadow-sm border ${activeTab === 'APROVACOES' ? 'bg-white border-white text-neutral-900 shadow-neutral-200 transform scale-105' : 'bg-transparent border-transparent text-neutral-500 hover:bg-white/50'}`}
                    >
                        <CheckCircle size={20} className={activeTab === 'APROVACOES' ? 'text-emerald-500' : ''} />
                        Aprovação de Faltas
                        {pendentesCount > 0 && <span className="ml-auto bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">{pendentesCount}</span>}
                    </button>

                    <button
                        onClick={() => setActiveTab('GESTAO')}
                        className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-semibold transition-all shadow-sm border ${activeTab === 'GESTAO' ? 'bg-white border-white text-neutral-900 shadow-neutral-200 transform scale-105' : 'bg-transparent border-transparent text-neutral-500 hover:bg-white/50'}`}
                    >
                        <Users size={20} className={activeTab === 'GESTAO' ? 'text-amber-500' : ''} />
                        Gerir Pessoas
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-white rounded-3xl shadow-sm border border-neutral-200 p-8 min-h-[600px] overflow-hidden flex flex-col">

                    {/* === ABA: DESEMPENHO === */}
                    {activeTab === 'DESEMPENHO' && (
                        <div className="flex-1 flex flex-col h-full">
                            <h2 className="text-2xl font-bold mb-2 text-neutral-800">Desempenho e Analytics</h2>
                            <p className="text-neutral-500 mb-6">Filtre seus colaboradores e visualize o balanÃ§o mensal de horas e mÃ©tricas de aderÃªncia.</p>

                            {/* Filtros */}
                            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex items-center justify-between mb-6 shrink-0">
                                <div className="flex items-center gap-3 bg-white px-4 py-2 border border-neutral-200 rounded-xl flex-1 max-w-sm">
                                    <Search size={18} className="text-neutral-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nome..."
                                        className="bg-transparent border-none outline-none w-full text-sm"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-neutral-500 font-medium">Ordenar por:</span>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as any)}
                                        className="bg-white border border-neutral-200 text-sm rounded-xl px-3 py-2 outline-none"
                                    >
                                        <option value="NOME">Nome (A-Z)</option>
                                        <option value="FALTAS">Mais Faltas Injustificadas</option>
                                        <option value="SALDO">Menor Saldo de Horas</option>
                                        <option value="ALMOCO">Maior Atraso de AlmoÃ§o</option>
                                    </select>
                                </div>
                            </div>

                            {/* Tabela de Analytics */}
                            <div className="border border-neutral-200 rounded-2xl overflow-hidden flex-1 overflow-y-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-neutral-100/50 text-neutral-500 text-xs uppercase tracking-widest">
                                            <th className="p-4 font-semibold whitespace-nowrap">EstagiÃ¡rio</th>
                                            <th className="p-4 font-semibold text-center">AderÃªncia de Horas</th>
                                            <th className="p-4 font-semibold text-center">Faltas no MÃªs</th>
                                            <th className="p-4 font-semibold text-center">MÃ©dia de AlmoÃ§o</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedKpis.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="text-center p-8 text-neutral-400">Nenhum resultado encontrado.</td>
                                            </tr>
                                        ) : sortedKpis.map((kpi) => (
                                            <tr key={kpi.nome_usuario}
                                                className="border-t border-neutral-100 hover:bg-neutral-50/50 transition cursor-pointer"
                                                onClick={() => router.push(`/resumo?user=${encodeURIComponent(kpi.nome_usuario)}`)}
                                            >
                                                <td className="p-4">
                                                    <div className="font-semibold text-neutral-800 hover:text-blue-600 transition-colors">{kpi.nome_usuario}</div>
                                                    <div className="text-xs text-neutral-400">{kpi.jornada_diaria} horas / dia</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold font-mono tracking-wider ${kpi.saldoH >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {kpi.saldoH > 0 ? '+' : ''}{kpi.saldoH.toFixed(1)}h
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center font-bold text-neutral-700">
                                                    {kpi.faltas > 0 ? <span className="text-rose-500">{kpi.faltas} dias</span> : <span className="text-neutral-300">Nenhuma</span>}
                                                </td>
                                                <td className="p-4 text-center font-mono text-sm text-neutral-600">
                                                    {kpi.avgLunch.toFixed(0)} min
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* === ABA: APROVACOES === */}
                    {activeTab === 'APROVACOES' && (
                        <div className="flex-1 flex flex-col h-full bg-neutral-50/50 rounded-2xl">
                            <h2 className="text-2xl font-bold mb-2 text-neutral-800">Caixa de Justificativas</h2>
                            <p className="text-neutral-500 mb-8">Aceite atestados e abone faltas ou recuse requisiÃ§Ãµes pendentes.</p>

                            {justificativas.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 gap-4 opacity-70">
                                    <CheckCircle size={64} className="text-emerald-300" />
                                    <p className="font-medium text-lg text-emerald-700/70">Caixa de Entrada Vazia. Tudo em dia!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-4">
                                    {justificativas.map(just => (
                                        <div key={just.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 flex flex-col relative group hover:border-blue-300 transition-all">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg cursor-pointer" onClick={() => router.push(`/resumo?user=${encodeURIComponent(just.username)}`)}>
                                                    {just.username.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-neutral-800 text-sm leading-tight hover:text-blue-600 transition cursor-pointer" onClick={() => router.push(`/resumo?user=${encodeURIComponent(just.username)}`)}>
                                                        {just.username}
                                                    </div>
                                                    <div className="text-xs text-neutral-400 font-mono">Falta em: {new Date(just.data_falta).toLocaleDateString('pt-BR')}</div>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-neutral-600 mb-4 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                                                    "{just.motivo}"
                                                </p>
                                            </div>
                                            {just.anexo_path && (
                                                <button onClick={() => handleOpenAnexo(just.anexo_path!)} className="text-xs font-semibold text-blue-600 mb-4 flex items-center gap-1 hover:underline w-fit">
                                                    <span className="truncate max-w-[150px]">{just.anexo_path.split('\\').pop()}</span>
                                                </button>
                                            )}
                                            <div className="grid grid-cols-2 gap-3 mt-auto">
                                                <button onClick={() => handleReprovarFalta(just.id)} className="py-2 flex items-center justify-center gap-2 rounded-xl border-2 border-rose-100 text-rose-600 font-semibold text-sm hover:bg-rose-50 transition active:scale-95">
                                                    <XCircle size={16} /> Recusar
                                                </button>
                                                <button onClick={() => handleAprovarFalta(just.id, just.username, just.data_falta)} className="py-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 transition active:scale-95">
                                                    <CheckCircle size={16} /> Abonar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* === ABA: GESTAO === */}
                    {activeTab === 'GESTAO' && (
                        <div className="flex-1 flex flex-col h-full overflow-y-auto pr-2">
                            <h2 className="text-2xl font-bold mb-2 text-neutral-800">ParÃ¢metros de Contrato</h2>
                            <p className="text-neutral-500 mb-8">Gerencie permissÃµes, adicione novos membros ou altere jornadas de trabalho.</p>

                            {/* Cadastro Colapsável */}
                            <div className="mb-10">
                                {!isCadastroOpen ? (
                                    <button
                                        onClick={() => setIsCadastroOpen(true)}
                                        className="group inline-flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-3 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/60 hover:shadow-md"
                                    >
                                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 transition group-hover:scale-105">
                                            <UserPlus size={20} />
                                        </span>
                                        <span className="text-left">
                                            <span className="block text-sm font-bold text-neutral-800">Cadastrar Novo Integrante</span>
                                            <span className="block text-xs text-neutral-500">Abra o formulário completo quando precisar</span>
                                        </span>
                                    </button>
                                ) : (
                                    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all duration-300">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <UserCheck size={80} className="text-white" />
                                        </div>
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                <UserCheck size={20} className="text-amber-400" />
                                                Cadastrar Novo Integrante
                                            </h3>
                                            <button
                                                onClick={() => setIsCadastroOpen(false)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-700"
                                            >
                                                <X size={14} /> Fechar
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-1">Nome de Usuário (Windows)</label>
                                                <input
                                                    type="text"
                                                    value={novoNome}
                                                    onChange={(e) => setNovoNome(e.target.value)}
                                                    placeholder="Ex: Vinicius Gomes"
                                                    className="bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-2.5 outline-none focus:border-amber-500 transition"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-1">Data de Contratação</label>
                                                <input
                                                    type="date"
                                                    value={novaContratacao}
                                                    onChange={(e) => setNovaContratacao(e.target.value)}
                                                    className="bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-2.5 outline-none focus:border-amber-500 transition"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-1">Jornada e Perfil</label>
                                                <div className="flex gap-2">
                                                    <select
                                                        value={novaJornada}
                                                        onChange={(e) => setNovaJornada(Number(e.target.value))}
                                                        className="bg-neutral-800 border border-neutral-700 text-white rounded-xl px-3 py-2.5 flex-1 outline-none focus:border-amber-500 transition"
                                                    >
                                                        <option value={4}>4h/dia</option>
                                                        <option value={6}>6h/dia</option>
                                                        <option value={8}>8h/dia</option>
                                                    </select>
                                                    <select
                                                        value={novoPerfil}
                                                        onChange={(e) => setNovoPerfil(e.target.value as any)}
                                                        className="bg-neutral-800 border border-neutral-700 text-white rounded-xl px-3 py-2.5 flex-1 outline-none focus:border-amber-500 transition"
                                                    >
                                                        <option value="ESTAGIARIO">Comum</option>
                                                        <option value="GESTOR">Gestor</option>
                                                        <option value="ESTAGIARIO_GESTOR">E. Gestor</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-6 flex items-center gap-3">
                                            <button
                                                onClick={handleCadastrar}
                                                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-neutral-900 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-[0.98]"
                                            >
                                                Confirmar Cadastro
                                            </button>
                                            <button
                                                onClick={() => setIsCadastroOpen(false)}
                                                className="py-3 px-4 rounded-xl border border-neutral-700 text-neutral-200 text-sm font-semibold hover:bg-neutral-800 transition"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <h3 className="text-xl font-semibold text-neutral-800 mb-6 flex items-center gap-2">Gerir Pessoas e Jornadas</h3>
                            <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-100">
                                        <tr>
                                            <th className="p-4 uppercase tracking-wider text-xs">Nome</th>
                                            <th className="p-4 uppercase tracking-wider text-xs">Jornada DiÃ¡ria</th>
                                            <th className="p-4 uppercase tracking-wider text-xs text-right">AÃ§Ãµes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {estagiarios.map((est) => {
                                            const dataContratacaoIso = new Date(est.data_contratacao).toISOString().split('T')[0];
                                            const canVacation = (new Date().getTime() - new Date(dataContratacaoIso).getTime()) >= (180 * 24 * 60 * 60 * 1000);
                                            const diffTime = est.data_inicio_ferias ? new Date().getTime() - new Date(new Date(est.data_inicio_ferias).toISOString().split('T')[0]).getTime() : -1;
                                            const isFeriando = est.data_inicio_ferias && Math.floor(diffTime / (1000 * 60 * 60 * 24)) >= 0 && Math.floor(diffTime / (1000 * 60 * 60 * 24)) <= 14;

                                            return (
                                                <tr key={est.nome_usuario} className={`border-t border-neutral-100 ${est.status === 'REMOVIDO' ? 'opacity-50 grayscale' : 'hover:bg-neutral-50 transition'}`}>
                                                    <td className="p-4 font-semibold text-neutral-800">
                                                        <span className="hover:text-blue-600 transition cursor-pointer" onClick={() => router.push(`/resumo?user=${encodeURIComponent(est.nome_usuario)}`)}>
                                                            {est.nome_usuario}
                                                        </span>
                                                        {isFeriando && <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-purple-200">Em FÃ©rias</span>}
                                                        {est.status === 'REMOVIDO' && <span className="ml-2 text-[10px] bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Bloqueado</span>}
                                                    </td>
                                                    <td className="p-4">
                                                        {est.status === 'ATIVO' && !isFeriando && (
                                                            <div className="flex flex-col gap-2 w-max">
                                                                <div className="flex bg-neutral-100 rounded-xl p-1 w-max">
                                                                    {[4, 6, 8].map(h => (
                                                                        <button
                                                                            key={h}
                                                                            onClick={() => handleChangeJornada(est.nome_usuario, h)}
                                                                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${est.jornada_diaria === h ? 'bg-white text-blue-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
                                                                        >
                                                                            {h}h
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                <select
                                                                    value={est.tipo_perfil || 'ESTAGIARIO'}
                                                                    onChange={(e) => handleChangePerfil(est.nome_usuario, e.target.value)}
                                                                    className="bg-neutral-50 border border-neutral-200 text-xs font-semibold text-neutral-600 rounded-lg px-2 py-1 outline-none mt-1"
                                                                >
                                                                    <option value="ESTAGIARIO">Comum</option>
                                                                    <option value="GESTOR">Gestor Puro</option>
                                                                    <option value="ESTAGIARIO_GESTOR">Bate Ponto + Gestor</option>
                                                                </select>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {est.status === 'ATIVO' && !isFeriando && (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleFerias(est.nome_usuario)}
                                                                    disabled={!canVacation}
                                                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${canVacation ? 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100' : 'bg-neutral-50 text-neutral-400 border-neutral-100 cursor-not-allowed hidden'}`}
                                                                >
                                                                    Dar FÃ©rias
                                                                </button>
                                                                <button onClick={() => handleRemover(est.nome_usuario)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition">Bloquear</button>
                                                            </div>
                                                        )}
                                                        {est.status === 'REMOVIDO' && <span className="text-xs font-semibold text-neutral-400">Acesso Revogado</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
