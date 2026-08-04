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
    if (
      file.type !== 'text/csv' && 
      !file.name.endsWith('.csv') && 
      !file.name.endsWith('.xlsx')
    ) {
      return NextResponse.json(
        { success: false, error: 'Only CSV and XLSX files are supported' },
        { status: 400 }
      );
    }

    // Read file content
    let parsedDataResult: any = null;
    let text = "";
    let fileType = "UNKNOWN";
    let year = new Date().getFullYear();

    if (file.name.endsWith('.xlsx')) {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      // For simplicity, grab the first sheet and convert to CSV, then autoParse
      // We could iterate sheets, but for now we parse the primary sheet
      const firstSheetName = workbook.SheetNames[0];
      text = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);
      year = detectYear(text);
      fileType = 'GENERIC'; 
      parsedDataResult = autoParseCSV(text);
    } else {
      text = await file.text();
      // Strip UTF-8 BOM
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      year = detectYear(text);
      
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (!parsed.data || parsed.data.length === 0) {
        return NextResponse.json({ success: false, error: 'CSV file is empty' }, { status: 400 });
      }
      const headers = Object.keys((parsed.data[0] || {}) as Record<string, unknown>);
      fileType = detectFileType(headers);
      parsedDataResult = autoParseCSV(text);
    }

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileSize: file.size,
        fileType: fileType.toUpperCase(),
        year,
        parsedData: parsedDataResult,
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
