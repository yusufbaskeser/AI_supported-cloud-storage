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
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];

    let cleaned = stem.toLowerCase();
    const tsMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (tsMatch) {
      const [, year, mon] = tsMatch;
      const monthName = months[parseInt(mon) - 1] || '';
      cleaned = cleaned
        .replace(/\d{4}-\d{2}-\d{2}[\s_-]?\d{2}[-:]\d{2}[-:]\d{2}/, `screen recording ${monthName} ${year}`)
        .replace(/\d{4}-\d{2}-\d{2}/, `${monthName} ${year}`);
    }

    return cleaned
      .replace(/[-_.]/g, ' ')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 1 && !/^\d{1,2}$/.test(w) && !/^(the|and|or|of|in|on|at|to|a|an)$/.test(w));
  }

  private static mergeWithFilename(contentTags: string[], file: Express.Multer.File, limit = 30): string[] {
    const filenameWords = this.extractFilenameWords(file.originalname);
    const ext  = file.originalname.split('.').pop()?.toLowerCase() || '';
    const stem = file.originalname.replace(/\.[^.]+$/, '').toLowerCase().replace(/[-_.]/g, ' ').trim();
    const all  = [...contentTags, ...filenameWords, stem, ext].filter(Boolean);
    return [...new Set(all)].slice(0, limit);
  }

  private static async analyzeMediaWithFilesAPI(
    file: Express.Multer.File,
    prompt: string,
  ): Promise<string> {
    const ext      = file.originalname.split('.').pop() || 'bin';
    const tempPath = path.join(os.tmpdir(), `synapse-upload-${Date.now()}.${ext}`);
    const manager  = new GoogleAIFileManager(this.apiKey);
    const genAI    = new GoogleGenerativeAI(this.apiKey);

    try {
      fs.writeFileSync(tempPath, file.buffer);

      const upload = await manager.uploadFile(tempPath, {
        mimeType: file.mimetype,
        displayName: file.originalname,
      });

      let uploaded = upload.file;
      let tries = 0;
      while (uploaded.state === FileState.PROCESSING && tries < 30) {
        await new Promise(r => setTimeout(r, 2000));
        uploaded = await manager.getFile(uploaded.name);
        tries++;
      }

      if (uploaded.state !== FileState.ACTIVE) {
        throw new Error(`File not ready: ${uploaded.state}`);
      }

      const model  = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
      const result = await model.generateContent([
        { fileData: { mimeType: file.mimetype, fileUri: uploaded.uri } },
        prompt,
      ]);

      try { await manager.deleteFile(uploaded.name); } catch {  }
      return result.response.text();
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {  }
    }
  }

  private static async extractText(file: Express.Multer.File): Promise<string> {
    const mimeType = file.mimetype;

    if (mimeType === 'application/pdf') {
      const result = await (pdfParse as unknown as (buf: Buffer) => Promise<{ text: string }>)(file.buffer);
      return result.text.slice(0, 5000);
    }

    if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value.slice(0, 5000);
    }

    if (
      mimeType.includes('presentationml') ||
      mimeType.includes('spreadsheetml') ||
      mimeType.includes('ms-powerpoint') ||
      mimeType.includes('ms-excel')
    ) {
      const text = await new Promise<string>((resolve, reject) => {
        officeParser.parseOffice(file.buffer, (ast: any, err?: any) => {
          if (err) reject(err);
          else resolve(ast?.toString() ?? '');
        });
      });
      return text.slice(0, 5000);
    }

    if (
      mimeType === 'text/plain' ||
      mimeType === 'text/csv'   ||
      mimeType === 'application/json' ||
      mimeType === 'text/html'  ||
      mimeType === 'text/xml'
    ) {
      return file.buffer.toString('utf-8').slice(0, 5000);
    }

    return '';
  }

  static async generateTags(file: Express.Multer.File): Promise<string[]> {
    try {
      const mimeType = file.mimetype;
      const sizeMB   = file.size / 1024 / 1024;
      const ext      = file.originalname.split('.').pop()?.toLowerCase() || '';

      if (mimeType.startsWith('image/')) {
        const base64 = file.buffer.toString('base64');
        const message = new HumanMessage({
          content: [
            {
              type: 'text',
              text: `Analyze this image and generate 10-20 SEARCHABLE English tags.
These tags will be used by users to find this file later by typing search terms.
Every tag must be something a user would realistically type when searching.

PRIORITY CATEGORIES — always include what applies:

IF the image contains an ANIMAL or PET:
  species     → cat, dog, bird, rabbit, hamster, fish, parrot...
  breed/type  → british shorthair, tabby, persian, golden retriever, husky, budgie...
  color(s)    → gray, orange, black, white, brown, cream, striped, spotted, bicolor, calico...
  behavior    → sitting, sleeping, lying down, running, eating, playing, jumping, stretching, yawning...
  gaze        → looking at camera, looking away, eyes closed, looking up, looking sideways...
  pose        → curled up, upright, on back, standing, crouching...
  features    → fluffy, shorthair, longhair, amber eyes, blue eyes, green eyes, big ears, bushy tail...
  environment → indoor, outdoor, sofa, floor, bed, grass, window, table, basket...

IF the image contains an OBJECT or ITEM:
  what it is  → phone, laptop, book, car, cup, keyboard, bag, chair...
  color       → red, blue, black, white, silver, wooden, metallic...
  material    → wood, plastic, leather, glass, fabric, metal...
  state       → open, closed, new, old, used, empty, full...

IF the image contains a PERSON:
  appearance  → man, woman, child, elderly, young...
  action      → walking, sitting, smiling, working, reading...
  setting     → office, street, indoor, outdoor, park...

STRICT RULES:
- NEVER include: photo, image, picture, beautiful, cute, adorable, lovely, nice, animal, pet, mammal, nature, creature (all too generic/useless for search)
- Be SPECIFIC: write "british shorthair" not just "cat"; write "looking at camera" not "eyes"; write "gray" not "light colored"
- Include BOTH the general AND specific: for a gray tabby include "cat", "tabby", "gray", "striped"
- Max 20 tags — quality over quantity

Return ONLY lowercase comma-separated tags, nothing else.
Filename hint: "${file.originalname}"`,
            },
            { type: 'image_url', image_url: `data:${mimeType};base64,${base64}` },
          ],
        });

        const response = await this.aiModel.invoke([message]);
        return this.mergeWithFilename(
          this.parseTags(response.content.toString(), ['image', 'photo']),
          file,
        );
      }


      if (mimeType.startsWith('video/')) {
        let rawTags: string;

        if (sizeMB <= MAX_INLINE_SIZE_MB) {

          rawTags = await this.analyzeMediaWithFilesAPI(
            file,
            `Analyze this video and generate 15-20 specific English tags.

Cover:
1. What is happening — actions, events, activities
2. People / animals / objects featured
3. Setting / location / environment
4. Mood / tone / atmosphere
5. Colors / visual style
6. Type of video — tutorial, vlog, gameplay, meeting, lecture, film, sport, personal…
7. Technical — camera angle, quality, style

Also add: video, ${ext}, recording, footage, clip.

Return ONLY comma-separated English tags, nothing else.`,
          );
        } else {

          const msg = new HumanMessage({
            content: `Generate 15-18 specific English tags for this video file based on its filename.
File: "${file.originalname}" (${sizeMB.toFixed(0)} MB, ${ext.toUpperCase()})
Extract ALL meaningful words. Add: video, ${ext}, recording, footage, clip.
Return ONLY comma-separated tags.`,
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
            `Analyze this audio and generate 12-18 specific English tags.

Cover:
1. Type — music, speech, podcast, lecture, interview, sound effect, voice memo, meeting…
2. If music — genre, mood, tempo, instruments, vocals style
3. If speech — topic, language style, professional/casual, subject matter
4. Mood / emotion — calm, energetic, tense, uplifting, sad, focused…
5. Quality / style — studio, live, recorded, lo-fi, professional…
6. Keywords from content — any notable words, topics, or themes

Also add: audio, ${ext}, sound, recording.

Return ONLY comma-separated English tags, nothing else.`,
          );
        } else {
          const msg = new HumanMessage({
            content: `Generate 12-15 specific English tags for this audio file based on its filename.
File: "${file.originalname}" (${sizeMB.toFixed(0)} MB, ${ext.toUpperCase()})
Extract ALL meaningful words. Add: audio, ${ext}, sound, recording.
Return ONLY comma-separated tags.`,
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
          content: `Analyze this document and generate 15-25 highly specific English tags based on the ACTUAL CONTENT.

Cover:
1. DOCUMENT TYPE — report, invoice, resume, contract, tutorial, thesis, notes…
2. MAIN TOPIC — primary subject in 1-3 specific words
3. KEY CONCEPTS — recurring themes and ideas
4. DOMAIN / INDUSTRY — finance, medical, legal, software, education, engineering…
5. NAMED ENTITIES — names, organizations, tools, products, technologies, places
6. TECHNICAL TERMS — field-specific terminology
7. AUDIENCE — student, developer, manager, researcher…
8. PURPOSE — analysis, tutorial, summary, invoice, specification, guide…
9. TIME PERIOD — year, semester, quarter if mentioned

Return ONLY comma-separated English tags, nothing else.

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
        content: `Generate 8-12 English tags for this file based on its filename.
Extract every meaningful word. Include file type and infer context.
Return ONLY comma-separated tags.
Filename: ${file.originalname}`,
      });
      const res = await this.aiModel.invoke([msg]);
      return this.mergeWithFilename(this.parseTags(res.content.toString(), ['file']), file);

    } catch (error) {
      console.error('AI tag error:', error);
      const fallback = this.extractFilenameWords(file.originalname);
      const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
      return [...new Set([...fallback, ext, 'file'])].filter(Boolean).slice(0, 15);
    }
  }

  private static parseTags(content: string, fallback: string[]): string[] {
    const tags = content
      .toString()
      .replace(/\n/g, ',')
      .split(',')
      .map(t => t.trim().toLowerCase().replace(/[^a-z0-9\s\-]/g, '').trim())
      .filter(t => t.length > 1 && t.length < 40 && !t.includes(':'));
    return tags.length > 0 ? [...new Set(tags)].slice(0, 25) : fallback;
  }

  static getModel(): ChatGoogleGenerativeAI {
    return this.aiModel;
  }
}
