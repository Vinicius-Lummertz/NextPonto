'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, Settings, User, Building, Calendar, Printer, Save } from 'lucide-react';
import dynamic from 'next/dynamic';
import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import FolhaPontoPDF from '@/components/FolhaPontoPDF';

// React-PDF needs to be dynamically imported with NO SSR since it relies on browser/node APIs not safe for Next.js SSR
const PDFViewer = dynamic(() => import('@react-pdf/renderer').then(mod => mod.PDFViewer), {
    ssr: false,
    loading: () => <div className="w-full h-full flex items-center justify-center text-neutral-400 bg-neutral-100/50 rounded-2xl animate-pulse">Carregando visualizador de impressão...</div>
});

const DB_URL = "mysql://root:@localhost:3306/nextponto";

type Ponto = {
    id: number;
    data: string;
    entrada?: string;
    almoco_saida?: string;
    almoco_retorno?: string;
    saida_final?: string;
};

export default function RelatorioPDF() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [historico, setHistorico] = useState<Ponto[]>([]);
    const [loading, setLoading] = useState(true);

    // Configurações do Relatório
    const [estagiario, setEstagiario] = useState('João da silva fulano');
    const [localTrabalho, setLocalTrabalho] = useState('Diretoria de Ti Tecnologia e Inovação');
    const [responsavel, setResponsavel] = useState(`Matheus Sant'ana Pacheco`);
    const [turno, setTurno] = useState<'MANHÃ' | 'TARDE'>('TARDE');

    const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

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

                // Override for the PDF if it's not custom set yet
                if (estagiario === 'João da silva fulano') {
                    setEstagiario(name);
                }

                const db = await Database.load(DB_URL);

                const month = currentDate.getMonth() + 1;
                const year = currentDate.getFullYear();

                const data = await db.select<Ponto[]>(
                    `SELECT * FROM Ponto WHERE username = ? AND MONTH(data) = ? AND YEAR(data) = ?`,
                    [name, month, year]
                );

                setHistorico(data);
            } catch (e) {
                console.error("Erro banco SQL:", e);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [currentDate]);

    return (
        <div className="min-h-screen bg-[#F5F5F7] font-sans flex text-neutral-800">
            {/* Sidebar Configuração */}
            <div className="w-96 bg-white border-r border-neutral-200 shadow-sm flex flex-col h-screen overflow-y-auto">
                <div className="p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur z-10">
                    <Link href="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition font-medium">
                        <ArrowLeft size={18} /> Voltar
                    </Link>
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-semibold">
                        <Settings size={16} /> Configurar
                    </div>
                </div>

                <div className="p-6 space-y-8 flex-1">

                    {/* Mês/Ano Referência */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-neutral-800 flex items-center gap-2 uppercase tracking-wide">
                            <Calendar size={16} className="text-neutral-400" /> Mês de Referência
                        </label>
                        <div className="flex gap-3">
                            <select
                                value={currentDate.getMonth()}
                                onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))}
                                className="flex-1 bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                            >
                                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select
                                value={currentDate.getFullYear()}
                                onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))}
                                className="w-28 bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                            >
                                {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="h-px bg-neutral-200 w-full" />

                    {/* Dados Fixos (Menos Chamativos) */}
                    <div className="space-y-4 pt-2">
                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Campos Fixos do Documento</h4>

                        <div>
                            <label className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5 mb-1.5">
                                <User size={14} /> Nome do Estagiário
                            </label>
                            <input
                                type="text"
                                value={estagiario}
                                onChange={e => setEstagiario(e.target.value)}
                                className="w-full bg-transparent border-b border-neutral-300 text-neutral-800 py-1.5 focus:border-blue-500 outline-none transition-colors text-sm font-medium"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5 mb-1.5">
                                <Building size={14} /> Local de Trabalho
                            </label>
                            <input
                                type="text"
                                value={localTrabalho}
                                onChange={e => setLocalTrabalho(e.target.value)}
                                className="w-full bg-transparent border-b border-neutral-300 text-neutral-800 py-1.5 focus:border-blue-500 outline-none transition-colors text-sm font-medium"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5 mb-1.5">
                                <User size={14} /> Responsável do Setor
                            </label>
                            <input
                                type="text"
                                value={responsavel}
                                onChange={e => setResponsavel(e.target.value)}
                                className="w-full bg-transparent border-b border-neutral-300 text-neutral-800 py-1.5 focus:border-blue-500 outline-none transition-colors text-sm font-medium"
                            />
                        </div>
                    </div>

                </div>

                {/* Footer Sidebar do Botão de Export */}
                <div className="p-6 border-t border-neutral-100 bg-neutral-50 sticky bottom-0 flex gap-3">
                    <button
                        onClick={() => {
                            const iframe = document.querySelector('iframe');
                            if (iframe && iframe.contentWindow) {
                                iframe.contentWindow.print();
                            }
                        }}
                        className={`flex-1 py-4 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-neutral-700 bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50 hover:border-neutral-300 transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                        <Printer size={18} /> Imprimir
                    </button>

                    <button
                        onClick={() => {
                            const iframe = document.querySelector('iframe');
                            if (iframe && iframe.src) {
                                const a = document.createElement('a');
                                a.href = iframe.src;
                                a.download = `Folha_Ponto_${months[currentDate.getMonth()]}_${currentDate.getFullYear()}.pdf`;
                                a.click();
                            }
                        }}
                        className={`flex-1 py-4 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-white bg-blue-600 shadow-lg shadow-blue-500/25 hover:bg-blue-700 hover:shadow-blue-500/40 transition-all active:scale-[0.98] ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                        <Save size={18} /> Salvar PDF
                    </button>
                </div>
            </div>

            {/* Live Preview Area */}
            <div className="flex-1 p-8 flex flex-col items-center justify-center bg-neutral-200/50">
                <div className="w-full max-w-5xl h-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col border border-neutral-300">
                    <div className="h-14 bg-neutral-800 text-neutral-200 flex items-center px-6 justify-between select-none shrink-0">
                        <div className="flex items-center gap-2">
                            <FileText size={18} className="text-blue-400" />
                            <span className="font-semibold text-sm tracking-wide">Live Preview - FolhaPonto.pdf</span>
                        </div>
                        <span className="text-xs font-mono opacity-60">A4 Portrait</span>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        {/* O PDFViewer toma 100% da área, forçando a escala do documento SVG PDF internamente */}
                        <PDFViewer width="100%" height="100%" className="border-none">
                            <FolhaPontoPDF
                                estagiario={estagiario}
                                localTrabalho={localTrabalho}
                                responsavel={responsavel}
                                turno={turno}
                                mes={months[currentDate.getMonth()]}
                                ano={currentDate.getFullYear()}
                                historico={historico}
                                monthIndex={currentDate.getMonth()}
                            />
                        </PDFViewer>
                    </div>
                </div>
            </div>
        </div>
    );
}
