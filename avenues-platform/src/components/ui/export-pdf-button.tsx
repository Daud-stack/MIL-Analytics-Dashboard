'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { APP_NAME } from '@/lib/app-config';

interface ExportPdfButtonProps {
  targetId: string;
  filename?: string;
  className?: string;
}

export function ExportPdfButton({ targetId, filename = 'Executive_Report', className }: ExportPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const element = document.getElementById(targetId);
      if (!element) {
        console.error(`Export target element #${targetId} not found`);
        return;
      }

      // Hide elements not needed in PDF
      const excludeElements = element.querySelectorAll('.export-exclude');
      (excludeElements as NodeListOf<HTMLElement>).forEach(el => el.style.display = 'none');

      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Restore excluded elements
      (excludeElements as NodeListOf<HTMLElement>).forEach(el => el.style.display = '');

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // Add a header
      pdf.setFontSize(14);
      pdf.setTextColor(15, 23, 42); // slate-900
      pdf.text(`${APP_NAME} - Executive Analytics Report`, 10, 15);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 10, 22);

      // Add the content (shifted down for the header)
      pdf.addImage(imgData, 'JPEG', 0, 30, pdfWidth, pdfHeight);

      // Add footer
      const totalPages = Math.ceil((pdfHeight + 30) / pdf.internal.pageSize.getHeight());
      if (totalPages > 1) {
        // Handle multi-page if needed later, but standard fits page width
      }

      pdf.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleExport} 
      disabled={isExporting}
      className={`border-slate-200 shadow-sm align-middle flex items-center gap-2 ${className}`}
    >
      {isExporting ? <Loader2 className="h-4 w-4 animate-spin text-teal-600" /> : <Download className="h-4 w-4 text-slate-500" />}
      {isExporting ? 'Generating PDF...' : 'Download PDF Report'}
    </Button>
  );
}
