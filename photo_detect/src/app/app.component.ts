import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

declare const Tesseract: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: true }) fileInput!: ElementRef<HTMLInputElement>;

  isLoading = false;
  detectionResult: string | null = null;
  detectedText: string = '';
  selectedLanguage: string = 'eng';

  // Update language options to include Myanmar
  languages = [
    { code: 'eng', name: 'English' },
    { code: 'fra', name: 'French' },
    { code: 'spa', name: 'Spanish' },
    { code: 'deu', name: 'German' },
    { code: 'chi_sim', name: 'Chinese Simplified' },
    { code: 'jpn', name: 'Japanese' },
    { code: 'mya', name: 'Myanmar (Burmese)' }  // Added Myanmar language
  ];

  async onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isLoading = true;
    this.detectionResult = null;
    this.detectedText = '';

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    img.onload = async () => {
      const canvas = this.canvas.nativeElement;
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      try {
        // Perform human detection
        const model = await cocoSsd.load();
        const predictions = await model.detect(canvas);
        const hasHuman = predictions.some((pred) => ['person'].includes(pred.class));
        this.detectionResult = hasHuman ? 'Human detected!' : 'No human detected';

        // Draw bounding boxes for humans
        predictions.forEach((prediction) => {
          if (prediction.class === 'person') {
            const [x, y, width, height] = prediction.bbox;
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            ctx.font = '18px Arial';
            ctx.fillStyle = 'red';
            ctx.fillText(prediction.class, x, y > 10 ? y - 5 : y + 15);
          }
        });

        // Perform text detection
        await this.detectText(canvas.toDataURL());

      } catch (error) {
        console.error('Detection error:', error);
        this.detectionResult = 'Error during detection';
      } finally {
        this.isLoading = false;
      }
    };
  }

  async detectText(imageUrl: string) {
    try {
      const worker = await Tesseract.createWorker();
      await worker.loadLanguage(this.selectedLanguage);
      await worker.initialize(this.selectedLanguage);
      
      const { data: { text } } = await worker.recognize(imageUrl);
      
      if (this.selectedLanguage === 'mya') {
        const normalizedText = text.normalize('NFC');
        this.detectedText = normalizedText.replace(/[<>&"']/g, (char: string) => {
          switch (char) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return char;
          }
        });
      } else {
        this.detectedText = text.replace(/[<>&"']/g, (char: string) => {
          switch (char) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return char;
          }
        });
      }
      
      await worker.terminate();
    } catch (error) {
      console.error('Text detection error:', error);
      this.detectedText = 'Error detecting text';
    }
  }

  onLanguageChange(event: Event) {
    this.selectedLanguage = (event.target as HTMLSelectElement).value;
    if (this.canvas.nativeElement.toDataURL()) {
      this.detectText(this.canvas.nativeElement.toDataURL());
    }
  }
}