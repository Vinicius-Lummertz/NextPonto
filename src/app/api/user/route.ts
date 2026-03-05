import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  try {
    const userInfo = os.userInfo();
    
    // Substitui ponto por espaço e aplica Title Case (mesmo formato do Rust)
    const formattedName = userInfo.username
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
      
    return NextResponse.json({ username: formattedName });
  } catch (error) {
    return NextResponse.json({ username: 'Usuário Desconhecido' }, { status: 500 });
  }
}
