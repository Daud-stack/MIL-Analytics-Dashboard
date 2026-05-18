import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Papa from 'papaparse';
import { detectFileType, detectYear, autoParseCSV } from '@/lib/parsers';

export async function POST(request: NextRequest) {
  try {
    // Auth: require authenticated session
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized — please sign in' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `File too large. Max size: 50MB` },
        { status: 400 }
      );
    }

    // Check file type
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: 'Only CSV files are supported' },
        { status: 400 }
      );
    }

    // Read file content
    let text = await file.text();
    // Strip UTF-8 BOM so the first header isn't silently corrupted.
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    // Parse CSV
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    if (!parsed.data || parsed.data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Detect file type and year
    const headers = Object.keys((parsed.data[0] || {}) as Record<string, unknown>);
    const fileType = detectFileType(headers);
    const year = detectYear(text);

    // Auto-parse based on file type
    const autoParseResult = autoParseCSV(text);

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileSize: file.size,
        fileType: fileType.toUpperCase(),
        year,
        rowCount: parsed.data.length,
        columnCount: headers.length,
        headers,
        sampleData: parsed.data.slice(0, 10),
        parsedData: autoParseResult,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process uploaded file',
      },
      { status: 500 }
    );
  }
}
