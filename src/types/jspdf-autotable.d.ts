declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';
  
  interface AutoTableOptions {
    head?: any[][];
    body?: any[][];
    startY?: number;
    styles?: any;
    headStyles?: any;
    bodyStyles?: any;
    columnStyles?: any;
  }
  
  global {
    interface jsPDF {
      autoTable: (options: AutoTableOptions) => void;
    }
  }
}
