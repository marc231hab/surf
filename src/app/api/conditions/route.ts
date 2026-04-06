import { NextResponse } from 'next/server';
import { fetchBlendedConditions } from '@/lib/buoys';
import { calculateSurfScore, getSurfRating } from '@/lib/surfModel';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const conditions = await fetchBlendedConditions();
    
    if (!conditions) {
      return NextResponse.json(
        { error: 'Unable to fetch conditions' },
        { status: 503 }
      );
    }

    // Calculate score
    const score = calculateSurfScore({
      waveHeight: conditions.waveHeight,
      wavePeriod: conditions.wavePeriod,
      waveDirection: conditions.waveDirection,
      windSpeed: conditions.windSpeed,
      windDirection: conditions.windDirection,
      windGusts: conditions.windGusts,
      tideHeight: conditions.tideHeight,
      tideRising: conditions.tideRising,
      nextTideExtreme: conditions.nextTideExtreme,
      secondarySwellHeight: conditions.secondarySwellHeight,
      secondarySwellPeriod: conditions.secondarySwellPeriod,
      secondarySwellDirection: conditions.secondarySwellDirection,
      waterTemp: conditions.waterTemp,
    });

    const rating = getSurfRating(score);

    return NextResponse.json({
      conditions,
      score,
      rating,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Conditions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
