import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const startTime = Date.now();
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;

    return NextResponse.json({
      status: 'ok',
      app: 'Synthox AI',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'healthy',
          latencyMs: dbLatency,
        },
      },
    });
  } catch (error) {
    console.error('[/api/health] Health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        app: 'Synthox AI',
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: 'unhealthy',
            error: (error as Error).message,
          },
        },
      },
      { status: 503 }
    );
  }
}
