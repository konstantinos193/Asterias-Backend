import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';

/**
 * One long-lived Chromium, with a concurrency limit.
 *
 * Every `GET /api/pdf/booking/:id` used to call `puppeteer.launch()`, render,
 * and close the whole browser: roughly 1-2 seconds and 100-150 MB RSS per
 * request, with no pool, no reuse, no concurrency limit and no timeout. Two
 * concurrent PDF requests could double the container's memory, on a VPS that
 * hosts four projects behind one proxy — so this was a way to exhaust the box
 * from an authenticated route, without meaning to.
 *
 * What this adds:
 *   - one browser process, launched on first use and reused;
 *   - a semaphore, so at most MAX_CONCURRENT_PAGES renders run at once and the
 *     rest wait rather than each bringing their own Chromium;
 *   - a queue bound, so waiting cannot grow without limit — past it the request
 *     is refused with a 503, which is honest and cheap, rather than accepted
 *     and left to time out;
 *   - a per-render timeout, so one page that never finishes loading cannot hold
 *     a slot forever;
 *   - a fresh page per render, closed afterwards, which is what isolates one
 *     booking's content from the next.
 */
@Injectable()
export class BrowserPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name);

  /** Two renders at once: ~300 MB peak, which the box can absorb. */
  private static readonly MAX_CONCURRENT_PAGES = 2;
  /** Requests allowed to wait for a slot before new ones are refused. */
  private static readonly MAX_QUEUE_DEPTH = 20;
  private static readonly RENDER_TIMEOUT_MS = 30_000;

  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  async onModuleDestroy(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    this.launching = null;
    if (browser) {
      await browser.close().catch((error) =>
        this.logger.warn(`Error closing the browser: ${error instanceof Error ? error.message : error}`),
      );
    }
  }

  /**
   * Runs `render` against a fresh page, holding one of the concurrency slots.
   */
  async withPage<T>(render: (page: Page) => Promise<T>): Promise<T> {
    await this.acquire();
    let page: Page | undefined;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (/^(data:|about:)/.test(request.url())) void request.continue();
        else void request.abort();
      });
      page.setDefaultTimeout(BrowserPoolService.RENDER_TIMEOUT_MS);
      return await this.withTimeout(render(page));
    } finally {
      if (page) {
        await page.close().catch(() => undefined);
      }
      this.release();
    }
  }

  private async withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('PDF rendering timed out')),
            BrowserPoolService.RENDER_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * The browser, launched once.
   *
   * `launching` is held so that concurrent first callers await the same launch
   * instead of each starting a Chromium — which is the problem this service
   * exists to solve, and would otherwise reappear on a cold start.
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;
    if (this.launching) return this.launching;

    this.launching = puppeteer
      .launch({
        headless: true,
        // --no-sandbox is required to run Chromium as root in the container.
        // It is the reason a page must never be given a URL to fetch: this
        // renders setContent() with HTML we built, and the guest-supplied
        // parts of it are HTML-escaped before they get here.
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })
      .then((browser) => {
        this.browser = browser;
        this.launching = null;
        // A crashed browser must not be reused: drop the reference so the next
        // caller launches a new one rather than failing forever.
        browser.on('disconnected', () => {
          if (this.browser === browser) this.browser = null;
        });
        this.logger.log('Chromium launched for PDF rendering');
        return browser;
      })
      .catch((error) => {
        this.launching = null;
        throw error;
      });

    return this.launching;
  }

  private async acquire(): Promise<void> {
    if (this.active < BrowserPoolService.MAX_CONCURRENT_PAGES) {
      this.active += 1;
      return;
    }

    if (this.waiting.length >= BrowserPoolService.MAX_QUEUE_DEPTH) {
      throw new ServiceUnavailableException('Too many PDFs are being generated. Please try again.');
    }

    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    // Transfer the held slot directly; a new request must not steal it while
    // the waiting promise's continuation is queued.
    if (next) next();
    else this.active -= 1;
  }
}
