import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface'
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
  isFaceTurnedLeftOnce: boolean = false;
  isFaceTurnedRightOnce: boolean = false;

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
        this.videoElement.nativeElement.style.transform = 'scaleX(-1)'; // Remove mirror effect
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

        predictions.forEach((prediction : any) => {
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

          // Check face orientation and eye openness
          this.checkOrientation(landmarks);
        });
      }, 100);
    }
  }

  checkOrientation(landmarks: number[][]) {
    const leftEye = landmarks[0]; // Approximation of left eye
    const rightEye = landmarks[1]; // Approximation of right eye
    const nose = landmarks[2]; // Approximation of nose bridge

    const dx = rightEye[0] - leftEye[0];
    const dy = rightEye[1] - leftEye[1];
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    console.log('Face Orientation Angle:', angle);

    if (angle < -10 && !this.isFaceTurnedLeftOnce) {
      console.log('Face turned left');
      // this.isFaceTurnedLeft = true;
      // this.isFaceTurnedRight = false;
      this.isFaceTurnedLeftOnce = true;
    } else if (angle > 10 && this.isFaceTurnedLeftOnce && !this.isFaceTurnedRightOnce) {
      console.log('Face turned right');
      // this.isFaceTurnedLeft = false;
      // this.isFaceTurnedRight = true;
      this.isFaceTurnedRightOnce = true;
    } else {
      this.isFaceTurnedLeft = false;
      this.isFaceTurnedRight = false;
    }

    // Check eye openness (example logic)
    // const eyeDistance = Math.abs(leftEye[1] - rightEye[1]);
    // if (eyeDistance < 5) {
    //   console.log('Eyes closed');
    // } else {
    //   console.log('Eyes open');
    // }
  }
}
