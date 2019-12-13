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
    // Will cause the current pan to be stopped
    blockPan: () => void;
    // If the current pan was blocked this resume it. If ignore is true, then
    // the pan will not be handled but the next one will.
    unblockPan: (ignore?: boolean) => void;
  }

  function PanZoomFunction(e: string | HTMLElement, callback: (event: PanZoomEvent) => void): PanZoomControl;

  export default PanZoomFunction;
}