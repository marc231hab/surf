import { fetch9DayForecastWithHourly } from '@/lib/forecast';

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const forecast = await fetch9DayForecastWithHourly();
    
    return Response.json(forecast, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Forecast API error:', error);
    return Response.json(
      { error: 'Failed to fetch forecast' },
      { status: 500 }
    );
  }
}
