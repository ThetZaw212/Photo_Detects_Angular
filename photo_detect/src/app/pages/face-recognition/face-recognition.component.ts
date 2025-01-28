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
  instructionText: string = 'Please turn your face to the left'; // Show instructions

  // Add new properties to track state completion
  leftTurnCompleted: boolean = false;
  rightTurnCompleted: boolean = false;
  blinkCompleted: boolean = false;

  // Add new property to track blink frames
  blinkFrameCount: number = 0;

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

    let lastProcessTime = 0;
    const PROCESS_INTERVAL = 200; // Process every 200ms instead of every frame

    const detect = async (timestamp: number) => {
      if (!this.isCameraOn) return;
      
      // Throttle processing
      if (timestamp - lastProcessTime < PROCESS_INTERVAL) {
        requestAnimationFrame(detect);
        return;
      }
      
      lastProcessTime = timestamp;
      const predictions = await this.model.estimateFaces(video, false);
      
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (predictions.length > 0) {
        const prediction = predictions[0]; // Focus on the primary face
        const start = prediction.topLeft;
        const end = prediction.bottomRight;
        const landmarks = prediction.landmarks;

        // Draw bounding box
        const x = start[0];
        const y = start[1];
        const width = end[0] - start[0];
        const height = end[1] - start[1];

        ctx!.strokeStyle = '#00ff00';
        ctx!.lineWidth = 2;
        ctx!.strokeRect(x, y, width, height);

        // Draw landmarks with different colors
        landmarks.forEach(([lx, ly]: [number, number], index: number) => {
          ctx!.fillStyle = index < 2 ? '#ff0000' : '#00ff00'; // Red for eyes, green for others
          ctx!.beginPath();
          ctx!.arc(lx, ly, 4, 0, 2 * Math.PI);
          ctx!.fill();
        });

        // Process face orientation and blinking
        this.checkOrientation(landmarks);
        if (this.currentState === 'blink') {
          this.checkBlinking(landmarks);
        }
      }

      requestAnimationFrame(detect);
    };

    requestAnimationFrame(detect);
  }

  checkOrientation(landmarks: number[][]) {
    const leftEye = landmarks[0];
    const rightEye = landmarks[1];
    const nose = landmarks[2];

    const leftEyeToNose = Math.abs(leftEye[0] - nose[0]);
    const rightEyeToNose = Math.abs(rightEye[0] - nose[0]);
    
    const orientationRatio = leftEyeToNose / rightEyeToNose;
    console.log('Orientation ratio:', orientationRatio);

    // More strict thresholds for better detection
    if (this.currentState === 'left') {
      if (orientationRatio < 0.6 && !this.leftTurnCompleted) { // More extreme left turn required
        this.leftTurnCompleted = true;
        this.resultText = 'Face turned left - Success!';
        console.log('Face turned left');
        this.instructionText = 'Please turn your face to the right';
        
        // Add delay before changing to right state
        setTimeout(() => {
          this.currentState = 'right';
          this.resultText = '';
        }, 2000); // Increased delay to 2 seconds
      }
    } else if (this.currentState === 'right') {
      if (orientationRatio > 1.4 && !this.rightTurnCompleted) { // More extreme right turn required
        this.rightTurnCompleted = true;
        console.log('Face turned right');
        this.resultText = 'Face turned right - Success!';
        this.instructionText = 'Get ready to blink your eyes';
        
        // Add longer delay before blink detection
        setTimeout(() => {
          this.currentState = 'blink';
          this.resultText = '';
          this.instructionText = 'Please blink your eyes now';
        }, 3000); // 3 second delay before blink detection
      }
    }
  }

  checkBlinking(landmarks: number[][]) {
    if (!this.leftTurnCompleted || !this.rightTurnCompleted) {
      return;
    }

    const leftEye = landmarks[0];
    const rightEye = landmarks[1];
    
    const leftEyeY = leftEye[1];
    const rightEyeY = rightEye[1];
    const eyeDistance = Math.abs(leftEye[0] - rightEye[0]);
    
    const eyeAspectRatio = Math.abs(leftEyeY - rightEyeY) / eyeDistance;

    // Adjusted threshold and added minimum hold time
    const BLINK_THRESHOLD = 0.07; // More sensitive threshold
    const MIN_BLINK_FRAMES = 3; // Number of frames blink must be detected
    
    if (eyeAspectRatio < BLINK_THRESHOLD) {
      if (!this.blinkFrameCount) {
        this.blinkFrameCount = 1;
      } else {
        this.blinkFrameCount++;
      }
      
      if (this.blinkFrameCount >= MIN_BLINK_FRAMES && !this.blinkCompleted) {
        this.blinkCompleted = true;
        this.isBlinking = true;
        this.resultText = 'Blink detected - Success!';
        console.log('Blink detected');
        this.instructionText = 'All steps completed successfully!';
        this.currentState = 'done';
        setTimeout(() => {
          this.resultText = '';
        }, 2000);
      }
    } else {
      this.blinkFrameCount = 0;
    }
  }
}