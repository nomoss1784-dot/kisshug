import { BaseScene } from './base';
import type { Ctx } from '../ui/draw';

/** Blank first frame so firstFrameReady fires as early as possible. */
export class LoadingScene extends BaseScene {
  name = 'Loading';
  build(): void {}
  draw(ctx: Ctx): void {
    this.drawBg(ctx);
  }
}
