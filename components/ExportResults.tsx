import React from 'react';
import { DocumentFile } from '../types/document';

interface Classification {
  filename: string;
  category: 'universal' | 'chapter' | 'context' | 'noise';
  reasoning: string;
  confidence: number;
  relevantChapters: string[];
}

interface ExportResultsProps {
  files: DocumentFile[];
  classifications: Classification[];
}

export default function ExportResults({ files, classifications }: ExportResultsProps) {
  const exportToJSON = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      totalFiles: files.length,
      classifications: classifications.map(c => {
        const file = files.find(f => f.name === c.filename);
        return {
          filename: c.filename,
          category: c.category,
          reasoning: c.reasoning,
          confidence: c.confidence,
          relevantChapters: c.relevantChapters,
          fileSize: file ? file.size : 0,
          fileType: file ? file.type : 'unknown'
        };
      }),
      summary: {
        universal: classifications.filter(c => c.category === 'universal').length,
        chapter: classifications.filter(c => c.category === 'chapter').length,
        context: classifications.filter(c => c.category === 'context').length,
        noise: classifications.filter(c => c.category === 'noise').length
      }
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `document-classification-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const exportToCSV = () => {
    const headers = ['Filename', 'Category', 'Reasoning', 'Confidence', 'Relevant Chapters', 'File Size (MB)', 'File Type'];
    
    const rows = classifications.map(c => {
      const file = files.find(f => f.name === c.filename);
      return [
        c.filename,
        c.category,
        c.reasoning,
        (c.confidence * 100).toFixed(0) + '%',
        c.relevantChapters.join('; '),
        file ? (file.size / 1024 / 1024).toFixed(2) : '0',
        file ? file.type : 'unknown'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `document-classification-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  return (
    <div className="flex gap-4 justify-center mt-8">
      <button
        onClick={exportToJSON}
        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export as JSON
      </button>
      
      <button
        onClick={exportToCSV}
        className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export as CSV
      </button>
    </div>
  );
} 