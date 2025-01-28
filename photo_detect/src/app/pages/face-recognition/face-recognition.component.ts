import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-face-recognition',
  imports: [CommonModule],
  templateUrl: './face-recognition.component.html',
  styleUrl: './face-recognition.component.scss'
})
export class FaceRecognitionComponent implements OnInit {
  @ViewChild('video') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasElement!: ElementRef<HTMLCanvasElement>;

  model: any;
  isCameraOn: boolean = false;
  isFaceTurnedLeft: boolean = false;
  isFaceTurnedRight: boolean = false;
  isBlinking: boolean = false;
  currentState: 'left' | 'right' | 'blink' | 'done' = 'left'; // Track the current state
  resultText: string = ''; // Show result text
  instructionText: string = 'Please turn your face to the left and right.'; // Show instructions

  ngOnInit(): void {
    this.initCamera();
    this.loadModel();
  }

  async loadModel() {
    this.model = await blazeface.load();
    console.log('Model loaded');
    this.detectFaces();
  }

  initCamera() {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        this.videoElement.nativeElement.srcObject = stream;
        this.videoElement.nativeElement.play();
        this.isCameraOn = true;
      })
      .catch((err) => console.error('Error accessing camera:', err));
  }

  toggleCamera() {
    if (this.isCameraOn) {
      const stream = this.videoElement.nativeElement.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      this.isCameraOn = false;
    } else {
      this.initCamera();
    }
  }

  async detectFaces() {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (this.model) {
      setInterval(async () => {
        const predictions = await this.model.estimateFaces(video, false);

        ctx!.clearRect(0, 0, canvas.width, canvas.height);
        ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);

        predictions.forEach((prediction: any) => {
          const start = prediction.topLeft as [number, number];
          const end = prediction.bottomRight as [number, number];
          const landmarks = prediction.landmarks;

          const x = start[0];
          const y = start[1];
          const width = end[0] - start[0];
          const height = end[1] - start[1];

          // Draw bounding box
          ctx!.strokeStyle = 'blue';
          ctx!.lineWidth = 2;
          ctx!.strokeRect(x, y, width, height);

          // Draw landmarks
          landmarks.forEach(([lx, ly]: [number, number]) => {
            ctx!.fillStyle = 'red';
            ctx!.beginPath();
            ctx!.arc(lx, ly, 3, 0, 2 * Math.PI);
            ctx!.fill();
          });

          // Check face orientation and blinking
          this.checkOrientation(landmarks);
          if (this.currentState === 'blink') {
            this.checkBlinking(landmarks);
          }
        });
      }, 100);
    }
  }

  checkOrientation(landmarks: number[][]) {
    const leftEye = landmarks[0]; // Approximation of left eye
    const rightEye = landmarks[1]; // Approximation of right eye
    const nose = landmarks[2]; // Approximation of nose bridge
    const leftCheek = landmarks[3]; // Approximation of left cheek
    const rightCheek = landmarks[4]; // Approximation of right cheek
  
    const leftFaceWidth = Math.abs(leftEye[0] - leftCheek[0]);
    const rightFaceWidth = Math.abs(rightEye[0] - rightCheek[0]);
  
    if (this.currentState === 'left' && leftFaceWidth > rightFaceWidth) {
      this.resultText = 'Face turned left - Success!';
      console.log('Face turned left');
      this.instructionText = 'Please wait...';
      this.currentState = 'right'; 
      this.delayAndProceed(); 
    } else if (this.currentState === 'right' && rightFaceWidth > leftFaceWidth) {
      this.resultText = 'Face turned right - Success!';
      this.instructionText = 'Please blink your eyes.'; 
      console.log('Face turned right');
      this.currentState = 'blink'; 
      this.delayAndProceed(); 
    }
  }

  checkBlinking(landmarks: number[][]) {
    const leftEye = landmarks[0];
    const rightEye = landmarks[1];
  
    const eyeAspectRatio = (Math.abs(leftEye[1] - rightEye[1]) + Math.abs(leftEye[0] - rightEye[0])) / 2;
  
    if (eyeAspectRatio < 10) {
      // Third state: Blinking detected
      this.isBlinking = true;
      this.resultText = 'Blink detected - Success!';
      this.instructionText = 'Process complete!'; // Final instruction
      console.log('Blink detected');
      this.currentState = 'done'; // Final state
      this.delayAndClearResult();
    }
  }

  delayAndProceed() {
    setTimeout(() => {
      this.resultText = ''; // Clear the result text
      if (this.currentState === 'right') {
        this.instructionText = 'Please turn your face to the right.'; // Update instruction for the next state
      } else if (this.currentState === 'blink') {
        this.instructionText = 'Please blink your eyes.'; // Update instruction for blinking
      }
    }, 500); // Delay for 500ms
  }

  delayAndClearResult() {
    setTimeout(() => {
      this.resultText = ''; // Clear the result text
    }, 500); // Delay for 500ms
  }
}