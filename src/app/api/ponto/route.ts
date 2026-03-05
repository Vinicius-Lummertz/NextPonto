import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// REGISTRAR PONTO (Entrada, Almoço, Volta, Saída)
export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    if (!username) return NextResponse.json({ error: 'Username necessário' }, { status: 400 });

    const now = new Date();
    // Prisma's @db.Date salva em UTC. Vamos garantir que a pesquisa do dia use a meia-noite UTC absoluta.
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Busca o registro de ponto de hoje
    let ponto = await prisma.ponto.findFirst({
      where: { username, data: today }
    });

    // PROGRESSÃO DO PONTO:
    if (!ponto) {
      ponto = await prisma.ponto.create({
        data: { username, data: today, entrada: now }
      });
      return NextResponse.json({ ponto, next: 'Saída Almoço' });
    }

    if (!ponto.almoco_saida) {
      ponto = await prisma.ponto.update({
        where: { id: ponto.id }, data: { almoco_saida: now }
      });
      return NextResponse.json({ ponto, next: 'Retorno Almoço' });
    }

    if (!ponto.almoco_retorno) {
      ponto = await prisma.ponto.update({
        where: { id: ponto.id }, data: { almoco_retorno: now }
      });
      return NextResponse.json({ ponto, next: 'Saída Final' });
    }

    if (!ponto.saida_final) {
      ponto = await prisma.ponto.update({
        where: { id: ponto.id }, data: { saida_final: now }
      });
      return NextResponse.json({ ponto, next: 'Turno Concluído' });
    }

    return NextResponse.json({ error: 'Turno 100% preenchido hoje' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
  }
}

// BUSCAR HISTÓRICO MENSAL E HOJE
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'Error' }, { status: 400 });

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1)); // Últimos meses

  const historico = await prisma.ponto.findMany({
    where: { username, data: { gte: startOfMonth } },
    orderBy: { data: 'desc' }
  });

  const todayStr = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString();

  const pontoHoje = historico.find(p => {
    return new Date(p.data).toISOString() === todayStr;
  });

  // Determinar rótulo do botão baseado no estado atual
  let next = 'Entrada';
  if (pontoHoje) {
    if (pontoHoje.saida_final) next = 'Turno Concluído';
    else if (pontoHoje.almoco_retorno) next = 'Saída Final';
    else if (pontoHoje.almoco_saida) next = 'Retorno Almoço';
    else next = 'Saída Almoço';
  }

  return NextResponse.json({ historico, hoje: pontoHoje || null, next });
}
