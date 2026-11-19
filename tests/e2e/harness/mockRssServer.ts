import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { REPORT_CATEGORIES, type ReportCategory } from '@repo/shared';

export interface MockRssItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string | Date;
  description?: string;
  sourceName?: string;
}

export type MockRssFault = 'none' | '500' | '404' | 'delay' | 'malformed' | 'empty';

export class MockRssServer {
  private server: http.Server | null = null;
  private port = 0;
  private globalFault: MockRssFault = 'none';
  private globalDelayMs = 0;
  private categoryFaults: Map<string, { fault: MockRssFault; delayMs: number }> = new Map();
  private feedData: Map<string, MockRssItem[]> = new Map();
  private requestLog: Array<{ path: string; method: string; timestamp: Date }> = [];

  constructor() {
    this.initDefaultFeeds();
  }

  private initDefaultFeeds(): void {
    this.feedData.clear();
    this.categoryFaults.clear();
    this.globalFault = 'none';
    this.globalDelayMs = 0;
    this.requestLog = [];

    const now = new Date().toUTCString();

    // Default fixtures for all 11 categories in Bangla and English
    const defaults: Record<ReportCategory, MockRssItem[]> = {
      THEFT: [
        {
          guid: 'rss-theft-001',
          title: 'মিরপুরে বাসা থেকে স্বর্ণালঙ্কার ও নগদ টাকা চুরি',
          link: 'https://news.bangladesh.test/theft-mirpur-001',
          pubDate: now,
          description: 'মিরপুর মডেল থানা এলাকায় একটি ভবনের ফ্ল্যাট থেকে মালামাল চুরির ঘটনা ঘটেছে।',
          sourceName: 'The Daily Star',
        },
        {
          guid: 'rss-theft-002',
          title: 'Motorbike stolen from parking lot in Uttara',
          link: 'https://news.bangladesh.test/theft-uttara-002',
          pubDate: now,
          description: 'A motorcycle was stolen yesterday afternoon from Uttara sector 4.',
          sourceName: 'Daily Sun',
        },
      ],
      ROBBERY: [
        {
          guid: 'rss-robbery-001',
          title: 'উত্তরায় মধ্যরাতে সিন্দুক ভেঙে সশস্ত্র ডাকাতি',
          link: 'https://news.bangladesh.test/robbery-uttara-001',
          pubDate: now,
          description: 'উত্তরা পশ্চিম থানা এলাকার একটি ব্যবসা প্রতিষ্ঠানে অস্ত্রের মুখে ডাকাতির ঘটনা ঘটে।',
          sourceName: 'Prothom Alo',
        },
      ],
      THEFT_ROBBERY: [
        {
          guid: 'rss-theft-robbery-001',
          title: 'ধানমন্ডিতে গভীর রাতে চুরি ও ডাকাতির ঘটনায় মামলা',
          link: 'https://news.bangladesh.test/theft-robbery-dhanmondi-001',
          pubDate: now,
          description: 'ধানমন্ডি মডেল থানা এলাকায় চুরি ও লুণ্ঠনের ঘটনায় পুলিশ অভিযান চালাচ্ছে।',
          sourceName: 'Dhaka Post',
        },
      ],
      SNATCHING: [
        {
          guid: 'rss-snatching-001',
          title: 'ফার্মগেটে অফিসগামী পথচারীর মোবাইল ও ব্যাগ ছিনতাই',
          link: 'https://news.bangladesh.test/snatching-farmgate-001',
          pubDate: now,
          description: 'তেজগাঁও থানা সংলগ্ন ফার্মগেট মোড়ে ছিনতাইকারী চক্র ব্যাগ টেনে নিয়ে যায়।',
          sourceName: 'Kaler Kantho',
        },
      ],
      ARMED_ASSAULT: [
        {
          guid: 'rss-assault-001',
          title: 'মোহাম্মদপুরে দুর্বৃত্তদের ছুরিকাঘাতে যুবক গুরুতর আহত',
          link: 'https://news.bangladesh.test/assault-mohammadpur-001',
          pubDate: now,
          description: 'মোহাম্মদপুর থানা এলাকায় ধারালো অস্ত্র দিয়ে কুপিয়ে জখম করা হয়।',
          sourceName: 'Samakal',
        },
      ],
      SNATCHING_ARMED_ASSAULT: [
        {
          guid: 'rss-snatching-assault-001',
          title: 'যাত্রাবাড়ীতে ছিনতাইকালে বাধা দেওয়ায় পথচারীকে কুপিয়ে জখম',
          link: 'https://news.bangladesh.test/snatching-assault-jatrabari-001',
          pubDate: now,
          description: 'যাত্রাবাড়ী থানা এলাকায় ছিনতাই ও সশস্ত্র হামলায় একজন রক্তাক্ত হন।',
          sourceName: 'Jugantor',
        },
      ],
      EXTORTION: [
        {
          guid: 'rss-extortion-001',
          title: 'টঙ্গীতে ৫ লাখ টাকা চাঁদা দাবি না পেয়ে দোকানে ভাঙচুর',
          link: 'https://news.bangladesh.test/extortion-tongi-001',
          pubDate: now,
          description: 'টঙ্গী পশ্চিম থানা এলাকায় চাঁদাবাজ চক্র ব্যবসায়ীর ওপর চাঁদার দাবিতে আক্রমণ চালায়।',
          sourceName: 'Ittefaq',
        },
      ],
      YOUTH_GANG_ACTIVITY: [
        {
          guid: 'rss-gang-001',
          title: 'মিরপুর ১০ নম্বরে কিশোর গ্যাংয়ের দুই পক্ষের মধ্যে সংঘর্ষ',
          link: 'https://news.bangladesh.test/gang-mirpur-001',
          pubDate: now,
          description: 'মিরপুর মডেল থানা এলাকায় কিশোর গ্যাংয়ের মহড়া ও দেশীয় অস্ত্র নিয়ে সংঘর্ষ হয়।',
          sourceName: 'Banglanews24',
        },
      ],
      DRUG_RELATED_CRIME: [
        {
          guid: 'rss-drug-001',
          title: 'টেকনাফে বিপুল পরিমাণ ইয়াবাসহ দুই মাদক কারবারি আটক',
          link: 'https://news.bangladesh.test/drug-teknaf-001',
          pubDate: now,
          description: 'টেকনাফ থানা পুলিশ ও বিজিবি অভিযান চালিয়ে ইয়াবা ট্যাবলেট উদ্ধার করেছে।',
          sourceName: 'Bdnews24',
        },
      ],
      UNLIT_ROAD: [
        {
          guid: 'rss-unlit-001',
          title: 'কেরানীগঞ্জে অন্ধকার ভাঙা সড়কে রাতে চলাচলে চরম ঝুঁকি',
          link: 'https://news.bangladesh.test/unlit-keraniganj-001',
          pubDate: now,
          description: 'কেরানীগঞ্জ থানা সংলগ্ন প্রধান সড়কে বাতি না থাকায় পথচারী ও চালকরা দুর্ঘটনার ঝুঁকিতে।',
          sourceName: 'Janakantha',
        },
      ],
      ROAD_ACCIDENT: [
        {
          guid: 'rss-accident-001',
          title: 'সীতাকুণ্ডে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৩',
          link: 'https://news.bangladesh.test/accident-sitakunda-001',
          pubDate: now,
          description: 'সীতাকুণ্ড থানা এলাকায় ঢাকা-চট্টগ্রাম মহাসড়কে বাস ও ট্রাকের সংঘর্ষে ৩ জন নিহত ও বহু আহত।',
          sourceName: 'The Daily Star',
        },
      ],
      // Fallback aliases
      MUGGING: [],
      DACOITY: [],
      THEFT_DACOITY: [],
      TEEN_GANG: [],
      TEEN_GANG_ARMED_ASSAULT: [],
      DRUG_ACTIVITY: [],
    };

    for (const [cat, items] of Object.entries(defaults)) {
      this.feedData.set(cat, items);
    }
  }

  public async start(): Promise<string> {
    if (this.server) {
      return this.getBaseUrl();
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Mock RSS Server Internal Error');
        }
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address() as AddressInfo;
        this.port = addr.port;
        resolve(this.getBaseUrl());
      });

      this.server.on('error', reject);
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null;
        this.port = 0;
        resolve();
      });
    });
  }

  public getBaseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  public getFeedUrl(category: ReportCategory, _lang: 'bn' | 'en' = 'en'): string {
    return `${this.getBaseUrl()}/rss/${category.toLowerCase()}`;
  }

  public setFaultMode(fault: MockRssFault, delayMs = 0): void {
    this.globalFault = fault;
    this.globalDelayMs = delayMs;
  }

  public setCategoryFault(category: ReportCategory, fault: MockRssFault, delayMs = 0): void {
    this.categoryFaults.set(category.toUpperCase(), { fault, delayMs });
  }

  public setFeedItems(category: ReportCategory, items: MockRssItem[]): void {
    this.feedData.set(category.toUpperCase(), items);
  }

  public getFeedItems(category: ReportCategory): MockRssItem[] {
    return this.feedData.get(category.toUpperCase()) || [];
  }

  public getRequestLog(): Array<{ path: string; method: string; timestamp: Date }> {
    return [...this.requestLog];
  }

  public reset(): void {
    this.initDefaultFeeds();
  }

  public generateRssXml(channelTitle: string, items: MockRssItem[]): string {
    const itemsXml = items
      .map(
        (it) => `    <item>
      <title><![CDATA[${it.title}]]></title>
      <link>${it.link}</link>
      <guid isPermaLink="false">${it.guid}</guid>
      <pubDate>${new Date(it.pubDate).toUTCString()}</pubDate>
      <description><![CDATA[${it.description || ''}]]></description>
      ${it.sourceName ? `<source url="${it.link}">${it.sourceName}</source>` : ''}
    </item>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${channelTitle}]]></title>
    <link>${this.getBaseUrl()}</link>
    <description><![CDATA[Danger Zone BD Automated News Feed Feed]]></description>
    <language>bn-BD</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const urlStr = req.url || '/';
    this.requestLog.push({ path: urlStr, method: req.method || 'GET', timestamp: new Date() });

    // Determine target category from URL
    let matchedCategory: ReportCategory | undefined;
    for (const cat of REPORT_CATEGORIES) {
      if (urlStr.toLowerCase().includes(cat.toLowerCase())) {
        matchedCategory = cat;
        break;
      }
    }

    // Determine fault mode
    let fault = this.globalFault;
    let delayMs = this.globalDelayMs;

    if (matchedCategory && this.categoryFaults.has(matchedCategory.toUpperCase())) {
      const catFault = this.categoryFaults.get(matchedCategory.toUpperCase())!;
      fault = catFault.fault;
      delayMs = catFault.delayMs;
    }

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    if (fault === '500') {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error (Mock Fault)');
      return;
    }

    if (fault === '404') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found (Mock Fault)');
      return;
    }

    if (fault === 'malformed') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end('<<MALFORMED_XML>>>This is not valid XML<<<');
      return;
    }

    if (fault === 'empty') {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end('');
      return;
    }

    const categoryKey = (matchedCategory || 'ROAD_ACCIDENT').toUpperCase();
    const items = this.feedData.get(categoryKey) || [];
    const xml = this.generateRssXml(`Danger Zone BD - ${categoryKey}`, items);

    res.writeHead(200, {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(xml, 'utf-8'),
    });
    res.end(xml);
  }
}
