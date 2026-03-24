import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const feedback = {
      timestamp: new Date().toISOString(),
      conditions: body.conditions,
      predictedScore: body.predictedScore,
      adjustment: body.adjustment,
      finalScore: body.finalScore,
    };

    // Store feedback in a JSONL file
    const dataDir = path.join(process.cwd(), 'data');
    const feedbackPath = path.join(dataDir, 'feedback.jsonl');
    
    // Ensure data directory exists
    await fs.mkdir(dataDir, { recursive: true });
    
    // Append feedback
    await fs.appendFile(feedbackPath, JSON.stringify(feedback) + '\n');
    
    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const feedbackPath = path.join(dataDir, 'feedback.jsonl');
    
    try {
      const content = await fs.readFile(feedbackPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const feedback = lines.map(line => JSON.parse(line));
      
      return NextResponse.json({ 
        count: feedback.length,
        feedback: feedback.slice(-50) // Last 50 entries
      });
    } catch {
      return NextResponse.json({ count: 0, feedback: [] });
    }
  } catch (error) {
    console.error('Feedback read error:', error);
    return NextResponse.json(
      { error: 'Failed to read feedback' },
      { status: 500 }
    );
  }
}
