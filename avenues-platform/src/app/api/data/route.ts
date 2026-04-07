import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || '2024');
    const month = parseInt(searchParams.get('month') || '0');
    const type = (searchParams.get('type') || 'dashboard') as
      | 'dashboard'
      | 'location'
      | 'claims';

    // Validate parameters
    if (isNaN(year) || year < 2020 || year > 2030) {
      return NextResponse.json(
        { success: false, error: 'Invalid year parameter' },
        { status: 400 }
      );
    }

    if (isNaN(month) || month < 0 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid month parameter' },
        { status: 400 }
      );
    }

    // Return empty data structure - no sample data
    const data = {
      year,
      dashboard: null,
      location: null,
      claims: null,
    };

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error('Data API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
