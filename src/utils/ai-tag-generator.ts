import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import mammoth from 'mammoth';
import * as officeParser from 'officeparser';
import pdfParse from 'pdf-parse';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const MAX_INLINE_SIZE_MB = 80;

const IMAGE_TAG_PROMPT = (filename: string) => `Analyze this image and generate 25-40 SEARCHABLE English tags ordered from MOST to LEAST important.

PURPOSE: These tags help users find this specific image by typing search terms.
CRITICAL GOAL: Generate tags that uniquely identify THIS image among similar images.
If someone had 10 similar photos, what makes them search for THIS specific one?

━━━ MANDATORY COLOR RULES — NEVER break these ━━━
NEVER write a standalone color word. ALWAYS specify what has that color:
  Fur/coat   → "gray fur", "orange fur", "black fur", "white fur", "brown fur", "striped coat", "spotted coat"
  Eyes       → "orange eyes", "blue eyes", "green eyes", "amber eyes", "yellow eyes"
  Background → "yellow grassland background", "green hillside background", "dark forest background", "blue sky background"
  Object     → "red car", "blue shirt", "white wall", "brown wooden table"
  Ground     → "golden dry grass", "green grass ground", "sandy ground", "rocky terrain", "snow covered ground"

━━━ ANIMALS / PETS ━━━
1. Species: cat, dog, zebra, lion, elephant, bird, rabbit, horse...
2. Breed/type: british shorthair, bengal cat, german shepherd, tabby, persian, husky...
3. Fur/coat color (COMPOUND REQUIRED): "gray fur", "orange fur", "black and white stripes", "spotted coat", "calico fur"
4. Eye color (COMPOUND REQUIRED): "orange eyes", "amber eyes", "blue eyes", "green eyes"
5. Body features: fluffy, shorthair, longhair, big ears, bushy tail, mane, whiskers, long neck
6. Size/age: kitten, puppy, adult, large, small, baby
7. Behavior: sitting, sleeping, running, eating, playing, yawning, stretching, grazing, hunting
8. Gaze: looking at camera, looking away, eyes closed, looking sideways, staring
9. Pose: curled up, upright, crouching, standing, lying down, jumping
10. ENVIRONMENT (distinguishes similar photos): "indoor on sofa", "outdoor in garden", "on wooden floor", "on white bed"
11. BACKGROUND (critical): "blurred green background", "white wall background", "yellow grassland background", "dark background", "forest background"
12. Ground/surface beneath: "grass ground", "wooden floor", "concrete", "sand", "carpet"

━━━ OBJECTS / ITEMS ━━━
1. What it is: phone, laptop, book, car, cup, keyboard, bag, chair, bottle, watch...
2. Brand/type if visible: iphone, macbook, samsung, toyota, nike...
3. Color (COMPOUND): "red car", "black laptop", "white ceramic mug", "blue denim jacket"
4. Material: wooden, plastic, leather, glass, metal, ceramic, fabric, stone
5. State/condition: open, closed, new, old, broken, empty, full, charging, on table, on desk
6. Context/setting: on office desk, in kitchen, on store shelf, outdoors, in hand

━━━ PEOPLE ━━━
1. Who: man, woman, child, boy, girl, elderly person, group of people, couple
2. Appearance: hair color (eg "blonde hair", "dark hair"), clothing ("red jacket", "white shirt"), accessories
3. Action: walking, sitting, smiling, working, reading, cooking, exercising, running, laughing
4. Emotion: happy, sad, focused, laughing, serious, surprised, angry
5. Setting: office, kitchen, park, city street, beach, gym, living room, restaurant
6. Shot type: portrait, selfie, full body shot, close-up face, candid

━━━ ENVIRONMENT / SCENE — required for ALL photos ━━━
Always describe:
- Location: indoor, outdoor, urban, rural, nature, studio, home
- Specific place: living room, pine forest, sandy beach, city street, mountain top, savanna, grassland
- Ground/surface: "green grass", "sandy beach", "wooden floor", "concrete pavement", "snow"
- Background details: "trees in background", "city skyline background", "mountains in background", "plain background"
- Lighting: sunny, overcast, golden hour lighting, night scene, artificial light, backlit, shadow
- Weather/atmosphere: clear sky, cloudy, foggy, rainy

━━━ STRICT RULES ━━━
- NEVER include: photo, image, picture, beautiful, cute, adorable, lovely, nice, animal, pet, mammal, nature, creature
- ALWAYS use compound color descriptions — NEVER standalone "orange", "gray", "blue", "yellow" etc
- Generate 25-40 tags total
- Most identifying/specific tags FIRST, generic tags last
- Think about what uniquely distinguishes THIS photo from similar ones

Return ONLY lowercase comma-separated tags, nothing else.
Filename hint: "${filename}"`;

const VIDEO_TAG_PROMPT = (filename: string, ext: string) => `Analyze this video and generate 20-35 specific English tags ordered from most to least important.

GOAL: Tags that uniquely identify THIS video. What makes it different from similar videos?

Cover in order:
1. What is happening — main action, event, activity (most important — put first)
2. People / animals / objects featured — be specific
3. Setting / location — "indoor office", "outdoor park", "city street", "forest trail"
4. Background details — what is visible behind the main subject
5. Mood / tone / atmosphere — energetic, calm, tense, dramatic, funny
6. Type of video — tutorial, vlog, gameplay, meeting, lecture, film clip, sport, personal recording, screen recording
7. Technical — close-up, wide shot, handheld, aerial, slow motion, timelapse

Color rules: always compound — "green forest background", "blue sky", "gray concrete", never standalone colors.
Also add: video, ${ext}, recording, footage, clip.

Return ONLY comma-separated English tags, most important first, nothing else.
Filename: "${filename}"`;

const AUDIO_TAG_PROMPT = (filename: string, ext: string) => `Analyze this audio and generate 15-25 specific English tags ordered from most to least important.

GOAL: Tags that uniquely identify THIS audio file.

Cover in order:
1. Type — music, speech, podcast, lecture, interview, sound effect, voice memo, meeting recording, nature sound
2. If music — genre (jazz, rock, classical, pop, hip-hop, electronic), mood, tempo (fast, slow, upbeat), instruments, vocals
3. If speech — topic, language style (formal/casual), subject matter, key themes
4. Mood / emotion — calm, energetic, tense, uplifting, melancholic, focused, aggressive, peaceful
5. Quality — studio quality, live recording, lo-fi, professional, amateur, phone recording
6. Notable content — any topics, names, or themes clearly present

Also add: audio, ${ext}, sound, recording.

Return ONLY comma-separated English tags, most important first, nothing else.
Filename: "${filename}"`;

export class AITagGenerator {
  private static apiKey: string;
  private static aiModel: ChatGoogleGenerativeAI;

  static initialize(apiKey: string) {
    if (!apiKey) throw new Error('API Key is missing!');
    this.apiKey = apiKey;
    this.aiModel = new ChatGoogleGenerativeAI({
      model: 'gemini-3-flash-preview',
      apiKey,
    });
  }

  private static extractFilenameWords(filename: string): string[] {
    const stem = filename.replace(/\.[^.]+$/, '');
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ];

    let cleaned = stem.toLowerCase();
    const tsMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (tsMatch) {
      const [, year, mon] = tsMatch;
      const monthName = months[parseInt(mon) - 1] || '';
      cleaned = cleaned
        .replace(
          /\d{4}-\d{2}-\d{2}[\s_-]?\d{2}[-:]\d{2}[-:]\d{2}/,
          `screen recording ${monthName} ${year}`,
        )
        .replace(/\d{4}-\d{2}-\d{2}/, `${monthName} ${year}`);
    }

    return cleaned
      .replace(/[-_.]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(
        (w) =>
          w.length > 1 &&
          !/^\d{1,2}$/.test(w) &&
          !/^(the|and|or|of|in|on|at|to|a|an)$/.test(w),
      );
  }

  private static mergeWithFilename(
    contentTags: string[],
    file: Express.Multer.File,
    limit = 40,
  ): string[] {
    const filenameWords = this.extractFilenameWords(file.originalname);
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    const stem = file.originalname
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[-_.]/g, ' ')
      .trim();
    const all = [...contentTags, ...filenameWords, stem, ext].filter(Boolean);
    return [...new Set(all)].slice(0, limit);
  }

  private static async analyzeMediaWithFilesAPI(
    file: Express.Multer.File,
    prompt: string,
  ): Promise<string> {
    const ext = file.originalname.split('.').pop() || 'bin';
    const tempPath = path.join(
      os.tmpdir(),
      `synapse-upload-${Date.now()}.${ext}`,
    );
    const manager = new GoogleAIFileManager(this.apiKey);
    const genAI = new GoogleGenerativeAI(this.apiKey);

    try {
      fs.writeFileSync(tempPath, file.buffer);

      const upload = await manager.uploadFile(tempPath, {
        mimeType: file.mimetype,
        displayName: file.originalname,
      });

      let uploaded = upload.file;
      let tries = 0;
      while (uploaded.state === FileState.PROCESSING && tries < 30) {
        await new Promise((r) => setTimeout(r, 2000));
        uploaded = await manager.getFile(uploaded.name);
        tries++;
      }

      if (uploaded.state !== FileState.ACTIVE) {
        throw new Error(`File not ready: ${uploaded.state}`);
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
      });
      const result = await model.generateContent([
        { fileData: { mimeType: file.mimetype, fileUri: uploaded.uri } },
        prompt,
      ]);

      try {
        await manager.deleteFile(uploaded.name);
      } catch {}
      return result.response.text();
    } finally {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {}
    }
  }

  private static async extractText(file: Express.Multer.File): Promise<string> {
    const mimeType = file.mimetype;

    if (mimeType === 'application/pdf') {
      const result = await (
        pdfParse as unknown as (buf: Buffer) => Promise<{ text: string }>
      )(file.buffer);
      return result.text.slice(0, 5000);
    }

    if (
      mimeType.includes('wordprocessingml') ||
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value.slice(0, 5000);
    }

    if (
      mimeType.includes('presentationml') ||
      mimeType.includes('spreadsheetml') ||
      mimeType.includes('ms-powerpoint') ||
      mimeType.includes('ms-excel')
    ) {
      const text = (await (officeParser as any).parseOffice(file.buffer)) as string;
      return text.slice(0, 5000);
    }

    if (
      mimeType === 'text/plain' ||
      mimeType === 'text/csv' ||
      mimeType === 'application/json' ||
      mimeType === 'text/html' ||
      mimeType === 'text/xml'
    ) {
      return file.buffer.toString('utf-8').slice(0, 5000);
    }

    return '';
  }

  static async generateTags(file: Express.Multer.File): Promise<string[]> {
    try {
      const mimeType = file.mimetype;
      const sizeMB = file.size / 1024 / 1024;
      const ext = file.originalname.split('.').pop()?.toLowerCase() || '';

      if (mimeType.startsWith('image/')) {
        const base64 = file.buffer.toString('base64');
        const message = new HumanMessage({
          content: [
            {
              type: 'text',
              text: IMAGE_TAG_PROMPT(file.originalname),
            },
            {
              type: 'image_url',
              image_url: `data:${mimeType};base64,${base64}`,
            },
          ],
        });

        const response = await this.aiModel.invoke([message]);
        return this.mergeWithFilename(
          this.parseTags(response.content.toString(), ['image']),
          file,
        );
      }

      if (mimeType.startsWith('video/')) {
        let rawTags: string;

        if (sizeMB <= MAX_INLINE_SIZE_MB) {
          rawTags = await this.analyzeMediaWithFilesAPI(
            file,
            VIDEO_TAG_PROMPT(file.originalname, ext),
          );
        } else {
          const msg = new HumanMessage({
            content: `Generate 20-30 specific English tags for this video file based on its filename.
File: "${file.originalname}" (${sizeMB.toFixed(0)} MB, ${ext.toUpperCase()})
Extract ALL meaningful words from the filename. Infer context from the name.
Also add: video, ${ext}, recording, footage, clip.
Return ONLY comma-separated tags, most specific first.`,
          });
          const res = await this.aiModel.invoke([msg]);
          rawTags = res.content.toString();
        }

        return this.mergeWithFilename(
          this.parseTags(rawTags, ['video', ext, 'recording']),
          file,
        );
      }

      if (mimeType.startsWith('audio/')) {
        let rawTags: string;

        if (sizeMB <= MAX_INLINE_SIZE_MB) {
          rawTags = await this.analyzeMediaWithFilesAPI(
            file,
            AUDIO_TAG_PROMPT(file.originalname, ext),
          );
        } else {
          const msg = new HumanMessage({
            content: `Generate 15-20 specific English tags for this audio file based on its filename.
File: "${file.originalname}" (${sizeMB.toFixed(0)} MB, ${ext.toUpperCase()})
Extract ALL meaningful words. Add: audio, ${ext}, sound, recording.
Return ONLY comma-separated tags, most specific first.`,
          });
          const res = await this.aiModel.invoke([msg]);
          rawTags = res.content.toString();
        }

        return this.mergeWithFilename(
          this.parseTags(rawTags, ['audio', ext, 'sound']),
          file,
        );
      }

      const extractedText = await this.extractText(file);

      if (extractedText.trim().length > 0) {
        const message = new HumanMessage({
          content: `Analyze this document and generate 20-35 highly specific English tags ordered from most to least important.

Cover in order:
1. DOCUMENT TYPE — report, invoice, resume, contract, tutorial, thesis, meeting notes, specification...
2. MAIN TOPIC — primary subject in 1-3 specific words (most important tag)
3. KEY CONCEPTS — recurring themes and core ideas
4. DOMAIN / INDUSTRY — finance, medical, legal, software, education, engineering, marketing...
5. NAMED ENTITIES — people names, company names, tools, products, technologies, places
6. TECHNICAL TERMS — field-specific terminology that appears in the document
7. AUDIENCE — student, developer, manager, researcher, client, executive...
8. PURPOSE — analysis, tutorial, summary, invoice, specification, guide, proposal, report...
9. TIME PERIOD — year, semester, quarter, date if mentioned
10. FORMAT — table, list, chart, presentation slide, form, letter...

Return ONLY comma-separated English tags, most important first, nothing else.

File: ${file.originalname}
Content:
${extractedText}`,
        });

        const response = await this.aiModel.invoke([message]);
        return this.mergeWithFilename(
          this.parseTags(response.content.toString(), ['document']),
          file,
        );
      }

      const msg = new HumanMessage({
        content: `Generate 10-15 English tags for this file based on its filename.
Extract every meaningful word. Include file type and infer context from the name.
Return ONLY comma-separated tags, most specific first.
Filename: ${file.originalname}`,
      });
      const res = await this.aiModel.invoke([msg]);
      return this.mergeWithFilename(
        this.parseTags(res.content.toString(), ['file']),
        file,
      );
    } catch (error) {
      console.error('AI tag error:', error);
      const fallback = this.extractFilenameWords(file.originalname);
      const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
      return [...new Set([...fallback, ext, 'file'])]
        .filter(Boolean)
        .slice(0, 15);
    }
  }

  private static parseTags(content: string, fallback: string[]): string[] {
    const tags = content
      .toString()
      .replace(/\n/g, ',')
      .split(',')
      .map((t) =>
        t
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s\-]/g, '')
          .trim(),
      )
      .filter((t) => t.length > 1 && t.length < 50 && !t.includes(':'));
    return tags.length > 0 ? [...new Set(tags)].slice(0, 40) : fallback;
  }

  static getModel(): ChatGoogleGenerativeAI {
    return this.aiModel;
  }
}
