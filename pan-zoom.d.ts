declare module "pan-zoom" {
  export interface PanZoomEvent {
      // Pan deltas
      dx: number;
      dy: number;
      // Zoom delta
      dz: number;
      // Center coordinates
      x: number;
      y: number;
      // Type of interaction
      type: 'mouse' | 'touch' | 'keyboard';

      target: HTMLElement;

      x0: number;
      y0: number;
  }

  export interface PanZoomControl {
    // Tear down all the event listeners
    destroy: () => void;
    // Will pause all panning, even if a pan is on-going. The only exception is
    // two-finger panning on mobile. That is still allowed to occur.
    pausePanning: () => void;
    // Will re-allow panning after a call to pausePanning. If there is an
    // on-going pan gesture, it can be selectively ignored by passing true for
    // `ignoreCurrent`. This will ignore any lingering momentum. The next pan
    // gesture that starts will be handled normally.
    resumePanning: (ignoreCurrent?: boolean) => void;
  }

  function PanZoomFunction(e: string | HTMLElement, callback: (event: PanZoomEvent) => void): PanZoomControl;

  export default PanZoomFunction;
}