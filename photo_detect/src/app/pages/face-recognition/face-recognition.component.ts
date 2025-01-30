import { Component, ElementRef, OnInit, ViewChild, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-face-recognition',
  standalone: true,
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

  // Audio elements for different states
  public modelLoadedAudio: HTMLAudioElement | null = null;
  public leftTurnAudio: HTMLAudioElement | null = null;
  public rightTurnAudio: HTMLAudioElement | null = null;
  public blinkAudio: HTMLAudioElement | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      // Initialize audio elements
      this.modelLoadedAudio = new Audio('faceload.mp3');
      this.leftTurnAudio = new Audio('success.mp3');
      this.rightTurnAudio = new Audio('success.mp3');
      this.blinkAudio = new Audio('success.mp3');
    }
  }

  ngOnInit(): void {
    setTimeout(() => {
      this.initCamera();
      this.loadModel();
    }, 100);
  }

  async loadModel() {
    this.model = await blazeface.load();
    console.log('Model loaded');
    if (this.modelLoadedAudio) {
      this.modelLoadedAudio.play(); // Play sound when model is loaded
    }
    this.detectFaces();
  }

  initCamera() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
        })
        .then((stream) => {
          if (this.videoElement && this.videoElement.nativeElement) {
            const video = this.videoElement.nativeElement;
            video.srcObject = stream;
            video.play();
            video.style.transform = 'none'; // Remove mirror effect
            this.isCameraOn = true;
          }
        })
        .catch((err) => {
          console.error('Error accessing camera:', err);
          this.handleCameraError(err);
        });
    } else {
      console.error('MediaDevices API not available');
      this.handleCameraError(new Error('Camera access not available'));
    }
  }

  private handleCameraError(error: Error) {
    this.instructionText = 'Camera access error. Please check permissions and try again.';
    console.error('Camera initialization error:', error);
  }

  async detectFaces() {
    if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) {
      console.error('Video or canvas element not initialized');
      return;
    }

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

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
        const landmarks = prediction.landmarks as [number, number][];

        const leftEye = landmarks[0];
        const rightEye = landmarks[1];
        const nose = landmarks[2];

        const leftEyeToNose = Math.abs(leftEye[0] - nose[0]);
        const rightEyeToNose = Math.abs(rightEye[0] - nose[0]);

        const orientationRatio = leftEyeToNose / rightEyeToNose;
        console.log('Orientation ratio:', orientationRatio);

        if (this.currentState === 'left') {
          if (orientationRatio > 6.2 && !this.leftTurnCompleted) {
            this.leftTurnCompleted = true;
            this.resultText = 'Face turned left - Success!';
            console.log('Face turned left');
            if (this.leftTurnAudio) {
              this.leftTurnAudio.play();
            }
            this.instructionText = 'Please turn your face to the right';

            setTimeout(() => {
              this.currentState = 'right';
              this.resultText = '';
            }, 2000);
          }
        } else if (this.currentState === 'right') {
          if (orientationRatio < 0.63 && !this.rightTurnCompleted) {
            this.rightTurnCompleted = true;
            console.log('Face turned right');
            this.resultText = 'Face turned right - Success!';
            if (this.rightTurnAudio) {
              this.rightTurnAudio.play();
            }
            this.instructionText = 'Get ready to blink your eyes';

            setTimeout(() => {
              this.currentState = 'blink';
              this.resultText = '';
              this.instructionText = 'Please blink your eyes now';
            }, 3000);
          }
        }

        if (this.currentState === 'blink') {
          const leftEyeY = leftEye[1];
          const rightEyeY = rightEye[1];
          const eyeDistance = Math.abs(leftEye[0] - rightEye[0]);

          const eyeAspectRatio = Math.abs(leftEyeY - rightEyeY) / eyeDistance;

          const BLINK_THRESHOLD = 0.07;
          const MIN_BLINK_FRAMES = 3;

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
              if (this.blinkAudio) {
                this.blinkAudio.play();
              }
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

      requestAnimationFrame(detect);
    };

    requestAnimationFrame(detect);
  }
}