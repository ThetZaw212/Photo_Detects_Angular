import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';

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

  async onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isLoading = true;
    this.detectionResult = null;

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

      // Load the COCO-SSD model
      const model = await cocoSsd.load();
      const predictions = await model.detect(canvas);

      const hasHuman = predictions.some((pred) =>
        ['person'].includes(pred.class)
      );

      // Set detection result
      this.detectionResult = hasHuman ? 'Human detected!' : 'No human detected';

      // Draw bounding boxes
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

      this.isLoading = false;
    };
  }
}