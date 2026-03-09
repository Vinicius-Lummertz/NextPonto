import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Registrar fonte serifada similar a Times New Roman para documento oficial
Font.register({
    family: 'Times',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/timesnewroman/v16/mpqBTrnS8B1p5C4Rms382qEuPko.woff2' }
        // Alternativa padrão caso fonte externa falhe: react-pdf já possui 'Times-Roman' builtin, mas declaramos para clareza
    ]
});

// Estilos baseados na imagem de referência do RH
const styles = StyleSheet.create({
    page: {
        fontFamily: 'Times-Roman',
        fontSize: 10,
        paddingTop: 20,
        paddingBottom: 20,
        paddingHorizontal: 40,
        flexDirection: 'column',
    },

    // Cabeçalho (Grid de Identificação)
    headerContainer: {
        border: '1px solid #000',
        marginBottom: 5,
    },
    headerRow: {
        flexDirection: 'row',
        borderBottom: '1px solid #000',
    },
    headerRowLast: {
        flexDirection: 'row',
    },
    headerLabel: {
        width: '35%',
        backgroundColor: '#fff',
        borderRight: '1px solid #000',
        padding: 4,
        fontWeight: 'bold',
        fontSize: 11,
    },
    headerValue: {
        width: '65%',
        padding: 4,
        textAlign: 'center',
        fontSize: 11,
    },

    // Tabela Principal
    table: {
        width: '100%',
        border: '1px solid #000',
    },
    tableHeaderRow: {
        flexDirection: 'row',
        borderBottom: '1px solid #000',
        backgroundColor: '#fff',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    colDiaHead: { width: '10%', borderRight: '1px solid #000', padding: 2 },
    colTurnoHead: { width: '45%', borderRight: '1px solid #000' },
    colTurnoHeadLast: { width: '45%' },

    subHeadRow: {
        flexDirection: 'row',
        borderBottom: '1px solid #000',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    colDiaSpaced: { width: '10%', borderRight: '1px solid #000' },
    colSub: { width: '22.5%', borderRight: '1px solid #000', padding: 2 },
    colSubLast: { width: '22.5%', padding: 2 },

    // Linhas da Tabela
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1px solid #000',
        textAlign: 'center',
    },
    colDia: { width: '10%', borderRight: '1px solid #000', padding: 2, fontWeight: 'bold' },
    colVal: { width: '22.5%', borderRight: '1px solid #000', padding: 2 },
    colValLast: { width: '22.5%', padding: 2 },

    // Linha Inteira (Fds / Feriado)
    fullRowText: {
        width: '90%',
        padding: 2,
        textAlign: 'center',
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },

    // Mensagem Final da Tabela
    tableFooterRow: {
        padding: 4,
        textAlign: 'center',
        fontWeight: 'bold',
        borderBottom: '1px solid #000',
    },
    tableFooterWarningRow: {
        padding: 4,
        textAlign: 'justify',
        fontSize: 9,
        fontWeight: 'bold',
    },

    // Área de Assinaturas (Rodapé Isolado)
    signaturesContainer: {
        marginTop: 25,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    signatureBox: {
        width: '40%',
        textAlign: 'center',
        paddingTop: 5,
        borderTop: '1px solid #000',
        fontSize: 10,
        fontWeight: 'bold',
    }
});

interface Ponto {
    id: number;
    data: string;
    entrada?: string;
    almoco_saida?: string;
    almoco_retorno?: string;
    saida_final?: string;
}

interface FolhaPontoPDFProps {
    estagiario: string;
    localTrabalho: string;
    responsavel: string;
    turno: 'MANHÃ' | 'TARDE';
    mes: string;
    ano: number;
    historico: Ponto[];
    monthIndex: number; // 0-11
    dataInicioFerias?: string | null;
}

// Lista Fixa Temporária de Feriados Nacionais 2026 (Exemplo prático)
const FERIADOS_NACIONAIS = [
    '01-01', // Confraternização Universal
    '02-17', // Carnaval (Exemplo 2026 Ter)
    '04-03', // Paixão de Cristo (Sexta Santa)
    '04-21', // Tiradentes
    '05-01', // Dia do Trabalho
    '06-04', // Corpus Christi
    '09-07', // Independência
    '10-12', // Nossa Sra. Aparecida
    '11-02', // Finados
    '11-15', // Proclamação da República
    '12-25', // Natal
];

const FolhaPontoPDF = ({ estagiario, localTrabalho, responsavel, turno, mes, ano, historico, monthIndex, dataInicioFerias }: FolhaPontoPDFProps) => {

    // Calcular dias do mês
    const daysInMonth = new Date(ano, monthIndex + 1, 0).getDate();

    // Gerar chaves unificadas da tabela
    const rows = [];

    // Funcao auxiliar para formatar horas da string ISO do BD
    const formatTime = (isoString?: string) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    for (let day = 1; day <= daysInMonth; day++) {
        const loopDate = new Date(ano, monthIndex, day);
        const dayOfWeek = loopDate.getDay(); // 0 = Dom, 6 = Sab

        // Formata a data para comparar YYYY-MM-DD e MM-DD
        const loopDateStr = new Date(loopDate.getTime() - (loopDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const monthDayStr = loopDateStr.substring(5, 10);

        // Verifica se é final de semana ou feriado
        const isSextaOuSabOuDom = dayOfWeek === 0 || dayOfWeek === 6;
        const isFeriadoNacional = FERIADOS_NACIONAIS.includes(monthDayStr);

        let isVacation = false;
        if (dataInicioFerias) {
            const diffTime = loopDate.getTime() - new Date(dataInicioFerias).getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            if (diffDays >= 0 && diffDays <= 14) isVacation = true;
        }

        let typeRow = 'NORMAL';
        if (dayOfWeek === 0) typeRow = 'Domingo';
        else if (dayOfWeek === 6) typeRow = 'Sábado';
        else if (isFeriadoNacional) typeRow = 'Feriado';
        else if (isVacation) typeRow = 'FÉRIAS';

        // Puxar ponto batido deste dia (se houver)
        const record = historico.find(p => p.data.toString().startsWith(loopDateStr));

        // Lógica dos Turnos da Imagem: O turno real trabalha (E1, S2). O oposto fica vazio (-) no PDF
        let txtM_In = '-', txtM_Out = '-';
        let txtT_In = '-', txtT_Out = '-';

        if (record && typeRow === 'NORMAL') {
            txtM_In = formatTime(record.entrada);
            txtT_Out = formatTime(record.almoco_saida || record.saida_final);
        }

        rows.push({
            day,
            typeRow,
            txtM_In, txtM_Out, txtT_In, txtT_Out
        });
    }

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* 1. CABEÇALHO */}
                <View style={styles.headerContainer}>
                    <View style={styles.headerRow}>
                        <Text style={styles.headerLabel}>NOME DO ESTAGIÁRIO</Text>
                        <Text style={styles.headerValue}>{estagiario}</Text>
                    </View>
                    <View style={styles.headerRow}>
                        <Text style={styles.headerLabel}>LOCAL DE TRABALHO</Text>
                        <Text style={styles.headerValue}>{localTrabalho}</Text>
                    </View>
                    <View style={styles.headerRow}>
                        <Text style={styles.headerLabel}>RESPONSÁVEL DO SETOR</Text>
                        <Text style={styles.headerValue}>{responsavel}</Text>
                    </View>
                    <View style={styles.headerRowLast}>
                        <View style={{ flexDirection: 'row', width: '60%', borderRight: '1px solid #000' }}>
                            <Text style={{ width: '58.33%', backgroundColor: '#fff', borderRight: '1px solid #000', padding: 4, fontWeight: 'bold', fontSize: 11 }}>HORÁRIO DE ESTÁGIO</Text>
                            <Text style={{ width: '41.67%', padding: 4, textAlign: 'center', fontSize: 11 }}>{turno === 'MANHÃ' ? '08h-14h' : '11h-17h'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', width: '40%' }}>
                            <Text style={{ width: '50%', backgroundColor: '#fff', borderRight: '1px solid #000', padding: 4, fontWeight: 'bold', fontSize: 11, textAlign: 'center' }}>MÊS</Text>
                            <Text style={{ width: '50%', padding: 4, textAlign: 'center', fontSize: 11 }}>{mes}</Text>
                        </View>
                    </View>
                </View>

                {/* 2. TABELA DE DIAS */}
                <View style={styles.table}>

                    {/* Linha Cabeçalhos Turno */}
                    <View style={styles.tableHeaderRow}>
                        <View style={styles.colDiaHead}></View> {/* Header DIA ocupa 2 linhas, deixamos vazio na div cima */}
                        <View style={styles.colTurnoHead}><Text style={{ paddingTop: 4, paddingBottom: 2 }}>MANHÃ</Text></View>
                        <View style={styles.colTurnoHeadLast}><Text style={{ paddingTop: 4, paddingBottom: 2 }}>TARDE</Text></View>
                    </View>

                    {/* Sub-Linha Entradas e Saidas */}
                    <View style={styles.subHeadRow}>
                        <View style={styles.colDiaSpaced}><Text style={{ position: 'relative', top: -14 }}>DIA</Text></View>
                        <View style={styles.colSub}><Text>ENTRADA</Text></View>
                        <View style={styles.colSub}><Text>SAÍDA</Text></View>
                        <View style={styles.colSub}><Text>ENTRADA</Text></View>
                        <View style={styles.colSubLast}><Text>SAÍDA</Text></View>
                    </View>

                    {/* Dados Diários Dinâmicos */}
                    {rows.map((r, i) => (
                        <View key={i} style={[styles.tableRow, i === rows.length - 1 ? { borderBottom: 'none' } : {}]}>
                            <View style={styles.colDia}><Text>{r.day}</Text></View>

                            {r.typeRow !== 'NORMAL' ? (
                                // Se for Sábado, Domingo, Feriado. Ocupa tudo ignorando divisão de turnos
                                <View style={{ width: '90%', justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>{r.typeRow}</Text>
                                </View>
                            ) : (
                                // Turno Normal
                                <>
                                    <View style={styles.colVal}><Text>{r.txtM_In}</Text></View>
                                    <View style={styles.colVal}><Text>{r.txtM_Out}</Text></View>
                                    <View style={styles.colVal}><Text>{r.txtT_In}</Text></View>
                                    <View style={styles.colValLast}><Text>{r.txtT_Out}</Text></View>
                                </>
                            )}
                        </View>
                    ))}

                    {/* Mensagens de Rodapé da Tabela */}
                    <View style={[styles.tableFooterRow, { borderTop: '1px solid #000' }]}>
                        <Text>REGISTRAR AQUI ATESTADOS, JUSTIFICATIVAS E O QUAISQUER</Text>
                        <Text>SITUAÇÃO ANORMAL</Text>
                    </View>
                    <View style={[styles.tableFooterWarningRow, { borderBottom: 'none' }]}>
                        <Text>
                            OBRIGATÓRIO ENTREGAR NO DPTO. DE PESSOAS ATÉ O DIA 10 DO MÊS SEGUINTE AO MÊS DE REFERÊNCIA, O NÃO RECEBIMENTO IMPLICARÁ A SUSPENSÃO DE SEUS PROVENTOS.
                        </Text>
                    </View>

                </View>

                {/* 3. ASSINATURAS */}
                <View style={styles.signaturesContainer}>
                    <View style={styles.signatureBox}>
                        <Text>ESTAGIÁRIO</Text>
                    </View>
                    <View style={styles.signatureBox}>
                        <Text>RESPONSÁVEL</Text>
                    </View>
                </View>

            </Page>
        </Document>
    );
};

export default FolhaPontoPDF;
