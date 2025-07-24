import { DocumentFile } from '../../types/document';
import { formatFileSize } from '../../utils/fileValidation';

interface FileListProps {
  files: DocumentFile[];
  onRemove: (fileId: string) => void;
  duplicates?: string[]; // Array of file IDs that are duplicates
}

export default function FileList({ files, onRemove, duplicates = [] }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No files uploaded yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Uploaded Files ({files.length})
      </h3>
      
      <div className="max-h-60 overflow-y-auto space-y-2">
        {files.map((file) => {
          const isDuplicate = duplicates.includes(file.id);
          
          return (
            <div
              key={file.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isDuplicate 
                  ? 'border-yellow-300 bg-yellow-50' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {getFileIcon(file.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {getFileTypeLabel(file.type)}
                    </p>
                    {isDuplicate && (
                      <p className="text-xs text-yellow-600 font-medium">
                        ⚠️ Duplicate file detected
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onRemove(file.id)}
                className="ml-4 p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getFileIcon(type: string) {
  if (type.includes('pdf')) {
    return (
      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
        <span className="text-red-600 text-xs font-bold">PDF</span>
      </div>
    );
  }
  
  if (type.includes('spreadsheet') || type.includes('excel')) {
    return (
      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
        <span className="text-green-600 text-xs font-bold">XLS</span>
      </div>
    );
  }
  
  if (type.includes('word') || type.includes('document')) {
    return (
      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
        <span className="text-blue-600 text-xs font-bold">DOC</span>
      </div>
    );
  }
  
  if (type.includes('presentation')) {
    return (
      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
        <span className="text-orange-600 text-xs font-bold">PPT</span>
      </div>
    );
  }
  
  return (
    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
      <span className="text-gray-600 text-xs font-bold">FILE</span>
    </div>
  );
}

function getFileTypeLabel(type: string): string {
  if (type.includes('pdf')) return 'PDF Document';
  if (type.includes('spreadsheet') || type.includes('excel')) return 'Excel Spreadsheet';
  if (type.includes('word') || type.includes('document')) return 'Word Document';
  if (type.includes('presentation')) return 'PowerPoint Presentation';
  if (type.includes('text')) return 'Text File';
  return 'Unknown File Type';
} 