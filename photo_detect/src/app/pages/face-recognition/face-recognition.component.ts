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
          }
        })
        .then((stream) => {
          if (this.videoElement && this.videoElement.nativeElement) {
            const video = this.videoElement.nativeElement;
            video.srcObject = stream;
            video.play();
            this.isCameraOn = true;

            // Start the mirroring effect
            this.mirrorVideo();
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

  mirrorVideo() {
    if (!this.videoElement || !this.canvasElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const drawFrame = () => {
      if (!this.isCameraOn) return;

      if (ctx) {
        ctx.save();
        ctx.scale(-1, 1); // Mirror the image
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  }

  private handleCameraError(error: Error) {
    this.instructionText = 'Camera access error. Please check permissions and try again.';
    console.error('Camera initialization error:', error);
  }

  toggleCamera() {
    if (this.isCameraOn && this.videoElement?.nativeElement?.srcObject) {
      const stream = this.videoElement.nativeElement.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.nativeElement.srcObject = null;
      this.isCameraOn = false;
    } else {
      this.initCamera();
    }
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
        const start = prediction.topLeft as [number, number];
        const end = prediction.bottomRight as [number, number];
        const landmarks = prediction.landmarks as [number, number][];

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
        if (this.leftTurnAudio) {
          this.leftTurnAudio.play(); // Play left turn success sound
        }
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
        if (this.rightTurnAudio) {
          this.rightTurnAudio.play(); // Play right turn success sound
        }
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
        if (this.blinkAudio) {
          this.blinkAudio.play(); // Play blink success sound
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